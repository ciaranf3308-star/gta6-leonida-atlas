/**
 * On-demand building enrichment — the executor (DESIGN-ADDENDUM §2).
 *
 * Cache first, paid call second, queue third, never a guess (§2.3,
 * §5.3): a fresh-enough cached row is served without a model call and
 * without touching the call counter; a miss with no key queues a
 * ResearchRequest (fulfilled developer-side, with citations, or
 * marked unanswerable — never answered from training data); a miss
 * with a key makes exactly one model call and stores the result
 * before rendering.
 *
 * The hard line (§2.4) is enforced here, not in the UI:
 * - a field with no citation is dropped at write time;
 * - a field the model flags as contradicting a verified/approximate
 *   record is stored `conflicted` and quarantined — the verified
 *   record wins, always, and the field is never shown as a fact;
 * - two independent sources (distinct hosts) lift a field to
 *   `corroborated` (evidence kind `approximate`);
 * - NOTHING AI-produced ever becomes `verified` — there is no code
 *   path in this module that yields that status.
 *
 * `Evidence` carries no id (§2.4's `conflictWith` names "the id of
 * the Evidence entry", but game-db's Evidence has none), so a
 * conflict names the winning record by its `sourceTitle` — the only
 * stable identifier the record has — and the UI resolves it back to
 * the record of that title. Recorded here so a later lane adding
 * Evidence ids can switch the match without changing the contract.
 */
import { atlasRepository } from '../../db/repository';
import type { ResearchRequest } from '../../domain/album';
import {
  ENRICHMENT_FRESH_DAYS,
  ENRICHMENT_SCHEMA_VERSION,
  ENRICHMENT_TIER2_KINDS,
  isEnrichmentFresh,
  type Enrichment,
  type EnrichmentField,
  type EnrichmentFieldKind,
} from '../../domain/enrichment';
import type { Evidence } from '../../domain/game-db';
import { ASK_TIMEOUT_MS, DEFAULT_ASK_MODEL } from '../ask/openai';

export const ENRICHMENT_FIELD_KINDS: readonly EnrichmentFieldKind[] = [
  'identity',
  'purpose',
  'shop-category',
  'accessibility',
  'interior',
  'loot',
  'vehicle-loot',
  'opportunities',
];

/** A field is only an answer at or above this confidence (§2.4). */
export const ENRICHMENT_CONFIDENCE_FLOOR = 0.6;

export function enrichmentIdFor(locationId: string, schemaVersion = ENRICHMENT_SCHEMA_VERSION): string {
  return `enr:${locationId}:${schemaVersion}`;
}

/** "Updated 12 Nov 2026" — the freshness display's date. */
export function formatResearchDate(researchedAt: string): string {
  const parsed = Date.parse(researchedAt);
  if (!Number.isFinite(parsed)) return 'unknown date';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed));
}

/**
 * Whole days since the research ran (floor). 90 days is the
 * fresh-enough boundary (§2.3): 89 days is fresh, 90 days is stale.
 */
