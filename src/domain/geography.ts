/**
 * Geography — hierarchy without invented boundaries (DESIGN §6, step 4).
 *
 * Step 4 completes the step-1 skeleton: parentage, children, extents
 * and the full 149-region-string hierarchy. The parse is the
 * matchesArea / region-segment logic from
 * src/features/map/isolation.ts, generalised:
 *
 * - A location's region string is an address minus its first part, so
 *   its segments run most-specific first: "Downtown, Vice City" is
 *   Downtown IN Vice City; "Allied Crystal, Ambrosia" is Allied
 *   Crystal IN Ambrosia. The area a location belongs to most
 *   specifically is its FULL parsed path — `area:downtown--vice-city`
 *   — and its parent is the path minus the first segment. The `--`
 *   separator is unambiguous: slugify collapses every separator
 *   inside a segment to a single `-`, so `--` can only be a segment
 *   boundary. (Step 1 used the LAST segment only, which made every
 *   neighbourhood collapse into its city — Downtown was not an area.)
 * - A leading STREET segment is not an area and is dropped: in a
 *   3-segment region the first segment is a street ("Shore Dr, Ocean
 *   Beach, Vice Beach"), and any non-last segment matching a street
 *   pattern is dropped wherever it sits ("Crosstown, Catalan Blvd,
 *   Vice City" → Crosstown in Vice City; "Historic Route 628, Kelly
 *   County" → the county itself). The last segment is never dropped:
 *   it is the top area by definition. Street names are data (the
 *   GTADB address), the classification is structural — no area name
 *   is invented, and no street becomes an area.
 * - Membership is the hierarchy: a location belongs to its own area
 *   AND to every ancestor (Vice City's members are its 60 direct
 *   places plus every neighbourhood's places — the matchesArea rule,
 *   so isolating Vice City still shows all its neighbourhoods).
 *   `locationIds` is the subtree; `directLocationIds()` is the
 *   exact-path members for the area page.
 * - A top-level area (single segment, not a county) joins the county
 *   its positioned members mostly fall in (counties.ts rects — the
 *   established convention: a place is assigned to the county its
 *   address names, otherwise to the rect it falls in). A tie, or no
 *   positioned members, joins the state directly. The vote is a
 *   plurality of positioned SUBTREE members, labelled an estimate
 *   wherever shown.
 * - Ambrosia is county-disputed (DESIGN §12.8): Output Lag says
 *   Leonard, GTA Base says Kelly. The node carries BOTH claims,
 *   has no single parentId, and is listed as a child of BOTH
 *   counties. Never silently pick one.
 * - Extents: state = whole-map rect; county = today's counties.ts
 *   rects (estimates, labelled as such); anything else = bounding
 *   box of positioned SUBTREE member locations, padded 12% / ≥200
 *   units — the same rule as boundsForPlaces in
 *   src/features/map/isolation.ts. An ESTIMATE, labelled as such
 *   everywhere shown. bounds is null when the area has no positioned
 *   members — the area is still selectable and searchable; selecting
 *   it shows its member list, not a camera move. NO boundary lines
 *   are drawn anywhere: the extent is a camera focus + a dim mask +
 *   the dashed rect outline marking the estimated extent — the rect
 *   is an extent indicator, not a boundary line (§6.2).
 * - Region "Leonida" IS the state: places with that region belong
 *   to the state node, not to a second area called Leonida.
 * - Display names are title-cased from the slug ("vice-city" →
 *   "Vice City"). That also heals the one case typo in the data
 *   ("Stockyard, Vice CIty" joins Vice City — same slug, same node).
 *   "Stafish Island" (GTADB's spelling) is kept verbatim as a slug;
 *   "Liberty State?" loses its "?" to slugify.
 */
import type { MapBounds } from '../features/map/coordinates';
import { BASEMAP_BOUNDS } from '../features/map/coordinates';
import { COUNTIES, countyIdForPosition } from '../data/counties';
import type { GameLocation } from './game-db';

