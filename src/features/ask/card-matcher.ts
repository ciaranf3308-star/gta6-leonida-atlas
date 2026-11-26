import { GTADB_REVISION } from '../street-leonida/gtadb';
import { subtreeAreaIds } from '../../domain/geography';
import type { CollectibleItem, GameDatabase, GameLocation } from '../../domain/game-db';
import type { PersonalMarker } from '../../domain/types';
import type { PersonalMatch } from '../../domain/album';
import type { AiCategoryRecord } from '../categorise/categories';
import { ASK_TIMEOUT_MS, DEFAULT_ASK_MODEL } from './openai';

/**
 * The card matcher (CARD-MATCHER-DESIGN.md) — deterministic first,
 * LLM last, auto-accept NEVER.
 *
 * The problem: 480 checklist slots, 40 pinned, 440 area-known. Each
 * area-known slot carries a lorenzone.fr direction ("· Xero, Omega
 * Pkwy · microwave") + an areaLead + a conflict note (or null). The
 * matcher proposes a host building for a slot; the player confirms
 * with one tap in Collections, and only then does the pin exist.
 *
 * Passes, in order, per slot:
 * - D1 exact host name: the direction names a host whose title
 *   appears in the catalogue in the same area. Confidence 0.95, no
 *   LLM call.
 * - D2 chain kind + area: the direction names a chain (RON / Xero /
 *   247 / Globe Oil / lifeguard station / diner) and exactly one
 *   catalogue record in the named area is typed as the matching kind
 *   — by its GTADB tags, or by the AI index. Exactly one → 0.8.
 *   Two or more → the slot goes to the LLM with the candidates listed.
 * - D3 same-street named record: the direction is a street +
 *   micro-spot and exactly one named residential record sits on that
 *   street in the area. 0.7 — the weakest deterministic pass, always
 *   needing confirmation.
 * - LLM last: temperature 0, JSON mode, gpt-4o-mini, the player's key.
 *   The prompt contains NO coordinates — the model chooses one listed
 *   candidate or "none". Confidence < 0.6 is "not sure" and is never
 *   attempted.
 *
 * A slot is never re-run with the same inputs: each slot carries an
 * attempt fingerprint (catalogue rev + resolver version + prompt
 * version + hash of the candidate host ids). An unchanged fingerprint
 * means no paid call, ever.
 *
 * Confirmed matches are written twice: on-device (Dexie cardMatches)
 * and shipped data (backup → merged-cards.json → generator). Pins
 * follow host ids (M3). A rejected (slot, host) pair is never
 * re-proposed (M4). The VCH review data (vch-links.ts) is LINK-ONLY
 * and is never an input here — the matcher works from the checklist's
 * own lorenzone directions, not from the murky-licence review.
 */

export const MATCHER_RESOLVER_VERSION = 1;
export const MATCHER_PROMPT_VERSION = 1;
export const MATCHER_BATCH_SIZE = 8;
/** Below this a proposal is "not sure" and is never attempted. */
export const MATCHER_MIN_CONFIDENCE = 0.6;

export type MatchPass = 'D1' | 'D2' | 'D3' | 'llm';

export interface MatchCandidate {
  hostId: string;
  hostName: string;
  areaName: string | null;
  /** The guide area and the host area agree (host area is the guide
   *  area or one of its descendants). */
  areaAgrees: boolean;
  /** How the type was established: a GTADB tag, the AI index, or the
   *  catalogue title naming the host. */
  typeEvidence: 'tag' | 'ai' | 'title';
  typeLabel: string;
  typeConfidence: number;
  /** The host sits on the street the direction names. */
  onStreet: boolean;
  /** Which deterministic pass produced this candidate. */
  pass: MatchPass;
}

export interface MatchProposal {
  slotId: string;
  hostId: string;
  hostName: string;
  confidence: number;
  reasoning: string;
  proposedBy: 'deterministic' | 'llm';
  candidate: MatchCandidate;
  /** One line: "both say Downtown" or the mismatch, in plain words. */
  areaCheck: string;
  conflictNote: string | null;
  /** The direction verbatim, with its citation. */
  direction: string;
  directionSourceTitle: string;
  directionSourceUrl: string;
}