export function daysSinceResearch(researchedAt: string, nowIso: string): number | null {
  const researched = Date.parse(researchedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(researched) || !Number.isFinite(now)) return null;
  return Math.floor((now - researched) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Store (injectable so unit tests run without IndexedDB)
// ---------------------------------------------------------------------------

export interface EnrichmentStore {
  getEnrichment(id: string): Promise<Enrichment | undefined>;
  saveEnrichment(enrichment: Enrichment): Promise<void>;
  /** Latest player correction touching this location, if any — a
   *  correction invalidates the cached enrichment (§2.3: the new
   *  fact outranks the old guess). */
  getLocationChangedAt(locationId: string): Promise<string | null>;
  getQueuedResearchRequest(targetId: string): Promise<ResearchRequest | undefined>;
  saveResearchRequest(request: ResearchRequest): Promise<void>;
}

export const dexieEnrichmentStore: EnrichmentStore = {
  async getEnrichment(id) {
    return atlasRepository.enrichments.get(id);
  },
  async saveEnrichment(enrichment) {
    await atlasRepository.enrichments.put(enrichment);
  },
  async getLocationChangedAt(locationId) {
    const corrections = await atlasRepository.corrections
      .where('locationId')
      .equals(locationId)
      .toArray();
    let latest: string | null = null;
    for (const correction of corrections) {
      if (!latest || correction.at > latest) latest = correction.at;
    }
    return latest;
  },
  async getQueuedResearchRequest(targetId) {
    return atlasRepository.researchRequests
      .where('targetId')
      .equals(targetId)
      .filter((request) => request.status === 'queued')
      .first();
  },
  async saveResearchRequest(request) {
    await atlasRepository.researchRequests.put(request);
  },
};

// ---------------------------------------------------------------------------
// Field validation — the write-time gate (§2.4)
// ---------------------------------------------------------------------------

export interface RawEnrichmentField {
  kind?: unknown;
  text?: unknown;
  confidence?: unknown;
  sources?: unknown;
  /** Source title of a verified/approximate record this field
   *  contradicts, as declared by the model. Validated against the
   *  location's real evidence — a name that matches nothing is
   *  ignored, never trusted. */
  conflictsWith?: unknown;
}

function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isValidSource(value: unknown): value is { title: string; url: string; quote: string } {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.title === 'string' &&
    source.title.trim().length > 0 &&
    typeof source.url === 'string' &&
    source.url.trim().length > 0 &&
    typeof source.quote === 'string' &&
    source.quote.trim().length > 0
  );
}

/**
 * Validate raw model fields into storable fields. A field with no
 * citation is dropped — it is never stored, never shown. Text over
 * 280 chars is truncated at the bound (the type's contract); a
 * confidence outside 0–1 drops the field. Returns the surviving
 * fields with their post-run status already applied.
 */
export function validateEnrichmentFields(
  rawFields: readonly RawEnrichmentField[],
  verifiedEvidence: readonly Evidence[],
): EnrichmentField[] {
  const winningTitles = new Set(
    verifiedEvidence
      .filter((entry) => entry.kind !== 'ai-suggested')
      .map((entry) => entry.sourceTitle),
  );
  const fields: EnrichmentField[] = [];
  for (const raw of rawFields) {
    if (!raw || typeof raw !== 'object') continue;
    if (
      typeof raw.kind !== 'string' ||
      !(ENRICHMENT_FIELD_KINDS as readonly string[]).includes(raw.kind)
    )
      continue;
    if (typeof raw.text !== 'string' || raw.text.trim().length === 0) continue;
    if (
      typeof raw.confidence !== 'number' ||
      !Number.isFinite(raw.confidence) ||
      raw.confidence < 0 ||
      raw.confidence > 1
    )
      continue;
    if (!Array.isArray(raw.sources)) continue;
    const sources = raw.sources.filter(isValidSource).map((source) => ({
      title: source.title.trim(),
      url: source.url.trim(),
      quote: source.quote.trim(),
    }));
    // No citation, no field — the §2.4 write-time drop.
    if (sources.length === 0) continue;
    const text =
      raw.text.trim().length > 280 ? `${raw.text.trim().slice(0, 277)}…` : raw.text.trim();
    const declaredConflict =
      typeof raw.conflictsWith === 'string' && raw.conflictsWith.trim().length > 0
        ? raw.conflictsWith.trim()
        : undefined;
    // A declared conflict only counts when it names a real winning
    // record. The verified record wins, always — the field is
    // quarantined, never shown as a fact, never promoted.
    if (declaredConflict && winningTitles.has(declaredConflict)) {
      fields.push({
        kind: raw.kind as EnrichmentFieldKind,
        text,
        confidence: raw.confidence,
        sources,
        status: 'conflicted',
        conflictWith: declaredConflict,
      });
      continue;
    }
    // Two independent sources (distinct hosts) corroborate the field
    // to `approximate` — the same tier as a guide lead (§2.4).
    const hosts = new Set(sources.map((source) => sourceHost(source.url)).filter(Boolean));
    const corroborated = hosts.size >= 2;
    fields.push({
      kind: raw.kind as EnrichmentFieldKind,
      text,
      confidence: raw.confidence,
      sources,
      status: corroborated ? 'corroborated' : 'ai-suggested',
      ...(corroborated ? { corroboratedBy: sources[1]!.title } : {}),
    });
  }
  return fields;
}

/**
 * Re-apply the conflict quarantine to already-stored fields (e.g.
 * after the location's verified record changed). A field whose
 * `conflictWith` names a winning record stays `conflicted`; a field
 * with no live conflict keeps its status. Nothing here can produce
 * `verified` — there is no promotion path out of quarantine except
 * the underlying record changing, which invalidates the row (§2.3)
 * and forces a fresh research run.
 */
export function applyConflictQuarantine(
  fields: readonly EnrichmentField[],
  verifiedEvidence: readonly Evidence[],
): EnrichmentField[] {
  const winningTitles = new Set(
    verifiedEvidence
      .filter((entry) => entry.kind !== 'ai-suggested')
      .map((entry) => entry.sourceTitle),
  );
  return fields.map((field) => {
    if (field.status === 'conflicted') return field;
    if (field.conflictWith && winningTitles.has(field.conflictWith)) {
      return { ...field, status: 'conflicted' };
    }
    return field;
  });
}

export const RESEARCH_TIER2_KINDS: readonly EnrichmentFieldKind[] = ENRICHMENT_TIER2_KINDS;

/** Tier 1 (what the building IS) vs tier 2 (what you can DO / TAKE
 *  there, behind "Show gameplay details", §2.2). */
export function splitEnrichmentTiers(fields: readonly EnrichmentField[]): {
  tier1: EnrichmentField[];
  tier2: EnrichmentField[];
} {
  const tier2 = new Set<EnrichmentFieldKind>(RESEARCH_TIER2_KINDS);
  return {
    tier1: fields.filter((field) => !tier2.has(field.kind)),
    tier2: fields.filter((field) => tier2.has(field.kind)),
  };
}

// ---------------------------------------------------------------------------
// Research flow
// ---------------------------------------------------------------------------

export interface ResearchBuildingInput {
  locationId: string;
  /** Display name for the prompt. Never invented — the place's own title. */
  placeTitle: string;
  category?: string;
  region?: string;
  description?: string;
  /** The location's verified/approximate evidence, for conflict
   *  detection and so the model can cite the winning record. */
  verifiedEvidence: readonly Evidence[];
  /** The exact question the user asked, if any. */
  question?: string | null;
  /** The user's own OpenAI key. Empty = no key (never faked). */
  apiKey: string;
  /** "Research again" — skip the cache on purpose (§2.3: the only
   *  way to spend a second call while a row is fresh). */
  force?: boolean;
  nowIso?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  store?: EnrichmentStore;
}

export type ResearchBuildingOutcome =
  | {
      status: 'cached';
      enrichment: Enrichment;
      /** A cache hit never spends a call — the counter is untouched. */
      callsMade: false;
    }
  | { status: 'researched'; enrichment: Enrichment; callsMade: true }
  | {
      status: 'no-key';
      /** The queued request, if one was created or already existed. */
      queuedRequestId: string | null;
      /** A stale cached row, if one exists — shown with its date,
       *  never presented as fresh. */
      enrichment: Enrichment | null;
    }
  | { status: 'error'; message: string; enrichment: Enrichment | null };

function buildResearchSystemPrompt(verifiedEvidence: readonly Evidence[]): string {
  const verified =
    verifiedEvidence.length === 0
      ? '(no verified record for this building yet)'
      : verifiedEvidence
          .map(
            (entry) =>
              `- [${entry.kind}] ${entry.sourceTitle} (${entry.sourceUrl || 'no URL'})`,
          )
          .join('\n');
  return [
    'You are a research assistant inside a GTA 6 map app. Research ONE building from published guides only.',
    'Rules:',
    '1. Every field you return MUST cite at least one published source (title + URL + an exact quote from that source). A field you cannot cite must be omitted entirely — never guess, never answer from memory.',
    '2. Keep each field text to 280 characters or fewer.',
    '3. Give a confidence from 0 to 1 for each field. Below 0.6 means you were not sure.',
    '4. The verified records for this building are listed below. If a claim of yours CONTRADICTS one of them, set conflictsWith to that record\'s exact source title. The verified record wins — your field will be shown only as a conflict, never as a fact. Do not silently overwrite a verified record.',
    '5. Return ONLY JSON: {"fields": [{"kind": "identity|purpose|shop-category|accessibility|interior|loot|vehicle-loot|opportunities", "text": "...", "confidence": 0.8, "sources": [{"title": "...", "url": "...", "quote": "..."}], "conflictsWith": "<source title, only when rule 4 applies>"}]}.',
    `Verified records:\n${verified}`,
  ].join('\n');
}

function buildResearchUserPrompt(input: ResearchBuildingInput): string {
  const lines = [
    `Building: ${input.placeTitle}`,
    input.category ? `In-game category: ${input.category}` : null,
    input.region ? `Region: ${input.region}` : null,
    input.description ? `What the map already says: ${input.description.slice(0, 500)}` : null,
    input.question ? `The player's question: ${input.question}` : null,
  ].filter((line): line is string => line !== null);
  return lines.join('\n');
}

interface ResearchModelResponse {
  fields?: RawEnrichmentField[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callResearchModel(
  input: ResearchBuildingInput,
): Promise<{ fields: RawEnrichmentField[]; usage?: Enrichment['usage'] }> {
  const apiKey = input.apiKey.trim();
  const model = input.model?.trim() || DEFAULT_ASK_MODEL;
  const timeoutMs = input.timeoutMs ?? ASK_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  try {
    const response = await (input.fetchImpl ?? fetch)('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildResearchSystemPrompt(input.verifiedEvidence) },
          { role: 'user', content: buildResearchUserPrompt(input) },
        ],
      }),
      signal: timeoutController.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Research failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}. Nothing was stored.`,
      );
    }
    const parsed: unknown = await response.json();
    const content =
      (parsed as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
        ?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Research returned no answer. Nothing was stored.');
    }
    let data: ResearchModelResponse;
    try {
      data = JSON.parse(content) as ResearchModelResponse;
    } catch {
      throw new Error('Research returned an answer the app could not read. Nothing was stored.');
    }
    const usageRaw = (parsed as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
      .usage;
    return {
      fields: Array.isArray(data.fields) ? data.fields : [],
      usage:
        usageRaw &&
        typeof usageRaw.prompt_tokens === 'number' &&
        typeof usageRaw.completion_tokens === 'number'
          ? {
              promptTokens: usageRaw.prompt_tokens,
              completionTokens: usageRaw.completion_tokens,
            }
          : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The on-demand flow (§2.2–§2.3). Explicit tap only — this function
 * is never called on card open, map pan, or in bulk.
 */
export async function researchBuilding(
  input: ResearchBuildingInput,
): Promise<ResearchBuildingOutcome> {
  const store = input.store ?? dexieEnrichmentStore;
  const nowIso = input.nowIso ?? new Date().toISOString();
  const id = enrichmentIdFor(input.locationId);
  const cached = await store.getEnrichment(id);
  const locationChangedAt = await store.getLocationChangedAt(input.locationId);
  // Cache first: a fresh-enough row is served with no model call and
  // no counter change. "Research again" (force) is the only way to
  // spend a second call while the row is fresh.
  if (cached && !input.force && isEnrichmentFresh(cached, nowIso, locationChangedAt)) {
    return { status: 'cached', enrichment: cached, callsMade: false };
  }
  // No key, no guess: queue the request (cache-or-queue, §5.3) and
  // say so honestly. The queue is fulfilled developer-side with
  // citations, or marked unanswerable — never answered from memory.
  if (!input.apiKey.trim()) {
    const existing = await store.getQueuedResearchRequest(input.locationId).catch(() => undefined);
    if (existing) {
      return { status: 'no-key', queuedRequestId: existing.id, enrichment: cached ?? null };
    }
    const request: ResearchRequest = {
      id: `req:${crypto.randomUUID()}`,
      targetType: 'location',
      targetId: input.locationId,
      question: (input.question ?? 'Research this building').slice(0, 200),
      requestedAt: nowIso,
      status: 'queued',
    };
    try {
      await store.saveResearchRequest(request);
      return { status: 'no-key', queuedRequestId: request.id, enrichment: cached ?? null };
    } catch {
      return { status: 'no-key', queuedRequestId: null, enrichment: cached ?? null };
    }
  }
  let result: { fields: RawEnrichmentField[]; usage?: Enrichment['usage'] };
  try {
    result = await callResearchModel(input);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Research could not run.',
      enrichment: cached ?? null,
    };
  }
  const fields = validateEnrichmentFields(result.fields, input.verifiedEvidence);
  const enrichment: Enrichment = {
    id,
    locationId: input.locationId,
    schemaVersion: ENRICHMENT_SCHEMA_VERSION,
    researchedAt: nowIso,
    researchedBy: input.model?.trim() || DEFAULT_ASK_MODEL,
    fields,
    imagery: [],
    question: input.question ?? null,
    ...(result.usage ? { usage: result.usage } : {}),
    // One paid call, counted once: the old row's count + 1 (a stale
    // row keeps its history; a first research starts at 1).
    researchCalls: (cached?.researchCalls ?? 0) + 1,
  };
  await store.saveEnrichment(enrichment);
  return { status: 'researched', enrichment, callsMade: true };
}

/** Fresh-enough, from the addendum's rule — for the UI's freshness
 *  line. Stale rows are still shown (with their date), never hidden. */
export function freshnessLabel(
  enrichment: Enrichment,
  nowIso: string,
  locationChangedAt: string | null = null,
): { fresh: boolean; label: string } {
  const fresh = isEnrichmentFresh(enrichment, nowIso, locationChangedAt);
  const date = formatResearchDate(enrichment.researchedAt);
  if (fresh) {
    return {
      fresh: true,
      label: `Last checked ${date} — still fresh, no new research call needed.`,
    };
  }
  const days = daysSinceResearch(enrichment.researchedAt, nowIso);
  const reason =
    enrichment.schemaVersion !== ENRICHMENT_SCHEMA_VERSION
      ? 'the research format changed since this ran'
      : locationChangedAt && Date.parse(locationChangedAt) > Date.parse(enrichment.researchedAt)
        ? 'a verified record for this building changed since this ran'
        : days !== null && days >= ENRICHMENT_FRESH_DAYS
          ? `this research is ${days} days old (older than ${ENRICHMENT_FRESH_DAYS} days)`
          : 'this research is no longer fresh';
  return { fresh: false, label: `Last checked ${date} — stale: ${reason}.` };
}