/** DESIGN §6.1. */
export interface AreaNode {
  /** `area:<slug>` for a region place, `county:<id>` for a county. */
  id: string;
  name: string;
  /** Full region path, e.g. "Downtown, Vice City" — the display
   *  disambiguator when two areas share a name (Bayside in Vice
   *  City vs Bayside in Vice Beach). County nodes carry the county
   *  name; the state node carries "Leonida". */
  path: string;
  level: 'state' | 'county' | 'city' | 'town' | 'neighbourhood' | 'district';
  /** One-tap return to the parent (§6.3). Null for the state, and
   *  for Ambrosia (disputed — see countyDisputed, never silently
   *  pick one county). */
  parentId: string | null;
  childrenIds: string[];
  /** Member locations, by id. The hierarchy is MEMBERSHIP — a place
   *  belongs to an area AND to every ancestor of that area, so
   *  Vice City's members are its direct places plus every
   *  neighbourhood's places. */
  locationIds: string[];
  /** Extent = bounding box of the area's POSITIONED member locations
   *  (subtree). An ESTIMATE, labelled as such everywhere it is
   *  shown. NULL when the area has no positioned members — the area
   *  is still selectable and searchable; selecting it shows its
   *  member list, not a camera move. */
  bounds: MapBounds | null;
  /** County rects keep today's COUNTY bounds (counties.ts) — estimates
   *  from the GTADB records naming the county, labelled as such. */
  extentNote: string;
  /** Curated aliases for geo search (§6.5) — in the area data, never
   *  invented at runtime. Only the grounded ones: "VC" → Vice City,
   *  "the Keys" → Leonida Keys. */
  aliases?: string[];
  /** Disputed membership. Ambrosia: Output Lag says Leonard, GTA Base
   *  says Kelly (DESIGN §12.8). The node carries BOTH claims and the
   *  UI shows "County disputed — listed under both". Never silently
   *  pick one. */
  countyDisputed?: { claims: { countyId: string; source: string }[] };
}

/** The state node: the whole of Leonida. */
export const STATE_NODE_ID = 'state:leonida';
export const STATE_NAME = 'Leonida';

/** The two cities in DESIGN §6.1: Vice City and Vice Beach. Port
 * Gellhorn is a TOWN (§6.1 lists it under Town) — the step-1 rule
 * that listed it as a city was wrong, and it wrongly made the
 * distinct 1-member node "Port Gellhorn, Kelly County" a city too. */
const CITY_NAMES: readonly string[] = ['Vice City', 'Vice Beach'];

/** Ambrosia's two sourced county claims (DESIGN §12.8). */
export const AMBROSIA_DISPUTE = {
  areaId: 'area:ambrosia',
  claims: [
    { countyId: 'leonard', source: 'Output Lag' },
    { countyId: 'kelly', source: 'GTA Base' },
  ],
} as const;

/** Curated geo-search aliases (§6.5). Nothing else is an alias. */
export const AREA_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'area:vice-city': ['VC'],
  'area:leonida-keys': ['the Keys'],
};