export interface MatcherAttempt {
  /** `${slotId}::${fingerprint}` — one attempt per slot per inputs. */
  id: string;
  slotId: string;
  fingerprint: string;
  /** ISO UTC. */
  at: string;
  result: 'proposed' | 'not-sure' | 'none' | 'error';
  proposedHostId?: string;
  confidence?: number;
  reasoning?: string;
  proposedBy?: 'deterministic' | 'llm';
  error?: string;
}

export interface MatcherRejection {
  /** `${slotId}::${hostId}`. */
  id: string;
  slotId: string;
  hostId: string;
  /** ISO UTC. */
  rejectedAt: string;
}

export function rejectionKey(slotId: string, hostId: string): string {
  return `${slotId}::${hostId}`;
}

export function attemptId(slotId: string, fingerprint: string): string {
  return `${slotId}::${fingerprint}`;
}

// ---------------------------------------------------------------------------
// Direction parsing
// ---------------------------------------------------------------------------

export interface ParsedDirection {
  /** First "·" segment — the host token or the street. */
  firstSegment: string;
  /** Second "·" segment — the micro-spot ("garage", "microwave"). */
  microSpot: string | null;
  /** Street token if the first segment names one ("Grace Ave",
   *  "SW 3rd Ave", "I-97"), else null. */
  street: string | null;
}

const STREET_SUFFIX = '(?:Ave|Av|St|Blvd|Pkwy|Rd|Dr|Cir|Cswy|Ct|Ln|Way|Pl|Ter)';
const STREET_RE = new RegExp(
  `\\b([A-Za-z0-9][\\w'’.\\-]* (?:[A-Za-z0-9][\\w'’.\\-]* ){0,2}${STREET_SUFFIX})\\b`,
);
const HIGHWAY_RE = /\b(?:I|SR|US)-\d+\b/;

