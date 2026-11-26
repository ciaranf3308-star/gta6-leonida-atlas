import {
  ASK_TIMEOUT_MS,
  buildAskSystemPrompt,
  CROSS_LAYER_KEYWORDS,
  DEFAULT_ASK_MODEL,
} from './openai';
import { NEAR_DISTANCE_UNITS, normalizeAsk } from './retrieval';
import {
  ASK_TOOL_DEFINITIONS,
  executeTool,
  type AskToolDeps,
  type AskToolName,
  type CompletionProposal,
  type SaleProposal,
  type ToolCall,
  type ToolResult,
} from './tools';
import type { GameDatabase } from '../../domain/game-db';
import type { AiCategoryRecord } from '../categorise/categories';

/**
 * Ask Nylah — intent layer (DESIGN §7.3).
 *
 * The keyword retrieval in retrieval.ts is the bug (§7.1): it can only
 * FILTER layers the question's words already named, never ADD one. The
 * intent layer replaces it with LLM function-calling: the model maps the
 * question to structured §7.2 tool calls, the tools run against the real
 * database, and a second call narrates the tool results in at most two
 * short sentences. The model NEVER answers from memory — if it cannot
 * map the question to a tool call it returns `no_tool` and the caller
 * falls back to the local deterministic finder.
 *
 * The spoiler rule is enforced in code, not by the prompt alone:
 * sanitizeToolsNarration drops any sentence naming a place or item
 * that was not in the tool results, or using the words of a layer
 * nobody asked for. What survives is shown; if nothing survives, the
 * deterministic fallback summary (built from the tool results) is
 * shown instead. Never a guessed name, never a cross-layer extra.
 *
 * BYOK, like the rest of Ask: the player's key, read fresh by the
 * caller (AskPanel re-reads it on sheet open and on every submit).
 * No key → { kind: 'no_tool' } — the finder works without one.
 */

export type AskProposal = CompletionProposal | SaleProposal;

export interface AskFocusAction {
  action: 'focus';
  locationId?: string;
  areaId?: string;
  bounds?: { west: number; east: number; south: number; north: number };
}

export type AskWithToolsResult =
  | {
      kind: 'tools';
      /** ≤2 sentences, sanitized — or the deterministic fallback summary. */
      narration: string;
      toolCalls: ToolCall[];
      results: ToolResult<unknown>[];
      /** update_completion / record_sale proposals — confirm cards, never writes. */
      proposals: AskProposal[];
      /** Location ids the answer may reveal on the map (≤120, the DOM cap). */
      revealIds: string[];
      focus: AskFocusAction | null;
    }
  | { kind: 'no_tool' }
  | { kind: 'error'; message: string };

export interface AskWithToolsInput {
  question: string;
  db: GameDatabase;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Abort a request the user abandoned (new question, panel closed). */
  signal?: AbortSignal;
  /** Total budget for router + narration — defaults to ASK_TIMEOUT_MS. */
  timeoutMs?: number;
  /**
   * Nightlife evidence for the tools path (DESIGN §7.4 case 3): the
   * user's own tags and confident AI types, keyed by Place id —
   * passed through to the tools as AskToolDeps. Without these the
   * tools-side nightlife filter sees source #tags only.
   */
  userTags?: ReadonlyMap<string, readonly string[]>;
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>;
  researchDeps?: AskToolDeps;
}

/** The router may emit at most this many independent tool calls per
 *  question. They must be independent — no call may depend on
 *  another call's result. */
export const MAX_TOOL_CALLS_PER_QUESTION = 3;

/** The 120-marker DOM cap — the answer never reveals more locations
 *  than the map can render. */
export const MAX_REVEAL_IDS = 120;