/** Lowercase slug for an area name: "Port Gellhorn" → "port-gellhorn". */
export function slugifyAreaName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/['’]/g, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

/** Title-case a slug back to a display name: "vice-city" → "Vice City". */
export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Area id for a region place: `region:<slug>` → `area:<slug>`,
 * `county:<id>` for a county node.
 */
export function areaIdForRegionPlace(regionPlaceId: string): string {
  return `area:${regionPlaceId.replace(/^region:/, '')}`;
}

/**
 * The level of a named region, from the source category in
 * src/features/street-leonida/page-data.ts (the `Place` ingest drops
 * the category, so this is keyed by name and kept in sync with that
 * file): Vice City and Vice Beach are CITY; anything ending in
 * "County" is a county; every other named region is carried as a town
 * for now — including the NATURAL_AREA regions (Grassrivers, Mount
 * Kalaga), which the §6.1 hierarchy has no level for. The full
 * 149-area hierarchy is derived by deriveAreaNodes (parent-aware
 * areaLevelForNode); nothing here invents a neighbourhood or district.
 *
 * Port Gellhorn is a town here, and page-data.ts agrees (its category
 * is 'TOWN' — changed in the step-4 follow-up so the region page and
 * the hierarchy say the same thing; §6.1 governs).
 *
 * Kept for compatibility: deriveAreaNodes uses the parent-aware
 * `areaLevelForNode` below. This name-only version is the fallback
 * for a bare name with no parent known.
 */
export function areaLevelForName(name: string): AreaNode['level'] {
  if (name.endsWith(' County')) return 'county';
  if (name === 'Vice City' || name === 'Vice Beach') return 'city';
  return 'town';
}

/**
 * Name → area-id index over the region places, for resolving a
 * location's region string to the node it names ("Mount Kalaga" →
 * `area:mount-kalaga-national-park`, whose slug is not its name).
 */
export function buildRegionNameIndex(
  regionPlaces: readonly { id: string; title: string }[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const place of regionPlaces) {
    index.set(place.title.trim().toLowerCase(), areaIdForRegionPlace(place.id));
  }
  return index;
}

/** A street-type suffix ("Catalan Blvd", "SW 4th St", "Rialto Cswy"). */
const STREET_SUFFIX =
  /\b(st|street|ave|avenue|blvd|boulevard|dr|drive|cir|circle|cswy|causeway|ct|court|rd|road|hwy|highway|ln|lane|way|pl|place|ter|terrace|pkwy|parkway)\.?$/i;
/** A numbered road ("Route 32", "Historic Route 628", "Interstate 404"). */
const NUMBERED_ROAD = /\b(route|interstate|highway|hwy)\s+\d+/i;

/** True when an address segment is a street/road, not an area. */
export function isStreetSegment(segment: string): boolean {
  const trimmed = segment.trim();
  return STREET_SUFFIX.test(trimmed) || NUMBERED_ROAD.test(trimmed);
}

/**
 * Parse a region string into its area path, most-specific first.
 * A 3-segment region drops its first segment (a street: the address
 * had street + district + city, and the region already dropped the
 * address's first part). Any remaining non-last segment matching a
 * street pattern is dropped wherever it sits ("Crosstown, Catalan
 * Blvd, Vice City" → ["Crosstown", "Vice City"]). The last segment
 * is never dropped — it is the top area by definition. Empty and
 * "My markers" regions parse to [].
 */
export function parseRegionPath(region: string): string[] {
  const trimmed = region.trim();
  if (!trimmed || trimmed === 'My markers') return [];
  const parts = trimmed
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const withoutStreet = parts.length >= 3 ? parts.slice(1) : parts;
  return withoutStreet.filter(
    (segment, index) =>
      index === withoutStreet.length - 1 || !isStreetSegment(segment),
  );
}

interface AreaIndexes {
  /** slug of a region-place title → its node id ("mount-kalaga" → area:mount-kalaga-national-park). */
  regionPlaceBySlug: ReadonlyMap<string, string>;
  /** slug of a county name → its node id ("kelly-county" → county:kelly). */
  countyBySlug: ReadonlyMap<string, string>;
}

function buildAreaIndexes(
  regionPlaces: readonly { id: string; title: string }[],
): AreaIndexes {
  const regionPlaceBySlug = new Map<string, string>();
  for (const place of regionPlaces) {
    regionPlaceBySlug.set(slugifyAreaName(place.title), areaIdForRegionPlace(place.id));
  }
  const countyBySlug = new Map<string, string>();
  for (const county of COUNTIES) {
    countyBySlug.set(slugifyAreaName(county.name), `county:${county.id}`);
  }
  return { regionPlaceBySlug, countyBySlug };
}

function countyIdForSlug(slug: string, indexes: AreaIndexes): string | null {
  const direct = indexes.countyBySlug.get(slug);
  if (direct) return direct.replace(/^county:/, '');
  for (const [countySlug, countyId] of indexes.countyBySlug) {
    if (slug.endsWith(`-${countySlug}`)) return countyId.replace(/^county:/, '');
  }
  return null;
}

/**
 * Resolve parsed path segments (as slugs) to a node id. Single
 * segment: the state ("leonida"), a county ("kelly-county", or a
 * qualified "northern-kelly-county"), a region place by title slug
 * ("mount-kalaga" → area:mount-kalaga-national-park), else
 * `area:<slug>`. Multi-segment: `area:<slug>--<slug>` — the `--`
 * separator is unambiguous because slugify never emits it inside a
 * segment.
 */
export function areaIdForPathSlugs(
  slugs: readonly string[],
  indexes: AreaIndexes,
): string | null {
  if (slugs.length === 0) return null;
  if (slugs.length === 1) {
    const only = slugs[0]!;
    if (only === slugifyAreaName(STATE_NAME)) return STATE_NODE_ID;
    const countyId = countyIdForSlug(only, indexes);
    if (countyId) return `county:${countyId}`;
    const byTitle = indexes.regionPlaceBySlug.get(only);
    if (byTitle) return byTitle;
    return `area:${only}`;
  }
  return `area:${slugs.join('--')}`;
}

/**
 * The area id for a location's `region` string, or null when the
 * region names no area (empty region, "My markers").
 *
 * The FULL parsed path is the area: "Downtown, Vice City" →
 * `area:downtown--vice-city`; "Vice City" → `area:vice-city`;
 * "Historic Route 628, Kelly County" → `county:kelly` (the road
 * drops, the county remains); "Leonida" → `state:leonida`. A single
 * segment matching a region place by name joins that node
 * ("Mount Kalaga" → `area:mount-kalaga-national-park`).
 */
export function areaIdForRegion(
  region: string,
  regionNameIndex: ReadonlyMap<string, string> = new Map(),
): string | null {
  const segments = parseRegionPath(region);
  if (segments.length === 0) return null;
  // The index is keyed by lowercased TITLE; rebuild the slug map
  // from it so the lookup is slug-based like everything else here.
  const regionPlaceBySlug = new Map<string, string>();
  for (const [title, id] of regionNameIndex) {
    regionPlaceBySlug.set(slugifyAreaName(title), id);
  }
  const countyBySlug = new Map<string, string>();
  for (const county of COUNTIES) {
    countyBySlug.set(slugifyAreaName(county.name), `county:${county.id}`);
  }
  return areaIdForPathSlugs(
    segments.map(slugifyAreaName),
    { regionPlaceBySlug, countyBySlug },
  );
}

/** Pad a bbox the way boundsForPlaces does (12% / ≥200 units). */
function padBounds(bounds: MapBounds): MapBounds {
  const padX = Math.max((bounds.east - bounds.west) * 0.12, 200);
  const padY = Math.max((bounds.north - bounds.south) * 0.12, 200);
  return {
    west: bounds.west - padX,
    east: bounds.east + padX,
    south: bounds.south - padY,
    north: bounds.north + padY,
  };
}

/**
 * Bounding box of a set of positioned locations, padded. Null when
 * nothing in the set has a position. Same rule as boundsForPlaces in
 * src/features/map/isolation.ts — keep in sync.
 */
export function boundsForLocations(
  locations: readonly Pick<GameLocation, 'position'>[],
): MapBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const location of locations) {
    if (!location.position) continue;
    west = Math.min(west, location.position.x);
    east = Math.max(east, location.position.x);
    south = Math.min(south, location.position.y);
    north = Math.max(north, location.position.y);
  }
  if (!Number.isFinite(west)) return null;
  return padBounds({ west, east, south, north });
}