export function parseDirection(direction: string): ParsedDirection {
  const segments = direction
    .split('·')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const firstSegment = segments[0] ?? '';
  const microSpot = segments[1] ?? null;
  const streetMatch = firstSegment.match(STREET_RE) ?? firstSegment.match(HIGHWAY_RE);
  return {
    firstSegment,
    microSpot,
    street: streetMatch ? streetMatch[1] ?? streetMatch[0] : null,
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shortName(locationName: string): string {
  return locationName.split(',')[0]?.trim() ?? locationName;
}

function wordIn(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);
}

/** True when the guide area and the host area agree: the host area is
 *  the guide area or one of its descendants. A null guide area can
 *  never agree — the area check is impossible, so no deterministic
 *  proposal may rely on it. */
export function areaAgrees(
  db: GameDatabase,
  guideAreaId: string | null,
  hostAreaId: string | null,
): boolean {
  if (guideAreaId === null || hostAreaId === null) return false;
  if (guideAreaId === hostAreaId) return true;
  return subtreeAreaIds(db.areas, guideAreaId).has(hostAreaId);
}

export function areaCheckLine(
  db: GameDatabase,
  slot: CollectibleItem,
  host: GameLocation,
): string {
  const guideArea = slot.areaId ? (db.areas.get(slot.areaId)?.name ?? null) : null;
  const hostArea = host.areaId ? (db.areas.get(host.areaId)?.name ?? null) : null;
  if (guideArea !== null && hostArea !== null && areaAgrees(db, slot.areaId, host.areaId)) {
    return guideArea === hostArea
      ? `Both say ${guideArea}.`
      : `Guide says ${guideArea}, host is in ${hostArea} — inside ${guideArea}.`;
  }
  if (guideArea === null) return 'The guide names no area for this card.';
  if (hostArea === null) return `Guide says ${guideArea}; the host has no area in the map data.`;
  return `Guide says ${guideArea}, but this building is in ${hostArea} — the areas disagree.`;
}

// ---------------------------------------------------------------------------
// Chains (D2)
// ---------------------------------------------------------------------------

interface ChainDefinition {
  key: string;
  label: string;
  /** Whole words that name the chain in a direction. */
  titleWords: string[];
  /** GTADB tags that type a record as this kind. */
  tags: string[];
  /** AI-index test: aiCategory + shopType. */
  aiCategory: string;
  aiShopType: RegExp;
  typeLabel: string;
}

const CHAINS: readonly ChainDefinition[] = [
  {
    key: 'ron',
    label: 'RON',
    titleWords: ['ron'],
    tags: ['#gas'],
    aiCategory: 'petrol',
    aiShopType: /gas|petrol/i,
    typeLabel: 'RON gas station',
  },
  {
    key: 'xero',
    label: 'Xero',
    titleWords: ['xero'],
    tags: ['#gas'],
    aiCategory: 'petrol',
    aiShopType: /gas|petrol/i,
    typeLabel: 'Xero gas station',
  },
  {
    key: 'globe-oil',
    label: 'Globe Oil',
    titleWords: ['globe'],
    tags: ['#gas'],
    aiCategory: 'petrol',
    aiShopType: /gas|petrol/i,
    typeLabel: 'Globe Oil gas station',
  },
  {
    key: '247',
    label: '247',
    titleWords: ['247'],
    tags: ['#supermarket', 'retail'],
    aiCategory: 'shop',
    aiShopType: /supermarket|convenience/i,
    typeLabel: '247 supermarket',
  },
  {
    key: 'lifeguard',
    label: 'lifeguard station',
    titleWords: ['lifeguard'],
    tags: ['leisure'],
    aiCategory: 'leisure',
    aiShopType: /lifeguard/i,
    typeLabel: 'lifeguard station',
  },
  {
    key: 'diner',
    label: 'diner',
    titleWords: ['diner'],
    tags: ['restaurant'],
    aiCategory: 'restaurant',
    aiShopType: /diner|restaurant/i,
    typeLabel: 'diner',
  },
];

/**
 * The chain/type word for a direction, or null. Scans EVERY segment
 * of the direction — the host is not always the first segment: the
 * lifeguard directions read "· South beach · lifeguard station",
 * where the first segment is the beach and the type is second. The
 * exactly-one rule in D2 guards against a coincidental word in the
 * spot segment; the chain word alone never proposes a host.
 */
function chainForDirection(direction: string): ChainDefinition | null {
  const segments = direction
    .split(/[·•]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const segment of segments) {
    for (const chain of CHAINS) {
      if (chain.titleWords.some((word) => wordIn(segment, word))) return chain;
    }
  }
  return null;
}

function aiRecordMatchesChain(
  record: AiCategoryRecord | undefined,
  chain: ChainDefinition,
): boolean {
  if (!record) return false;
  if (record.status === 'unsure') return false;
  const category = record.userCategory ?? record.aiCategory;
  if (category !== chain.aiCategory) return false;
  if (record.confidence < 0.6) return false;
  const shopType = record.userShopType ?? record.shopType ?? '';
  // 'petrol' / 'leisure' / 'restaurant' categories type the kind
  // on their own; 'shop' needs the shopType to say which shop.
  if (chain.aiCategory !== 'shop') return true;
  return chain.aiShopType.test(shopType);
}

// ---------------------------------------------------------------------------
// Candidate construction
// ---------------------------------------------------------------------------

export interface MatcherDeps {
  /** The AI index (placeId → record) — D2's second typing source. */
  aiCategories?: ReadonlyMap<string, AiCategoryRecord>;
  /** Rejected (slot, host) pairs — never re-proposed (M4). */
  rejections?: ReadonlySet<string>;
}

const BUSINESS_TAGS = new Set([
  'retail',
  '#gas',
  '#supermarket',
  'restaurant',
  'hotel',
  'office',
  '#bar',
  '#hair',
  '#clothes',
  '#airport',
  '#marina',
  '#bus',
  '#train',
  '#metromover',
]);

function isResidential(location: GameLocation): boolean {
  if (!location.name || location.nameUncertain) return false;
  if (!location.tags.includes('residential')) return false;
  return !location.tags.some((tag) => BUSINESS_TAGS.has(tag));
}

function toCandidate(
  db: GameDatabase,
  slot: CollectibleItem,
  host: GameLocation,
  pass: MatchPass,
  typeEvidence: MatchCandidate['typeEvidence'],
  typeLabel: string,
  typeConfidence: number,
  onStreet: boolean,
): MatchCandidate {
  return {
    hostId: host.id,
    hostName: host.name ?? host.id,
    areaName: host.areaId ? (db.areas.get(host.areaId)?.name ?? null) : null,
    areaAgrees: areaAgrees(db, slot.areaId, host.areaId),
    typeEvidence,
    typeLabel,
    typeConfidence,
    onStreet,
    pass,
  };
}

/**
 * Every host the deterministic passes can name for this slot, in
 * pass order, deduplicated — the candidate pool the LLM also sees.
 * Rejected (slot, host) pairs are excluded here, never downstream.
 */
export function candidateHostsForSlot(
  db: GameDatabase,
  slot: CollectibleItem,
  deps: MatcherDeps = {},
): MatchCandidate[] {
  const aiCategories = deps.aiCategories ?? new Map();
  const rejections = deps.rejections ?? new Set<string>();
  const rejected = (hostId: string): boolean => rejections.has(rejectionKey(slot.id, hostId));
  const parsed = parseDirection(slot.pickups[0]?.direction ?? '');
  const byId = new Map<string, MatchCandidate>();
  const add = (candidate: MatchCandidate): void => {
    if (rejected(candidate.hostId)) return;
    const existing = byId.get(candidate.hostId);
    if (!existing) byId.set(candidate.hostId, candidate);
  };

  // D1 — exact host name in the same area.
  const hostToken = parsed.firstSegment.split(',')[0]?.trim() ?? '';
  const isStreet = parsed.street !== null && normalize(parsed.street) === normalize(hostToken);
  const chain = chainForDirection(slot.pickups[0]?.direction ?? '');
  const areaNames = new Set(
    [...db.areas.values()].map((area) => normalize(area.name)),
  );
  if (
    hostToken.length >= 4 &&
    !isStreet &&
    chain === null &&
    !areaNames.has(normalize(hostToken))
  ) {
    for (const location of db.locations.values()) {
      if (!location.name || location.nameUncertain) continue;
      const short = normalize(shortName(location.name));
      const full = normalize(location.name);
      if (short !== normalize(hostToken) && full !== normalize(hostToken)) continue;
      if (areaAgrees(db, slot.areaId, location.areaId)) {
        add(
          toCandidate(db, slot, location, 'D1', 'title', 'Named host', 0.95, false),
        );
      } else {
        // The host exists, in a DIFFERENT area — the conflict case
        // (e.g. lorenzone says Downtown, the Sahara Arena is in
        // Shoreline). Deterministic passes never propose it, but the
        // LLM sees it with the mismatch flagged, and the review screen
        // shows the area check either way. Never silently dropped.
        add(
          toCandidate(db, slot, location, 'llm', 'title', 'Named host', 0.95, false),
        );
      }
    }
  }

  // D2 — chain kind + area. Exactly one typed record in the area is
  // the deterministic proposal; two or more go to the LLM. The
  // candidates are listed either way — the caller decides.
  if (chain !== null && slot.areaId !== null) {
    const inArea = subtreeAreaIds(db.areas, slot.areaId);
    for (const location of db.locations.values()) {
      if (!location.areaId || !inArea.has(location.areaId)) continue;
      if (rejected(location.id)) continue;
      const title = location.name ?? '';
      const namesChain =
        title !== '' &&
        chain.titleWords.some((word) => wordIn(title, word));
      const titledOtherChain =
        title !== '' &&
        !namesChain &&
        CHAINS.some(
          (other) =>
            other.key !== chain.key &&
            other.titleWords.some((word) => wordIn(title, word)),
        );
      if (titledOtherChain) continue;
      const tagTyped = chain.tags.some((tag) => location.tags.includes(tag));
      const aiTyped = aiRecordMatchesChain(aiCategories.get(location.id), chain);
      // A titled record must name the chain (a #gas Xero is not a
      // RON); an unnamed "?" record counts on its AI typing alone.
      // A title naming the chain types the kind by itself (a "RON Gas
      // Station" is a RON), weaker than a tag (0.8) but real.
      if (title !== '' && !namesChain && !aiTyped) continue;
      if (!tagTyped && !aiTyped && !namesChain) continue;
      const typeEvidence = tagTyped ? 'tag' : aiTyped ? 'ai' : 'title';
      const typeConfidence = tagTyped
        ? 0.95
        : aiTyped
          ? (aiCategories.get(location.id)?.confidence ?? 0.6)
          : 0.8;
      add(
        toCandidate(
          db,
          slot,
          location,
          'D2',
          typeEvidence,
          chain.typeLabel,
          typeConfidence,
          parsed.street !== null &&
            normalize(title).includes(normalize(parsed.street)),
        ),
      );
    }
  }

  // D3 — same-street named residential record in the area.
  if (parsed.street !== null && slot.areaId !== null) {
    const inArea = subtreeAreaIds(db.areas, slot.areaId);
    const street = normalize(parsed.street);
    for (const location of db.locations.values()) {
      if (!location.areaId || !inArea.has(location.areaId)) continue;
      if (!isResidential(location)) continue;
      if (!normalize(location.name ?? '').includes(street)) continue;
      add(
        toCandidate(db, slot, location, 'D3', 'title', 'House on the named street', 0.7, true),
      );
    }
  }

  return [...byId.values()];
}

/**
 * The deterministic verdict for one slot: a proposal when exactly one
 * candidate survives a pass with the area agreeing, otherwise the
 * reason it stops here (the LLM pass takes it from there).
 */
export function resolveSlotDeterministically(
  db: GameDatabase,
  slot: CollectibleItem,
  deps: MatcherDeps = {},
): { proposal: MatchProposal | null; candidates: MatchCandidate[]; status: 'proposed' | 'ambiguous' | 'none' } {
  const candidates = candidateHostsForSlot(db, slot, deps);
  const direction = slot.pickups[0];
  const base = {
    slotId: slot.id,
    conflictNote: slotConflictNote(slot),
    direction: direction?.direction ?? '',
    directionSourceTitle: direction?.sourceTitle ?? '',
    directionSourceUrl: direction?.sourceUrl ?? '',
  };
  // Passes in order; the first pass with exactly one area-agreeing
  // candidate wins. A pass with two or more is ambiguous — the LLM
  // decides between them, the matcher never picks at random.
  for (const pass of ['D1', 'D2', 'D3'] as const) {
    const agreeing = candidates.filter(
      (candidate) => candidate.pass === pass && candidate.areaAgrees,
    );
    if (agreeing.length === 1) {
      const candidate = agreeing[0]!;
      const host = db.locations.get(candidate.hostId)!;
      const confidence = pass === 'D1' ? 0.95 : pass === 'D2' ? 0.8 : 0.7;
      return {
        proposal: {
          ...base,
          hostId: candidate.hostId,
          hostName: candidate.hostName,
          confidence,
          reasoning: reasoningFor(candidate),
          proposedBy: 'deterministic',
          candidate,
          areaCheck: areaCheckLine(db, slot, host),
        },
        candidates,
        status: 'proposed',
      };
    }
  }
  return {
    proposal: null,
    candidates,
    status: candidates.length > 1 ? 'ambiguous' : 'none',
  };
}

function reasoningFor(candidate: MatchCandidate): string {
  if (candidate.pass === 'D1')
    return `Only ${candidate.hostName} in the named area matches the direction's host name.`;
  if (candidate.pass === 'D2')
    return `Only ${candidate.typeLabel} in the named area${candidate.typeEvidence === 'ai' ? ' (typed by the AI index)' : ''}.`;
  return 'Only named house on the named street in the area.';
}

/** The checklist slot's conflict note, if any — shown, never hidden. */
export function slotConflictNote(slot: CollectibleItem): string | null {
  return slot.conflict;
}

// ---------------------------------------------------------------------------
// Fingerprint — never re-pay for unchanged inputs
// ---------------------------------------------------------------------------

function djb2Hex(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function attemptFingerprint(
  slotId: string,
  candidateHostIds: readonly string[],
  llmAvailable = true,
): string {
  const hosts = [...candidateHostIds].sort().join(',');
  // Key availability is part of the inputs: a slot attempted without
  // a key never had its LLM pass, so a later keyed run must not read
  // the keyless attempt as "already tried with these inputs".
  return [
    GTADB_REVISION.slice(0, 7),
    `r${MATCHER_RESOLVER_VERSION}`,
    `p${MATCHER_PROMPT_VERSION}`,
    djb2Hex(`${slotId}|${hosts}`),
    ...(llmAvailable ? [] : ['nokey']),
  ].join(':');
}

// ---------------------------------------------------------------------------
// LLM pass — last resort, JSON mode, no coordinates, ever
// ---------------------------------------------------------------------------

export function buildMatcherLlmPrompt(
  db: GameDatabase,
  slot: CollectibleItem,
  candidates: readonly MatchCandidate[],
): string {
  const setName = slot.setId ? (db.sets.get(slot.setId)?.name ?? slot.setId) : 'Unset';
  const areaName = slot.areaId ? (db.areas.get(slot.areaId)?.name ?? slot.areaId) : 'Unknown area';
  const lines = [
    `Card: ${slot.name}${slot.variant ? ` (${slot.variant})` : ''} — ${setName} set.`,
    `Direction (verbatim, lorenzone.fr): ${slot.pickups[0]?.direction ?? 'No direction on file.'}`,
    `Guide area: ${areaName}.`,
  ];
  const conflict = slotConflictNote(slot);
  if (conflict) lines.push(`Conflict note (the sources disagree — do not hide it): ${conflict}`);
  lines.push('Candidate hosts (choose ONE, or "none"):');
  for (const candidate of candidates.slice(0, 8)) {
    lines.push(
      `- ${candidate.hostId}: ${candidate.hostName} — ${candidate.typeLabel} (${candidate.typeEvidence === 'tag' ? 'GTADB tag' : candidate.typeEvidence === 'ai' ? `AI-suggested, ${Math.round(candidate.typeConfidence * 100)}% sure` : 'catalogue title'}), area ${candidate.areaName ?? 'unknown'}${candidate.areaAgrees ? '' : ' — AREA DISAGREES WITH THE GUIDE'}${candidate.onStreet ? ', on the named street' : ''}.`,
    );
  }
  lines.push(
    'Rules: choose the host the direction most likely means, or "none" if none fits or two fit equally. Never invent a host. Never output coordinates — there are none in this prompt and none in your answer. Confidence below 0.6 means "not sure".',
    'Answer as JSON only: {"choice": "<host id or none>", "confidence": 0-1, "reasoning": "one line"}.',
  );
  return lines.join('\n');
}

export interface MatcherLlmInput {
  db: GameDatabase;
  slot: CollectibleItem;
  candidates: readonly MatchCandidate[];
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function matchSlotWithLlm(
  input: MatcherLlmInput,
): Promise<
  | { proposal: MatchProposal; status: 'proposed' }
  | { proposal: null; status: 'not-sure' | 'none' }
> {
  const { db, slot, candidates } = input;
  const model = input.model?.trim() || DEFAULT_ASK_MODEL;
  const timeoutMs = input.timeoutMs ?? ASK_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
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
        model,
        messages: [
          {
            role: 'system',
            content:
              'You match GTA 6 trading cards to buildings. Choose one listed candidate host or "none". Never invent a host. Never output coordinates.',
          },
          { role: 'user', content: buildMatcherLlmPrompt(db, slot, candidates) },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal,
    },
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Matcher timed out after ${Math.round(timeoutMs / 1000)} seconds.`)),
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
    throw error instanceof Error ? error : new Error('Matcher request failed.');
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `OpenAI request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    // Not JSON — the checks below treat it as no answer.
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { proposal: null, status: 'none' };
  }
  const record = parsed as Record<string, unknown>;
  const choice = typeof record['choice'] === 'string' ? record['choice'] : 'none';
  const confidence =
    typeof record['confidence'] === 'number' && Number.isFinite(record['confidence'])
      ? record['confidence']
      : 0;
  const reasoning = typeof record['reasoning'] === 'string' ? record['reasoning'] : '';
  if (choice === 'none' || confidence < MATCHER_MIN_CONFIDENCE) {
    return { proposal: null, status: 'not-sure' };
  }
  const candidate = candidates.find((entry) => entry.hostId === choice);
  if (!candidate) return { proposal: null, status: 'none' };
  const host = db.locations.get(candidate.hostId)!;
  // An LLM proposal for an area-disagreeing host is capped — the
  // area check is on the review screen either way (M1).
  const capped = candidate.areaAgrees
    ? Math.min(1, confidence)
    : Math.min(0.7, confidence);
  const direction = slot.pickups[0];
  return {
    proposal: {
      slotId: slot.id,
      hostId: candidate.hostId,
      hostName: candidate.hostName,
      confidence: capped,
      reasoning: reasoning || 'Chosen by the matcher from the listed candidates.',
      proposedBy: 'llm',
      candidate,
      areaCheck: areaCheckLine(db, slot, host),
      conflictNote: slotConflictNote(slot),
      direction: direction?.direction ?? '',
      directionSourceTitle: direction?.sourceTitle ?? '',
      directionSourceUrl: direction?.sourceUrl ?? '',
    },
    status: 'proposed',
  };
}

// ---------------------------------------------------------------------------
// One slot, end to end — deterministic first, LLM last, fingerprint-gated
// ---------------------------------------------------------------------------

export interface MatchSlotDeps extends MatcherDeps {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** The slot's latest attempt, if any — an unchanged fingerprint
   *  means no re-run, ever (no paid call for the same inputs). */
  latestAttempt?: MatcherAttempt | null;
}

export type MatchSlotResult =
  | { status: 'proposed'; proposal: MatchProposal; attempt: MatcherAttempt }
  | { status: 'not-sure' | 'none' | 'skipped'; attempt: MatcherAttempt }
  | { status: 'error'; attempt: MatcherAttempt };

export async function matchSlot(
  db: GameDatabase,
  slot: CollectibleItem,
  deps: MatchSlotDeps = {},
): Promise<MatchSlotResult> {
  const candidates = candidateHostsForSlot(db, slot, deps);
  const fingerprint = attemptFingerprint(
    slot.id,
    candidates.map((candidate) => candidate.hostId),
    deps.apiKey?.trim() ? true : false,
  );
  const at = new Date().toISOString();
  if (deps.latestAttempt && deps.latestAttempt.fingerprint === fingerprint) {
    return {
      status: 'skipped',
      attempt: {
        id: attemptId(slot.id, fingerprint),
        slotId: slot.id,
        fingerprint,
        at,
        result: deps.latestAttempt.result,
        proposedHostId: deps.latestAttempt.proposedHostId,
        confidence: deps.latestAttempt.confidence,
        reasoning: deps.latestAttempt.reasoning,
        proposedBy: deps.latestAttempt.proposedBy,
      },
    };
  }
  const deterministic = resolveSlotDeterministically(db, slot, deps);
  if (deterministic.proposal) {
    return {
      status: 'proposed',
      proposal: deterministic.proposal,
      attempt: {
        id: attemptId(slot.id, fingerprint),
        slotId: slot.id,
        fingerprint,
        at,
        result: 'proposed',
        proposedHostId: deterministic.proposal.hostId,
        confidence: deterministic.proposal.confidence,
        reasoning: deterministic.proposal.reasoning,
        proposedBy: 'deterministic',
      },
    };
  }
  if (candidates.length === 0 || !deps.apiKey?.trim()) {
    return {
      status: 'none',
      attempt: {
        id: attemptId(slot.id, fingerprint),
        slotId: slot.id,
        fingerprint,
        at,
        result: 'none',
      },
    };
  }
  try {
    const llm = await matchSlotWithLlm({
      db,
      slot,
      candidates,
      apiKey: deps.apiKey,
      model: deps.model,
      fetchImpl: deps.fetchImpl,
      signal: deps.signal,
      timeoutMs: deps.timeoutMs,
    });
    if (llm.proposal) {
      return {
        status: 'proposed',
        proposal: llm.proposal,
        attempt: {
          id: attemptId(slot.id, fingerprint),
          slotId: slot.id,
          fingerprint,
          at,
          result: 'proposed',
          proposedHostId: llm.proposal.hostId,
          confidence: llm.proposal.confidence,
          reasoning: llm.proposal.reasoning,
          proposedBy: 'llm',
        },
      };
    }
    return {
      status: llm.status,
      attempt: {
        id: attemptId(slot.id, fingerprint),
        slotId: slot.id,
        fingerprint,
        at,
        result: llm.status,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      attempt: {
        id: attemptId(slot.id, fingerprint),
        slotId: slot.id,
        fingerprint,
        at,
        result: 'error',
        error: error instanceof Error ? error.message : 'Matcher request failed.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// What a confirmed match becomes (CARD-MATCHER-DESIGN §2.3)
// ---------------------------------------------------------------------------

export function buildPersonalMatch(
  proposal: MatchProposal,
  slot: CollectibleItem,
): PersonalMatch {
  const direction = slot.pickups[0];
  return {
    slotId: slot.id,
    hostId: proposal.hostId,
    confidence: proposal.confidence,
    reasoning: proposal.reasoning,
    citations: [
      {
        sourceTitle: direction?.sourceTitle ?? 'lorenzone.fr · GTA 6 Trading Cards checklist',
        sourceUrl: direction?.sourceUrl ?? '',
        catalogueRecordId: proposal.hostId,
        snapshotRev: GTADB_REVISION,
      },
    ],
    proposedBy: proposal.proposedBy,
    confirmedBy: 'player',
    confirmedAt: new Date().toISOString(),
    // The pin carries 'approximate' — the guide is approximate and
    // the player confirmed the HOST, not the exact shelf. Never
    // 'verified'.
    evidenceKind: 'approximate',
  };
}

/**
 * The jot flow (CARD-MATCHER-DESIGN §3): the player marks a spot
 * in-game — the path to real pins for the ~200+ micro-spots with no
 * host. The player is the source (like the Capri gym equipment, which
 * no public guide lists), so the match is evidence 'personal' and
 * bypasses the matcher entirely. The marker id IS the host id — pins
 * follow it the same way they follow a catalogue host.
 */
export function recordJot(
  slot: CollectibleItem,
  marker: PersonalMarker,
): PersonalMatch {
  return {
    slotId: slot.id,
    hostId: marker.id,
    confidence: 1,
    reasoning: 'Marked by you in-game.',
    citations: [
      {
        sourceTitle: 'Player jot — marked in-game',
        sourceUrl: '',
        catalogueRecordId: marker.id,
        snapshotRev: GTADB_REVISION,
      },
    ],
    proposedBy: 'player',
    confirmedBy: 'player',
    confirmedAt: new Date().toISOString(),
    evidenceKind: 'personal',
  };
}

// ---------------------------------------------------------------------------
// The job — batches of 8, pause/cancel between batches, per-batch save
// ---------------------------------------------------------------------------

export interface RunMatcherJobInput {
  db: GameDatabase;
  /** Unmatched slots to consider, in checklist order. */
  slots: readonly CollectibleItem[];
  aiCategories?: ReadonlyMap<string, AiCategoryRecord>;
  rejections?: ReadonlySet<string>;
  attempts: readonly MatcherAttempt[];
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  shouldPause: () => boolean;
  shouldCancel: () => boolean;
  /** Persist one finished batch (proposals as attempts + any
   *  not-sure/none/error attempts). False = storage failed: the job
   *  stops with an honest error instead of carrying on as if the
   *  batch were saved. */
  applyBatch: (attempts: MatcherAttempt[]) => Promise<boolean>;
  onProgress?: (done: number, total: number) => void;
  batchDelayMs?: number;
}

export type RunMatcherJobOutcome = 'done' | 'paused' | 'cancelled' | 'error';

export interface RunMatcherJobResult {
  outcome: RunMatcherJobOutcome;
  proposed: MatchProposal[];
  error?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runMatcherJob(
  input: RunMatcherJobInput,
): Promise<RunMatcherJobResult> {
  const total = input.slots.length;
  const latestBySlot = new Map<string, MatcherAttempt>();
  for (const attempt of input.attempts) {
    const current = latestBySlot.get(attempt.slotId);
    if (!current || attempt.at > current.at) latestBySlot.set(attempt.slotId, attempt);
  }
  const proposed: MatchProposal[] = [];
  let done = 0;
  for (let start = 0; start < input.slots.length; start += MATCHER_BATCH_SIZE) {
    if (input.shouldCancel()) return { outcome: 'cancelled', proposed };
    if (input.shouldPause()) return { outcome: 'paused', proposed };
    const batch = input.slots.slice(start, start + MATCHER_BATCH_SIZE);
    const batchAttempts: MatcherAttempt[] = [];
    for (const slot of batch) {
      // A slot already matched is never in `slots` (the caller
      // filters), so every result here is a fresh attempt or a skip.
      const result = await matchSlot(input.db, slot, {
        aiCategories: input.aiCategories,
        rejections: input.rejections,
        latestAttempt: latestBySlot.get(slot.id) ?? null,
        apiKey: input.apiKey,
        model: input.model,
        fetchImpl: input.fetchImpl,
      });
      if (result.status === 'proposed') proposed.push(result.proposal);
      if (result.status !== 'skipped') batchAttempts.push(result.attempt);
      done += 1;
      input.onProgress?.(done, total);
    }
    if (batchAttempts.length > 0) {
      const saved = await input.applyBatch(batchAttempts);
      if (!saved) {
        return {
          outcome: 'error',
          proposed,
          error:
            'The matcher results could not be saved on this device — the job stopped before this batch was recorded. Nothing was lost: the batch will be tried again.',
        };
      }
    }
    if (input.batchDelayMs !== undefined && input.batchDelayMs > 0) {
      await sleep(input.batchDelayMs);
    } else {
      await sleep(120);
    }
  }
  return { outcome: 'done', proposed };
}