export function buildToolRouterSystemPrompt(): string {
  return [
    'You are Ask Nylah, the intent router inside a GTA 6 map app. Your ONLY job is to map the user\'s question to tool calls. You do not answer questions. You do not know any places, positions, or prices — the tools do.',
    '',
    'Rules:',
    '1. Map the question to at most 3 tool calls, all independent — no call may depend on another call\'s result. Prefer the single most direct tool.',
    '2. A question naming a card set BY NAME ("Delight dancers", "Delights", "Jack of Hearts", "flamingos") is a remaining_collectibles call with setId = the set name. Never require the word "card".',
    '3. "near X" is a proximity question: remaining_collectibles with sortNearAreaId = the area name (never areaId). "in X" is a membership question: areaId = the area name. Never pass both.',
    '4. A "where is ..." question about a collectible is remaining_collectibles with includeHints = true — ONLY when the question explicitly asks where it is. A question that does not ask where gets includeHints = false: the spot stays hidden.',
    '5. A question about workout equipment is NOT a gym question. Use kinds ["workout-equipment"], never ["gym"], unless the user asked for a gym.',
    '6. A nearby question with no anchor in the question uses anchor position {x: 0, y: 0} with radiusUnits 16384 (the whole island).',
    '7. A hint request starts at level 1 (the vaguest) unless the question says otherwise: "which area" is level 2, "which building" is level 3, "the exact spot" / "where exactly" is level 4.',
    '8. Call update_completion ONLY when the user says they found, collected, looted, discovered, or explored something. Call record_sale ONLY when the user says they sold something. Both return a proposal the player must confirm — they never write anything.',
    '9. Call research_missing ONLY when the user explicitly asks for research into something not in the map.',
    '10. Answer ONLY the kind of thing asked for. Never volunteer extras from other kinds of places — a gym question never mentions cards, a shop question never mentions loot.',
    '11. If the question cannot be mapped to a tool call with valid arguments, make NO tool call and reply with the single word: no_tool. Never answer from memory. Never guess a place, a position, a price, or a detail. A question you cannot map is a job for the local finder, not for you.',
  ].join('\n');
}

export function buildToolNarrationSystemPrompt(requestedLayerNames: readonly string[]): string {
  const base = buildAskSystemPrompt(requestedLayerNames);
  return [
    base,
    '',
    'You are narrating TOOL RESULTS, not answering from memory. The results below are the only facts you have.',
    '1. If a result is an error, say what it says in plain words — that IS the answer. ("There is no set called ..." is a complete answer.)',
    '2. If the results carry a nearest item and a distance, say the proximity verdict FIRST: the nearest is X, about N map units away — and whether that is near or far. Never call a place "near" when the distance is large.',
    '3. If a result says an item has no position yet, say so — never invent a spot, a building, or an area for it.',
    '4. Name ONLY items, places, sets, and areas that appear in the results. Never add a place from your own knowledge.',
    '5. A proposal (mark collected / mark sold) is a question for the player, not a fact — mention it only as "tap Confirm to mark it".',
    '6. At most two short sentences.',
  ].join('\n');
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ChatCompletionsResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

/**
 * One chat-completions call, with the same timeout + abort discipline
 * as askOpenAi: the timeout aborts the real fetch, and the race
 * unblocks the caller even if a fetch implementation ignores the
 * signal. Throws on network failure, non-OK status, or an empty reply.
 */
async function callChatCompletions(input: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: typeof ASK_TOOL_DEFINITIONS;
  temperature: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<ChatCompletionsResult> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), input.timeoutMs);
  const signal =
    input.signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([input.signal, timeoutController.signal]);
  const fetchPromise = (input.fetchImpl ?? fetch)(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        ...(input.tools ? { tools: input.tools, tool_choice: 'auto' } : {}),
        temperature: input.temperature,
      }),
      signal,
    },
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Ask timed out after ${Math.round(input.timeoutMs / 1000)} seconds.`)),
      input.timeoutMs,
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
      throw new Error(
        `Ask timed out after ${Math.round(input.timeoutMs / 1000)} seconds — the local map results below still work.`,
        { cause: error },
      );
    }
    throw error;
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `OpenAI request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('OpenAI returned an empty answer.');
  const toolCalls = (message.tool_calls ?? [])
    .filter((call) => call.type === 'function' && call.function?.name)
    .map((call) => ({
      id: call.id,
      name: call.function!.name!,
      arguments: call.function!.arguments ?? '{}',
    }));
  return { content: (message.content ?? '').trim(), toolCalls };
}