function segmentsOfAreaId(id: string): string[] | null {
  if (!id.startsWith('area:')) return null;
  return id.replace(/^area:/, '').split('--').filter(Boolean);
}

function displayPathForId(id: string): string {
  if (id === STATE_NODE_ID) return STATE_NAME;
  if (id.startsWith('county:')) {
    return COUNTIES.find((county) => `county:${county.id}` === id)?.name ?? id;
  }
  const segments = segmentsOfAreaId(id);
  if (!segments) return id;
  return segments.map(titleCaseSlug).join(', ');
}

function nameForId(id: string): string {
  if (id === STATE_NODE_ID) return STATE_NAME;
  if (id.startsWith('county:')) {
    return COUNTIES.find((county) => `county:${county.id}` === id)?.name ?? id;
  }
  const segments = segmentsOfAreaId(id);
  if (!segments || segments.length === 0) return id;
  return titleCaseSlug(segments[0]!);
}

/** Parent-aware level (§6.1): city list, then " District", then the parent's level. */
function areaLevelForNode(
  name: string,
  parentLevel: AreaNode['level'] | null,
): AreaNode['level'] {
  if (name.endsWith(' County')) return 'county';
  if ((CITY_NAMES as readonly string[]).includes(name)) return 'city';
  if (name.endsWith(' District')) return 'district';
  if (parentLevel === 'city') return 'neighbourhood';
  if (parentLevel === 'town') return 'district';
  if (parentLevel === 'district') return 'neighbourhood';
  return 'town';
}

