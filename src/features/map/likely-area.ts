/**
 * Likely-area regions for gang operations (v0.32 gang-op lane 1).
 *
 * The user decision (2026-11-26, DESIGN.md §3.1 Placement +
 * CARD-MATCHER-DESIGN.md §4): an area-known record is plotted as a
 * soft "likely area" region over its named area — dashed outline, no
 * icon, no point — labelled with the item name + "likely area". A
 * region never becomes a pin by zooming in; it changes only on a
 * confirmed match or a player jot.
 *
 * This module is the PURE half (no Leaflet — the same split as
 * isolation-label.ts vs isolation-layer.ts, so unit tests can assert
 * the contract without spinning up a map). The Leaflet half is
 * likely-area-layer.ts; MapView wires it in.
 *
 * Resolution reuses the geography module and invents nothing:
 * areaIdForRegion(place.region) + resolveAreaBounds(areas, areaId).
 * The area id is checked against the derived nodes first, with an
 * exact path match as fallback — a region place whose slug is not
 * its title ("Mount Kalaga" → area:mount-kalaga-national-park)
 * still resolves. When the bounds are a county fallback, the kind
 * is 'county' and the label says so, using resolveAreaBounds'
 * reason — a county extent is never presented as the op's own.
 * A region whose named area IS a county (region "Mariana County")
 * is 'county' too: its bounds are the counties.ts rect, an estimate
 * (the node's own extentNote says so), not the op's own extent.
 *
 * Shared extents: several ops name the same area (six name Port
 * Gellhorn), and several AREAS fall back to the same county rect
 * (Port Gellhorn, Emerald Springs and Frogswater all fall back to
 * Kelly County — eight ops over one rect). The pure result stays
 * one LikelyArea per op (each op keeps its own label);
 * groupLikelyAreas() collapses identical GEOMETRY for DRAWING only
 * — one dashed rect, one combined label naming every op in it —
 * keyed on the bounds, not the area, so three areas sharing one
 * county rect draw once, not three times on top of each other.
 */
import type { LayerDefinition, Place } from '../../domain/types';
import {
  GANG_OPERATIONS,
  type GangOperationRecord,
} from '../../data/gang-operations';
import {
  areaIdForRegion,
  resolveAreaBounds,
  type AreaNode,
} from '../../domain/geography';
import type { MapBounds } from './coordinates';

export const GANG_OP_LAYER_ID = 'gang-op';

/** 'own' — the named area's own extent. 'county' — a county extent
 *  standing in for it (the area has no extent of its own, or the
 *  area named IS a county). A county region is honest only when
 *  labelled as the county extent — never as the op's own. */
export type LikelyAreaKind = 'own' | 'county';

/** One gang op's likely-area region. Bounds, never a position: a
 *  region carries no point, so the marker pipeline can never pin
 *  it — at any zoom. */
export interface LikelyArea {
  /** The gang-op place id (`gang-op:<slug>`). */
  placeId: string;
  opId: string;
  name: string;
  gang: string;
  areaId: string;
  areaName: string;
  bounds: MapBounds;
  kind: LikelyAreaKind;
  /** The county whose extent this is, when kind is 'county'. */
  countyName: string | null;
  /** Why these bounds — resolveAreaBounds' reason verbatim for
   *  'own' and county-fallback, the county node's extentNote when
   *  the area named IS a county. */
  reason: string;
  /** "<op name> · likely area", or the county variant. */
  label: string;
}

export function likelyAreaLabel(
  name: string,
  kind: LikelyAreaKind,
  countyName: string | null,
): string {
  if (kind === 'county' && countyName) {
    return `${name} · likely area — ${countyName} extent (estimate)`;
  }
  return `${name} · likely area`;
}

/**
 * The area id for a gang-op region string, resolved against the
 * derived nodes. areaIdForRegion first (multi-segment paths are
 * exact); an exact node-path match second, for a region place whose
 * slug is not its title. Returns the areaIdForRegion result even
 * when it names no node — resolveAreaBounds then reports it
 * unknown, and the op classifies as 'none' with that reason.
 */