/** Parse one router tool call. An unparsable arguments object is a
 *  failed call, never a silent default — the narrator says so. */
function parseToolCall(
  call: { id: string; name: string; arguments: string },
): ToolCall | { error: string } {
  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(call.arguments);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { error: `The ${call.name} call had arguments that were not an object.` };
    }
    args = parsed as Record<string, unknown>;
  } catch {
    return { error: `The ${call.name} call had arguments that could not be read.` };
  }
  return { name: call.name as AskToolName, args };
}

// ---------------------------------------------------------------------------
// Scope derivation: what the tool calls asked for (for the narration
// prompt + the sanitizer). The spoiler rule needs the LAYER ids, not
// just the tool names.
// ---------------------------------------------------------------------------

const KIND_TO_LAYER: Readonly<Record<string, string>> = {
  shop: 'shops',
  'robbery-shop': 'lootable',
  'bank-job': 'loot-heists',
  'break-in': 'breakable',
  interior: 'interiors',
  gym: 'gyms',
  'workout-equipment': 'equipment',
};

function layersForKind(kind: string): string[] {
  if (kind === 'trading-card' || kind === 'flamingo' || kind === 'watch') return ['cards'];
  if (kind === 'meditation' || kind === 'magazine') return ['loot-collectibles'];
  return [];
}

export function requestedLayersForToolCalls(
  db: GameDatabase,
  toolCalls: readonly ToolCall[],
): string[] {
  const layers = new Set<string>();
  for (const call of toolCalls) {
    if (call.name === 'remaining_collectibles') {
      const setId = typeof call.args['setId'] === 'string' ? call.args['setId'] : null;
      if (setId) {
        layers.add('cards');
        const resolved =
          db.sets.get(setId) ??
          [...db.sets.values()].find((set) => set.name.toLowerCase() === setId.toLowerCase());
        if (resolved) layers.add(`cards:${resolved.id}`);
      }
      if (typeof call.args['kind'] === 'string')
        for (const layer of layersForKind(call.args['kind'])) layers.add(layer);
      if (!setId && typeof call.args['kind'] !== 'string') layers.add('cards');
    } else if (call.name === 'find_nearby_opportunities') {
      const kinds = Array.isArray(call.args['kinds'])
        ? (call.args['kinds'] as unknown[]).filter(
            (kind): kind is string => typeof kind === 'string',
          )
        : [];
      for (const kind of kinds) {
        const layer = KIND_TO_LAYER[kind];
        if (layer) layers.add(layer);
      }
    } else if (call.name === 'get_location_detail') {
      const locationId =
        typeof call.args['locationId'] === 'string' ? call.args['locationId'] : null;
      const location = locationId ? db.locations.get(locationId) : undefined;
      if (location) {
        for (const opp of db.opportunitiesByLocation.get(location.id) ?? []) {
          const layer = KIND_TO_LAYER[opp.kind];
          if (layer) layers.add(layer);
        }
        if ((db.itemsByLocation.get(location.id) ?? []).length > 0) layers.add('cards');
      }
    } else if (call.name === 'update_completion') {
      const targetId =
        typeof call.args['targetId'] === 'string' ? call.args['targetId'] : null;
      const targetType = call.args['targetType'];
      if (targetType === 'item' && targetId) {
        const item = db.items.get(targetId);
        if (item) for (const layer of layersForKind(item.kind)) layers.add(layer);
        if (item && !layers.size) layers.add('cards');
      } else if (targetType === 'opportunity' && targetId) {
        const opp = db.opportunities.get(targetId);
        if (opp) {
          const layer = KIND_TO_LAYER[opp.kind];
          if (layer) layers.add(layer);
        }
      }
    } else if (call.name === 'record_sale' || call.name === 'get_hint') {
      layers.add('cards');
    } else if (call.name === 'personal_progress') {
      layers.add('cards');
      layers.add('loot-collectibles');
    }
    // search_locations, focus_map, research_missing: no layer claim —
    // the answer names places, not kinds.
  }
  return [...layers];
}