/**
 * Derive the full area hierarchy: one node per region place, one per
 * county, one state node, and one per distinct parsed region path in
 * the locations (plus suffix parents — "Wild Hog Point" exists only
 * as the parent of "Wild Hog Airfield, Wild Hog Point"). Membership
 * is the hierarchy (subtree). Parentage is structural from the
 * paths; top-level areas join a county by plurality vote of their
 * positioned subtree members over the counties.ts rects (an
 * estimate); Ambrosia is disputed and joins neither. Extents are
 * member bboxes (county rects for counties, whole-map rect for the
 * state), null when the area has no positioned members.
 */
export function deriveAreaNodes(
  regionPlaces: readonly { id: string; title: string }[],
  locations: readonly GameLocation[],
): ReadonlyMap<string, AreaNode> {
  const indexes = buildAreaIndexes(regionPlaces);
  const nodes = new Map<string, AreaNode>();

  const directByArea = new Map<string, GameLocation[]>();
  for (const location of locations) {
    if (!location.areaId) continue;
    const members = directByArea.get(location.areaId) ?? [];
    members.push(location);
    directByArea.set(location.areaId, members);
  }

  // Node ids: every area id in use, every region place, every county,
  // the state — plus suffix parents, to a fixpoint (a path's parent
  // is the path minus its first segment).
  const ids = new Set<string>(directByArea.keys());
  for (const place of regionPlaces) ids.add(areaIdForRegionPlace(place.id));
  for (const county of COUNTIES) ids.add(`county:${county.id}`);
  ids.add(STATE_NODE_ID);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...ids]) {
      const segments = segmentsOfAreaId(id);
      if (!segments || segments.length < 2) continue;
      const parentId = areaIdForPathSlugs(segments.slice(1), indexes);
      if (parentId && !ids.has(parentId)) {
        ids.add(parentId);
        grew = true;
      }
    }
  }

  for (const id of ids) {
    nodes.set(id, {
      id,
      name: nameForId(id),
      path: displayPathForId(id),
      level: 'town',
      parentId: null,
      childrenIds: [],
      locationIds: [],
      bounds: null,
      extentNote: '',
      ...(AREA_ALIASES[id] ? { aliases: [...AREA_ALIASES[id]!] } : {}),
    });
  }
  // Ambrosia carries both county claims, no single parent.
  const ambrosia = nodes.get(AMBROSIA_DISPUTE.areaId);
  if (ambrosia) {
    ambrosia.countyDisputed = {
      claims: AMBROSIA_DISPUTE.claims.map((claim) => ({ ...claim })),
    };
  }

  // Structural parents: multi-segment areas, counties, state.
  // Single-segment areas get their county parent by vote below.
  const parentIdOf = new Map<string, string | null>();
  for (const id of ids) {
    if (id === STATE_NODE_ID) {
      parentIdOf.set(id, null);
      continue;
    }
    if (id.startsWith('county:')) {
      parentIdOf.set(id, STATE_NODE_ID);
      continue;
    }
    if (id === AMBROSIA_DISPUTE.areaId) {
      parentIdOf.set(id, null);
      continue;
    }
    const segments = segmentsOfAreaId(id);
    if (segments && segments.length >= 2) {
      parentIdOf.set(id, areaIdForPathSlugs(segments.slice(1), indexes));
    }
  }

  // Children map from the structural parents (county parents of
  // single-segment areas join in the vote step below).
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);
  for (const [id, parentId] of parentIdOf) {
    if (parentId) childrenOf.get(parentId)?.push(id);
  }

  // Subtree members for a node, from a children map (bottom-up).
  // Deduped by location id: Ambrosia is a child of BOTH claimed
  // counties, so its members reach the state twice — the state's
  // list must still count each place once.
  const subtreeMembers = (
    children: ReadonlyMap<string, readonly string[]>,
  ): Map<string, GameLocation[]> => {
    const memo = new Map<string, GameLocation[]>();
    const collect = (id: string, seen: Set<string>): GameLocation[] => {
      if (memo.has(id)) return memo.get(id)!;
      if (seen.has(id)) return [];
      seen.add(id);
      const byId = new Map<string, GameLocation>();
      for (const member of directByArea.get(id) ?? []) byId.set(member.id, member);
      for (const childId of children.get(id) ?? []) {
        for (const member of collect(childId, seen)) byId.set(member.id, member);
      }
      const members = [...byId.values()];
      memo.set(id, members);
      return members;
    };
    for (const id of ids) collect(id, new Set());
    return memo;
  };
  const partialSubtree = subtreeMembers(childrenOf);

  // County vote for single-segment areas: plurality of positioned
  // subtree members over the counties.ts rects. Tie or no positioned
  // members → the state directly.
  for (const id of ids) {
    if (parentIdOf.has(id)) continue;
    if (id.startsWith('county:') || id === STATE_NODE_ID) continue;
    const members = partialSubtree.get(id) ?? [];
    const votes = new Map<string, number>();
    for (const member of members) {
      if (!member.position) continue;
      const countyId = countyIdForPosition(member.position);
      if (countyId) votes.set(countyId, (votes.get(countyId) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    let tied = false;
    for (const [countyId, count] of [...votes.entries()].sort()) {
      if (count > bestCount) {
        best = countyId;
        bestCount = count;
        tied = false;
      } else if (count === bestCount) {
        tied = true;
      }
    }
    const parentId = best !== null && !tied ? `county:${best}` : STATE_NODE_ID;
    parentIdOf.set(id, parentId);
    childrenOf.get(parentId)?.push(id);
  }
  // Ambrosia is listed under BOTH claimed counties.
  if (ambrosia) {
    for (const claim of AMBROSIA_DISPUTE.claims) {
      childrenOf.get(`county:${claim.countyId}`)?.push(ambrosia.id);
    }
  }

  // Levels by depth (parents first): state, counties, then areas.
  const depthOf = (id: string): number => {
    let depth = 0;
    let current: string | null = id;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      depth += 1;
      current = parentIdOf.get(current) ?? null;
    }
    return depth;
  };
  const byDepth = [...ids].sort((a, b) => depthOf(a) - depthOf(b));
  for (const id of byDepth) {
    const node = nodes.get(id)!;
    node.parentId = parentIdOf.get(id) ?? null;
    node.childrenIds = [...(childrenOf.get(id) ?? [])].sort((a, b) =>
      (nodes.get(a)?.name ?? a).localeCompare(nodes.get(b)?.name ?? b),
    );
    if (id === STATE_NODE_ID) node.level = 'state';
    else if (id.startsWith('county:')) node.level = 'county';
    else {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      node.level = areaLevelForNode(node.name, parent?.level ?? null);
    }
  }

  // Membership (subtree), extents, notes — now that parents are final.
  const fullSubtree = subtreeMembers(childrenOf);
  for (const id of ids) {
    const node = nodes.get(id)!;
    const members = fullSubtree.get(id) ?? [];
    node.locationIds = members.map((member) => member.id);
    if (id === STATE_NODE_ID) {
      node.bounds = { ...BASEMAP_BOUNDS };
      node.extentNote = 'Whole-map extent — the state of Leonida.';
    } else if (id.startsWith('county:')) {
      const county = COUNTIES.find((entry) => `county:${entry.id}` === id)!;
      node.bounds = { ...county.bounds };
      node.extentNote =
        'County extent estimated from GTADB records naming the county (src/data/counties.ts) — labelled estimate.';
    } else {
      node.bounds = boundsForLocations(members);
      node.extentNote = node.bounds
        ? 'The estimated extent is the bounding box of positioned member locations — no official boundary lines are published.'
        : 'No positioned member locations yet — no extent. The area is still selectable and searchable; selecting it shows its member list, not a camera move.';
    }
  }
  return nodes;
}

/** Breadcrumb chain for an area, state first (§6.3). */
export function breadcrumbChain(
  nodes: ReadonlyMap<string, AreaNode>,
  areaId: string,
): AreaNode[] {
  const chain: AreaNode[] = [];
  const seen = new Set<string>();
  let current: string | null = areaId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = nodes.get(current);
    if (!node) break;
    chain.unshift(node);
    current = node.parentId;
  }
  const state = nodes.get(STATE_NODE_ID);
  if (state && chain[0] !== state) chain.unshift(state);
  return chain;
}