export function areaIdForGangOpRegion(
  region: string,
  areas: ReadonlyMap<string, AreaNode>,
): string | null {
  const direct = areaIdForRegion(region);
  if (direct === null) return null;
  if (areas.has(direct)) return direct;
  const wanted = region.trim().toLowerCase();
  for (const node of areas.values()) {
    if (node.path.toLowerCase() === wanted) return node.id;
  }
  return direct;
}

function resolveLikelyArea(
  areas: ReadonlyMap<string, AreaNode>,
  record: Pick<GangOperationRecord, 'id' | 'name' | 'gang' | 'region'>,
): LikelyArea | null {
  const areaId = areaIdForGangOpRegion(record.region, areas);
  if (!areaId) return null;
  const resolved = resolveAreaBounds(areas, areaId);
  if (!resolved.bounds) return null;
  const node = areas.get(areaId);
  const isCountyArea =
    node?.level === 'county' || areaId.startsWith('county:');
  const kind: LikelyAreaKind =
    isCountyArea || resolved.fallback === 'county' ? 'county' : 'own';
  const countyName =
    kind === 'county'
      ? (node?.level === 'county'
          ? node.name
          : resolved.countyId
            ? (areas.get(`county:${resolved.countyId}`)?.name ?? null)
            : null)
      : null;
  // A county area's own bounds ARE the county rect (an estimate):
  // resolveAreaBounds' "The area's own extent." would present the
  // county as the op's own, so the county node's extentNote — which
  // says it is an estimate — is the reason instead.
  const reason =
    kind === 'county' && isCountyArea
      ? (node?.extentNote ?? resolved.reason)
      : resolved.reason;
  return {
    placeId: record.id,
    opId: record.id,
    name: record.name,
    gang: record.gang,
    areaId,
    areaName: node?.name ?? node?.path ?? areaId,
    bounds: resolved.bounds,
    kind,
    countyName,
    reason,
    label: likelyAreaLabel(record.name, kind, countyName),
  };
}

/**
 * The likely-area region for one gang-op place, or null when it has
 * no extent to draw (its named area has no positioned members and
 * no county to fall back to, or names no known area). Null is the
 * honest empty state — the place stays listed by area only.
 */
export function likelyAreaForPlace(
  areas: ReadonlyMap<string, AreaNode>,
  place: Pick<Place, 'id' | 'title' | 'region'>,
): LikelyArea | null {
  return resolveLikelyArea(areas, {
    id: place.id,
    name: place.title,
    gang: '',
    region: place.region,
  });
}

/** True when the gang-op layer is on. Regions render ONLY then —
 *  the spoiler rule (off by default, visiblePlaces). A revealed
 *  gang-op place (Ask answer, Find tap) does NOT draw its region:
 *  a reveal shows that place, never its layer. */
export function gangOpLayerVisible(
  layers: readonly LayerDefinition[],
): boolean {
  return layers.some(
    (layer) => layer.id === GANG_OP_LAYER_ID && layer.visible,
  );
}

/**
 * Every drawable likely-area region for the gang-op places in view,
 * or [] when the layer is off. Zoom-independent by construction —
 * there is no zoom input, and a region carries bounds, never a
 * position, so zooming in can never turn one into a pin.
 */
export function gangOpLikelyAreas(
  areas: ReadonlyMap<string, AreaNode>,
  places: readonly Place[],
  layers: readonly LayerDefinition[],
): LikelyArea[] {
  if (!gangOpLayerVisible(layers)) return [];
  const regions: LikelyArea[] = [];
  for (const place of places) {
    if (place.layerId !== GANG_OP_LAYER_ID) continue;
    const region = likelyAreaForPlace(areas, place);
    if (region) regions.push(region);
  }
  return regions;
}

/** One drawable rect: every op sharing one exact extent. */
export interface LikelyAreaGroup {
  key: string;
  bounds: MapBounds;
  kind: LikelyAreaKind;
  countyName: string | null;
  /** The ops in this rect, in input order (in-game order). */
  areas: LikelyArea[];
  /** The combined label: every op name, then "likely area" once —
   *  plus the county-estimate suffix when the extent is a county's. */
  label: string;
}

