import { ASK_TIMEOUT_MS, DEFAULT_ASK_MODEL } from './openai';
import type { CollectibleItem, GameDatabase } from '../../domain/game-db';
import type { ResearchRequest } from '../../domain/album';

/**
 * Find this card (DESIGN §7 + step-7 scope item 2) — the priority
 * answer to the app gap the user named on 2026-11-26: a fresh ChatGPT
 * session mapped hundreds of cards because it has web search; the
 * app's Ask does not.
 *
 * The button calls a web-search-enabled model (OpenAI Responses API +
 * web_search tool) on the player's key — BYOK, key on-device only in
 * localStorage 'leonida-ask-api-key', never bundled, logged, committed
 * or exported. Without a key the button is not offered (Ask works as
 * a finder only).
 *
 * The model searches live and reads the guide pages. Results return as
 * PROPOSALS with sources + confidence, never auto-placed pins — the
 * matcher confirms a proposal only via the one-tap confirmation in
 * Collections (see card-matcher.ts), never auto-accept. When search
 * finds nothing usable it queues a ResearchRequest instead.
 *
 * Cost is stated honestly in FIND_CARD_COST_COPY: no invented price,
 * just the shape of the charge (per web search, on the player's key).
 */

/** A proposal is "sure enough to show" only at or above this — the
 *  same 0.6 line the matcher uses (CARD-MATCHER-DESIGN §2.3). */
export const FIND_CARD_MIN_CONFIDENCE = 0.6;

export const FIND_CARD_BUTTON_LABEL = 'Find this card';

/** Shown next to the button, and in the proposal sheet. The price is
 *  not invented here — only the shape of the charge, which is what
 *  the player needs to decide whether to tap. */
export const FIND_CARD_COST_COPY =
  'Web search costs extra, on your key: OpenAI bills each web search separately, on top of the chat tokens, so one question can cost several searches. The result is a proposal with its sources — never a placed pin. You confirm it in Collections, or it stays unplaced.';

export interface CardProposalSource {
  title: string;
  url: string;
}

export interface CardProposal {
  itemId: string;
  /** The guide's written direction, in the model's own words
   *  (building, area, room/surface) — a lead, never a pin. */
  direction: string;
  sources: CardProposalSource[];
  /** 0–1, always >= FIND_CARD_MIN_CONFIDENCE. */
  confidence: number;
}

export type FindCardResult =
  | { kind: 'proposal'; proposal: CardProposal }
  | {
      kind: 'queued';
      requestId: string;
      message: string;
    }
  | { kind: 'no_key' }
  | { kind: 'error'; message: string };

export interface FindCardInput {
  item: CollectibleItem;
  db: GameDatabase;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Abort a request the user abandoned (sheet closed, new question). */
  signal?: AbortSignal;
  /** Bounded wait — defaults to ASK_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Where a nothing-found result is queued (Dexie researchRequests
   *  in the app; an in-memory list in tests). */
  queueResearch?: (request: ResearchRequest) => Promise<boolean>;
}

export function buildFindCardSystemPrompt(): string {
  return [
    'You are researching where a GTA 6 trading card is found, using live web search. Search the web and read the guide pages — do not answer from memory.',
    'Rules:',
    '1. Only report what a guide page actually says. Never guess a building, a room, or coordinates. Never invent a location.',
    '2. If no guide gives a usable location for this card, say so — that is a complete answer, and the app queues it for research instead.',
    '3. A direction names the BUILDING or host the card is in, plus the area and the spot inside if a guide gives them. An area alone is not a usable direction.',
    '4. End your answer with a single JSON object on its own line, and nothing after it: {"found": true or false, "direction": "the direction, or empty", "confidence": 0 to 1}.',
    '5. Confidence is how sure you are the direction names the right place: 1.0 only when two independent guides agree on the same building; 0.8 when one reputable guide gives a specific building and spot; below 0.6 when the guides disagree, or only name an area, or you had to guess.',
  ].join('\n');
}

export function buildFindCardUserPrompt(item: CollectibleItem, db: GameDatabase): string {
  const setName = item.setId ? (db.sets.get(item.setId)?.name ?? item.setId) : null;
  const areaName = item.areaId ? (db.areas.get(item.areaId)?.name ?? null) : null;
  const lines = [
    `Card: ${item.name}${item.variant ? ` (${item.variant})` : ''}${setName ? ` — ${setName} set` : ''}.`,
  ];
  if (areaName) lines.push(`Area lead the app already has: ${areaName}.`);
  if (item.areaLead) lines.push(`Guide area lead: ${item.areaLead}.`);
  if (item.spotDescription) lines.push(`Guide spot description: ${item.spotDescription}.`);
  const directions = item.pickups
    .map((pickup) => pickup.direction)
    .filter(Boolean)
    .slice(0, 2);
  for (const direction of directions) lines.push(`Guide direction on file: ${direction}`);
  lines.push(
    'The app already knows this much. Find the BUILDING or host this card is in — or say it is not published anywhere you can find.',
  );
  return lines.join('\n');
}

