/**
 * Ask Nylah — structured tools (v0.32 step 7, DESIGN §7.2 + addendum §5).
 *
 * The keyword branches in retrieval.ts are the intent mechanism no
 * longer: intent is a tool call with validated arguments, executed
 * deterministically against the GameDatabase, and the LLM narrates
 * ONLY from the returned records. Tool results are the only records
 * the model may mention.
 *
 * Every tool returns `{ ok: true, data }` or `{ ok: false, error }`.
 * An unknown id, an illegal verb, or an out-of-range argument is a
 * tool error — the model is told, in plain words, that the target
 * does not exist, and it must say so to the user. It never guesses.
 *
 * SPOILER RULES (normative, DESIGN §3.5):
 * - A tool result may name an item the user asked about, but its
 *   `spotDescription` is returned only when the question explicitly
 *   asked where it is (`get_location_detail` / `remaining_collectibles`
 *   with `includeHints: true`). Otherwise the hint fields are stripped.
 * - `update_completion` / `record_sale` NEVER execute on the model's
 *   say-so alone: they return a PROPOSAL. The app renders a confirm
 *   card ("Mark Vicki — Delights Dancers as collected?") and executes
 *   only after the user taps Confirm. The tool call proposes; the user
 *   disposes. The record's `source` is 'ask'.
 * - A tool result enters the REVEAL set for the specific records
 *   returned (DESIGN §3.3) — the pin for that one record shows. No
 *   tool turns a filter on. Ask never switches layers (addendum §5.4).
 * - A hint never names a DIFFERENT record. "While you're there, the
 *   Starlet Motel also has…" is forbidden — helpful finder, never
 *   volunteering extras.
 *
 * KNOWN GAP (flagged for the coordinator): the nightlife filter in
 * `find_nearby_opportunities` uses SOURCE #tags only. The retrieval
 * finder also answers from the user's own tags and confident AI "bar"
 * types; GameDatabase carries neither, so the tools path cannot see
 * them yet. A nightclub the player tagged himself answers in the
 * local finder, not through the tools.
 */
import {
  categoryProgress,
  locationCard,
  matchingItems,
  overallProgress,
  remainingItems,
  setProgress,
  type CollectibleItem,
  type GameDatabase,
  type ItemKind,
  type OpportunityKind,
} from '../../domain/game-db';
import { matchNameTier, searchAreas } from '../../domain/search';
import { NEAR_DISTANCE_UNITS } from './retrieval';
import type { Enrichment } from '../../domain/enrichment';
import type { ResearchRequest } from '../../domain/album';

export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toolError<T>(message: string): ToolResult<T> {
  return { ok: false, error: message };
}

function toolOk<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

/** The tool names, in DESIGN §7.2 + addendum §5.5 order. */
export const ASK_TOOL_NAMES = [
  'search_locations',
  'find_nearby_opportunities',
  'remaining_collectibles',
  'personal_progress',
  'focus_map',
  'get_location_detail',
  'update_completion',
  'get_hint',
  'research_missing',
  'record_sale',
] as const;

export type AskToolName = (typeof ASK_TOOL_NAMES)[number];

export const OPPORTUNITY_KINDS: readonly OpportunityKind[] = [
  'shop',
  'robbery-shop',
  'bank-job',
  'gang-op',
  'break-in',
  'interior',
  'gym',
  'workout-equipment',
  'activity',
  'vehicle-loot',
  'easter-egg',
  'mission',
  'discovery',
];

export const ITEM_KINDS: readonly ItemKind[] = [
  'trading-card',
  'meditation',
  'magazine',
  'flamingo',
  'waink-scan',
  'vehicle-scan',
  'animal',
  'underwater',
  'watch',
  'earbuds',
  'other',
];

/** Dependencies the tools need from outside the database. Everything
 *  is injectable so the executor stays unit-testable without Dexie. */
export interface AskToolDeps {
  /** Research-when-missing (addendum §5.3): the enrichment cache. */
  findEnrichment?: (locationId: string) => Enrichment | null;
  /** Research-when-missing: queue a request for developer-side fulfilment. */
  queueResearch?: (request: ResearchRequest) => Promise<boolean>;
}

/** Resolve a set id OR a set name ("Delights Dancers", "delights")
 *  to a set id. Unknown → null (the caller turns it into a tool error). */
export function resolveSetId(db: GameDatabase, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (db.sets.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const set of db.sets.values()) {
    if (set.name.toLowerCase() === lower || set.id.toLowerCase() === lower) return set.id;
  }
  return null;
}

/** Resolve an area id OR an area name ("Port Gellhorn", "capri") to
 *  an area id. The catalogue carries county-qualified duplicates
 *  that share a name (two areas called "Port Gellhorn", two called
 *  "Capri") — the unqualified area (path === name) is the place
 *  itself and wins over the qualified duplicate; then the largest
 *  member count. A true tie between different places resolves to
 *  null — the model must ask, not guess. */
export function resolveAreaId(db: GameDatabase, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (db.areas.has(trimmed)) return trimmed;
  const matches = searchAreas(db.areas, trimmed, 10).filter(
    (result) => result.match === 'exact',
  );
  if (matches.length === 0) return null;
  const ranked = [...matches].sort(
    (a, b) =>
      (a.path === a.name ? 0 : 1) - (b.path === b.name ? 0 : 1) ||
      b.memberCount - a.memberCount,
  );
  const first = ranked[0]!;
  const second = ranked[1];
  if (
    second !== undefined &&
    (second.path === second.name ? 0 : 1) === (first.path === first.name ? 0 : 1) &&
    second.memberCount === first.memberCount
  )
    return null;
  return first.areaId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArg(args: Record<string, unknown>, key: string, max = 200): string | null {
  const value = args[key];
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) return null;
  return value.trim();
}

