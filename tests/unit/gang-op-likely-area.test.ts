import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { GANG_OP_PLACES } from '../../src/data/gang-operations';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import { BASEMAP_BOUNDS } from '../../src/features/map/coordinates';
import {
  DEFAULT_LAYERS,
  getVisiblePlaces,
} from '../../src/features/map/layers';
import {
  areaIdForGangOpRegion,
  gangOpLikelyAreas,
  groupLikelyAreas,
  likelyAreaForPlace,
  measureGangOpBounds,
} from '../../src/features/map/likely-area';
import { buildSpatialIndex, querySpatialIndex } from '../../src/features/map/spatial';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function buildFullDb(): GameDatabase {
  return buildGameDatabase({ places: catalogueFromSnapshot(snapshot) });
}

function gangOpLayersOn(): typeof DEFAULT_LAYERS {
  return DEFAULT_LAYERS.map((layer) =>
    layer.id === 'gang-op' ? { ...layer, visible: true } : layer,
  );
}

describe('gang-op likely-area measurement (v0.32 lane 1)', () => {
  it('the layer description states the measured likely-area split — asserted against the live measurement', () => {
    const db = buildFullDb();
    const measured = measureGangOpBounds(db.areas);
    expect(measured.total).toBe(39);
    const description =
      DEFAULT_LAYERS.find((layer) => layer.id === 'gang-op')?.description ??
      '';
    expect(description).toContain(`${measured.own} draw their own area's extent`);
    expect(description).toContain(`${measured.county} draw a county extent instead`);
    expect(description).toContain(`${measured.none} have no extent to draw`);
  });

  it('measures all 39 ops: 2 hosted, 22 own-bounds, 12 county-fallback, 3 no-extent, 34 drawn', () => {
    const db = buildFullDb();
    const measured = measureGangOpBounds(db.areas);
    expect(measured.total).toBe(39);
    expect(measured.hosted).toBe(2);
    expect(measured.own).toBe(22);
    expect(measured.county).toBe(12);
    expect(measured.none).toBe(3);
    expect(measured.drawn).toBe(34);
    expect(measured.hosted + measured.own + measured.county + measured.none).toBe(39);
    expect(measured.rows).toHaveLength(39);
    expect(
      measured.rows.filter((row) => row.kind === 'hosted').map((row) => row.name).sort(),
    ).toEqual(['Parlor Apartments', 'Sunrise RV Park']);
    expect(
      measured.rows.filter((row) => row.kind === 'none').map((row) => row.name).sort(),
    ).toEqual([
      'Chatfield Storage & Logistics',
      'Fishing Shacks',
      'Vespucci Mansion',
    ]);
  });

  it('resolves area ids from the full region path, counties included', () => {
    const db = buildFullDb();
    expect(areaIdForGangOpRegion('Port Gellhorn, Kelly County', db.areas)).toBe(
      'area:port-gellhorn',
    );
    expect(areaIdForGangOpRegion('Mariana County', db.areas)).toBe('county:mariana');
    expect(areaIdForGangOpRegion('Ambrosia', db.areas)).toBe('area:ambrosia');
    expect(areaIdForGangOpRegion('Vice City', db.areas)).toBe('area:vice-city');
  });

  it('Brooks Boatworks draws the PORT GELLHORN town extent — the guides’ county-qualified name is the same town (v0.32 regions-fix, lane 4)', () => {
    const db = buildFullDb();
    const place = GANG_OP_PLACES.find((p) => p.id === 'gang-op:brooks-boatworks')!;
    const region = likelyAreaForPlace(db.areas, place);
    expect(region).not.toBeNull();
    // The guides name the ops "Port Gellhorn, Kelly County" and
    // the catalogue's Port Gellhorn is the TOWN area:port-gellhorn
    // (337 member places, 335 positioned, parent county:kelly) —
    // same place, county-qualified naming — so the gang-op
    // resolution draws the town extent. The guides' words are
    // untouched: the record region is still the qualified string,
    // and the place still files under the qualified node; only
    // this resolution changes.
    expect(place.region).toBe('Port Gellhorn, Kelly County');
    expect(db.locations.get('gang-op:brooks-boatworks')?.areaId).toBe(
      'area:port-gellhorn--kelly-county',
    );
    expect(region?.kind).toBe('own');
    expect(region?.countyName).toBeNull();
    expect(region?.areaId).toBe('area:port-gellhorn');
    expect(region?.areaName).toBe('Port Gellhorn');
    expect(region?.bounds).toEqual(db.areas.get('area:port-gellhorn')?.bounds);
    expect(region?.bounds).toEqual({
      west: -8213.502793266167,
      east: -5403.483414978226,
      south: 1829.856884400902,
      north: 5730.9954744969755,
    });
    expect(region?.label).toBe('Brooks Boatworks · likely area');
    expect(region?.reason).toBe('The area’s own extent.');
  });

  it('the merge is scoped to Port Gellhorn: the other qualified-vs-bare towns still fall back to their county', () => {
    const db = buildFullDb();
    // Same qualified-vs-bare shape (Grassrivers, Hamlet, Watson
    // Bay, Emerald Springs) — left for the coordinator to rule on;
    // this lane merges Port Gellhorn only.
    expect(areaIdForGangOpRegion('Grassrivers, Mariana County', db.areas)).toBe(
      'area:grassrivers--mariana-county',
    );
    expect(areaIdForGangOpRegion('Emerald Springs, Kelly County', db.areas)).toBe(
      'area:emerald-springs--kelly-county',
    );
    const manatee = GANG_OP_PLACES.find((p) => p.id === 'gang-op:manatee-motel')!;
    expect(likelyAreaForPlace(db.areas, manatee)?.kind).toBe('county');
    const gasStation = GANG_OP_PLACES.find(
      (p) => p.id === 'gang-op:gas-station-meth-front',
    )!;
    const gasRegion = likelyAreaForPlace(db.areas, gasStation);
    expect(gasRegion?.kind).toBe('county');
    expect(gasRegion?.countyName).toBe('Kelly County');
  });

  it('without the town node in the map, the qualified id is returned unchanged (no invented node)', () => {
    expect(
      areaIdForGangOpRegion('Port Gellhorn, Kelly County', new Map()),
    ).toBe('area:port-gellhorn--kelly-county');
  });

  it('an own-bounds op draws its named area: Hog Stars Garage → Ambrosia extent', () => {
    const db = buildFullDb();
    const place = GANG_OP_PLACES.find((p) => p.id === 'gang-op:hog-stars-garage')!;
    const region = likelyAreaForPlace(db.areas, place);
    expect(region).not.toBeNull();
    expect(region?.kind).toBe('own');
    expect(region?.areaId).toBe('area:ambrosia');
    expect(region?.bounds).toEqual(db.areas.get('area:ambrosia')?.bounds);
    expect(region?.label).toBe('Hog Stars Garage · likely area');
    expect(region?.countyName).toBeNull();
  });

  it('a county-fallback region is labelled as an estimate, with the county named', () => {
    const db = buildFullDb();
    const place = GANG_OP_PLACES.find((p) => p.id === 'gang-op:manatee-motel')!;
    const region = likelyAreaForPlace(db.areas, place);
    expect(region?.kind).toBe('county');
    expect(region?.countyName).toBe('Mariana County');
    expect(region?.label).toBe(
      'Manatee Motel · likely area — Mariana County extent (estimate)',
    );
    // A region named as a county IS a county extent too.
    const weedGrow = GANG_OP_PLACES.find((p) => p.id === 'gang-op:weed-grow')!;
    const countyRegion = likelyAreaForPlace(db.areas, weedGrow);
    expect(countyRegion?.kind).toBe('county');
    expect(countyRegion?.countyName).toBe('Lummox County');
    expect(countyRegion?.label).toBe(
      'Weed Grow · likely area — Lummox County extent (estimate)',
    );
    expect(countyRegion?.reason).toContain('labelled estimate');
  });

  it('a no-extent op renders nothing: Fishing Shacks, Chatfield, Vespucci Mansion', () => {
    const db = buildFullDb();
    for (const id of [
      'gang-op:fishing-shacks',
      'gang-op:chatfield-storage-logistics',
      'gang-op:vespucci-mansion',
    ]) {
      const place = GANG_OP_PLACES.find((p) => p.id === id)!;
      expect(likelyAreaForPlace(db.areas, place)).toBeNull();
    }
    const measured = measureGangOpBounds(db.areas);
    expect(
      measured.rows
        .filter((row) => row.kind === 'none')
        .map((row) => row.reason),
    ).toEqual([
      'No positioned places in Wetman Bay, and no county extent to fall back to.',
      'No positioned places in Waxman Island, and no county extent to fall back to.',
      'No positioned places in Vespucci Island, and no county extent to fall back to.',
    ]);
  });

  it('layer off → no regions; layer on → 34 regions, matching the measurement', () => {
    const db = buildFullDb();
    expect(gangOpLikelyAreas(db.areas, GANG_OP_PLACES, DEFAULT_LAYERS)).toEqual([]);
    const regions = gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    expect(regions).toHaveLength(34);
    expect(regions).toHaveLength(measureGangOpBounds(db.areas).drawn);
    // Every region is bounds, never a point.
    for (const region of regions) {
      expect(region.bounds).toBeDefined();
      expect('position' in region).toBe(false);
    }
  });

  it('regions sharing one extent draw once: 34 regions group into 14 rects, Kelly County carrying 2 ops, Port Gellhorn town carrying 6', () => {
    const db = buildFullDb();
    const regions = gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    const groups = groupLikelyAreas(regions);
    expect(groups).toHaveLength(14);
    const kelly = groups.find((group) => group.countyName === 'Kelly County');
    expect(kelly?.areas).toHaveLength(2);
    expect(kelly?.areas.map((area) => area.name).sort()).toEqual([
      'Gas Station Meth Front',
      'Walker Farm',
    ]);
    expect(kelly?.label).toContain('likely area — Kelly County extent (estimate)');
    for (const name of kelly?.areas.map((area) => area.name) ?? []) {
      expect(kelly?.label).toContain(name);
    }
    // The six Port Gellhorn ops draw the town extent as one rect,
    // not six — and no longer share the Kelly County rect.
    const portGellhorn = groups.find((group) =>
      group.areas.some((area) => area.areaId === 'area:port-gellhorn'),
    );
    expect(portGellhorn).toBeDefined();
    expect(portGellhorn?.kind).toBe('own');
    expect(portGellhorn?.countyName).toBeNull();
    expect(portGellhorn?.areas).toHaveLength(6);
    expect(portGellhorn?.areas.map((area) => area.name).sort()).toEqual([
      'Backroom Weed Front',
      'Brooks Boatworks',
      'June Warehouse',
      'Kingpin Bowling',
      'La Cascara Motel',
      'Stash House',
    ]);
    expect(portGellhorn?.bounds).toEqual(db.areas.get('area:port-gellhorn')?.bounds);
    expect(portGellhorn?.label).toContain('likely area');
    expect(portGellhorn?.label).not.toContain('Kelly County');
    expect(
      groups.filter((group) =>
        group.areas.some((area) => area.areaId === 'area:port-gellhorn--kelly-county'),
      ),
    ).toHaveLength(0);
  });

  it('zoom can never turn a region into a pin: regions are zoom-independent and gang-op places are unpositioned', () => {
    const db = buildFullDb();
    const layers = gangOpLayersOn();
    // No zoom input exists: the same call is the answer at island
    // zoom and at street zoom alike.
    const regions = gangOpLikelyAreas(db.areas, GANG_OP_PLACES, layers);
    expect(gangOpLikelyAreas(db.areas, GANG_OP_PLACES, layers)).toEqual(regions);
    // The places are visible with the layer on (Find lists them)
    // yet carry no position — and the spatial index, which is what
    // the marker pipeline pins from, holds none of them at any zoom.
    expect(
      getVisiblePlaces(GANG_OP_PLACES, layers).map((p) => p.id).sort(),
    ).toEqual(GANG_OP_PLACES.map((p) => p.id).sort());
    const index = buildSpatialIndex(GANG_OP_PLACES);
    expect(querySpatialIndex(index, BASEMAP_BOUNDS)).toEqual([]);
  });
});