export function groupLikelyAreas(
  regions: readonly LikelyArea[],
): LikelyAreaGroup[] {
  const groups = new Map<string, LikelyAreaGroup>();
  for (const region of regions) {
    const { west, east, south, north } = region.bounds;
    // Keyed on GEOMETRY (+ kind + county), not area: three areas
    // falling back to one county rect draw once, with one combined
    // label — not three identical rects with three labels piled on
    // the same centre.
    const key = [region.kind, region.countyName ?? '', west, east, south, north].join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.areas.push(region);
      existing.label = groupLabel(existing.areas, existing.kind, existing.countyName);
    } else {
      groups.set(key, {
        key,
        bounds: region.bounds,
        kind: region.kind,
        countyName: region.countyName,
        areas: [region],
        label: groupLabel([region], region.kind, region.countyName),
      });
    }
  }
  return [...groups.values()];
}

function groupLabel(
  regions: readonly LikelyArea[],
  kind: LikelyAreaKind,
  countyName: string | null,
): string {
  const names = regions.map((region) => region.name).join(' · ');
  if (kind === 'county' && countyName) {
    return `${names} · likely area — ${countyName} extent (estimate)`;
  }
  return `${names} · likely area`;
}

/** One op's bounds outcome, for the measurement. */
export type GangOpBoundsKind = 'hosted' | 'own' | 'county' | 'none';

export interface GangOpBoundsRow {
  opId: string;
  name: string;
  gang: string;
  order: number;
  region: string;
  areaId: string | null;
  kind: GangOpBoundsKind;
  /** The host building, when kind is 'hosted'. */
  hostLocationId?: string;
  /** County name, when kind is 'county'. */
  countyName?: string;
  reason: string;
}

export interface GangOpBoundsMeasurement {
  total: number;
  /** Rides on an existing building — no region is drawn. */
  hosted: number;
  /** The named area's own extent. */
  own: number;
  /** A county extent standing in for the named area (or the area
   *  named IS a county). */
  county: number;
  /** No extent to draw — listed by area only. */
  none: number;
  /** Regions actually drawn (own + county). */
  drawn: number;
  rows: GangOpBoundsRow[];
}

/**
 * The 39-op bounds measurement: every operation classified by
 * what its named area resolves to. Hosted ops are 'hosted' whatever
 * their region resolves to — the host building is their map
 * presence, not a region. The counts here are what the layer
 * description's honest numbers rest on; assert them in tests,
 * don't hardcode them.
 */
export function measureGangOpBounds(
  areas: ReadonlyMap<string, AreaNode>,
  records: readonly GangOperationRecord[] = GANG_OPERATIONS,
): GangOpBoundsMeasurement {
  const rows: GangOpBoundsRow[] = [];
  let hosted = 0;
  let own = 0;
  let county = 0;
  let none = 0;
  for (const record of records) {
    if (record.hostLocationId !== undefined) {
      hosted += 1;
      rows.push({
        opId: record.id,
        name: record.name,
        gang: record.gang,
        order: record.order,
        region: record.region,
        areaId: areaIdForGangOpRegion(record.region, areas),
        kind: 'hosted',
        hostLocationId: record.hostLocationId,
        reason: `Rides on the existing building ${record.hostLocationId} — no region is drawn.`,
      });
      continue;
    }
    const area = resolveLikelyArea(areas, record);
    if (!area) {
      none += 1;
      const areaId = areaIdForGangOpRegion(record.region, areas);
      const reason = areaId
        ? resolveAreaBounds(areas, areaId).reason
        : 'No area named.';
      rows.push({
        opId: record.id,
        name: record.name,
        gang: record.gang,
        order: record.order,
        region: record.region,
        areaId,
        kind: 'none',
        reason,
      });
      continue;
    }
    if (area.kind === 'county') {
      county += 1;
      rows.push({
        opId: record.id,
        name: record.name,
        gang: record.gang,
        order: record.order,
        region: record.region,
        areaId: area.areaId,
        kind: 'county',
        countyName: area.countyName ?? undefined,
        reason: area.reason,
      });
    } else {
      own += 1;
      rows.push({
        opId: record.id,
        name: record.name,
        gang: record.gang,
        order: record.order,
        region: record.region,
        areaId: area.areaId,
        kind: 'own',
        reason: area.reason,
      });
    }
  }
  return {
    total: records.length,
    hosted,
    own,
    county,
    none,
    drawn: own + county,
    rows,
  };
}
