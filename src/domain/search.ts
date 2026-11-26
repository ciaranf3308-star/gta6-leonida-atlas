/**
 * Search, split three ways (DESIGN §6.5, step 4).
 *
 * Three independent modes with SEPARATE state — clearing one never
 * touches the others, and clearing search never disables a layer or
 * resets a preference:
 *
 * (a) Geographical search — areas only. Typeahead over every area
 *     name + curated aliases. Exact-name first, then prefix, then
 *     typo-tolerant (edit distance ≤2 on tokens ≥4 chars). A result
 *     tap isolates the area. NO gameplay information is ever in a
 *     geo result — not a place, not a count of loot, nothing.
 * (b) Explicit POI search — locations, opportunities and items by
 *     name. Runs against the DATABASE, not the visible subset (the
 *     v0.31.3 lesson, made structural: the input is the GameDatabase,
 *     never the filtered list). Spoiler protection by the reveal
 *     rule (§3.3): a result row shows the name and kind only; tapping
 *     it reveals THAT ONE record (adds it to the reveal set) and
 *     opens its card; nothing else appears.
 * (c) Map-layer visibility — the map-filter sheet: filter toggles
 *     only, no search box inside it, no statistics, no explanatory
 *     paragraphs. (The sheet itself lives in the Layers tab; the
 *     toggles are the existing layer switches, stripped of their
 *     per-layer counts and group blurbs in step 4.)
 *
 * This module is pure: no storage, no React. The zustand slice that
 * holds the three modes' state is src/stores/search-split.ts.
 */
import type { AreaNode } from './geography';
import type { GameDatabase } from './game-db';
import { COUNTIES } from '../data/counties';

/** Geo no-match — exact string (§6.5). */
export const GEO_NO_MATCH =
  'No area called that in Leonida — try a county, city or town';

/** POI no-match — exact shape (§6.5): what was searched + nearest spelling. */
export function poiNoMatchMessage(query: string, suggestion: string | null): string {
  const trimmed = query.trim();
  return suggestion
    ? `No place called “${trimmed}” — did you mean ${suggestion}?`
    : `No place called “${trimmed}”.`;
}

/** A search matching only unpositioned records (§6.5) — with the real count. */
export function poiUnpositionedMessage(count: number): string {
  return count === 1
    ? '1 place matches — none has a map position yet'
    : `${count} places match — none has a map position yet`;
}

/** The five counties, offered on a geo no-match (§6.5). */
export function geoNoMatchCounties(): { id: string; name: string }[] {
  return COUNTIES.map((county) => ({ id: `county:${county.id}`, name: county.name }));
}

export type MatchTier = 'exact' | 'prefix' | 'typo';

function normalizeQuery(query: string): string {
  // Hyphens read as spaces ("vice dale" must find Vice-Dale
  // County); multiple spaces collapse to one.
  return query
    .trim()
    .toLowerCase()
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\s+/g, ' ');
}

/** Small Levenshtein distance (tokens are short; no dependency). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost,
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Match tier of a query against one name: exact (whole name, alias
 * or path equals the query), prefix (name, path or alias starts with
 * the query, or any token does), typo (edit distance ≤2 against a
 * token of ≥4 chars, or against the whole name). Null = no match.
 */
export function matchNameTier(query: string, name: string): MatchTier | null {
  const q = normalizeQuery(query);
  const n = normalizeQuery(name);
  if (!q || !n) return null;
  if (n === q) return 'exact';
  if (n.startsWith(q)) return 'prefix';
  for (const token of tokensOf(n)) {
    if (token.startsWith(q) && q.length >= 2) return 'prefix';
  }
  if (levenshtein(n, q) <= 2) return 'typo';
  for (const token of tokensOf(n)) {
    // A typo'd query against a long name token: "vice ciy" matches
    // the "city" token, "delites" matches "delights".
    if (token.length >= 4 && q.length >= 3 && levenshtein(token, q) <= 2) {
      return 'typo';
    }
  }
  return null;
}