interface ResponsesOutputText {
  type: 'output_text';
  text: string;
  annotations?: Array<{
    type: string;
    url?: string;
    title?: string;
  }>;
}

interface ResponsesOutputItem {
  type: string;
  content?: ResponsesOutputText[];
}

function parseResponsesOutput(data: unknown): {
  text: string;
  sources: CardProposalSource[];
} {
  const output = (data as { output?: unknown })?.output;
  if (!Array.isArray(output)) return { text: '', sources: [] };
  const texts: string[] = [];
  const sources: CardProposalSource[] = [];
  const seenUrls = new Set<string>();
  for (const item of output as ResponsesOutputItem[]) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      texts.push(part.text);
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== 'url_citation' || !annotation.url) continue;
        if (seenUrls.has(annotation.url)) continue;
        seenUrls.add(annotation.url);
        sources.push({ title: annotation.title ?? annotation.url, url: annotation.url });
      }
    }
  }
  return { text: texts.join('\n').trim(), sources };
}

/** The trailing JSON object the model was instructed to end with —
 *  fenced or bare. Anything else in the text is prose, not data. */
function parseResultJson(text: string): {
  found: boolean;
  direction: string;
  confidence: number;
} | null {
  const fenced = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  const raw = fenced?.[1] ?? text.match(/\{[^{}]*"found"[^{}]*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record['found'] !== 'boolean') return null;
    if (typeof record['direction'] !== 'string') return null;
    if (typeof record['confidence'] !== 'number' || !Number.isFinite(record['confidence']))
      return null;
    return {
      found: record['found'],
      direction: record['direction'].trim(),
      confidence: record['confidence'],
    };
  } catch {
    return null;
  }
}

async function queueNothingFound(
  item: CollectibleItem,
  queueResearch: FindCardInput['queueResearch'],
): Promise<FindCardResult> {
  const request: ResearchRequest = {
    id: `rr:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    targetType: 'item',
    targetId: item.id,
    question: `Where is the ${item.name} card?`,
    requestedAt: new Date().toISOString(),
    status: 'queued',
  };
  if (!queueResearch) {
    return {
      kind: 'error',
      message:
        'Web search found nothing usable for this card, and the research queue is not available on this device — nothing was queued.',
    };
  }
  const saved = await queueResearch(request);
  if (!saved) {
    return {
      kind: 'error',
      message:
        'Web search found nothing usable for this card, and the research request could not be saved on this device — nothing was queued.',
    };
  }
  return {
    kind: 'queued',
    requestId: request.id,
    message:
      "Web search found nothing usable for this card — I've queued it for research. I'll have an answer with sources, or I'll tell you there isn't one.",
  };
}

export async function findCard(input: FindCardInput): Promise<FindCardResult> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) return { kind: 'no_key' };
  const model = input.model?.trim() || DEFAULT_ASK_MODEL;
  const timeoutMs = input.timeoutMs ?? ASK_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal =
    input.signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([input.signal, timeoutController.signal]);
  const fetchPromise = (input.fetchImpl ?? fetch)('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: buildFindCardSystemPrompt() },
        { role: 'user', content: buildFindCardUserPrompt(input.item, input.db) },
      ],
      tools: [{ type: 'web_search' }],
    }),
    signal,
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Find this card timed out after ${Math.round(timeoutMs / 1000)} seconds.`)),
      timeoutMs,
    );
    fetchPromise.then(
      () => clearTimeout(t),
      () => clearTimeout(t),
    );
  });
  let response: Response;
  try {
    response = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    clearTimeout(timer);
    if (timeoutController.signal.aborted && !(input.signal?.aborted ?? false)) {
      return {
        kind: 'error',
        message: `Find this card timed out after ${Math.round(timeoutMs / 1000)} seconds — nothing was queued.`,
      };
    }
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Find this card could not reach the web search.',
    };
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      kind: 'error',
      message: `Web search failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''} — nothing was queued.`,
    };
  }
  const data: unknown = await response.json().catch(() => null);
  const { text, sources } = parseResponsesOutput(data);
  const parsed = parseResultJson(text);
  // A usable result needs all three: the model said found, it was
  // sure enough, and it cited at least one guide page. Anything less
  // is not a proposal — it is a research request.
  if (
    parsed !== null &&
    parsed.found &&
    parsed.direction.length > 0 &&
    parsed.confidence >= FIND_CARD_MIN_CONFIDENCE &&
    sources.length > 0
  ) {
    return {
      kind: 'proposal',
      proposal: {
        itemId: input.item.id,
        direction: parsed.direction,
        sources,
        confidence: Math.min(1, parsed.confidence),
      },
    };
  }
  return queueNothingFound(input.item, input.queueResearch);
}
