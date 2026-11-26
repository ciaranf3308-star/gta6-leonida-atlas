import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { COUNTIES } from '../../src/data/counties';
import { BASEMAP_BOUNDS } from '../../src/features/map/coordinates';
import { areaIsolation, areaOptions } from '../../src/features/map/isolation';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import {
  areaCentroid,
  areaIdForRegion,
  areaNoExtentMessage,
  breadcrumbChain,
  directLocationIds,
  deriveAreaNodes,
  geoLabelsForView,
  geoLabelVisibleAtZoom,
  parseRegionPath,
  resolveAreaBounds,
  STATE_NODE_ID,
} from '../../src/domain/geography';

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

/** Grounded counts (GTADB 2e9e194, counted 2026-11-26): distinct
 * region strings (address minus its first segment), and how many
 * have a named place (GTADB evidence.name KNOWN). */
function groundedRegionCounts(): {
  distinct: number;
  withNamed: number;
  namedUnder50: number;
  exactlyOne: number;
} {
  const regions = new Map<string, { total: number; named: number }>();
  for (const record of snapshot.landmarks as {
    inGameAddress?: string;
    evidence?: { name?: string };
  }[]) {
    const address = (record.inGameAddress ?? '').trim();
    const region = address.split(',').slice(1).join(',').trim();
    if (!region) continue;
    const entry = regions.get(region) ?? { total: 0, named: 0 };
    entry.total += 1;
    if (record.evidence?.name === 'KNOWN') entry.named += 1;
    regions.set(region, entry);
  }
  return {
    distinct: regions.size,
    withNamed: [...regions.values()].filter((e) => e.named >= 1).length,
    namedUnder50: [...regions.values()].filter((e) => e.named >= 1 && e.total < 50)
      .length,
    exactlyOne: [...regions.values()].filter((e) => e.total === 1).length,
  };
}