export interface GeoSearchResult {
  areaId: string;
  name: string;
  /** Full path — the disambiguator when two areas share a name. */
  path: string;
  level: AreaNode['level'];
  match: MatchTier;
  /** Member count (subtree) — for the row subtitle, and the
   *  tie-break within a tier (largest area first). */
  memberCount: number;
}

const TIER_ORDER: Record<MatchTier, number> = { exact: 0, prefix: 1, typo: 2 };

/**
 * Geographical search (§6.5a): areas only, over every node in the
 * hierarchy — no 50 / 150 / top-15 restriction. Ranking is by
 * WHERE the query matched, then how close:
 *   1. name/alias tier (exact → prefix → typo) — the area's own
 *      name always outranks a match on its path, so "vice" finds
 *      Vice City before the neighbourhoods inside it;
 *   2. shortest name first, then largest member count — so
 *      "downtown" finds the 141-place Vice City Downtown before
 *      the 2-place bare Downtown;
 *   3. path tier (same order) for areas matched only by path;
 * Empty query → no results (the UI offers the five counties instead).
 */
export function searchAreas(
  nodes: ReadonlyMap<string, AreaNode>,
  query: string,
  limit = 25,
): GeoSearchResult[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const scored: {
    result: GeoSearchResult;
    nameTier: MatchTier | null;
    pathTier: MatchTier | null;
  }[] = [];
  for (const node of nodes.values()) {
    const nameTier = bestTier([node.name, ...(node.aliases ?? [])], q);
    const pathTier = matchNameTier(q, node.path);
    const best = nameTier ?? pathTier;
    if (!best) continue;
    scored.push({
      result: {
        areaId: node.id,
        name: node.name,
        path: node.path,
        level: node.level,
        match: best,
        memberCount: node.locationIds.length,
      },
      nameTier,
      pathTier,
    });
  }
  const tierRank = (tier: MatchTier | null): number =>
    tier === null ? TIER_ORDER.typo + 1 : TIER_ORDER[tier];
  scored.sort(
    (a, b) =>
      tierRank(a.nameTier) - tierRank(b.nameTier) ||
      a.result.name.length - b.result.name.length ||
      b.result.memberCount - a.result.memberCount ||
      tierRank(a.pathTier) - tierRank(b.pathTier) ||
      a.result.name.localeCompare(b.result.name) ||
      a.result.path.localeCompare(b.result.path),
  );
  return scored.slice(0, limit).map((entry) => entry.result);
}

function bestTier(candidates: readonly string[], query: string): MatchTier | null {
  let best: MatchTier | null = null;
  for (const candidate of candidates) {
    const tier = matchNameTier(query, candidate);
    if (tier && (best === null || TIER_ORDER[tier] < TIER_ORDER[best])) {
      best = tier;
    }
  }
  return best;
}

export type PoiRecordKind = 'location' | 'opportunity' | 'item';

export interface PoiSearchResult {
  /** Record id: location id, opportunity id, or item id. Tapping it
   *  reveals exactly this record — nothing else. */
  id: string;
  recordKind: PoiRecordKind;
  /** Display name — the ONLY gameplay-adjacent text on the row. */
  name: string;
  /** Kind label — the only other thing on the row. */
  kind: string;
  /** Host location to open as a card, if the record has one. */
  hostLocationId: string | null;
  /** False when the record has no map position (yet). */
  positioned: boolean;
}

export interface PoiSearchOutcome {
  results: PoiSearchResult[];
  /** Total matches before the cap — the honest count for the
   *  unpositioned message. */
  totalMatching: number;
  /** True when matches exist but none has a map position. */
  allUnpositioned: boolean;
  /** Nearest spelling, offered only when nothing matches. */
  suggestion: string | null;
}

const POI_RESULT_LIMIT = 25;

