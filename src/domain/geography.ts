/**
 * Geography — hierarchy without invented boundaries (DESIGN §6, step 1).
 *
 * Step 1 scope, deliberately narrow: the `AreaNode` type, the
 * region-string → area-id derivation, and the derivation of area nodes
 * from `region:*` places plus the five counties. Extents (member-bbox),
 * breadcrumb / parentage, and search are step 4 — they are NOT built
 * here. Every node therefore carries `parentId: null` and
 * `childrenIds: []` until step 4 fills the hierarchy, and region nodes
 * carry `bounds: null` with an extent note saying so.
 *
 * Membership is the hierarchy: a location belongs to an area because
 * its address says so — the area id is derived from the LAST segment
 * of the location's `region` string (the street / district segments
 * before it are not areas). County membership is by name suffix:
 * a last segment ending in a county name ("Kelly County", or a
 * qualified "Northern Kelly County") joins that county.
 */
import type { MapBounds } from '../features/map/coordinates';
import { COUNTIES } from '../data/counties';
import type { GameLocation } from './game-db';

/** DESIGN §6.1. */
export interface AreaNode {
  /** `area:<slug>` for a region place, `county:<id>` for a county. */
  id: string;
  name: string;
  level: 'state' | 'county' | 'city' | 'town' | 'neighbourhood' | 'district';
  /** One-tap return to the parent (§6.3). Step 4 fills this in. */
  parentId: string | null;
  childrenIds: string[];
  /** Member locations, by id. The hierarchy is MEMBERSHIP — a place
   *  belongs to an area because its address says so. */
  locationIds: string[];
  /** Extent = bounding box of the area's POSITIONED member locations.
   *  An ESTIMATE, labelled as such everywhere it is shown. NULL when
   *  the area has no computed extent yet — the area is still selectable
   *  and searchable; selecting it shows its member list, not a camera
   *  move. Step 4 computes member bboxes; county rects come from
   *  counties.ts meanwhile. */
  bounds: MapBounds | null;
  /** County rects keep today's COUNTY bounds (counties.ts) — estimates
   *  from the GTADB records naming the county, labelled as such. */
  extentNote: string;
  /** Disputed membership. Ambrosia: Output Lag says Leonard, GTA Base
   *  says Kelly (DESIGN §12.8). The node carries BOTH claims and the
   *  UI shows "County disputed — listed under both". Never silently
   *  pick one. Step 4 fills this in when the hierarchy lands. */
  countyDisputed?: { claims: { countyId: string; source: string }[] };
}

/** Lowercase slug for an area name: "Port Gellhorn" → "port-gellhorn". */
export function slugifyAreaName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/['’]/g, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
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
 * file): Vice City and Port Gellhorn are CITY; anything ending in
 * "County" is a county; every other named region is carried as a town
 * for now — including the NATURAL_AREA regions (Grassrivers, Mount
 * Kalaga), which the §6.1 hierarchy has no level for. Step 4 refines
 * levels when the full 149-area hierarchy lands; nothing here invents
 * a neighbourhood or district.
 */
export function areaLevelForName(name: string): AreaNode['level'] {
  if (name.endsWith(' County')) return 'county';
  if (name === 'Vice City' || name === 'Port Gellhorn' || name === 'Vice Beach')
    return 'city';
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

/**
 * The area id for a location's `region` string, or null when the
 * region names no area (empty region, "My markers").
 *
 * The LAST comma segment is the area: GTADB regions are an address
 * minus its first part ("Interstate 404, Port Gellhorn" → "Port
 * Gellhorn"; "Historic Route 628, Kelly County" → "Kelly County"),
 * and loot/guide regions are already a bare area name. A last segment
 * that ends in a county name joins that county (qualified forms like
 * "Northern Kelly County" included); a last segment matching a region
 * place by name joins that node; anything else becomes
 * `area:<slug>` — a dangling reference until step 4 builds the full
 * 149-area hierarchy, never a guessed node.
 */
export function areaIdForRegion(
  region: string,
  regionNameIndex: ReadonlyMap<string, string> = new Map(),
): string | null {
  const trimmed = region.trim();
  if (!trimmed || trimmed === 'My markers') return null;
  const lastSegment = trimmed.split(',').at(-1)?.trim() ?? '';
  if (!lastSegment) return null;
  const byName = regionNameIndex.get(lastSegment.toLowerCase());
  if (byName) return byName;
  for (const county of COUNTIES) {
    if (lastSegment === county.name || lastSegment.endsWith(` ${county.name}`)) {
      return `county:${county.id}`;
    }
  }
  return `area:${slugifyAreaName(lastSegment)}`;
}

/**
 * Derive the step-1 area nodes: one per `region:*` place plus one per
 * county in counties.ts. Membership comes from the locations' area
 * ids — a location is a member of exactly the node its area id names.
 * Parentage, children and region extents are step 4; county nodes
 * keep their counties.ts rects (labelled estimates) meanwhile.
 */
export function deriveAreaNodes(
  regionPlaces: readonly { id: string; title: string }[],
  locations: readonly GameLocation[],
): ReadonlyMap<string, AreaNode> {
  const nodes = new Map<string, AreaNode>();
  const membersByArea = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.areaId) continue;
    const members = membersByArea.get(location.areaId) ?? [];
    members.push(location.id);
    membersByArea.set(location.areaId, members);
  }
  for (const place of regionPlaces) {
    const id = areaIdForRegionPlace(place.id);
    nodes.set(id, {
      id,
      name: place.title,
      level: areaLevelForName(place.title),
      parentId: null,
      childrenIds: [],
      locationIds: membersByArea.get(id) ?? [],
      bounds: null,
      extentNote:
        'Extent is the bounding box of positioned member locations — computed in step 4; no extent yet.',
    });
  }
  for (const county of COUNTIES) {
    const id = `county:${county.id}`;
    nodes.set(id, {
      id,
      name: county.name,
      level: 'county',
      parentId: null,
      childrenIds: [],
      locationIds: membersByArea.get(id) ?? [],
      bounds: { ...county.bounds },
      extentNote:
        'County extent estimated from GTADB records naming the county (src/data/counties.ts) — labelled estimate.',
    });
  }
  return nodes;
}
