/**
 * On-demand building intelligence — enrichment (DESIGN-ADDENDUM §2)
 * and the Ask context it plugs into (addendum §5.1) — types only.
 *
 * Mapping onto the base design: an enrichment's fields surface on the
 * `GameLocation` as `Evidence` entries of kind `'ai-suggested'` at
 * `buildGameDatabase()` time (a read-time join, same pattern as the AI
 * index, DESIGN §5). The `Enrichment` itself lives in its own Dexie
 * table; the location is never rewritten by enrichment. A corroborated
 * field becomes a second `Evidence` entry of kind `'approximate'` (two
 * independent sources) or `'personal'` (player confirmed in-game).
 * NO field ever becomes `'verified'` from AI alone.
 *
 * The hard line (§2.4): a field with no citation is dropped at write
 * time — it is never stored, never shown. The executor enforces that
 * in step 5/7; these types only carry the shape.
 */
import type { GamePosition, OverallView } from './game-db';

export type EnrichmentFieldKind =
  | 'identity' // what this building is called / is
  | 'purpose' // what it is for
  | 'shop-category' // weapons / style / food-drink / vehicles / other
  | 'accessibility' // enterable? how (door, roof, ladder)? mission-only?
  | 'interior' // what is inside, in general terms
  | 'loot' // what can be taken here (general — tier-2 gated, §2.2)
  | 'vehicle-loot' // vehicles / safes / codes on the host
  | 'opportunities'; // gameplay opportunities present (kinds only, no detail)

/** Tier 2 (what you can DO / TAKE there) — hidden behind a second
 *  explicit tap, "Show gameplay details", on that card only (§2.2).
 *  Researching a building never auto-reveals its loot. */
export const ENRICHMENT_TIER2_KINDS: readonly EnrichmentFieldKind[] = [
  'loot',
  'vehicle-loot',
  'opportunities',
];

/** One enrichment run for one location. Stored in Dexie `enrichments`.
 *  The record is the audit trail for a paid AI call — it exists so the
 *  call is never repeated and never mistaken for a fact. */
export interface Enrichment {
  /** `enr:<locationId>:<schemaVersion>` */
  id: string;
  locationId: string;
  /** Bumped when the enrichment prompt/fields change; a bump
   *  invalidates all rows of the old version at once, by key. */
  schemaVersion: number;
  /** ISO UTC. */
  researchedAt: string;
  /** Model id, e.g. 'gpt-4o-mini'. */
  researchedBy: string;
  /** Field-level results. A record is never "enriched" as a whole —
   *  each field carries its own confidence and source. */
  fields: EnrichmentField[];
  /** Imagery attached to this run (§2.5). */
  imagery: EnrichmentImage[];
  /** The exact question the user asked, if any ("what shop is this?").
   *  Null when the user tapped plain "Research this building". */
  question: string | null;
  /** Cost guard: the call's token usage, recorded for the Settings
   *  research-usage readout. */
  usage?: { promptTokens: number; completionTokens: number };
}

export interface EnrichmentField {
  kind: EnrichmentFieldKind;
  /** The AI's claim, in its own words, ≤ 280 chars per field. */
  text: string;
  /** 0–1. Below 0.6 the field is not shown as an answer at all — it
   *  is shown as "AI wasn't sure" (§2.4). */
  confidence: number;
  /** Citations are mandatory. A field with no source is dropped at
   *  write time — it is never stored, never shown. */
  sources: { title: string; url: string; quote: string }[];
  /** What happened to this field after the run. */
  status: 'ai-suggested' | 'corroborated' | 'personal' | 'conflicted';
  /** When status is 'conflicted': the id of the Evidence entry that
   *  contradicts it (the verified/approximate record that won). */
  conflictWith?: string;
  /** When status is 'corroborated' or 'personal': what corroborated it
   *  (second source title, or 'player confirmed in-game'). */
  corroboratedBy?: string;
}

export interface EnrichmentImage {
  kind: 'screenshot' | 'ai-illustration';
  /** 'screenshot': a cited guide screenshot (URL + source) or the
   *  player's own upload (local blob id). 'ai-illustration': generated
   *  on demand, labelled in the UI and in the record (§2.5). */
  url: string;
  sourceTitle: string;
  sourceUrl: string;
  /** AI illustrations only: the prompt used, so the label is honest. */
  generatedPrompt?: string;
}

/**
 * A player correction to any field on a location (or to an enrichment
 * field). The old value is kept — a correction is an audit trail,
 * not an overwrite. A correction overrides the AI-suggested field it
 * targets (status becomes 'personal') and invalidates the cached
 * enrichment for that location — the new fact outranks the old guess.
 */
export interface Correction {
  /** `cor:<uuid>` */
  id: string;
  locationId: string;
  /** e.g. 'name', 'enrichment:loot', 'opportunity:shop'. */
  field: string;
  oldText: string | null;
  newText: string;
  /** ISO UTC. */
  at: string;
  source: 'user';
}

/** Current enrichment schema version (§2.3 cache key). */
export const ENRICHMENT_SCHEMA_VERSION = 1;
/** Fresh-enough TTL (§2.3): a cached row older than this is re-run. */
export const ENRICHMENT_FRESH_DAYS = 90;
/** Shared daily budget for research actions (enrichment +
 *  `research_missing`, §2.3). A guard for the player's key, never a
 *  paywall: it never silently blocks. */
export const DAILY_RESEARCH_BUDGET = 20;

/**
 * "Fresh enough" (§2.3, normative): the row exists for the current
 * schema version, AND `researchedAt` is < 90 days old, AND no
 * verified/`approximate` record for that location has changed since
 * the row was written (`locationChangedAt`, when known — a guide
 * import or a player correction touching the location invalidates its
 * enrichment), AND the user has not tapped "Research again" (the
 * caller handles that by skipping the cache). Never repeat a paid
 * request while a fresh-enough row exists.
 */
export function isEnrichmentFresh(
  enrichment: Enrichment,
  nowIso: string,
  locationChangedAt: string | null = null,
): boolean {
  if (enrichment.schemaVersion !== ENRICHMENT_SCHEMA_VERSION) return false;
  const researchedAt = Date.parse(enrichment.researchedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(researchedAt) || !Number.isFinite(now)) return false;
  if (now - researchedAt >= ENRICHMENT_FRESH_DAYS * 24 * 60 * 60 * 1000) return false;
  if (locationChangedAt && Date.parse(locationChangedAt) > researchedAt) return false;
  return true;
}

/**
 * What the tools receive every Ask turn (addendum §5.1) — scoped,
 * never the full catalogue. A tool result never contains a record the
 * question did not ask for, and a hint result never contains a level
 * the question did not ask for.
 */
export interface AskContext {
  /** The location card currently open, if any. Follow-ups default
   *  their anchor here ("what can I do here?" = this location). */
  selectedLocationId?: string;
  /** The map's current position / area (for "near here" questions). */
  mapPosition?: GamePosition;
  areaId?: string;
  /** What the player has found vs what remains — counts + the *names*
   *  of found items in the current scope, never the full list. */
  progressSummary: {
    overall: OverallView;
    perSet: { setId: string; found: number; total: number }[];
  };
  /** The player's own words about the selected location + their 5
   *  most recent notes. Notes are the player's — they are context,
   *  never evidence for a gameplay fact. */
  notes: { locationId: string; text: string }[];
  /** Ids the player has already revealed this session (the reveal
   *  set, DESIGN §3.3) — so a follow-up does not re-gate them. */
  revealIds: string[];
}