/**
 * Explicit POI search (§6.5b): locations, opportunities and items
 * by name, against the whole database — never the visible subset.
 * An opportunity matches by its host location's name or by its own
 * label; an item matches by its own name. A row shows the name and
 * kind only. Unnamed "?" records have no name to match and are
 * skipped. Ranked exact → prefix → typo, then location →
 * opportunity → item, then name.
 */
export function searchPoi(db: GameDatabase, query: string): PoiSearchOutcome {
  const q = normalizeQuery(query);
  if (!q) {
    return { results: [], totalMatching: 0, allUnpositioned: false, suggestion: null };
  }
  const ranked: { result: PoiSearchResult; tier: MatchTier; kindOrder: number }[] = [];
  const seenOpportunityNames = new Set<string>();

  for (const location of db.locations.values()) {
    if (!location.name) continue;
    const tier = matchNameTier(q, location.name);
    if (!tier) continue;
    ranked.push({
      result: {
        id: location.id,
        recordKind: 'location',
        name: location.name,
        kind: 'Place',
        hostLocationId: location.id,
        positioned: location.position !== null,
      },
      tier,
      kindOrder: 0,
    });
  }

  for (const opportunity of db.opportunities.values()) {
    const host = db.locations.get(opportunity.locationId);
    if (!host) continue;
    // Match by host name or by the opportunity's own label — never
    // by anything else (no detail, no loot, no position).
    const hostTier = host.name ? matchNameTier(q, host.name) : null;
    const labelTier = matchNameTier(q, opportunity.label);
    const tier = hostTier ?? labelTier;
    if (!tier) continue;
    // One row per (host, kind): a place with two same-kind
    // opportunities is still one result row, not a wall of dupes.
    const dedupe = `${opportunity.locationId}:${opportunity.kind}`;
    if (seenOpportunityNames.has(dedupe)) continue;
    seenOpportunityNames.add(dedupe);
    ranked.push({
      result: {
        id: opportunity.id,
        recordKind: 'opportunity',
        name: host.name ?? 'Unnamed place',
        kind: opportunityKindLabel(opportunity.kind),
        hostLocationId: host.id,
        positioned: host.position !== null,
      },
      tier,
      kindOrder: 1,
    });
  }

  for (const item of db.items.values()) {
    const tier = matchNameTier(q, item.name);
    if (!tier) continue;
    const host = item.locationId ? db.locations.get(item.locationId) : undefined;
    ranked.push({
      result: {
        id: item.id,
        recordKind: 'item',
        name: item.name,
        kind: itemKindLabel(item.kind),
        hostLocationId: item.locationId,
        positioned: host ? host.position !== null : false,
      },
      tier,
      kindOrder: 2,
    });
  }

  ranked.sort(
    (a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      a.kindOrder - b.kindOrder ||
      a.result.name.localeCompare(b.result.name) ||
      a.result.id.localeCompare(b.result.id),
  );
  const totalMatching = ranked.length;
  const results = ranked.slice(0, POI_RESULT_LIMIT).map((entry) => entry.result);
  const allUnpositioned =
    totalMatching > 0 && ranked.every((entry) => !entry.result.positioned);
  let suggestion: string | null = null;
  if (totalMatching === 0) {
    suggestion = nearestSpelling(db, q);
  }
  return { results, totalMatching, allUnpositioned, suggestion };
}

function opportunityKindLabel(kind: string): string {
  switch (kind) {
    case 'shop':
      return 'Shop';
    case 'robbery-shop':
      return 'Robbery target';
    case 'bank-job':
      return 'Bank job';
    case 'gang-op':
      return 'Gang operation';
    case 'break-in':
      return 'Break-in';
    case 'interior':
      return 'Interior';
    case 'gym':
      return 'Gym';
    case 'workout-equipment':
      return 'Workout equipment';
    case 'activity':
      return 'Activity';
    case 'vehicle-loot':
      return 'Vehicle loot';
    case 'easter-egg':
      return 'Easter egg';
    case 'mission':
      return 'Mission';
    case 'discovery':
      return 'Discovery';
    default:
      return kind;
  }
}

function itemKindLabel(kind: string): string {
  switch (kind) {
    case 'trading-card':
      return 'Trading card';
    case 'meditation':
      return 'Meditation';
    case 'magazine':
      return 'Magazine';
    case 'flamingo':
      return 'Flamingo';
    case 'waink-scan':
      return 'Waink scan';
    case 'vehicle-scan':
      return 'Vehicle scan';
    case 'animal':
      return 'Animal';
    case 'underwater':
      return 'Underwater';
    case 'watch':
      return 'Watch';
    case 'earbuds':
      return 'Earbuds';
    default:
      return 'Item';
  }
}

/**
 * Nearest spelling for a POI no-match: the closest searchable name
 * by edit distance (whole name or any token), offered only within
 * distance ≤2 — the same tolerance as typo search. Null when nothing
 * is close enough to be a useful suggestion.
 *
 * Note on the brief's example ("Did you mean Delights?" for
 * "Delites"): on this dataset "Delites" is distance 3 from
 * "Delights" but distance 2 from "Al Dentes", and it typo-matches
 * "Al Dentes" outright — so the example pair does not reproduce
 * here, and widening the tolerance to 3 would suggest the wrong
 * name. The mechanism is pinned by a real case instead ("qux" →
 * "Pawn & Gun, Port Gellhorn" via the 3-letter token "gun").
 */
export function nearestSpelling(db: GameDatabase, query: string): string | null {
  const q = normalizeQuery(query);
  if (!q) return null;
  let bestName: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const consider = (name: string | null | undefined): void => {
    if (!name) return;
    const lower = name.toLowerCase();
    const whole = levenshtein(lower, q);
    let distance = whole;
    for (const token of tokensOf(lower)) {
      distance = Math.min(distance, levenshtein(token, q));
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = name;
    }
  };
  for (const location of db.locations.values()) consider(location.name);
  for (const item of db.items.values()) consider(item.name);
  for (const opportunity of db.opportunities.values()) consider(opportunity.label);
  return bestDistance <= 2 ? bestName : null;
}

// ---------------------------------------------------------------------------
// Separate state (§6.5): three independent modes. Clearing one never
// touches the others; clearing search never disables a layer or
// resets a preference (layers live outside this state entirely, in
// the map store — these transitions cannot reach them).
// ---------------------------------------------------------------------------

export interface SearchSplitState {
  geo: { query: string };
  poi: { query: string; revealedRecordIds: readonly string[] };
}

export function createSearchSplitState(): SearchSplitState {
  return { geo: { query: '' }, poi: { query: '', revealedRecordIds: [] } };
}

/** Clear the geo query only — POI query, reveals and layers untouched. */
export function clearGeoSearch(state: SearchSplitState): SearchSplitState {
  return { ...state, geo: { query: '' } };
}

/** Clear the POI query only — geo query, reveals and layers untouched. */
export function clearPoiSearch(state: SearchSplitState): SearchSplitState {
  return { ...state, poi: { ...state.poi, query: '' } };
}

/** Clear both search queries — reveals, layers and preferences untouched. */
export function clearAllSearch(state: SearchSplitState): SearchSplitState {
  return {
    geo: { query: '' },
    poi: { ...state.poi, query: '' },
  };
}

/**
 * Reveal exactly one POI record (§3.3): the tap adds that record's
 * id to the reveal set and nothing else — no layer turns on, no
 * other record appears. Idempotent: revealing the same record twice
 * still reveals exactly one record.
 */
export function revealPoiResult(
  state: SearchSplitState,
  recordId: string,
): SearchSplitState {
  if (state.poi.revealedRecordIds.includes(recordId)) return state;
  return {
    ...state,
    poi: {
      ...state.poi,
      revealedRecordIds: [...state.poi.revealedRecordIds, recordId],
    },
  };
}
