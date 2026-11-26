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

  it('measures all 39 ops: 2 hosted, 16 own-bounds, 18 county-fallback, 3 no-extent, 34 drawn', () => {
    const db = buildFullDb();
    const measured = measureGangOpBounds(db.areas);
    expect(measured.total).toBe(39);
    expect(measured.hosted).toBe(2);
    expect(measured.own).toBe(16);
    expect(measured.county).toBe(18);
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
      'area:port-gellhorn--kelly-county',
    );
    expect(areaIdForGangOpRegion('Mariana County', db.areas)).toBe('county:mariana');
    expect(areaIdForGangOpRegion('Ambrosia', db.areas)).toBe('area:ambrosia');
    expect(areaIdForGangOpRegion('Vice City', db.areas)).toBe('area:vice-city');
  });

  it('Brooks Boatworks draws the KELLY COUNTY extent, not a Port Gellhorn extent — the Port Gellhorn node has no positioned members', () => {
    const db = buildFullDb();
    const place = GANG_OP_PLACES.find((p) => p.id === 'gang-op:brooks-boatworks')!;
    const region = likelyAreaForPlace(db.areas, place);
    expect(region).not.toBeNull();
    // The catalogue's Port Gellhorn places file under "Port
    // Gellhorn" (area:port-gellhorn); the guides name the ops
    // "Port Gellhorn, Kelly County" — a different node, with no
    // positioned members, so the county fallback fires.
    expect(region?.kind).toBe('county');
    expect(region?.countyName).toBe('Kelly County');
    expect(region?.areaId).toBe('area:port-gellhorn--kelly-county');
    expect(region?.bounds).toEqual(db.areas.get('county:kelly')?.bounds);
    expect(region?.label).toBe(
      'Brooks Boatworks · likely area — Kelly County extent (estimate)',
    );
    expect(region?.reason).toContain('No positioned places in Port Gellhorn');
    expect(region?.reason).toContain('Kelly County extent instead (estimate)');
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

  it('regions sharing one extent draw once: 34 regions group into 13 rects, Kelly County carrying 8 ops', () => {
    const db = buildFullDb();
    const regions = gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    const groups = groupLikelyAreas(regions);
    expect(groups).toHaveLength(13);
    const kelly = groups.find((group) => group.countyName === 'Kelly County');
    expect(kelly?.areas).toHaveLength(8);
    expect(kelly?.areas.map((area) => area.name).sort()).toEqual([
      'Backroom Weed Front',
      'Brooks Boatworks',
      'Gas Station Meth Front',
      'June Warehouse',
      'Kingpin Bowling',
      'La Cascara Motel',
      'Stash House',
      'Walker Farm',
    ]);
    expect(kelly?.label).toContain('likely area — Kelly County extent (estimate)');
    for (const name of kelly?.areas.map((area) => area.name) ?? []) {
      expect(kelly?.label).toContain(name);
    }
    // One Port Gellhorn rect, not six: the six ops share one group.
    expect(
      groups.filter((group) =>
        group.areas.some((area) => area.areaId === 'area:port-gellhorn--kelly-county'),
      ),
    ).toHaveLength(1);
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