export function layerNamesForToolCalls(
  db: GameDatabase,
  toolCalls: readonly ToolCall[],
): string[] {
  const names = new Set<string>();
  for (const call of toolCalls) {
    if (call.name === 'remaining_collectibles') {
      const setId = typeof call.args['setId'] === 'string' ? call.args['setId'] : null;
      const set = setId
        ? (db.sets.get(setId) ??
          [...db.sets.values()].find(
            (candidate) => candidate.name.toLowerCase() === setId.toLowerCase(),
          ))
        : undefined;
      names.add(set ? `${set.name} cards` : 'collectible cards');
    } else if (call.name === 'find_nearby_opportunities') {
      const kinds = Array.isArray(call.args['kinds'])
        ? (call.args['kinds'] as unknown[]).filter(
            (kind): kind is string => typeof kind === 'string',
          )
        : [];
      for (const kind of kinds) names.add(kind.replaceAll('-', ' '));
      if (call.args['nightlife'] === true) names.add('nightlife');
    } else if (call.name === 'search_locations') {
      names.add('locations');
    } else if (call.name === 'get_location_detail') {
      names.add('that location');
    } else if (call.name === 'update_completion' || call.name === 'record_sale') {
      names.add('your collection');
    } else if (call.name === 'personal_progress') {
      names.add('your progress');
    } else if (call.name === 'get_hint') {
      names.add('hints');
    }
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Allowed names: everything the tool results may name. The sanitizer
// drops sentences naming anything outside this set (plus areas, which
// are geography, not finds).
// ---------------------------------------------------------------------------

function shortName(name: string): string {
  return name.split(',')[0]?.trim() ?? name;
}

function addName(names: Set<string>, value: string | null | undefined): void {
  if (!value) return;
  const normalized = normalizeAsk(value);
  if (normalized.length >= 3) names.add(normalized);
  // Every comma segment of the name is a legitimate way to refer to
  // it — "Delights, Port Gellhorn" (first + last) is the same place
  // as "Delights, Interstate 404, Port Gellhorn" (full). Without the
  // last segment, "port" inside the allowed "Port Gellhorn" reads as
  // a mention of the place "Port, Millport" (L1984) and the sentence
  // is wrongly dropped.
  for (const segment of value.split(',')) {
    const seg = normalizeAsk(segment);
    if (seg.length >= 4) names.add(seg);
  }
}

export function allowedNamesForResults(
  db: GameDatabase,
  toolCalls: readonly ToolCall[],
  results: readonly ToolResult<unknown>[],
): Set<string> {
  const names = new Set<string>();
  // Names from the calls themselves (the thing asked about is always
  // allowed — a hint answer may name its target, a focus answer its place).
  for (const call of toolCalls) {
    const args = call.args;
    if (typeof args['setId'] === 'string') {
      const setId = args['setId'];
      const set =
        db.sets.get(setId) ??
        [...db.sets.values()].find(
          (candidate) => candidate.name.toLowerCase() === setId.toLowerCase(),
        );
      if (set) addName(names, set.name);
    }
    if (typeof args['targetId'] === 'string') {
      const item = db.items.get(args['targetId']);
      if (item) addName(names, item.name);
      const opp = db.opportunities.get(args['targetId']);
      if (opp) addName(names, opp.label);
      const location = db.locations.get(args['targetId']);
      if (location) addName(names, location.name);
    }
    if (typeof args['itemId'] === 'string') {
      const item = db.items.get(args['itemId']);
      if (item) addName(names, item.name);
    }
    if (typeof args['locationId'] === 'string') {
      const location = db.locations.get(args['locationId']);
      if (location) addName(names, location.name);
    }
    if (typeof args['areaId'] === 'string') {
      const areaId = args['areaId'];
      const area =
        db.areas.get(areaId) ??
        [...db.areas.values()].find(
          (candidate) => candidate.name.toLowerCase() === areaId.toLowerCase(),
        );
      if (area) addName(names, area.name);
    }
    if (typeof args['sortNearAreaId'] === 'string') {
      const sortNearAreaId = args['sortNearAreaId'];
      const area =
        db.areas.get(sortNearAreaId) ??
        [...db.areas.values()].find(
          (candidate) => candidate.name.toLowerCase() === sortNearAreaId.toLowerCase(),
        );
      if (area) addName(names, area.name);
    }
  }
  // Names from the results.
  for (const result of results) {
    if (!result.ok) continue;
    const data = result.data as Record<string, unknown>;
    const locations = Array.isArray(data['locations'])
      ? (data['locations'] as Record<string, unknown>[])
      : [];
    for (const row of locations) {
      if (typeof row['name'] === 'string') addName(names, row['name']);
    }
    const opportunities = Array.isArray(data['opportunities'])
      ? (data['opportunities'] as Record<string, unknown>[])
      : [];
    for (const row of opportunities) {
      if (typeof row['locationName'] === 'string') addName(names, row['locationName']);
    }
    const items = Array.isArray(data['items'])
      ? (data['items'] as Record<string, unknown>[])
      : [];
    for (const row of items) {
      if (typeof row['name'] === 'string') addName(names, row['name']);
      if (typeof row['locationName'] === 'string') addName(names, row['locationName']);
      if (typeof row['setName'] === 'string') addName(names, row['setName']);
    }
    if (typeof data['name'] === 'string') addName(names, data['name']);
    const nearest = data['nearest'];
    if (nearest !== null && typeof nearest === 'object' && !Array.isArray(nearest)) {
      const near = nearest as Record<string, unknown>;
      if (typeof near['name'] === 'string') addName(names, near['name']);
      if (typeof near['locationName'] === 'string') addName(names, near['locationName']);
    }
    const remaining = Array.isArray(data['remaining'])
      ? (data['remaining'] as Record<string, unknown>[])
      : [];
    for (const row of remaining) {
      if (typeof row['name'] === 'string') addName(names, row['name']);
    }
    if (typeof data['targetName'] === 'string') addName(names, data['targetName']);
    if (typeof data['itemName'] === 'string') addName(names, data['itemName']);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Sanitizer — the tools-path sibling of sanitizeAiNote. Same two rules,
// over tool results instead of Place records:
// - a sentence naming a place or item that was NOT in the tool results
//   is dropped (area names are geography, not finds, so they are allowed);
// - a sentence using the words of a layer nobody asked for is dropped.
// ---------------------------------------------------------------------------

export function sanitizeToolsNarration(
  narration: string,
  db: GameDatabase,
  allowedNames: ReadonlySet<string>,
  requestedLayerIds: readonly string[],
): string {
  const areaNames = new Set(
    [...db.areas.values()].map((area) => normalizeAsk(area.name)),
  );
  const sentences = narration
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const sentence of sentences) {
    const haystack = normalizeAsk(sentence);
    // Mask allowed names out of the haystack FIRST: a short name that
    // is a segment of an allowed longer name is not a leak — "port"
    // inside the allowed "Port Gellhorn" must not read as a mention
    // of the place "Port, Millport" (L1984). Without this, any
    // sentence naming Delights trips on the word "port".
    let placeHaystack = haystack;
    for (const allowed of allowedNames) {
      if (allowed.length >= 3) placeHaystack = placeHaystack.split(allowed).join(' ');
    }
    let leak = false;
    // A named place that was never in the tool results.
    for (const location of db.locations.values()) {
      if (!location.name) continue;
      const base = normalizeAsk(location.name);
      const short = normalizeAsk(shortName(location.name));
      for (const candidate of [base, short]) {
        if (candidate.length < 4 || allowedNames.has(candidate)) continue;
        // An area name is geography, not a find — "in Capri" must not
        // read as a mention of a place called Capri.
        if (areaNames.has(candidate)) continue;
        if (placeHaystack.includes(candidate)) {
          leak = true;
          break;
        }
      }
      if (leak) break;
    }
    if (leak) continue;
    // A named item that was never in the tool results. Allowed names
    // are masked out first, so "Jack of Hearts" (a set name in the
    // results) does not read as a mention of a card called Jack.
    let itemHaystack = haystack;
    for (const allowed of allowedNames) {
      if (allowed.length >= 3) itemHaystack = itemHaystack.split(allowed).join(' ');
    }
    for (const item of db.items.values()) {
      const name = normalizeAsk(item.name);
      if (name.length < 3 || allowedNames.has(name)) continue;
      if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(itemHaystack)) {
        leak = true;
        break;
      }
    }
    if (leak) continue;
    // Words of a layer nobody asked for — same map as the finder path.
    let keywordHaystack = haystack;
    for (const allowed of allowedNames) {
      for (const word of allowed.split(/[^a-z0-9]+/).filter((w) => w.length > 1)) {
        keywordHaystack = keywordHaystack.replace(
          new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
          ' ',
        );
      }
    }
    for (const [layerId, keywords] of Object.entries(CROSS_LAYER_KEYWORDS)) {
      if (requestedLayerIds.includes(layerId)) continue;
      if (layerId === 'cards' && requestedLayerIds.some((id) => id.startsWith('cards:')))
        continue;
      if (
        keywords.some((keyword) =>
          new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(
            keywordHaystack,
          ),
        )
      ) {
        leak = true;
        break;
      }
    }
    if (!leak) kept.push(sentence);
  }
  return kept.join(' ');
}

// ---------------------------------------------------------------------------
// Deterministic fallback summary — built from the tool results when the
// narration call fails or the sanitizer drops everything. Plain words,
// counts and the nearest verdict; never a guessed name.
// ---------------------------------------------------------------------------

export function fallbackSummary(
  toolCalls: readonly ToolCall[],
  results: readonly ToolResult<unknown>[],
): string {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]!;
    const call = toolCalls[i];
    if (!result.ok) {
      parts.push(result.error);
      continue;
    }
    const data = result.data as Record<string, unknown>;
    if (call?.name === 'remaining_collectibles') {
      const items = Array.isArray(data['items'])
        ? (data['items'] as Record<string, unknown>[])
        : [];
      const total = typeof data['total'] === 'number' ? data['total'] : items.length;
      const found = typeof data['found'] === 'number' ? data['found'] : 0;
      const nearest = data['nearest'];
      if (
        nearest !== null &&
        typeof nearest === 'object' &&
        !Array.isArray(nearest) &&
        typeof (nearest as Record<string, unknown>)['name'] === 'string'
      ) {
        const near = nearest as Record<string, unknown>;
        const distance = near['distanceUnits'];
        const far =
          typeof distance === 'number' && distance > NEAR_DISTANCE_UNITS;
        parts.push(
          `The nearest is ${String(near['name'])}${near['locationName'] ? `, in ${String(near['locationName'])}` : ''}${typeof distance === 'number' ? ` — about ${distance} map units away, ${far ? 'not near' : 'near'}` : ''}.`,
        );
      }
      const setName =
        items[0] && typeof items[0]['setName'] === 'string'
          ? String(items[0]['setName'])
          : null;
      parts.push(
        `${total - found} of ${total} ${setName ? `${setName} cards` : 'collectibles'} left to find.`,
      );
    } else if (call?.name === 'find_nearby_opportunities') {
      const opportunities = Array.isArray(data['opportunities'])
        ? (data['opportunities'] as Record<string, unknown>[])
        : [];
      parts.push(
        opportunities.length > 0
          ? `${opportunities.length} matching ${opportunities.length === 1 ? 'place' : 'places'} found.`
          : 'Nothing matching that in the map data.',
      );
    } else if (call?.name === 'search_locations') {
      const locations = Array.isArray(data['locations'])
        ? (data['locations'] as Record<string, unknown>[])
        : [];
      parts.push(
        locations.length > 0
          ? `${locations.length} matching ${locations.length === 1 ? 'place' : 'places'} found.`
          : 'Nothing by that name in the map data.',
      );
    } else if (call?.name === 'personal_progress') {
      if (typeof data['pct'] === 'number') {
        parts.push(`You are ${data['pct']}% through the collection.`);
      } else if (typeof data['found'] === 'number' && typeof data['total'] === 'number') {
        parts.push(`You have found ${data['found']} of ${data['total']}.`);
      }
    } else if (call?.name === 'get_hint') {
      if (typeof data['hint'] === 'string') parts.push(String(data['hint']));
    } else if (call?.name === 'update_completion' || call?.name === 'record_sale') {
      if (typeof data['confirmLabel'] === 'string')
        parts.push(`${String(data['confirmLabel'])} Tap Confirm to mark it.`);
    } else if (call?.name === 'research_missing') {
      if (typeof data['message'] === 'string') parts.push(String(data['message']));
    } else if (call?.name === 'get_location_detail') {
      if (typeof data['name'] === 'string') parts.push(`${String(data['name'])} — shown on the map.`);
    }
  }
  return parts.join(' ') || 'Nothing in the map data for that.';
}