/**
 * All area ids in a subtree: the area itself plus every descendant
 * (childrenIds, walked). Used by the descendant-aware area filter
 * (step 5): filtering by Vice City matches Downtown items, filtering
 * by Port Gellhorn matches its children. Ambrosia appears under both
 * claimed counties, so a county subtree containing it lists it once
 * (the Set dedupes).
 */
export function subtreeAreaIds(
  nodes: ReadonlyMap<string, AreaNode>,
  areaId: string,
): Set<string> {
  const ids = new Set<string>();
  const walk = (id: string): void => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const childId of nodes.get(id)?.childrenIds ?? []) walk(childId);
  };
  walk(areaId);
  return ids;
}

/**
 * An area's DIRECT members — locations whose region names exactly
 * this area's path (not a descendant's). The area page lists these
 * under the child areas.
 */
export function directLocationIds(
  nodes: ReadonlyMap<string, AreaNode>,
  areaId: string,
): string[] {
  const node = nodes.get(areaId);
  if (!node) return [];
  const descendantIds = new Set<string>();
  const walk = (id: string): void => {
    for (const childId of nodes.get(id)?.childrenIds ?? []) {
      descendantIds.add(childId);
      walk(childId);
    }
  };
  walk(areaId);
  const descendantMembers = new Set<string>();
  for (const descendantId of descendantIds) {
    for (const memberId of nodes.get(descendantId)?.locationIds ?? []) {
      descendantMembers.add(memberId);
    }
  }
  return node.locationIds.filter((memberId) => !descendantMembers.has(memberId));
}

