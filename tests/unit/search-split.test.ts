import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import {
  GEO_NO_MATCH,
  clearAllSearch,
  clearGeoSearch,
  clearPoiSearch,
  createSearchSplitState,
  geoNoMatchCounties,
  levenshtein,
  nearestSpelling,
  poiNoMatchMessage,
  poiUnpositionedMessage,
  revealPoiResult,
  searchAreas,
  searchPoi,
} from '../../src/domain/search';
import { useSearchSplitStore } from '../../src/stores/search-split';

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

describe('search — §6.5a geographical search (areas only)', () => {
  it('ranks exact first, then prefix, then typo', () => {
    const db = buildFullDb();
    const exact = searchAreas(db.areas, 'vice city');
    expect(exact[0]!.areaId).toBe('area:vice-city');
    expect(exact[0]!.match).toBe('exact');
    const prefix = searchAreas(db.areas, 'vice');
    expect(prefix[0]!.match).toBe('prefix');
    // The area's own name outranks a match on its path: Vice City
    // first, then Vice Beach — the neighbourhoods inside Vice City
    // (Balsero, Bayside, …) come after, never ahead of it.
    expect(prefix[0]!.areaId).toBe('area:vice-city');
    expect(prefix[1]!.areaId).toBe('area:vice-beach');
    expect(prefix.map((r) => r.name)).toContain('Vice City');
    expect(prefix.map((r) => r.name)).toContain('Vice Beach');
    expect(prefix.map((r) => r.name)).toContain('Vice-Dale County');
    const viceCityIndex = prefix.findIndex((r) => r.areaId === 'area:vice-city');
    const balseroIndex = prefix.findIndex((r) => r.areaId === 'area:balsero--vice-city');
    expect(viceCityIndex).toBeLessThan(balseroIndex);
    const typo = searchAreas(db.areas, 'vice ciy');
    expect(typo[0]!.areaId).toBe('area:vice-city');
    expect(typo[0]!.match).toBe('typo');
    const typo2 = searchAreas(db.areas, 'ambrosya');
    expect(typo2[0]!.areaId).toBe('area:ambrosia');
    expect(typo2[0]!.match).toBe('typo');
    // A hyphenated name matches with a space: "vice dale" finds
    // Vice-Dale County.
    const hyphen = searchAreas(db.areas, 'vice dale');
    expect(hyphen[0]!.areaId).toBe('county:vice-dale');
    expect(hyphen[0]!.match).toBe('prefix');
    // A typo beyond distance 2 is not a match.
    expect(searchAreas(db.areas, 'vice zzzzz')).toEqual([]);
  });

  it('aliases resolve: "VC" → Vice City, "the Keys" → Leonida Keys', () => {
    const db = buildFullDb();
    const vc = searchAreas(db.areas, 'VC');
    expect(vc[0]!.areaId).toBe('area:vice-city');
    expect(vc[0]!.match).toBe('exact');
    const keys = searchAreas(db.areas, 'the Keys');
    expect(keys[0]!.areaId).toBe('area:leonida-keys');
    expect(keys[0]!.match).toBe('exact');
  });

  it('every named area is searchable, including one-place areas', () => {
    const db = buildFullDb();
    expect(searchAreas(db.areas, 'lost vista')[0]!.areaId).toBe('area:lost-vista');
    expect(searchAreas(db.areas, 'scattered pines')[0]!.areaId).toBe(
      'area:scattered-pines',
    );
    expect(searchAreas(db.areas, 'downtown')[0]!.areaId).toBe(
      'area:downtown--vice-city',
    );
    // Both Downtowns are exact name matches; the 141-place Vice
    // City Downtown outranks the 2-place bare Downtown.
    expect(searchAreas(db.areas, 'downtown')[1]!.areaId).toBe('area:downtown');
    // Same name, different areas: the path disambiguates.
    const baysides = searchAreas(db.areas, 'bayside');
    expect(baysides.map((r) => r.path).sort()).toEqual([
      'Bayside',
      'Bayside, Vice City',
    ]);
    expect(searchAreas(db.areas, '')).toEqual([]);
  });

  it('no-match is the exact string, and the five counties are offered', () => {
    expect(GEO_NO_MATCH).toBe(
      'No area called that in Leonida — try a county, city or town',
    );
    const db = buildFullDb();
    expect(searchAreas(db.areas, 'atlantis')).toEqual([]);
    expect(geoNoMatchCounties().map((c) => c.name)).toEqual([
      'Lummox County',
      'Kelly County',
      'Leonard County',
      'Vice-Dale County',
      'Mariana County',
    ]);
  });

  it('geo results carry no gameplay information', () => {
    const db = buildFullDb();
    for (const result of searchAreas(db.areas, 'vice')) {
      expect(Object.keys(result).sort()).toEqual([
        'areaId',
        'level',
        'match',
        'memberCount',
        'name',
        'path',
      ]);
    }
  });

  it('levenshtein is exact on the small cases', () => {
    expect(levenshtein('city', 'ciy')).toBe(1);
    expect(levenshtein('delights', 'delight')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
    // "Delites" is distance 3 from "Delights", not 1 — beyond the
    // ≤2 typo tolerance, and "Al Dentes" is closer at 2 (see the
    // Delites test below).
    expect(levenshtein('delights', 'delites')).toBe(3);
  });
});

describe('search — §6.5b explicit POI search (database, not the visible subset)', () => {
  it('finds Delights the location plus its four opportunities, by name — and the real typo neighbours', () => {
    const db = buildFullDb();
    const outcome = searchPoi(db, 'Delights');
    // 5 prefix matches (the place + its 4 opportunities) and 3
    // typo matches: "Afternoon Delight" (delight, distance 1) and
    // "Bayfront Heights" (heights, distance 2) — the ≤2 rule working.
    expect(outcome.totalMatching).toBe(8);
    expect(outcome.results.map((r) => r.id)).toEqual([
      'L629',
      'opp:L629:activity:1',
      'opp:L629:discovery:1',
      'opp:L629:interior:1',
      'opp:L629:shop:1',
      'loot:guide-afternoon-delight',
      'L22',
      'opp:loot:guide-afternoon-delight:bank-job:1',
    ]);
    expect(outcome.results[0]!.recordKind).toBe('location');
    expect(outcome.results[0]!.id).toBe('L629');
    expect(outcome.results[0]!.name).toBe('Delights, Interstate 404, Port Gellhorn');
    expect(outcome.results[0]!.positioned).toBe(true);
    const kinds = outcome.results
      .filter((r) => r.recordKind === 'opportunity' && r.hostLocationId === 'L629')
      .map((r) => r.kind)
      .sort();
    expect(kinds).toEqual(['Activity', 'Discovery', 'Interior', 'Shop']);
    for (const opp of outcome.results.filter((r) => r.recordKind === 'opportunity' && r.hostLocationId === 'L629')) {
      expect(opp.hostLocationId).toBe('L629');
    }
  });

  it('finds items by their own name (Harley lives at Delights)', () => {
    const db = buildFullDb();
    const outcome = searchPoi(db, 'Harley');
    const item = outcome.results.find((r) => r.recordKind === 'item')!;
    expect(item).toBeDefined();
    expect(item.name).toBe('Harley');
    expect(item.hostLocationId).toBe('L629');
    expect(item.positioned).toBe(true);
  });

  it('result rows show the name and kind only — no detail, loot, description or position', () => {
    const db = buildFullDb();
    const outcome = searchPoi(db, 'Delights');
    for (const result of outcome.results) {
      expect(Object.keys(result).sort()).toEqual([
        'hostLocationId',
        'id',
        'kind',
        'name',
        'positioned',
        'recordKind',
      ]);
    }
  });

  it('a search matching only unpositioned records says so, with the real count', () => {
    const db = buildFullDb();
    // "Lost Vista trailers" is the area-known breakable home: the
    // place plus its break-in and interior opportunities, none with
    // a map position — the brief's example, with the real count 3.
    const outcome = searchPoi(db, 'Lost Vista trailers');
    expect(outcome.totalMatching).toBe(3);
    expect(outcome.allUnpositioned).toBe(true);
    expect(outcome.results.every((r) => !r.positioned)).toBe(true);
    expect(outcome.results.map((r) => r.id)).toEqual([
      'breakable:lost-vista-trailers',
      'opp:breakable:lost-vista-trailers:break-in:1',
      'opp:breakable:lost-vista-trailers:interior:1',
    ]);
    expect(poiUnpositionedMessage(outcome.totalMatching)).toBe(
      '3 places match — none has a map position yet',
    );
    expect(poiUnpositionedMessage(1)).toBe(
      '1 place matches — none has a map position yet',
    );
  });

  it('a POI no-match says what was searched and offers the nearest spelling', () => {
    const db = buildFullDb();
    // "qux" matches nothing, but the 3-letter token "gun" is
    // distance 2 away — a real suggestion from the data.
    const outcome = searchPoi(db, 'qux');
    expect(outcome.totalMatching).toBe(0);
    expect(outcome.suggestion).toBe('Pawn & Gun, Port Gellhorn');
    expect(poiNoMatchMessage('qux', outcome.suggestion)).toBe(
      'No place called “qux” — did you mean Pawn & Gun, Port Gellhorn?',
    );
    // The brief's example shape, with the brief's spelling.
    expect(poiNoMatchMessage('Delites', 'Delights, Interstate 404, Port Gellhorn')).toBe(
      'No place called “Delites” — did you mean Delights, Interstate 404, Port Gellhorn?',
    );
    expect(poiNoMatchMessage('Zzzzz', null)).toBe('No place called “Zzzzz”.');
    expect(searchPoi(db, 'Zzzzz')).toEqual({
      results: [],
      totalMatching: 0,
      allUnpositioned: false,
      suggestion: null,
    });
    expect(searchPoi(db, '')).toEqual({
      results: [],
      totalMatching: 0,
      allUnpositioned: false,
      suggestion: null,
    });
  });

  it('"Delites" does NOT no-match on this data: it typo-matches "Al Dentes" (distance 2), while "Delights" is distance 3', () => {
    const db = buildFullDb();
    const outcome = searchPoi(db, 'Delites');
    expect(outcome.totalMatching).toBe(1);
    expect(outcome.results[0]!.name).toBe('Al Dentes, Crosstown, Vice City');
    expect(nearestSpelling(db, 'Delites')).toBe('Al Dentes, Crosstown, Vice City');
  });

  it('tap reveals exactly one record — never a layer, never another record', () => {
    const state = createSearchSplitState();
    const once = revealPoiResult(state, 'opp:L629:shop:0');
    expect(once.poi.revealedRecordIds).toEqual(['opp:L629:shop:0']);
    // Revealing the same record again still reveals exactly one.
    expect(revealPoiResult(once, 'opp:L629:shop:0')).toBe(once);
    const twice = revealPoiResult(once, 'L629');
    expect(twice.poi.revealedRecordIds).toEqual(['opp:L629:shop:0', 'L629']);
    // The reveal never touches the queries.
    expect(twice.geo.query).toBe('');
    expect(twice.poi.query).toBe('');
  });
});

describe('search — §6.5 separate state', () => {
  it('clearing geo leaves POI and reveals untouched; clearing POI leaves geo untouched', () => {
    const state: ReturnType<typeof createSearchSplitState> = {
      geo: { query: 'vice' },
      poi: { query: 'delights', revealedRecordIds: ['L629'] },
    };
    const afterGeo = clearGeoSearch(state);
    expect(afterGeo.geo.query).toBe('');
    expect(afterGeo.poi.query).toBe('delights');
    expect(afterGeo.poi.revealedRecordIds).toEqual(['L629']);
    const afterPoi = clearPoiSearch(state);
    expect(afterPoi.poi.query).toBe('');
    expect(afterPoi.geo.query).toBe('vice');
    expect(afterPoi.poi.revealedRecordIds).toEqual(['L629']);
    const afterAll = clearAllSearch(state);
    expect(afterAll.geo.query).toBe('');
    expect(afterAll.poi.query).toBe('');
    expect(afterAll.poi.revealedRecordIds).toEqual(['L629']);
  });

  it('the transitions are pure: they never mutate their input and never carry layer state', () => {
    const state = Object.freeze({
      geo: Object.freeze({ query: 'vice' }),
      poi: Object.freeze({ query: 'delights', revealedRecordIds: Object.freeze(['L629']) }),
    }) as unknown as ReturnType<typeof createSearchSplitState>;
    expect(() => clearGeoSearch(state)).not.toThrow();
    expect(() => clearPoiSearch(state)).not.toThrow();
    expect(() => clearAllSearch(state)).not.toThrow();
    for (const next of [clearGeoSearch(state), clearPoiSearch(state), clearAllSearch(state)]) {
      expect('layers' in next).toBe(false);
      expect('visibleLayers' in next).toBe(false);
    }
  });

  it('the store keeps the three modes apart: clearGeo keeps POI, area and reveals', () => {
    const store = useSearchSplitStore.getState();
    store.setGeoQuery('vice');
    store.setPoiQuery('delights');
    store.revealRecord('L629');
    store.selectArea('area:vice-city');
    expect(useSearchSplitStore.getState().areaPageOpen).toBe(true);
    store.clearGeo();
    const after = useSearchSplitStore.getState();
    expect(after.geo.query).toBe('');
    expect(after.poi.query).toBe('delights');
    expect(after.poi.revealedRecordIds).toEqual(['L629']);
    expect(after.selectedAreaId).toBe('area:vice-city');
    // Closing the page keeps the area; clearing search keeps the area too.
    store.setAreaPageOpen(false);
    expect(useSearchSplitStore.getState().selectedAreaId).toBe('area:vice-city');
    store.clearSearch();
    const cleared = useSearchSplitStore.getState();
    expect(cleared.geo.query).toBe('');
    expect(cleared.poi.query).toBe('');
    expect(cleared.poi.revealedRecordIds).toEqual(['L629']);
    expect(cleared.selectedAreaId).toBe('area:vice-city');
    // Reset for other tests (zustand store is module-global).
    store.selectArea(null);
    store.clearPoi();
    useSearchSplitStore.setState({ poi: { query: '', revealedRecordIds: [] } });
  });
});