describe('geography — §6.1 hierarchy (step 4)', () => {
  it('pins the grounded counts: 149 distinct region strings, 110 with a named place, 81 named under 50, 47 with exactly 1 place', () => {
    const counts = groundedRegionCounts();
    expect(counts.distinct).toBe(149);
    expect(counts.withNamed).toBe(110);
    expect(counts.namedUnder50).toBe(81);
    expect(counts.exactlyOne).toBe(47);
  });

  it('derives 126 area nodes: 1 state + 5 counties + 120 areas', () => {
    const db = buildFullDb();
    expect(db.areas.size).toBe(126);
    const byLevel = new Map<string, number>();
    for (const node of db.areas.values()) {
      byLevel.set(node.level, (byLevel.get(node.level) ?? 0) + 1);
    }
    expect(byLevel.get('state')).toBe(1);
    expect(byLevel.get('county')).toBe(5);
    // 2 cities (§6.1: Vice City and Vice Beach only). Port Gellhorn
    // is a TOWN, so both Port Gellhorn nodes are towns — the
    // 1-member path node "Port Gellhorn, Kelly County" included.
    expect(byLevel.get('city')).toBe(2);
    expect(byLevel.get('town')).toBe(89);
    expect(byLevel.get('neighbourhood')).toBe(22);
    expect(byLevel.get('district')).toBe(7);
  });

  it('parses region paths: streets drop, the last segment never does', () => {
    expect(parseRegionPath('Downtown, Vice City')).toEqual(['Downtown', 'Vice City']);
    expect(parseRegionPath('Shore Dr, Ocean Beach, Vice Beach')).toEqual([
      'Ocean Beach',
      'Vice Beach',
    ]);
    expect(parseRegionPath('Crosstown, Catalan Blvd, Vice City')).toEqual([
      'Vice City',
    ]);
    expect(parseRegionPath('Historic Route 628, Kelly County')).toEqual([
      'Kelly County',
    ]);
    expect(parseRegionPath('Interstate 404, Port Gellhorn')).toEqual([
      'Port Gellhorn',
    ]);
    expect(parseRegionPath('Port Gellhorn')).toEqual(['Port Gellhorn']);
    expect(parseRegionPath('')).toEqual([]);
    expect(parseRegionPath('My markers')).toEqual([]);
  });

  it('resolves area ids from the full path, not the last segment', () => {
    expect(areaIdForRegion('Downtown, Vice City')).toBe('area:downtown--vice-city');
    expect(areaIdForRegion('Vice City')).toBe('area:vice-city');
    expect(areaIdForRegion('Historic Route 628, Kelly County')).toBe(
      'county:kelly',
    );
    expect(areaIdForRegion('Leonida')).toBe('state:leonida');
    expect(areaIdForRegion('Mount Kalaga National Park')).toBe(
      'area:mount-kalaga-national-park',
    );
    expect(areaIdForRegion('Mount Kalaga, Lummox County')).toBe(
      'area:mount-kalaga--lummox-county',
    );
    // The one case typo in the data heals: "Vice CIty" is Vice City.
    expect(areaIdForRegion('Stockyard, Vice CIty')).toBe(
      'area:stockyard--vice-city',
    );
    expect(areaIdForRegion('')).toBeNull();
    expect(areaIdForRegion('My markers')).toBeNull();
  });

  it('parents every node: Downtown → Vice City → Vice-Dale → Leonida', () => {
    const db = buildFullDb();
    const downtown = db.areas.get('area:downtown--vice-city')!;
    expect(downtown.parentId).toBe('area:vice-city');
    expect(downtown.level).toBe('neighbourhood');
    const viceCity = db.areas.get('area:vice-city')!;
    expect(viceCity.parentId).toBe('county:vice-dale');
    expect(viceCity.level).toBe('city');
    expect(viceCity.childrenIds).toContain('area:downtown--vice-city');
    expect(viceCity.childrenIds).toHaveLength(19);
    expect(
      breadcrumbChain(db.areas, 'area:downtown--vice-city').map((n) => n.name),
    ).toEqual(['Leonida', 'Vice-Dale County', 'Vice City', 'Downtown']);
    const portGellhorn = db.areas.get('area:port-gellhorn')!;
    expect(portGellhorn.parentId).toBe('county:kelly');
    expect(portGellhorn.level).toBe('town');
    expect(portGellhorn.childrenIds).toEqual([]);
    const state = db.areas.get(STATE_NODE_ID)!;
    expect(state.parentId).toBeNull();
    expect(state.childrenIds).toContain('county:vice-dale');
  });

  it('keeps same-name areas apart by path: two Baysides, two Port Gellhorns', () => {
    const db = buildFullDb();
    const baysides = [...db.areas.values()].filter((n) => n.name === 'Bayside');
    expect(baysides.map((n) => n.id).sort()).toEqual([
      'area:bayside',
      'area:bayside--vice-city',
    ]);
    expect(baysides.map((n) => n.path).sort()).toEqual([
      'Bayside',
      'Bayside, Vice City',
    ]);
    expect(baysides.map((n) => n.level).sort()).toEqual([
      'neighbourhood',
      'town',
    ]);
    const portGellhorns = [...db.areas.values()].filter(
      (n) => n.name === 'Port Gellhorn',
    );
    expect(portGellhorns.map((n) => n.path).sort()).toEqual([
      'Port Gellhorn',
      'Port Gellhorn, Kelly County',
    ]);
    // Both are towns (§6.1) — including the 1-member disambiguation
    // node, which step 4 wrongly counted as a city.
    expect(portGellhorns.map((n) => n.level).sort()).toEqual([
      'town',
      'town',
    ]);
  });

  it('membership is the hierarchy: Vice City holds its neighbourhoods too', () => {
    const db = buildFullDb();
    const viceCity = db.areas.get('area:vice-city')!;
    expect(viceCity.locationIds.length).toBe(1157);
    const downtown = db.areas.get('area:downtown--vice-city')!;
    expect(downtown.locationIds.length).toBe(141);
    for (const memberId of downtown.locationIds) {
      expect(viceCity.locationIds).toContain(memberId);
    }
    // Direct members are the exact-path places only.
    expect(directLocationIds(db.areas, 'area:downtown--vice-city')).toHaveLength(141);
    expect(directLocationIds(db.areas, 'area:vice-city')).toHaveLength(62);
    // The state counts each place once, even Ambrosia's (listed
    // under both counties).
    expect(db.areas.get(STATE_NODE_ID)!.locationIds.length).toBe(4266);
    expect(new Set(db.areas.get(STATE_NODE_ID)!.locationIds).size).toBe(4266);
  });

  it('Ambrosia is county-disputed: no single parent, both claims, listed under both', () => {
    const db = buildFullDb();
    const ambrosia = db.areas.get('area:ambrosia')!;
    expect(ambrosia.parentId).toBeNull();
    expect(ambrosia.countyDisputed).toEqual({
      claims: [
        { countyId: 'leonard', source: 'Output Lag' },
        { countyId: 'kelly', source: 'GTA Base' },
      ],
    });
    expect(db.areas.get('county:leonard')!.childrenIds).toContain('area:ambrosia');
    expect(db.areas.get('county:kelly')!.childrenIds).toContain('area:ambrosia');
    expect(breadcrumbChain(db.areas, 'area:ambrosia').map((n) => n.name)).toEqual([
      'Leonida',
      'Ambrosia',
    ]);
  });
});