/**
 * The §6.3 View Area fix, as a domain function: an area's OWN
 * bounds, falling back to the county's bounds only when the area has
 * none — and saying so. A disputed area (Ambrosia) never falls back
 * to one county: there is no single county to fall back to. Step 5
 * wires this into the location card; PlaceDetails.viewArea() is
 * untouched in step 4.
 */
export function resolveAreaBounds(
  nodes: ReadonlyMap<string, AreaNode>,
  areaId: string,
): {
  bounds: MapBounds | null;
  fallback: 'none' | 'county';
  countyId?: string;
  reason: string;
} {
  const node = nodes.get(areaId);
  if (!node) {
    return { bounds: null, fallback: 'none', reason: 'Unknown area.' };
  }
  if (node.bounds) {
    return {
      bounds: node.bounds,
      fallback: 'none',
      reason: 'The area’s own extent.',
    };
  }
  if (node.countyDisputed) {
    return {
      bounds: null,
      fallback: 'none',
      reason:
        'No positioned places here, and the county is disputed — no single county to fall back to.',
    };
  }
  const countyId = node.parentId?.startsWith('county:')
    ? node.parentId.replace(/^county:/, '')
    : undefined;
  const countyNode = countyId ? nodes.get(`county:${countyId}`) : undefined;
  if (countyNode?.bounds) {
    return {
      bounds: countyNode.bounds,
      fallback: 'county',
      countyId,
      reason: `No positioned places in ${node.name} — showing the ${countyNode.name} extent instead (estimate).`,
    };
  }
  return {
    bounds: null,
    fallback: 'none',
    reason: `No positioned places in ${node.name}, and no county extent to fall back to.`,
  };
}

