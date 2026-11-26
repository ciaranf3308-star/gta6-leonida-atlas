import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { GANG_OP_PLACES } from '../../src/data/gang-operations';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import { filterPlaces } from '../../src/domain/filter';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import {
  layersTurnedOn,
  nothingShowing,
  regionsDrawnCount,
} from '../../src/features/map/empty-state';
import { gangOpLikelyAreas } from '../../src/features/map/likely-area';
import { DEFAULT_FILTERS, useUiStore } from '../../src/stores/atlas';

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

describe('empty-state banner showing computation (v0.32 lane 3, Finding 3)', () => {
  it('regions drawn: the gang-op layer on draws 34 regions, so nothing is "not showing"', () => {
    const db = buildFullDb();
    const regions = regionsDrawnCount(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    expect(regions).toBe(34);
    expect(regions).toBe(
      gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn()).length,
    );
    // The R2e case: gang-op places carry no position, so the old
    // places-only count is 0 — yet the banner must NOT fire.
    expect(GANG_OP_PLACES.filter((p) => p.position)).toHaveLength(0);
    expect(nothingShowing(0, regions)).toBe(false);
  });

  it('regions drawn: the grouped count (13 rects) also suppresses the banner — any region counts', () => {
    expect(nothingShowing(0, 13)).toBe(false);
    expect(nothingShowing(0, 1)).toBe(false);
  });

  it('nothing drawn: layer off draws no regions, so the banner fires when no place shows either', () => {
    const db = buildFullDb();
    expect(regionsDrawnCount(db.areas, GANG_OP_PLACES, DEFAULT_LAYERS)).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: a revealed op with the layer off draws no region — the banner still fires', () => {
    const db = buildFullDb();
    // A reveal shows that place, never its layer (likely-area.ts):
    // regionsDrawnCount gates on layer visibility, like MapView.
    expect(regionsDrawnCount(db.areas, GANG_OP_PLACES, DEFAULT_LAYERS)).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: the 3 no-extent ops on their own draw nothing and must not count as showing', () => {
    const db = buildFullDb();
    const noExtent = GANG_OP_PLACES.filter((p) =>
      ['gang-op:fishing-shacks', 'gang-op:chatfield-storage-logistics', 'gang-op:vespucci-mansion'].includes(p.id),
    );
    expect(noExtent).toHaveLength(3);
    expect(regionsDrawnCount(db.areas, noExtent, gangOpLayersOn())).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: no areas yet (game db still loading) draws nothing', () => {
    expect(regionsDrawnCount(null, GANG_OP_PLACES, gangOpLayersOn())).toBe(0);
    expect(regionsDrawnCount(undefined, GANG_OP_PLACES, gangOpLayersOn())).toBe(0);
  });

  it('places showing suppress the banner with or without regions', () => {
    expect(nothingShowing(1, 0)).toBe(false);
    expect(nothingShowing(27, 0)).toBe(false);
    expect(nothingShowing(5, 34)).toBe(false);
  });
});

describe('"Show everything" clears the narrow filters (v0.32.1, Finding 4)', () => {
  // The fix is two store writes in App.tsx turnOnLayers — the layer
  // half (layersTurnedOn, pure, tested below) and the filter half
  // (resetFilters + isolation lift, the same reset "Clear filters"
  // already performs). The wiring itself is proven by the banner
  // probe (scripts/lane3-banner-probe.mjs, L3-4b) on the real build.
  // These tests pin both halves through the real stores and the
  // real filter pipeline, so a future narrowing of either half
  // fails here first. The shared ui store is reset after every
  // test so no narrow filter leaks into the next one.
  afterEach(() => {
    useUiStore.getState().resetFilters();
  });

  it('layersTurnedOn("all") turns every public layer on and leaves my-markers exactly as it was', () => {
    const mine = DEFAULT_LAYERS.find((l) => l.id === 'my-markers');
    const turnedOn = layersTurnedOn(DEFAULT_LAYERS, 'all');
    expect(turnedOn.filter((l) => l.id !== 'my-markers').every((l) => l.visible)).toBe(true);
    expect(turnedOn.find((l) => l.id === 'my-markers')).toBe(mine);
    // A layer already on stays on (no-op, not a toggle).
    expect(layersTurnedOn(turnedOn, 'all')).toEqual(turnedOn);
  });

  it('layersTurnedOn([ids]) turns on only the named layers', () => {
    const turnedOn = layersTurnedOn(DEFAULT_LAYERS, ['gang-op']);
    expect(turnedOn.find((l) => l.id === 'gang-op')?.visible).toBe(true);
    expect(
      turnedOn.filter((l) => l.id !== 'gang-op' && l.id !== 'my-markers').some((l) => l.visible),
    ).toBe(false);
    expect(layersTurnedOn(DEFAULT_LAYERS, [])).toEqual(DEFAULT_LAYERS);
  });

  it('resetFilters restores every narrow filter to its default', () => {
    const ui = useUiStore.getState();
    ui.setFilters({
      query: 'brooks',
      favoritesOnly: true,
      personalOnly: true,
      lootableOnly: true,
      enterableOnly: true,
      hideFound: true,
      remainingOnly: true,
      interiorHouseOnly: true,
      countyId: 'kelly',
      area: 'Port Gellhorn',
    });
    expect(useUiStore.getState().filters.favoritesOnly).toBe(true);
    useUiStore.getState().resetFilters();
    expect(useUiStore.getState().filters).toEqual(DEFAULT_FILTERS);
  });

  it.each([
    ['Saved only', { favoritesOnly: true }],
    ['Lootable only', { lootableOnly: true }],
    ['My markers only', { personalOnly: true }],
  ])(
    '%s with nothing saved drops every gang-op place, so the banner fires — the L3-4b state',
    (_label, narrow) => {
      const db = buildFullDb();
      useUiStore.getState().setFilters(narrow);
      const filters = useUiStore.getState().filters;
      // The region feed is App's likelyAreaPlaces pipeline: the same
      // filters with only the geo isolation lifted.
      const feed = filterPlaces(GANG_OP_PLACES, { ...filters, area: null, countyId: null }, [], [], []);
      expect(feed).toHaveLength(0);
      expect(regionsDrawnCount(db.areas, feed, gangOpLayersOn())).toBe(0);
      expect(nothingShowing(0, 0)).toBe(true);
    },
  );

  it('after the filter reset the same feed draws 34 regions again, so the banner goes away', () => {
    const db = buildFullDb();
    useUiStore.getState().setFilters({ favoritesOnly: true });
    const before = filterPlaces(
      GANG_OP_PLACES,
      { ...useUiStore.getState().filters, area: null, countyId: null },
      [],
      [],
      [],
    );
    expect(regionsDrawnCount(db.areas, before, gangOpLayersOn())).toBe(0);
    // The filter half of the fixed "Show everything".
    useUiStore.getState().resetFilters();
    const after = filterPlaces(
      GANG_OP_PLACES,
      { ...useUiStore.getState().filters, area: null, countyId: null },
      [],
      [],
      [],
    );
    expect(regionsDrawnCount(db.areas, after, gangOpLayersOn())).toBe(34);
    expect(nothingShowing(0, 34)).toBe(false);
  });
});