describe('geography — §6.1 extents (step 4)', () => {
  it('§6.2 town isolation keeps the rect outline, labelled "estimated extent"', () => {
    const places = catalogueFromSnapshot(snapshot);
    const isolation = areaIsolation('Capri', places);
    expect(isolation).not.toBeNull();
    expect(isolation!.label).toBe('Capri');
    // No opt-out exists: the Isolation type has no noOutline flag,
    // so the layer builder draws the rect outline unconditionally
    // (counties keep their traced coastline via countyId instead).
    expect(isolation!).not.toHaveProperty('noOutline');
    expect(isolation!.countyId).toBeUndefined();
    // The extent is named "estimated extent" where the area UI
    // shows it (AreaPage extent note).
    const db = buildFullDb();
    expect(db.areas.get('area:capri')!.extentNote).toMatch(/estimated extent/);
    expect(db.areas.get('area:capri')!.extentNote).toMatch(
      /no official boundary/,
    );
  });

  it('bounds a city by its positioned members, padded 12% / ≥200 units', () => {
    const db = buildFullDb();
    const viceCity = db.areas.get('area:vice-city')!;
    expect(viceCity.bounds).not.toBeNull();
    const members = viceCity.locationIds
      .map((id) => db.locations.get(id)!)
      .filter((location) => location.position);
    const minX = Math.min(...members.map((m) => m.position!.x));
    const maxX = Math.max(...members.map((m) => m.position!.x));
    const minY = Math.min(...members.map((m) => m.position!.y));
    const maxY = Math.max(...members.map((m) => m.position!.y));
    // Padded: the box is strictly larger than the member bbox, by
    // at least 200 units on every side.
    expect(viceCity.bounds!.west).toBeLessThanOrEqual(minX - 200);
    expect(viceCity.bounds!.east).toBeGreaterThanOrEqual(maxX + 200);
    expect(viceCity.bounds!.south).toBeLessThanOrEqual(minY - 200);
    expect(viceCity.bounds!.north).toBeGreaterThanOrEqual(maxY + 200);
    expect(viceCity.extentNote).toMatch(/estimate/);
    expect(viceCity.extentNote).toMatch(/no official boundary/);
    // Selecting an area focuses its OWN bounds, not the county's.
    const county = db.areas.get('county:vice-dale')!;
    expect(viceCity.bounds).not.toEqual(county.bounds);
  });

  it('county bounds are today’s counties.ts rects, labelled estimates', () => {
    const db = buildFullDb();
    for (const county of COUNTIES) {
      const node = db.areas.get(`county:${county.id}`)!;
      expect(node.bounds).toEqual(county.bounds);
      expect(node.extentNote).toMatch(/labelled estimate/);
    }
    const kelly = db.areas.get('county:kelly')!;
    expect(kelly.bounds).toEqual({ west: -9382, east: -3023, south: 596, north: 5626 });
    expect(kelly.locationIds).toContain('L304');
  });

  it('state bounds are the whole-map rect', () => {
    const db = buildFullDb();
    expect(db.areas.get(STATE_NODE_ID)!.bounds).toEqual(BASEMAP_BOUNDS);
  });

  it('bounds are null when the area has no positioned members — still selectable', () => {
    const db = buildFullDb();
    const nullBounds = [...db.areas.values()]
      .filter((node) => node.bounds === null)
      .map((node) => node.id)
      .sort();
    expect(nullBounds).toEqual([
      'area:grassrivers--mariana-county',
      'area:lost-vista',
      'area:port-gellhorn--kelly-county',
      'area:scattered-pines',
      'area:st-joseph--leonida',
      'area:sundown--leonida',
    ]);
    const lostVista = db.areas.get('area:lost-vista')!;
    expect(lostVista.locationIds.length).toBe(1);
    expect(lostVista.extentNote).toMatch(/still selectable and searchable/);
    // The honest empty state names the NAMED member count.
    const named = lostVista.locationIds.filter(
      (id) => db.locations.get(id)?.name,
    ).length;
    expect(areaNoExtentMessage(named)).toBe(
      'No positioned places here yet — 1 named place, all unpositioned',
    );
    expect(areaNoExtentMessage(3)).toBe(
      'No positioned places here yet — 3 named places, all unpositioned',
    );
  });

  it('§6.3 View Area: own bounds, county fallback only when the area has none — and never for a disputed area', () => {
    const db = buildFullDb();
    const downtown = resolveAreaBounds(db.areas, 'area:downtown--vice-city');
    expect(downtown.fallback).toBe('none');
    expect(downtown.bounds).toEqual(
      db.areas.get('area:downtown--vice-city')!.bounds,
    );
    const grassrivers = resolveAreaBounds(
      db.areas,
      'area:grassrivers--mariana-county',
    );
    expect(grassrivers.fallback).toBe('county');
    expect(grassrivers.countyId).toBe('mariana');
    expect(grassrivers.bounds).toEqual(
      db.areas.get('county:mariana')!.bounds,
    );
    expect(grassrivers.reason).toMatch(/showing the Mariana County extent instead/);
    const lostVista = resolveAreaBounds(db.areas, 'area:lost-vista');
    expect(lostVista.bounds).toBeNull();
    expect(lostVista.fallback).toBe('none');
    const ambrosia = resolveAreaBounds(db.areas, 'area:ambrosia');
    expect(ambrosia.fallback).toBe('none');
    expect(ambrosia.bounds).toEqual(db.areas.get('area:ambrosia')!.bounds);
    expect(resolveAreaBounds(db.areas, 'area:no-such-area').bounds).toBeNull();
  });
});