/** Centroid of an area's extent (member-bbox centre) — the geo-label anchor. Null when the area has no bounds. */
export function areaCentroid(node: AreaNode): { x: number; y: number } | null {
  if (!node.bounds) return null;
  return {
    x: (node.bounds.west + node.bounds.east) / 2,
    y: (node.bounds.south + node.bounds.north) / 2,
  };
}

/**
 * Zoom band for geo labels (§6.4): county labels at island zoom,
 * city/town labels at district zoom, neighbourhood/district labels
 * at street zoom. The state never gets a label. Leaflet zoom -5..1;
 * island is ≤ -2.5 (the hero-mode threshold), street is > -0.5.
 */
export function geoLabelVisibleAtZoom(
  level: AreaNode['level'],
  zoom: number,
): boolean {
  switch (level) {
    case 'state':
      return false;
    case 'county':
      return zoom <= -2.5;
    case 'city':
    case 'town':
      return zoom > -2.5 && zoom <= -0.5;
    case 'neighbourhood':
    case 'district':
      return zoom > -0.5;
  }
}

/**
 * Geo labels for the current view (§6.4): tappable area-name chips
 * at each area's centroid, INDEPENDENT of gameplay layers. Only
 * areas with an extent, in the right zoom band, whose centroid is
 * inside the viewport (with a small margin) — and never the selected
 * area, whose name is already on the map.
 */
export function geoLabelsForView(
  nodes: ReadonlyMap<string, AreaNode>,
  zoom: number,
  viewport: MapBounds,
  selectedAreaId: string | null = null,
): { areaId: string; name: string; position: { x: number; y: number } }[] {
  const labels: { areaId: string; name: string; position: { x: number; y: number } }[] = [];
  const marginX = (viewport.east - viewport.west) * 0.05;
  const marginY = (viewport.north - viewport.south) * 0.05;
  for (const node of nodes.values()) {
    if (node.id === selectedAreaId) continue;
    if (!geoLabelVisibleAtZoom(node.level, zoom)) continue;
    const centroid = areaCentroid(node);
    if (!centroid) continue;
    if (
      centroid.x < viewport.west - marginX ||
      centroid.x > viewport.east + marginX ||
      centroid.y < viewport.south - marginY ||
      centroid.y > viewport.north + marginY
    ) {
      continue;
    }
    labels.push({ areaId: node.id, name: node.name, position: centroid });
  }
  return labels.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The honest empty state for a bounds:null area (§6.3): the count is
 * NAMED member places — unnamed "?" records are not counted as
 * named. `namedCount` comes from the area's member locations.
 */
export function areaNoExtentMessage(namedCount: number): string {
  return `No positioned places here yet — ${namedCount} named place${namedCount === 1 ? '' : 's'}, all unpositioned`;
}

/** "County disputed — listed under both" (§6.1, Ambrosia). */
export const COUNTY_DISPUTED_LABEL = 'County disputed — listed under both';