function intArg(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
  max: number,
): number | null {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max)
    return null;
  return value;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------------------------------------------------------------------------
// search_locations
// ---------------------------------------------------------------------------

export interface SearchLocationRow {
  id: string;
  name: string | null;
  areaName: string | null;
  kinds: string[];
  placement: string;
  position: { x: number; y: number } | null;
}

export interface SearchLocationsData {
  locations: SearchLocationRow[];
}

export function executeSearchLocations(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<SearchLocationsData> {
  const query = stringArg(args, 'query');
  if (query === null)
    return toolError('search_locations needs a query of 1–200 characters.');
  const limit = intArg(args, 'limit', 10, 30);
  if (limit === null) return toolError('search_locations limit must be between 1 and 30.');
  let areaId: string | null = null;
  if (args['areaId'] !== undefined) {
    const raw = stringArg(args, 'areaId');
    if (raw === null) return toolError('search_locations areaId must be a set id or area name.');
    areaId = resolveAreaId(db, raw);
    if (areaId === null)
      return toolError(`There is no area called "${raw}" in Leonida in the map data.`);
  }
  let kinds: OpportunityKind[] | null = null;
  if (args['kinds'] !== undefined) {
    if (!Array.isArray(args['kinds']) || args['kinds'].length === 0)
      return toolError('search_locations kinds must be a non-empty list of opportunity kinds.');
    const bad = (args['kinds'] as unknown[]).find(
      (kind): kind is string =>
        typeof kind !== 'string' ||
        !(OPPORTUNITY_KINDS as readonly string[]).includes(kind),
    );
    if (bad !== undefined)
      return toolError(
        `"${String(bad)}" is not a kind of opportunity in the map data.`,
      );
    kinds = args['kinds'] as OpportunityKind[];
  }
  const includeUnpositioned = args['includeUnpositioned'] !== false;
  const tierOrder = { exact: 0, prefix: 1, typo: 2 } as const;
  const scored: { location: SearchLocationRow; tier: number }[] = [];
  for (const location of db.locations.values()) {
    if (location.name === null) continue;
    const areaName = location.areaId ? (db.areas.get(location.areaId)?.name ?? null) : null;
    if (areaId !== null && location.areaId !== areaId) continue;
    if (!includeUnpositioned && location.position === null) continue;
    const kindsHere = [
      ...(db.opportunitiesByLocation.get(location.id) ?? []).map((opp) => opp.kind),
    ];
    if (kinds !== null && !kinds.some((kind) => kindsHere.includes(kind))) continue;
    const tier =
      matchNameTier(query, location.name) ??
      (location.tags
        .map((tag) => matchNameTier(query, tag))
        .find((match) => match !== null) ??
        null);
    if (tier === null) continue;
    scored.push({
      location: {
        id: location.id,
        name: location.name,
        areaName,
        kinds: kindsHere,
        placement: location.placement,
        position: location.position,
      },
      tier: tierOrder[tier],
    });
  }
  scored.sort((a, b) => a.tier - b.tier || (a.location.name ?? '').localeCompare(b.location.name ?? ''));
  return toolOk({ locations: scored.slice(0, limit).map((entry) => entry.location) });
}

// ---------------------------------------------------------------------------
// find_nearby_opportunities
// ---------------------------------------------------------------------------

export interface NearbyOpportunityRow {
  id: string;
  kind: string;
  label: string;
  locationId: string;
  locationName: string | null;
  areaName: string | null;
  distanceUnits: number;
  found: boolean;
}

export interface NearbyOpportunitiesData {
  opportunities: NearbyOpportunityRow[];
  /** Unpositioned matches in the scope, listed separately — never
   *  given a distance, never dropped silently. */
  unpositionedCount: number;
  unpositionedNote: string | null;
}

const NIGHTLIFE_TAGS = ['#nightclub', '#stripclub', '#bar'];

/** Tool-side nightlife evidence (DESIGN §7.4 case 3): a shop is a
 *  nightlife venue when its location carries a source #nightclub /
 *  #stripclub / #bar tag. (User tags + AI "bar" types are a known gap
 *  — see the module header.) */
export function isNightlifeLocation(location: {
  tags: readonly string[];
}): boolean {
  return location.tags.some((tag) => NIGHTLIFE_TAGS.includes(tag));
}

export function executeFindNearbyOpportunities(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<NearbyOpportunitiesData> {
  if (!Array.isArray(args['kinds']) || args['kinds'].length === 0)
    return toolError(
      'find_nearby_opportunities needs at least one opportunity kind — a question with no kind is not a nearby question.',
    );
  const badKind = (args['kinds'] as unknown[]).find(
    (kind): kind is string =>
      typeof kind !== 'string' || !(OPPORTUNITY_KINDS as readonly string[]).includes(kind),
  );
  if (badKind !== undefined)
    return toolError(`"${String(badKind)}" is not a kind of opportunity in the map data.`);
  const kinds = args['kinds'] as OpportunityKind[];
  const radius = intArg(args, 'radiusUnits', NEAR_DISTANCE_UNITS, 16384);
  if (radius === null)
    return toolError('find_nearby_opportunities radiusUnits must be between 1 and 16384.');
  const includeFound = args['includeFound'] === true;
  const nightlife = args['nightlife'] === true;

  let anchorPosition: { x: number; y: number };
  const anchor = args['anchor'];
  if (!isRecord(anchor))
    return toolError(
      'find_nearby_opportunities needs an anchor: a locationId, an areaId, or a position.',
    );
  if (typeof anchor['locationId'] === 'string') {
    const location = db.locations.get(anchor['locationId']);
    if (!location) return toolError(`There is no location "${anchor['locationId']}" in the map data.`);
    if (location.position === null)
      return toolError(
        `${location.name ?? 'That location'} has no verified position in the map data, so how far away things are from there cannot be measured.`,
      );
    anchorPosition = location.position;
  } else if (typeof anchor['areaId'] === 'string') {
    const areaId = resolveAreaId(db, anchor['areaId']);
    if (areaId === null)
      return toolError(`There is no area called "${anchor['areaId']}" in Leonida in the map data.`);
    const area = db.areas.get(areaId)!;
    if (area.bounds) {
      anchorPosition = {
        x: (area.bounds.west + area.bounds.east) / 2,
        y: (area.bounds.south + area.bounds.north) / 2,
      };
    } else {
      return toolError(
        `${area.name} has no positioned places in the map data yet, so distances from there cannot be measured.`,
      );
    }
  } else if (isRecord(anchor['position'])) {
    const position = anchor['position'];
    if (
      typeof position['x'] !== 'number' ||
      typeof position['y'] !== 'number' ||
      !Number.isFinite(position['x']) ||
      !Number.isFinite(position['y'])
    )
      return toolError('find_nearby_opportunities anchor position must have finite x and y.');
    anchorPosition = { x: position['x'], y: position['y'] };
  } else {
    return toolError(
      'find_nearby_opportunities needs an anchor: a locationId, an areaId, or a position.',
    );
  }

  const rows: NearbyOpportunityRow[] = [];
  let unpositionedCount = 0;
  for (const opportunity of db.opportunities.values()) {
    if (!kinds.includes(opportunity.kind)) continue;
    const location = db.locations.get(opportunity.locationId);
    if (!location) continue;
    if (nightlife && !isNightlifeLocation(location)) continue;
    const foundCount = db.completedOpportunityIds.get(opportunity.id) ?? 0;
    if (!includeFound && foundCount > 0) continue;
    if (location.position === null) {
      unpositionedCount += 1;
      continue;
    }
    const d = distance(location.position, anchorPosition);
    if (d > radius) continue;
    rows.push({
      id: opportunity.id,
      kind: opportunity.kind,
      label: opportunity.label,
      locationId: opportunity.locationId,
      locationName: location.name,
      areaName: location.areaId ? (db.areas.get(location.areaId)?.name ?? null) : null,
      distanceUnits: Math.round(d),
      found: foundCount > 0,
    });
  }
  rows.sort((a, b) => a.distanceUnits - b.distanceUnits);
  return toolOk({
    opportunities: rows.slice(0, 30),
    unpositionedCount,
    unpositionedNote:
      unpositionedCount > 0
        ? `${unpositionedCount} more in this scope ${unpositionedCount === 1 ? 'has' : 'have'} no position yet.`
        : null,
  });
}

// ---------------------------------------------------------------------------
// remaining_collectibles
// ---------------------------------------------------------------------------

export interface RemainingItemRow {
  id: string;
  name: string;
  variant?: string;
  setName: string | null;
  found: boolean;
  placement: string;
  locationName: string | null;
  /** Returned ONLY when includeHints is true (§3.5). */
  spotDescription?: string | null;
  areaLead?: string | null;
}

export interface RemainingCollectiblesData {
  items: RemainingItemRow[];
  total: number;
  found: number;
  /** When sortNearAreaId was given: the nearest positioned item, with
   *  its distance from the area's centroid — the honest "nearest is …"
   *  verdict, never "near" when it is far. */
  nearest?: { id: string; name: string; locationName: string | null; distanceUnits: number } | null;
  nearCount?: number;
}

export function executeRemainingCollectibles(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<RemainingCollectiblesData> {
  let setId: string | null = null;
  if (args['setId'] !== undefined) {
    const raw = stringArg(args, 'setId');
    if (raw === null) return toolError('remaining_collectibles setId must be a set id or set name.');
    setId = resolveSetId(db, raw);
    if (setId === null)
      return toolError(`There is no collectible set called "${raw}" in the map data.`);
  }
  let kind: ItemKind | null = null;
  if (args['kind'] !== undefined) {
    if (
      typeof args['kind'] !== 'string' ||
      !(ITEM_KINDS as readonly string[]).includes(args['kind'])
    )
      return toolError(`"${String(args['kind'])}" is not a kind of collectible in the map data.`);
    kind = args['kind'] as ItemKind;
  }
  let areaId: string | null = null;
  if (args['areaId'] !== undefined) {
    const raw = stringArg(args, 'areaId');
    if (raw === null) return toolError('remaining_collectibles areaId must be an area id or area name.');
    areaId = resolveAreaId(db, raw);
    if (areaId === null)
      return toolError(`There is no area called "${raw}" in Leonida in the map data.`);
  }
  // sortNearAreaId (step-7 extension to the §7.2 contract — see the
  // §7.4 case-2 note below): "near X" is a SORT, not a filter. The
  // §7.2 areaId filter and the case-2 sort are different questions
  // ("Delights Dancers in Port Gellhorn" = membership, 15 items; "…
  // near Capri" = proximity, all 18 sorted from Capri, nearest
  // named honestly). The two must never be passed together.
  let sortNearAreaId: string | null = null;
  if (args['sortNearAreaId'] !== undefined) {
    const raw = stringArg(args, 'sortNearAreaId');
    if (raw === null)
      return toolError('remaining_collectibles sortNearAreaId must be an area id or area name.');
    sortNearAreaId = resolveAreaId(db, raw);
    if (sortNearAreaId === null)
      return toolError(`There is no area called "${raw}" in Leonida in the map data.`);
    if (areaId !== null)
      return toolError(
        'remaining_collectibles takes areaId (membership) OR sortNearAreaId (proximity), not both — "near X" sorts, "in X" filters.',
      );
  }
  const includeHints = args['includeHints'] === true;
  let matching: CollectibleItem[];
  try {
    matching = matchingItems(db, {
      setId: setId ?? undefined,
      kind: kind ?? undefined,
      areaId: areaId ?? undefined,
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : 'Unknown collectible set.');
  }
  const remaining = remainingItems(db, {
    setId: setId ?? undefined,
    kind: kind ?? undefined,
    areaId: areaId ?? undefined,
  });
  // §7.4 case 5: the tool is called remaining_collectibles — a second
  // call after a find EXCLUDES the found card. `total` is the size of
  // the matching set and `found` the completed count, so the caller
  // can still say "5 of 18 found"; `items` is only what is left.
  const items: RemainingItemRow[] = remaining.map((item) => {
    const row: RemainingItemRow = {
      id: item.id,
      name: item.name,
      variant: item.variant,
      setName: item.setId ? (db.sets.get(item.setId)?.name ?? null) : null,
      // Every row here is remaining — found is always false. The
      // field stays so the row shape is stable for the narrator.
      found: false,
      placement: item.placement,
      locationName: item.locationId
        ? (db.locations.get(item.locationId)?.name ?? null)
        : null,
    };
    // §3.5: the spot is behind an explicit ask. A tool result may
    // name an item the user asked about, but its spotDescription is
    // returned only when the question explicitly asked where it is.
    if (includeHints) {
      row.spotDescription = item.spotDescription;
      row.areaLead = item.areaLead;
    }
    return row;
  });
  const data: RemainingCollectiblesData = {
    items,
    total: matching.length,
    found: matching.length - remaining.length,
  };
  if (sortNearAreaId !== null) {
    const area = db.areas.get(sortNearAreaId)!;
    if (area.bounds) {
      const centroid = {
        x: (area.bounds.west + area.bounds.east) / 2,
        y: (area.bounds.south + area.bounds.north) / 2,
      };
      const positioned = items
        .map((item) => {
          const full = db.items.get(item.id)!;
          const position = full.locationId
            ? (db.locations.get(full.locationId)?.position ?? null)
            : null;
          return position === null
            ? null
            : { item, distanceUnits: Math.round(distance(position, centroid)) };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => a.distanceUnits - b.distanceUnits);
      // Sort: positioned nearest-first, unpositioned last (they are
      // the "N more in this set with no position yet", never dropped).
      const positionedIds = new Set(positioned.map((entry) => entry.item.id));
      data.items = [
        ...positioned.map((entry) => entry.item),
        ...items.filter((item) => !positionedIds.has(item.id)),
      ];
      const nearest = positioned[0];
      data.nearest = nearest
        ? {
            id: nearest.item.id,
            name: nearest.item.name,
            locationName: nearest.item.locationName,
            distanceUnits: nearest.distanceUnits,
          }
        : null;
      data.nearCount = positioned.filter(
        (entry) => entry.distanceUnits <= NEAR_DISTANCE_UNITS,
      ).length;
    }
  }
  return toolOk(data);
}

// ---------------------------------------------------------------------------
// personal_progress
// ---------------------------------------------------------------------------

export function executePersonalProgress(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<unknown> {
  const scope = args['scope'];
  if (scope === undefined || scope === 'overall') return toolOk(overallProgress(db));
  if (typeof scope === 'string')
    return toolError('personal_progress scope must be "overall" or an object with setId or categoryId.');
  if (!isRecord(scope))
    return toolError('personal_progress scope must be "overall" or an object with setId or categoryId.');
  if (typeof scope['setId'] === 'string') {
    const setId = resolveSetId(db, scope['setId']);
    if (setId === null)
      return toolError(`There is no collectible set called "${scope['setId']}" in the map data.`);
    return toolOk(setProgress(db, setId));
  }
  if (typeof scope['categoryId'] === 'string') {
    try {
      return toolOk(categoryProgress(db, scope['categoryId']));
    } catch (error) {
      return toolError(error instanceof Error ? error.message : 'Unknown completion category.');
    }
  }
  return toolError('personal_progress scope needs a setId or a categoryId.');
}

// ---------------------------------------------------------------------------
// focus_map
// ---------------------------------------------------------------------------

export function executeFocusMap(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<{ action: 'focus'; locationId?: string; areaId?: string; bounds?: unknown }> {
  const hasLocation = typeof args['locationId'] === 'string';
  const hasArea = typeof args['areaId'] === 'string';
  const hasBounds = isRecord(args['bounds']);
  const count = [hasLocation, hasArea, hasBounds].filter(Boolean).length;
  if (count !== 1)
    return toolError('focus_map needs exactly one of locationId, areaId, or bounds.');
  if (hasLocation) {
    const locationId = args['locationId'] as string;
    if (!db.locations.has(locationId))
      return toolError(`There is no location "${locationId}" in the map data.`);
    return toolOk({ action: 'focus', locationId });
  }
  if (hasArea) {
    const areaId = resolveAreaId(db, args['areaId'] as string);
    if (areaId === null)
      return toolError(`There is no area called "${args['areaId']}" in Leonida in the map data.`);
    return toolOk({ action: 'focus', areaId });
  }
  const bounds = args['bounds'] as Record<string, unknown>;
  const numbers = ['west', 'east', 'south', 'north'].map((key) => bounds[key]);
  if (numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value)))
    return toolError('focus_map bounds need finite west, east, south and north.');
  // Validated finite above — the indexed access keeps tsc honest
  // under noUncheckedIndexedAccess.
  const west = numbers[0] as number;
  const east = numbers[1] as number;
  const south = numbers[2] as number;
  const north = numbers[3] as number;
  if (west >= east || south >= north)
    return toolError('focus_map bounds need west < east and south < north.');
  return toolOk({ action: 'focus', bounds: { west, east, south, north } });
}

// ---------------------------------------------------------------------------
// get_location_detail
// ---------------------------------------------------------------------------

export interface LocationDetailData {
  locationId: string;
  name: string | null;
  areaName: string | null;
  placement: string;
  position: { x: number; y: number } | null;
  opportunities: {
    id: string;
    kind: string;
    label: string;
    detail?: string;
    loot?: { code?: string; contents: string[] };
    repeatable: boolean;
    found: boolean;
  }[];
  items: RemainingItemRow[];
  /** The reveal set gains this id (DESIGN §3.3): calling this tool IS
   *  the explicit request for that location, so its pin shows. */
  revealIds: string[];
}

export function executeGetLocationDetail(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<LocationDetailData> {
  const locationId = stringArg(args, 'locationId');
  if (locationId === null)
    return toolError('get_location_detail needs a locationId.');
  const card = locationCard(db, locationId);
  if (card === null)
    return toolError(`There is no location "${locationId}" in the map data.`);
  const includeHints = args['includeHints'] === true;
  const location = card.location;
  return toolOk({
    locationId: location.id,
    name: location.name,
    areaName: location.areaId ? (db.areas.get(location.areaId)?.name ?? null) : null,
    placement: location.placement,
    position: location.position,
    opportunities: card.opportunities.map((opp) => ({
      id: opp.id,
      kind: opp.kind,
      label: opp.label,
      detail: opp.detail,
      loot: opp.loot,
      repeatable: opp.repeatable,
      found: (db.completedOpportunityIds.get(opp.id) ?? 0) > 0,
    })),
    items: card.items.map((item) => {
      const row: RemainingItemRow = {
        id: item.id,
        name: item.name,
        variant: item.variant,
        setName: item.setId ? (db.sets.get(item.setId)?.name ?? null) : null,
        found: db.completedItemIds.has(item.id),
        placement: item.placement,
        locationName: location.name,
      };
      if (includeHints) {
        row.spotDescription = item.spotDescription;
        row.areaLead = item.areaLead;
      }
      return row;
    }),
    revealIds: [location.id],
  });
}

// ---------------------------------------------------------------------------
// update_completion + record_sale — PROPOSALS ONLY, never writes
// ---------------------------------------------------------------------------

export type CompletionProposalVerb = 'collected' | 'looted' | 'discovered' | 'explored';

export interface CompletionProposal {
  kind: 'completion';
  verb: CompletionProposalVerb;
  targetType: 'item' | 'opportunity' | 'location';
  targetId: string;
  targetName: string;
  count: number;
  note?: string;
  /** The confirm card's label — "Mark Vicki — Delights Dancers as collected?" */
  confirmLabel: string;
  /** Shown when the target is unpositioned: the jot follow-up. */
  jotOffer: string | null;
}

const COMPLETION_VERBS: readonly string[] = ['collected', 'looted', 'discovered', 'explored'];

function verbLabel(verb: CompletionProposalVerb): string {
  if (verb === 'collected') return 'collected';
  if (verb === 'looted') return 'looted';
  if (verb === 'discovered') return 'discovered';
  return 'explored';
}

export function proposeUpdateCompletion(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<CompletionProposal> {
  const verb = args['verb'];
  if (typeof verb !== 'string' || !COMPLETION_VERBS.includes(verb))
    return toolError(
      'update_completion verb must be collected, looted, discovered, or explored.',
    );
  const targetType = args['targetType'];
  if (targetType !== 'item' && targetType !== 'opportunity' && targetType !== 'location')
    return toolError('update_completion targetType must be item, opportunity, or location.');
  const targetId = stringArg(args, 'targetId');
  if (targetId === null) return toolError('update_completion needs a targetId.');
  let targetName: string;
  let jotOffer: string | null = null;
  if (targetType === 'item') {
    const item = db.items.get(targetId);
    if (!item) return toolError(`There is no collectible item "${targetId}" in the map data.`);
    if (verb !== 'collected')
      return toolError(`A collectible item can only be marked collected, not ${verb}.`);
    if (db.completedItemIds.has(item.id))
      return toolError(`You've already got ${item.name} — it is already marked collected.`);
    targetName = `${item.name}${item.variant ? ` (${item.variant})` : ''}${item.setId ? ` — ${db.sets.get(item.setId)?.name ?? ''}` : ''}`;
    if (item.locationId === null) {
      // The jot follow-up (§7.2): the item has no position, so after
      // the find is confirmed the app asks where it was found. The
      // player's own mark is the path to a real pin for it.
      jotOffer =
        'This one has no spot in the map data yet — after confirming, mark where you found it and it becomes your pin for it.';
    }
  } else if (targetType === 'opportunity') {
    const opportunity = db.opportunities.get(targetId);
    if (!opportunity)
      return toolError(`There is no opportunity "${targetId}" in the map data.`);
    if (verb === 'collected')
      return toolError('An opportunity cannot be marked collected — only an item can.');
    if (verb === 'looted' && !opportunity.repeatable)
      return toolError(
        `${opportunity.label} cannot be marked looted — it is not a repeatable opportunity.`,
      );
    const location = db.locations.get(opportunity.locationId);
    targetName = `${opportunity.label}${location?.name ? ` — ${location.name}` : ''}`;
  } else {
    const location = db.locations.get(targetId);
    if (!location) return toolError(`There is no location "${targetId}" in the map data.`);
    if (verb === 'collected' || verb === 'looted')
      return toolError(`A location can only be marked discovered or explored, not ${verb}.`);
    targetName = location.name ?? 'An unnamed place';
  }
  let count = 1;
  if (args['count'] !== undefined) {
    if (verb === 'collected')
      return toolError('A collected item counts once — a duplicate card is not a second completion.');
    if (
      typeof args['count'] !== 'number' ||
      !Number.isInteger(args['count']) ||
      (args['count'] as number) < 1 ||
      (args['count'] as number) > 99
    )
      return toolError('update_completion count must be a whole number between 1 and 99.');
    count = args['count'] as number;
  }
  const note =
    typeof args['note'] === 'string' && args['note'].length <= 500 ? args['note'] : undefined;
  return toolOk({
    kind: 'completion',
    verb: verb as CompletionProposalVerb,
    targetType,
    targetId,
    targetName,
    count,
    note,
    confirmLabel: `Mark ${targetName} as ${verbLabel(verb as CompletionProposalVerb)}?`,
    jotOffer,
  });
}

export interface SaleProposal {
  kind: 'sale';
  itemId: string;
  itemName: string;
  /** The price the player quoted, if any — the confirm card passes
   *  it to recordSale. Without it the sale records with no price. */
  price?: number;
  confirmLabel: string;
}

export function proposeRecordSale(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<SaleProposal> {
  const itemId = stringArg(args, 'itemId');
  if (itemId === null) return toolError('record_sale needs an itemId.');
  const item = db.items.get(itemId);
  if (!item) return toolError(`There is no collectible item "${itemId}" in the map data.`);
  if (!db.completedItemIds.has(item.id))
    return toolError(
      `You have not found ${item.name} yet — selling a card you have not found is not possible.`,
    );
  const price =
    typeof args['price'] === 'number' && Number.isFinite(args['price'])
      ? args['price']
      : undefined;
  return toolOk({
    kind: 'sale',
    itemId: item.id,
    itemName: `${item.name}${item.variant ? ` (${item.variant})` : ''}`,
    ...(price === undefined ? {} : { price }),
    confirmLabel:
      price !== undefined
        ? `Mark ${item.name} as sold for $${price}? Your collection progress stays — selling never un-finds a card.`
        : `Mark ${item.name} as sold? Your collection progress stays — selling never un-finds a card.`,
  });
}

// ---------------------------------------------------------------------------
// get_hint — the progressive-hint ladder (addendum §5.2)
// ---------------------------------------------------------------------------

export interface HintData {
  level: number;
  hint: string;
  sources: { title: string; url: string }[];
  nextLevelAvailable: boolean;
  nextLevelBlockedReason?: string;
}

function hintSourcesFor(item: CollectibleItem): { title: string; url: string }[] {
  const first = item.evidence[0];
  if (!first) return [];
  return [{ title: first.sourceTitle, url: first.sourceUrl }];
}

/** Deterministic hint content per level. The executor builds the hint
 *  from the database — the model never writes hint text, so a level
 *  can never leak the next level's content. */
export function hintForItem(
  db: GameDatabase,
  item: CollectibleItem,
  level: number,
): ToolResult<HintData> {
  const sources = hintSourcesFor(item);
  if (db.completedItemIds.has(item.id))
    return toolError(`You've already got ${item.name} — there is nothing left to hint at.`);
  const setName = item.setId ? (db.sets.get(item.setId)?.name ?? null) : null;
  if (level === 1) {
    // Vague clue: name, set, flavour — NO geography at all.
    const hint = setName
      ? `A ${setName} card — ${item.name}${item.variant ? ` (${item.variant})` : ''} — is out there somewhere. The name is the only clue at this level.`
      : `${item.name} is out there somewhere. The name is the only clue at this level.`;
    return toolOk({ level: 1, hint, sources, nextLevelAvailable: true });
  }
  // Levels 2–4 need geography. An item with no area and no location
  // stops at level 2 with the honest no-location message.
  const areaName = item.areaId ? (db.areas.get(item.areaId)?.name ?? null) : null;
  if (level === 2) {
    if (areaName === null)
      return toolError(
        `Nobody's published a spot for ${item.name} yet — not even an area. Ask can queue it for research, or you can mark it yourself when you find it.`,
      );
    return toolOk({
      level: 2,
      hint: `${areaName}. That's the area — nothing more precise at this level.`,
      sources,
      nextLevelAvailable: item.locationId !== null,
      nextLevelBlockedReason:
        item.locationId !== null
          ? undefined
          : `Nobody's published a spot for ${item.name} yet — the next hint needs a location the map data does not have.`,
    });
  }
  if (item.locationId === null)
    return toolError(
      `Nobody's published a spot for ${item.name} yet — the map data has an area lead at most. Ask can queue it for research, or you can mark it yourself when you find it.`,
    );
  const host = db.locations.get(item.locationId);
  if (level === 3) {
    // Exact map location: the host + a pin (via focus_map as a
    // follow-up the user taps). No spot description, no room, no
    // surface, no access notes.
    return toolOk({
      level: 3,
      hint: `${host?.name ?? 'Its host'}${areaName ? `, ${areaName}` : ''}. That's the building — tap to show it on the map. The exact spot inside is the next hint.`,
      sources,
      nextLevelAvailable: item.spotDescription !== null || item.areaLead !== null,
      nextLevelBlockedReason:
        item.spotDescription !== null || item.areaLead !== null
          ? undefined
          : 'That is everything the map data knows about this one — no spot description was ever published for it.',
    });
  }
  // Level 4: everything the database knows.
  if (item.spotDescription === null && item.areaLead === null)
    return toolError(
      `That is everything the map data knows about ${item.name} — no spot description was ever published for it.`,
    );
  const parts = [item.areaLead, item.spotDescription].filter(Boolean);
  return toolOk({
    level: 4,
    hint: parts.join(' — '),
    sources,
    nextLevelAvailable: false,
    nextLevelBlockedReason: "That's everything we know.",
  });
}

export function executeGetHint(
  db: GameDatabase,
  args: Record<string, unknown>,
): ToolResult<HintData> {
  const level = args['level'];
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 4)
    return toolError('get_hint level must be 1, 2, 3, or 4 — no default, no inference.');
  const targetType = args['targetType'];
  if (targetType !== 'item')
    return toolError('get_hint works on collectible items — a location hint is the location card itself.');
  const targetId = stringArg(args, 'targetId');
  if (targetId === null) return toolError('get_hint needs a targetId.');
  const item = db.items.get(targetId);
  if (!item) return toolError(`There is no collectible item "${targetId}" in the map data.`);
  return hintForItem(db, item, level);
}

// ---------------------------------------------------------------------------
// research_missing — cache-or-queue (addendum §5.3)
// ---------------------------------------------------------------------------

export interface ResearchMissingData {
  status: 'cached' | 'queued';
  enrichment?: Enrichment;
  requestId?: string;
  message: string;
}

export async function executeResearchMissing(
  db: GameDatabase,
  args: Record<string, unknown>,
  deps: AskToolDeps = {},
): Promise<ToolResult<ResearchMissingData>> {
  const targetType = args['targetType'];
  if (targetType !== 'item' && targetType !== 'opportunity' && targetType !== 'location')
    return toolError('research_missing targetType must be item, opportunity, or location.');
  const targetId = stringArg(args, 'targetId');
  if (targetId === null) return toolError('research_missing needs a targetId.');
  const question = stringArg(args, 'question');
  if (question === null)
    return toolError('research_missing needs a question of 1–200 characters — what is missing.');
  const exists =
    targetType === 'item'
      ? db.items.has(targetId)
      : targetType === 'opportunity'
        ? db.opportunities.has(targetId)
        : db.locations.has(targetId);
  if (!exists)
    return toolError(`There is no ${targetType} "${targetId}" in the map data.`);
  // Cache first: an enrichment already researched for this location
  // IS the answer, with its citations.
  const locationId =
    targetType === 'location'
      ? targetId
      : targetType === 'item'
        ? (db.items.get(targetId)?.locationId ?? null)
        : (db.opportunities.get(targetId)?.locationId ?? null);
  if (locationId !== null && deps.findEnrichment) {
    const cached = deps.findEnrichment(locationId);
    if (cached) {
      return toolOk({
        status: 'cached',
        enrichment: cached,
        message: `This was already researched — see the cached result with its sources.`,
      });
    }
  }
  const request: ResearchRequest = {
    id: `rr:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    targetType,
    targetId,
    question,
    sourceUrl:
      typeof args['sourceUrl'] === 'string' && args['sourceUrl'].length <= 500
        ? args['sourceUrl']
        : undefined,
    requestedAt: new Date().toISOString(),
    status: 'queued',
  };
  if (deps.queueResearch) {
    const saved = await deps.queueResearch(request);
    if (!saved)
      return toolError(
        'The research request could not be saved on this device — nothing was queued.',
      );
  }
  return toolOk({
    status: 'queued',
    requestId: request.id,
    message:
      "Nobody's published that yet, or we haven't checked — I've queued it for research. I'll have an answer with sources, or I'll tell you there isn't one.",
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export type ToolCall = { name: AskToolName; args: Record<string, unknown> };

export async function executeTool(
  db: GameDatabase,
  call: ToolCall,
  deps: AskToolDeps = {},
): Promise<ToolResult<unknown>> {
  if (!isRecord(call.args)) return toolError('A tool call needs an arguments object.');
  switch (call.name) {
    case 'search_locations':
      return executeSearchLocations(db, call.args);
    case 'find_nearby_opportunities':
      return executeFindNearbyOpportunities(db, call.args);
    case 'remaining_collectibles':
      return executeRemainingCollectibles(db, call.args);
    case 'personal_progress':
      return executePersonalProgress(db, call.args);
    case 'focus_map':
      return executeFocusMap(db, call.args);
    case 'get_location_detail':
      return executeGetLocationDetail(db, call.args);
    case 'update_completion':
      return proposeUpdateCompletion(db, call.args);
    case 'get_hint':
      return executeGetHint(db, call.args);
    case 'research_missing':
      return executeResearchMissing(db, call.args, deps);
    case 'record_sale':
      return proposeRecordSale(db, call.args);
    default:
      return toolError(`There is no tool called "${String((call as { name?: unknown }).name)}" — the question cannot be mapped to a tool.`);
  }
}

/** The function definitions the LLM sees (OpenAI function-calling
 *  shape). The model returns a tool call or nothing — never a
 *  free-text answer containing place names. */
export const ASK_TOOL_DEFINITIONS: {
  type: 'function';
  function: { name: AskToolName; description: string; parameters: Record<string, unknown> };
}[] = [
  {
    type: 'function',
    function: {
      name: 'search_locations',
      description:
        'Find locations by name. Returns locations ONLY — no gameplay detail beyond the kind labels. Unpositioned records ARE searchable.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for, 1–200 characters.' },
          areaId: { type: 'string', description: 'An area id or area name to scope to.' },
          kinds: {
            type: 'array',
            items: { type: 'string', enum: OPPORTUNITY_KINDS },
            description: 'Opportunity kinds the location must have.',
          },
          includeUnpositioned: {
            type: 'boolean',
            description: 'Default true — unpositioned records are searchable.',
          },
          limit: { type: 'integer', description: 'Default 10, max 30.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_nearby_opportunities',
      description:
        'Opportunities of given kinds near an anchor (a location, an area, or a position), nearest first. Unpositioned opportunities are listed separately, never given a distance.',
      parameters: {
        type: 'object',
        properties: {
          anchor: {
            type: 'object',
            description: 'Exactly one of locationId, areaId, or position {x, y}.',
            properties: {
              locationId: { type: 'string' },
              areaId: { type: 'string' },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
              },
            },
          },
          kinds: {
            type: 'array',
            items: { type: 'string', enum: OPPORTUNITY_KINDS },
            description: 'Required, at least one kind.',
          },
          radiusUnits: { type: 'integer', description: 'Default 2000, max 16384.' },
          includeFound: {
            type: 'boolean',
            description: 'Default false — hide completed, like Hide completed.',
          },
          nightlife: {
            type: 'boolean',
            description:
              'When true, only nightlife venues (source #nightclub / #stripclub / #bar tags). Use for nightclub, strip club, bar, and nightlife questions.',
          },
        },
        required: ['anchor', 'kinds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remaining_collectibles',
      description:
        'Remaining collectible items, filtered by set AND kind AND area. setId ALWAYS wins over areaId: items in the set with no location are still returned as "no position yet", never dropped. For a "near X" question use sortNearAreaId (proximity sort, no filtering) instead of areaId (membership filter) — never both.',
      parameters: {
        type: 'object',
        properties: {
          setId: { type: 'string', description: 'A set id or set name, e.g. "delights-dancers".' },
          kind: { type: 'string', enum: ITEM_KINDS },
          areaId: { type: 'string', description: 'An area id or area name — membership filter ("in X").' },
          sortNearAreaId: {
            type: 'string',
            description:
              'An area id or area name — proximity sort ("near X"): items sorted nearest-first from the area centroid, nothing dropped, with nearest + nearCount in the result.',
          },
          includeHints: {
            type: 'boolean',
            description:
              'Default false. Spot descriptions are returned ONLY when the question explicitly asked where the item is.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'personal_progress',
      description:
        'The player’s progress: recorded (from their finds), reconciled (from their in-game stats), estimated — labelled, never summed across the same category.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            description: '"overall", or {"setId": "..."} or {"categoryId": "..."}.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'focus_map',
      description: 'Move the map camera to one location, area, or bounds. Camera action only — no data.',
      parameters: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          areaId: { type: 'string' },
          bounds: {
            type: 'object',
            properties: {
              west: { type: 'number' },
              east: { type: 'number' },
              south: { type: 'number' },
              north: { type: 'number' },
            },
          },
        },
        description: 'Exactly one of the three.',
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_location_detail',
      description:
        'Everything the map knows about one location: its opportunities, its items, its evidence. Calling this IS the explicit request for that location, so its pin shows. Spot descriptions only with includeHints: true, when the question explicitly asked where something is.',
      parameters: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          includeHints: { type: 'boolean' },
        },
        required: ['locationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_completion',
      description:
        'PROPOSE marking something found/looted/discovered/explored. This NEVER writes by itself — it returns a proposal and the app shows a confirm card. Only the player tapping Confirm writes the record.',
      parameters: {
        type: 'object',
        properties: {
          verb: { type: 'string', enum: ['collected', 'looted', 'discovered', 'explored'] },
          targetType: { type: 'string', enum: ['item', 'opportunity', 'location'] },
          targetId: { type: 'string' },
          count: { type: 'integer', description: 'Repeatable verbs only, 1–99. Default 1.' },
          note: { type: 'string', description: 'At most 500 characters, e.g. the safe code used.' },
        },
        required: ['verb', 'targetType', 'targetId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hint',
      description:
        'One progressive hint for one collectible item, level 1–4. Level 1 is a vague clue with no geography; level 2 names the area only; level 3 names the host building; level 4 gives the exact spot. Never jump levels. Unpositioned items stop at level 2.',
      parameters: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['item'] },
          targetId: { type: 'string' },
          level: { type: 'integer', description: 'Required, 1–4. No default, no inference.' },
        },
        required: ['targetType', 'targetId', 'level'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'research_missing',
      description:
        'When the local database does not know the answer: check the enrichment cache first, otherwise queue a research request for developer-side fulfilment. Never answer from memory, never guess.',
      parameters: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['item', 'opportunity', 'location'] },
          targetId: { type: 'string' },
          question: { type: 'string', description: 'What is missing, at most 200 characters.' },
          sourceUrl: {
            type: 'string',
            description: 'A guide URL the player supplied — the developer-side job checks that guide first.',
          },
        },
        required: ['targetType', 'targetId', 'question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_sale',
      description:
        'PROPOSE marking a collected card as sold. This NEVER writes by itself — it returns a proposal and the app shows a confirm card. Selling never removes collection progress.',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          price: { type: 'number', description: 'Optional, player-typed.' },
        },
        required: ['itemId'],
      },
    },
  },
];