// ---------------------------------------------------------------------------
// Reveal + proposal collection
// ---------------------------------------------------------------------------

function collectRevealIds(
  db: GameDatabase,
  results: readonly ToolResult<unknown>[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined): void => {
    if (!id || seen.has(id) || ids.length >= MAX_REVEAL_IDS) return;
    seen.add(id);
    ids.push(id);
  };
  for (const result of results) {
    if (!result.ok) continue;
    const data = result.data as Record<string, unknown>;
    const revealIds = Array.isArray(data['revealIds'])
      ? (data['revealIds'] as unknown[])
      : [];
    for (const id of revealIds) if (typeof id === 'string') add(id);
    const locations = Array.isArray(data['locations'])
      ? (data['locations'] as Record<string, unknown>[])
      : [];
    for (const row of locations)
      if (typeof row['id'] === 'string') add(row['id']);
    const opportunities = Array.isArray(data['opportunities'])
      ? (data['opportunities'] as Record<string, unknown>[])
      : [];
    for (const row of opportunities)
      if (typeof row['locationId'] === 'string') add(row['locationId']);
    // Tool results carry host NAMES, not host ids — but the map reveal
    // needs ids, and the intent layer holds the database. Resolving an
    // item's host here is not a spoiler: asking for the set IS consent
    // to show that layer, and the reveal shows only the asked scope.
    const items = Array.isArray(data['items'])
      ? (data['items'] as Record<string, unknown>[])
      : [];
    for (const row of items) {
      if (typeof row['id'] === 'string') {
        add(db.items.get(row['id'])?.locationId ?? null);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function askWithTools(input: AskWithToolsInput): Promise<AskWithToolsResult> {
  const { db, question } = input;
  const apiKey = input.apiKey.trim();
  if (!apiKey) return { kind: 'no_tool' };
  const model = input.model?.trim() || DEFAULT_ASK_MODEL;
  const totalBudget = input.timeoutMs ?? ASK_TIMEOUT_MS;
  const startedAt = Date.now();
  const remainingBudget = (): number =>
    Math.max(5_000, totalBudget - (Date.now() - startedAt));

  // 1. Route: question → tool calls (or no_tool).
  let router: ChatCompletionsResult;
  try {
    router = await callChatCompletions({
      apiKey,
      model,
      messages: [
        { role: 'system', content: buildToolRouterSystemPrompt() },
        { role: 'user', content: question },
      ],
      tools: ASK_TOOL_DEFINITIONS,
      temperature: 0,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
      timeoutMs: totalBudget,
    });
  } catch (error) {
    return {
      kind: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Ask could not reach the AI — the local map results below still work.',
    };
  }
  const knownNames = new Set<string>(ASK_TOOL_DEFINITIONS.map((def) => def.function.name));
  const rawCalls = router.toolCalls.slice(0, MAX_TOOL_CALLS_PER_QUESTION);
  if (rawCalls.length === 0 || rawCalls.some((call) => !knownNames.has(call.name))) {
    // No tool call, or the model invented a tool — either way this is
    // a job for the local finder, and the model's free text (if any)
    // is never shown: it has no map data behind it.
    return { kind: 'no_tool' };
  }
  const toolCalls: ToolCall[] = [];
  const results: ToolResult<unknown>[] = [];
  for (const raw of rawCalls) {
    const parsed = parseToolCall(raw);
    if ('error' in parsed) {
      results.push({ ok: false, error: parsed.error });
      // Keep the call list aligned with results for the fallback
      // summary — the failed call is recorded by name with no args.
      toolCalls.push({ name: raw.name as AskToolName, args: {} });
      continue;
    }
    toolCalls.push(parsed);
    results.push(
      await executeTool(db, parsed, {
        ...input.researchDeps,
        userTags: input.userTags,
        aiCategories: input.aiCategories,
      }),
    );
  }

  // 2. Narrate the tool results — ≤2 sentences, sanitized. If the
  // narration call fails, the deterministic summary is the answer:
  // the tools already ran, and their results ARE the answer.
  const requestedLayerIds = requestedLayersForToolCalls(db, toolCalls);
  const layerNames = layerNamesForToolCalls(db, toolCalls);
  const allowedNames = allowedNamesForResults(db, toolCalls, results);
  const resultsJson = JSON.stringify(results);
  const truncated = resultsJson.length > 12_000;
  let narration = fallbackSummary(toolCalls, results);
  try {
    const narrated = await callChatCompletions({
      apiKey,
      model,
      messages: [
        { role: 'system', content: buildToolNarrationSystemPrompt(layerNames) },
        {
          role: 'user',
          content: `Question: ${question}\n\nTool results (the only facts — do not add anything else):\n${truncated ? `${resultsJson.slice(0, 12_000)}\n[…truncated]` : resultsJson}`,
        },
      ],
      temperature: 0.2,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
      timeoutMs: remainingBudget(),
    });
    const cleaned = sanitizeToolsNarration(
      narrated.content,
      db,
      allowedNames,
      requestedLayerIds,
    );
    if (cleaned) narration = cleaned;
  } catch {
    // The narration is optional — the deterministic summary stands.
  }

  // 3. Proposals, reveals, focus.
  const proposals: AskProposal[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const call = toolCalls[i]!;
    const result = results[i]!;
    if (!result.ok) continue;
    if (call.name === 'update_completion' || call.name === 'record_sale') {
      proposals.push(result.data as AskProposal);
    }
  }
  let focus: AskFocusAction | null = null;
  for (let i = 0; i < results.length; i += 1) {
    const call = toolCalls[i]!;
    const result = results[i]!;
    if (call.name === 'focus_map' && result.ok) {
      const data = result.data as {
        locationId?: string;
        areaId?: string;
        bounds?: { west: number; east: number; south: number; north: number };
      };
      focus = {
        action: 'focus',
        ...(data.locationId ? { locationId: data.locationId } : {}),
        ...(data.areaId ? { areaId: data.areaId } : {}),
        ...(data.bounds ? { bounds: data.bounds } : {}),
      };
      break;
    }
  }
  return {
    kind: 'tools',
    narration,
    toolCalls,
    results,
    proposals,
    revealIds: collectRevealIds(db, results),
    focus,
  };
}