describe('geography — §6.4 geo labels (step 4)', () => {
  it('zoom bands: counties at island zoom, cities/towns at district zoom, neighbourhoods/districts at street zoom', () => {
    expect(geoLabelVisibleAtZoom('county', -5)).toBe(true);
    expect(geoLabelVisibleAtZoom('county', -2)).toBe(false);
    expect(geoLabelVisibleAtZoom('city', -2)).toBe(true);
    expect(geoLabelVisibleAtZoom('town', -2)).toBe(true);
    expect(geoLabelVisibleAtZoom('city', -0.5)).toBe(true);
    expect(geoLabelVisibleAtZoom('city', 0)).toBe(false);
    expect(geoLabelVisibleAtZoom('neighbourhood', 0)).toBe(true);
    expect(geoLabelVisibleAtZoom('district', 1)).toBe(true);
    expect(geoLabelVisibleAtZoom('neighbourhood', -2)).toBe(false);
    expect(geoLabelVisibleAtZoom('state', -5)).toBe(false);
  });

  it('labels for the whole map: 5 counties at island zoom, 85 at district zoom, 29 at street zoom', () => {
    const db = buildFullDb();
    const whole = { ...BASEMAP_BOUNDS };
    const island = geoLabelsForView(db.areas, -5, whole);
    expect(island.map((label) => label.name).sort()).toEqual([
      'Kelly County',
      'Leonard County',
      'Lummox County',
      'Mariana County',
      'Vice-Dale County',
    ]);
    expect(geoLabelsForView(db.areas, -2, whole)).toHaveLength(85);
    expect(geoLabelsForView(db.areas, 0, whole)).toHaveLength(29);
    expect(geoLabelsForView(db.areas, 1, whole)).toHaveLength(29);
    // Labels sit at the area centroid (member-bbox centre).
    const downtown = db.areas.get('area:downtown--vice-city')!;
    const centroid = areaCentroid(downtown)!;
    const street = geoLabelsForView(db.areas, 0, whole);
    const downtownLabel = street.find((l) => l.areaId === downtown.id)!;
    expect(downtownLabel.position).toEqual(centroid);
  });

  it('the selected area gets no label, and labels outside the viewport are skipped', () => {
    const db = buildFullDb();
    const whole = { ...BASEMAP_BOUNDS };
    const withSelected = geoLabelsForView(db.areas, -5, whole, 'county:kelly');
    expect(withSelected.map((l) => l.areaId)).not.toContain('county:kelly');
    expect(withSelected).toHaveLength(4);
    const viceCityView = { west: -3779, east: 2559, south: -2650, north: 3235 };
    const district = geoLabelsForView(db.areas, -2, viceCityView);
    expect(district.map((l) => l.name)).toContain('Vice City');
    expect(district.map((l) => l.name)).not.toContain('Port Gellhorn');
  });
});

