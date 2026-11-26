import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { GANG_OPERATIONS, GANG_OP_PLACES } from '../../src/data/gang-operations';
import { retrieveForAsk } from '../../src/features/ask/retrieval';
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

  it('measures all 39 ops: 2 hosted, 27 own-bounds, 7 county-fallback, 3 no-extent, 34 drawn', () => {
    const db = buildFullDb();
    const measured = measureGangOpBounds(db.areas);
    expect(measured.total).toBe(39);
    expect(measured.hosted).toBe(2);
    expect(measured.own).toBe(27);
    expect(measured.county).toBe(7);
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
    expect(areaIdForGangOpRegion('Hamlet, Mariana County', db.areas)).toBe(
      'area:hamlet',
    );
    expect(areaIdForGangOpRegion('Watson Bay, Mariana County', db.areas)).toBe(
      'area:watson-bay',
    );
    expect(areaIdForGangOpRegion('Emerald Springs, Kelly County', db.areas)).toBe(
      'area:emerald-springs',
    );
    // Grassrivers is deliberately NOT redirected (lane 4b sanity
    // check — the bare node's extent is a 2-point sliver), and
    // Frogswater has no bare node at all: both stay qualified.
    expect(areaIdForGangOpRegion('Grassrivers, Mariana County', db.areas)).toBe(
      'area:grassrivers--mariana-county',
    );
    expect(areaIdForGangOpRegion('Frogswater, Kelly County', db.areas)).toBe(
      'area:frogswater--kelly-county',
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

  it('the merge is generalised to Hamlet, Watson Bay and Emerald Springs — but NOT Grassrivers, Starlet Motel or La Perle (v0.32 regions-fix, lane 4b)', () => {
    const db = buildFullDb();
    // The same qualified-vs-bare shape as Port Gellhorn, merged
    // by the coordinator's generalisation decision: the three
    // towns' ops now resolve to their town extents (own-bounds).
    for (const [region, townId] of [
      ['Hamlet, Mariana County', 'area:hamlet'],
      ['Watson Bay, Mariana County', 'area:watson-bay'],
      ['Emerald Springs, Kelly County', 'area:emerald-springs'],
    ] as const) {
      expect(areaIdForGangOpRegion(region, db.areas)).toBe(townId);
    }
    // Grassrivers is the deliberate exception: the bare node has
    // only 2 positioned members — L2943 ("?, Grassrivers",
    // UNKNOWN confidence) and L3389 ("Bridge, Grassrivers") —
    // 21 map units apart horizontally, 1,088 apart vertically,
    // so its padded bbox is a 421 × 1,488 sliver whose width is
    // 95% padding. That is not a town extent: Manatee Motel
    // keeps the Mariana County fallback.
    expect(areaIdForGangOpRegion('Grassrivers, Mariana County', db.areas)).toBe(
      'area:grassrivers--mariana-county',
    );
    const manatee = GANG_OP_PLACES.find((p) => p.id === 'gang-op:manatee-motel')!;
    const manateeRegion = likelyAreaForPlace(db.areas, manatee);
    expect(manateeRegion?.kind).toBe('county');
    expect(manateeRegion?.countyName).toBe('Mariana County');
    expect(manateeRegion?.areaId).toBe('area:grassrivers--mariana-county');
    expect(manateeRegion?.label).toBe(
      'Manatee Motel · likely area — Mariana County extent (estimate)',
    );
    // Frogswater has no bare node: Walker Farm stays county.
    const walker = GANG_OP_PLACES.find((p) => p.id === 'gang-op:walker-farm')!;
    const walkerRegion = likelyAreaForPlace(db.areas, walker);
    expect(walkerRegion?.kind).toBe('county');
    expect(walkerRegion?.countyName).toBe('Kelly County');
    expect(walkerRegion?.areaId).toBe('area:frogswater--kelly-county');
    // Scope guards: the qualified form is genuinely a different
    // place here, so no redirect fires — Starlet Motel is a real
    // sub-area (its own positioned member L1159, its own bounds),
    // and "La Perle, Vice City" and bare area:la-perle have
    // different bounds.
    expect(areaIdForGangOpRegion('Starlet Motel, Kelly County', db.areas)).toBe(
      'area:starlet-motel--kelly-county',
    );
    expect(areaIdForGangOpRegion('La Perle, Vice City', db.areas)).toBe(
      'area:la-perle--vice-city',
    );
    const laPerle = GANG_OP_PLACES.find(
      (p) => p.id === 'gang-op:la-perle-trap-house',
    )!;
    expect(likelyAreaForPlace(db.areas, laPerle)?.areaId).toBe(
      'area:la-perle--vice-city',
    );
    expect(likelyAreaForPlace(db.areas, laPerle)?.bounds).toEqual(
      db.areas.get('area:la-perle--vice-city')?.bounds,
    );
    expect(likelyAreaForPlace(db.areas, laPerle)?.bounds).not.toEqual(
      db.areas.get('area:la-perle')?.bounds,
    );
  });

  it('without the town node in the map, each qualified id is returned unchanged (no invented node)', () => {
    const empty = new Map();
    expect(areaIdForGangOpRegion('Port Gellhorn, Kelly County', empty)).toBe(
      'area:port-gellhorn--kelly-county',
    );
    expect(areaIdForGangOpRegion('Hamlet, Mariana County', empty)).toBe(
      'area:hamlet--mariana-county',
    );
    expect(areaIdForGangOpRegion('Watson Bay, Mariana County', empty)).toBe(
      'area:watson-bay--mariana-county',
    );
    expect(areaIdForGangOpRegion('Emerald Springs, Kelly County', empty)).toBe(
      'area:emerald-springs--kelly-county',
    );
    expect(areaIdForGangOpRegion('Grassrivers, Mariana County', empty)).toBe(
      'area:grassrivers--mariana-county',
    );
  });

  it('the three newly-merged towns draw their own extents, with exact bounds', () => {
    const db = buildFullDb();
    // Hamlet — M7 Compound. The town node: 175 direct members,
    // all positioned, parent county:mariana (plus a Prison,
    // Hamlet child node whose 10 members sit inside the bounds).
    const m7 = GANG_OP_PLACES.find((p) => p.id === 'gang-op:m7-compound')!;
    const m7Region = likelyAreaForPlace(db.areas, m7);
    expect(m7?.region).toBe('Hamlet, Mariana County');
    expect(m7Region?.kind).toBe('own');
    expect(m7Region?.countyName).toBeNull();
    expect(m7Region?.areaId).toBe('area:hamlet');
    expect(m7Region?.areaName).toBe('Hamlet');
    expect(m7Region?.bounds).toEqual(db.areas.get('area:hamlet')?.bounds);
    expect(m7Region?.bounds).toEqual({
      west: -3480.072948296937,
      east: -2005.38102213178,
      south: -4026.5847781958873,
      north: -2440.581,
    });
    expect(m7Region?.label).toBe('M7 Compound · likely area');
    expect(m7Region?.reason).toBe('The area’s own extent.');
    // Watson Bay — all three ops, one extent. The town node: 78
    // members, all positioned, parent county:mariana.
    const watsonBayBounds = {
      west: -6123.6121437835245,
      east: -3869.8948198560356,
      south: -3954.0969653242105,
      north: -2224.2386352058174,
    };
    for (const id of [
      'gang-op:palmer-fishing-warehouse',
      'gang-op:watson-bay-safehouse',
      'gang-op:mill-station-radar-base',
    ]) {
      const place = GANG_OP_PLACES.find((p) => p.id === id)!;
      const region = likelyAreaForPlace(db.areas, place);
      expect(place.region).toBe('Watson Bay, Mariana County');
      expect(region?.kind).toBe('own');
      expect(region?.countyName).toBeNull();
      expect(region?.areaId).toBe('area:watson-bay');
      expect(region?.areaName).toBe('Watson Bay');
      expect(region?.bounds).toEqual(watsonBayBounds);
      expect(region?.bounds).toEqual(db.areas.get('area:watson-bay')?.bounds);
      expect(region?.label).toBe(`${place.title} · likely area`);
      expect(region?.reason).toBe('The area’s own extent.');
    }
    // Emerald Springs — Gas Station Meth Front. The town node: 7
    // members, all positioned (L1111, L1627, L1778, L1779, L2889,
    // L2899, L3812), parent county:kelly.
    const gasStation = GANG_OP_PLACES.find(
      (p) => p.id === 'gang-op:gas-station-meth-front',
    )!;
    const gasRegion = likelyAreaForPlace(db.areas, gasStation);
    expect(gasStation.region).toBe('Emerald Springs, Kelly County');
    expect(gasRegion?.kind).toBe('own');
    expect(gasRegion?.countyName).toBeNull();
    expect(gasRegion?.areaId).toBe('area:emerald-springs');
    expect(gasRegion?.areaName).toBe('Emerald Springs');
    expect(gasRegion?.bounds).toEqual(
      db.areas.get('area:emerald-springs')?.bounds,
    );
    expect(gasRegion?.bounds).toEqual({
      west: -4729.169114876321,
      east: -3133.603410203587,
      south: 1235.362396286126,
      north: 2952.7691507797717,
    });
    expect(gasRegion?.label).toBe('Gas Station Meth Front · likely area');
    expect(gasRegion?.reason).toBe('The area’s own extent.');
    // The places still file under their qualified nodes — the
    // merge is gang-op resolution only.
    expect(db.locations.get('gang-op:m7-compound')?.areaId).toBe(
      'area:hamlet--mariana-county',
    );
    expect(db.locations.get('gang-op:palmer-fishing-warehouse')?.areaId).toBe(
      'area:watson-bay--mariana-county',
    );
    expect(db.locations.get('gang-op:gas-station-meth-front')?.areaId).toBe(
      'area:emerald-springs--kelly-county',
    );
  });

  it('the merge changes no Ask answer: every merged op still answers from its region + area lead, never from the resolved area id', () => {
    const ask = (question: string) =>
      retrieveForAsk({
        question,
        places: GANG_OP_PLACES,
        layers: DEFAULT_LAYERS,
        filters: { hideFound: false, remainingOnly: false, countyId: null },
      });
    // Brooks (lane 4) plus the five newly-merged ops: the answer
    // is built from record.region + record.areaLead, so the
    // resolution change must not move a word of it. The builder
    // (areaKnownSummaryFor) trims a leading "{town}, " from the
    // lead when the region already names it — assert the trimmed
    // detail, exactly as the builder computes it.
    for (const name of [
      'Brooks Boatworks',
      'M7 Compound',
      'Palmer Fishing Warehouse',
      'Watson Bay Safehouse',
      'Mill Station Radar Base',
      'Gas Station Meth Front',
    ]) {
      const record = GANG_OPERATIONS.find((op) => op.name === name)!;
      const result = ask(`where is ${name}?`);
      expect(result.records[0]?.id).toBe(record.id);
      expect(result.proximitySummary).toContain(record.region);
      const regionFirst = record.region.split(',')[0] ?? '';
      let detail = record.areaLead;
      if (detail.startsWith(`${regionFirst}, `)) {
        detail = detail.slice(regionFirst.length + 2);
      } else if (detail.endsWith(`, ${record.region}`)) {
        detail = detail.slice(0, -record.region.length - 2);
      } else if (detail === record.region) {
        detail = '';
      }
      if (detail) expect(result.proximitySummary).toContain(detail);
      expect(result.proximitySummary).toMatch(/no verified position/);
    }
    // And the two county stayers answer the same way.
    for (const name of ['Manatee Motel', 'Walker Farm']) {
      const record = GANG_OPERATIONS.find((op) => op.name === name)!;
      const result = ask(`where is ${name}?`);
      expect(result.records[0]?.id).toBe(record.id);
      expect(result.proximitySummary).toContain(record.region);
      const regionFirst = record.region.split(',')[0] ?? '';
      let detail = record.areaLead;
      if (detail.startsWith(`${regionFirst}, `)) {
        detail = detail.slice(regionFirst.length + 2);
      }
      if (detail) expect(result.proximitySummary).toContain(detail);
    }
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

  it('regions sharing one extent draw once: 34 regions group into 17 rects, Kelly County carrying Walker Farm alone, Mariana County carrying 2', () => {
    const db = buildFullDb();
    const regions = gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    const groups = groupLikelyAreas(regions);
    expect(groups).toHaveLength(17);
    // Kelly County: Gas Station Meth Front merged to its town
    // extent, so Walker Farm sits alone on the county rect.
    const kelly = groups.find((group) => group.countyName === 'Kelly County');
    expect(kelly?.areas).toHaveLength(1);
    expect(kelly?.areas.map((area) => area.name)).toEqual(['Walker Farm']);
    expect(kelly?.bounds).toEqual({ west: -9382, east: -3023, south: 596, north: 5626 });
    expect(kelly?.label).toBe(
      'Walker Farm · likely area — Kelly County extent (estimate)',
    );
    // Mariana County: Hamlet + Watson Bay merged out, so only
    // Manatee Motel (Grassrivers, no town extent) and the
    // county-named Industrial Weed Grow remain.
    const mariana = groups.find((group) => group.countyName === 'Mariana County');
    expect(mariana?.areas).toHaveLength(2);
    expect(mariana?.areas.map((area) => area.name).sort()).toEqual([
      'Industrial Weed Grow',
      'Manatee Motel',
    ]);
    expect(mariana?.label).toContain('likely area — Mariana County extent (estimate)');
    for (const name of mariana?.areas.map((area) => area.name) ?? []) {
      expect(mariana?.label).toContain(name);
    }
    // The three newly-merged town rects.
    const hamlet = groups.find((group) =>
      group.areas.some((area) => area.areaId === 'area:hamlet'),
    );
    expect(hamlet).toBeDefined();
    expect(hamlet?.kind).toBe('own');
    expect(hamlet?.areas.map((area) => area.name)).toEqual(['M7 Compound']);
    expect(hamlet?.bounds).toEqual(db.areas.get('area:hamlet')?.bounds);
    const watsonBay = groups.find((group) =>
      group.areas.some((area) => area.areaId === 'area:watson-bay'),
    );
    expect(watsonBay).toBeDefined();
    expect(watsonBay?.kind).toBe('own');
    expect(watsonBay?.areas).toHaveLength(3);
    expect(watsonBay?.areas.map((area) => area.name).sort()).toEqual([
      'Mill Station Radar Base',
      'Palmer Fishing Warehouse',
      'Watson Bay Safehouse',
    ]);
    expect(watsonBay?.bounds).toEqual(db.areas.get('area:watson-bay')?.bounds);
    const emeraldSprings = groups.find((group) =>
      group.areas.some((area) => area.areaId === 'area:emerald-springs'),
    );
    expect(emeraldSprings).toBeDefined();
    expect(emeraldSprings?.kind).toBe('own');
    expect(emeraldSprings?.areas.map((area) => area.name)).toEqual([
      'Gas Station Meth Front',
    ]);
    expect(emeraldSprings?.bounds).toEqual(
      db.areas.get('area:emerald-springs')?.bounds,
    );
    // No op still resolves to a merged qualified id.
    for (const qualifiedId of [
      'area:hamlet--mariana-county',
      'area:watson-bay--mariana-county',
      'area:emerald-springs--kelly-county',
    ]) {
      expect(
        groups.filter((group) =>
          group.areas.some((area) => area.areaId === qualifiedId),
        ),
      ).toHaveLength(0);
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