describe('geography — §6.5 every named area is selectable (no 50/150/top-15)', () => {
  it('areaOptions offers every parsed area, including one-place areas, with no cap', () => {
    const places = catalogueFromSnapshot(snapshot);
    const options = areaOptions(places);
    // 107 parsed paths + suffix parents (from the 149 region
    // strings), plus the loot/guide/breakable regions in the
    // catalogue — far past the old top-15 cap.
    expect(options.length).toBeGreaterThan(100);
    expect(options.map((o) => o.name)).toContain('Capri');
    expect(options.map((o) => o.name)).toContain('Port Gellhorn');
    expect(options.map((o) => o.name)).toContain('Vice City');
    expect(options.map((o) => o.name)).toContain('Downtown, Vice City');
    // A one-place area is offered: "Liberty State?" has 1 place.
    const liberty = options.find((o) => o.name === 'Liberty State?');
    expect(liberty).toBeDefined();
    expect(liberty!.count).toBe(1);
    // A city's count is the whole city, not just the exact-name places.
    expect(options.find((o) => o.name === 'Vice City')!.count).toBeGreaterThan(1000);
    expect(options.find((o) => o.name === 'Capri')!.count).toBeGreaterThan(100);
  });

  it('every node is reachable by breadcrumb and has a parent chain to the state', () => {
    const db = buildFullDb();
    for (const node of db.areas.values()) {
      const chain = breadcrumbChain(db.areas, node.id);
      expect(chain[0]!.id).toBe(STATE_NODE_ID);
      expect(chain[chain.length - 1]!.id).toBe(node.id);
    }
  });

  it('deriveAreaNodes on synthetic locations builds the hierarchy without the snapshot', () => {
    const nodes = deriveAreaNodes(
      [{ id: 'region:vice-city', title: 'Vice City' }],
      [
        {
          id: 'L1',
          name: 'A shop',
          nameUncertain: false,
          position: { x: 0, y: 0 },
          placement: 'pinned',
          areaId: 'area:downtown--vice-city',
          footprint: null,
          evidence: [],
          tags: [],
          description: '',
        },
        {
          id: 'L2',
          name: null,
          nameUncertain: true,
          position: null,
          placement: 'area-known',
          areaId: 'area:lost-vista',
          footprint: null,
          evidence: [],
          tags: [],
          description: '',
        },
      ] as unknown as Parameters<typeof deriveAreaNodes>[1],
    );
    const downtown = nodes.get('area:downtown--vice-city')!;
    expect(downtown.parentId).toBe('area:vice-city');
    expect(downtown.locationIds).toEqual(['L1']);
    expect(downtown.bounds).not.toBeNull();
    const lostVista = nodes.get('area:lost-vista')!;
    expect(lostVista.bounds).toBeNull();
    expect(nodes.get('area:vice-city')!.locationIds).toEqual(['L1']);
    expect(nodes.get(STATE_NODE_ID)).toBeDefined();
    expect(nodes.get('county:vice-dale')).toBeDefined();
    expect(nodes.get('county:vice-dale')!.childrenIds).toContain('area:vice-city');
  });
});
