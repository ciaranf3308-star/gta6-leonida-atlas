import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  LOOT_MAP_COLLECTIBLES,
  LOOT_MAP_HEISTS,
  LOOT_MAP_PLACES,
} from '../../src/data/loot-map';
import { isUnnamedPlace } from '../../src/domain/types';
import { parseBackup } from '../../src/db/backup';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import { iconKeyForLayer } from '../../src/features/map/place-icons';
import { layersRequestedByQuestion } from '../../src/features/ask/retrieval';
import {
  askAllowedLayerIds,
  isPlaceVisible,
} from '../../src/features/spoiler/visibility';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function gtadbPosition(id: string): { x: number; y: number } {
  const record = snapshot.landmarks.find((r: { id: string }) => r.id === id);
  expect(record, `GTADB snapshot must carry ${id}`).toBeDefined();
  expect(record.inGameCoordinates, `${id} must be positioned`).toBeTruthy();
  return { x: record.inGameCoordinates[0], y: record.inGameCoordinates[1] };
}

function placeById(id: string) {
  const place = LOOT_MAP_PLACES.find((p) => p.id === id);
  expect(place, `loot data must carry ${id}`).toBeDefined();
  return place!;
}

describe('Loot Map import — v0.31.1', () => {
  it('imports 29 heists + 20 collectibles = 49 records, all unique loot ids', () => {
    expect(LOOT_MAP_HEISTS).toHaveLength(29);
    expect(LOOT_MAP_COLLECTIBLES).toHaveLength(20);
    expect(LOOT_MAP_PLACES).toHaveLength(49);
    expect(new Set(LOOT_MAP_PLACES.map((p) => p.id)).size).toBe(49);
    for (const place of LOOT_MAP_PLACES) {
      expect(place.id.startsWith('loot:')).toBe(true);
    }
  });

  it('every record is UNVERIFIED-tier, positioned in bounds, and carries Loot Map provenance', () => {
    for (const place of LOOT_MAP_PLACES) {
      expect(place.evidence).toBe('uncertain');
      expect(place.position).not.toBeNull();
      const { x, y } = place.position!;
      expect(Math.abs(x)).toBeLessThanOrEqual(16384);
      expect(Math.abs(y)).toBeLessThanOrEqual(16384);
      // Inside the GTADB landmass box — nothing in the sea.
      expect(x).toBeGreaterThanOrEqual(-11000);
      expect(x).toBeLessThanOrEqual(4000);
      expect(y).toBeGreaterThanOrEqual(-8500);
      expect(y).toBeLessThanOrEqual(9700);
      expect(place.source.title.startsWith('Loot Map (MIT)')).toBe(true);
      expect(place.source.license).toBe('MIT');
      expect(place.source.url.length).toBeGreaterThan(0);
      expect(place.tags).toContain('loot-map');
      expect(place.description).toContain('not in-game verified');
      // A loot place is never an unnamed "?" place, so the AI indexing
      // job never sweeps it in as an unnamed record to resolve.
      expect(isUnnamedPlace(place)).toBe(false);
    }
    for (const place of LOOT_MAP_HEISTS) {
      expect(place.layerId).toBe('loot-heists');
      expect(place.category).toBe('robberies');
      expect(place.tags).toContain('heist');
    }
    for (const place of LOOT_MAP_COLLECTIBLES) {
      expect(place.layerId).toBe('loot-collectibles');
      expect(place.category).toBe('collectibles');
      expect(place.tags).toContain('collectible');
    }
  });

  it('excludes the two position conflicts and both duplicates', () => {
    const ids = new Set(LOOT_MAP_PLACES.map((p) => p.id));
    // Position conflicts: venue vs registered marker >100 m apart.
    expect(ids.has('loot:guide-downtown-shorefront')).toBe(false);
    expect(ids.has('loot:guide-rockridge-shorefront')).toBe(false);
    // Duplicate of the existing Vicki card pin (same item, same spot).
    expect(ids.has('loot:guide-vicki-card')).toBe(false);
    // Duplicate of the registered Kalaga meditation — imported once,
    // from collectible-guides.json.
    expect(ids.has('loot:guide-kalaga-meditation')).toBe(false);
    expect(
      LOOT_MAP_PLACES.filter((p) => p.id.includes('kalaga')),
    ).toHaveLength(1);
    expect(
      LOOT_MAP_PLACES.filter((p) => p.id.includes('kalaga'))[0]!.id,
    ).toBe('loot:guide-mount-kalaga-meditation');
    // No two places share an exact position AND the same title —
    // the dedupe invariant the import script enforces.
    const seen = new Set<string>();
    for (const place of LOOT_MAP_PLACES) {
      const key = `${place.position!.x},${place.position!.y}|${place.title}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('converted positions match the GTADB venue positions they were registered against', () => {
    // The inventory lane hand-verified the conversion sub-metre on
    // Jason's House (L266), ShoreFront (L224) and Delights (L629)
    // against the d406fea snapshot. Against the 2e9e194 snapshot the
    // conversion is exact (0 m, before 2dp rounding) on six venues;
    // L304 and L629 moved 18-19 m between pins, and the Loot Map
    // positions were kept as published — never nudged.
    const exact: Array<[string, string]> = [
      ['loot:guide-meditation-jasons-house', 'L266'],
      ['loot:guide-off-the-hook', 'L266'],
      ['loot:guide-rusty-anchor-card', 'L325'],
      ['loot:guide-high-rollerz', 'L172'],
      ['loot:guide-remote-strike', 'L1869'],
      ['loot:guide-rx-men', 'L341'],
      ['loot:guide-wonder-whale-scan', 'L332'],
    ];
    for (const [lootId, gtadbId] of exact) {
      expect(dist(placeById(lootId).position!, gtadbPosition(gtadbId))).toBeLessThan(
        0.01,
      );
    }
    // Venues that moved between d406fea and 2e9e194: 18-19 m off the
    // current pin, and NOT zero — a future move must stay visible.
    for (const [lootId, gtadbId] of [
      ['loot:guide-afternoon-delight', 'L629'],
      ['loot:guide-harley-card', 'L629'],
      ['loot:guide-starlet-motel-book', 'L304'],
    ] as Array<[string, string]>) {
      const d = dist(placeById(lootId).position!, gtadbPosition(gtadbId));
      expect(d).toBeGreaterThan(15);
      expect(d).toBeLessThan(20);
    }
  });

  it('the layers are wired, off by default, with their own colours and icons', () => {
    const heists = DEFAULT_LAYERS.find((l) => l.id === 'loot-heists');
    const collectibles = DEFAULT_LAYERS.find((l) => l.id === 'loot-collectibles');
    expect(heists).toMatchObject({
      name: 'Bank jobs & vaults',
      mapIndex: 'robberies',
      visible: false,
      order: 88,
      icon: 'banknote',
    });
    expect(heists!.style.color).toBe('#ffb020');
    expect(collectibles).toMatchObject({
      name: 'Collectibles · Loot Map',
      mapIndex: 'collectibles',
      visible: false,
      order: 19,
      icon: 'sparkles',
    });
    expect(collectibles!.style.color).toBe('#2ec4b6');
    expect(iconKeyForLayer('loot-heists')).toBe('banknote');
    expect(iconKeyForLayer('loot-collectibles')).toBe('sparkles');
    // Distinct from the existing lootable shops layer and the cards.
    expect(DEFAULT_LAYERS.find((l) => l.id === 'lootable')!.style.color).not.toBe(
      '#ffb020',
    );
    expect(DEFAULT_LAYERS.find((l) => l.id === 'lootable')!.style.color).not.toBe(
      '#2ec4b6',
    );
  });

  it('the catalogue carries all 49 loot places', () => {
    const places = catalogueFromSnapshot(snapshot);
    for (const loot of LOOT_MAP_PLACES) {
      expect(places.some((p) => p.id === loot.id)).toBe(true);
    }
    expect(places.filter((p) => p.layerId === 'loot-heists')).toHaveLength(29);
    expect(places.filter((p) => p.layerId === 'loot-collectibles')).toHaveLength(20);
  });

  it('spoiler rule: a loot place is hidden until its layer is on or it is revealed', () => {
    const heist = placeById('loot:guide-afternoon-delight');
    const collectible = placeById('loot:guide-meditation-jasons-house');
    expect(isPlaceVisible(heist, DEFAULT_LAYERS)).toBe(false);
    expect(isPlaceVisible(collectible, DEFAULT_LAYERS)).toBe(false);
    // Revealing one place never switches on its layer.
    expect(isPlaceVisible(heist, DEFAULT_LAYERS, new Set([heist.id]))).toBe(true);
    expect(isPlaceVisible(collectible, DEFAULT_LAYERS, new Set([heist.id]))).toBe(false);
    const on = DEFAULT_LAYERS.map((l) =>
      l.id === 'loot-heists' ? { ...l, visible: true } : l,
    );
    expect(isPlaceVisible(heist, on)).toBe(true);
    expect(isPlaceVisible(collectible, on)).toBe(false);
  });

  it('Ask scope: asking for bank jobs never pulls in the collectibles layer, or vice versa', () => {
    const collectiblesOn = DEFAULT_LAYERS.map((l) =>
      l.id === 'loot-collectibles' ? { ...l, visible: true } : l,
    );
    // loot-collectibles is ON, but the question asked for bank jobs only.
    expect(
      [...askAllowedLayerIds(['loot-heists'], collectiblesOn)].sort(),
    ).toEqual(['loot-heists', 'my-markers']);
    expect(
      [...askAllowedLayerIds(['loot-collectibles'], collectiblesOn)].sort(),
    ).toEqual(['loot-collectibles', 'my-markers']);
  });

  it('Ask routing: vaults and heists ask for bank jobs, meditations ask for collectibles', () => {
    expect(
      layersRequestedByQuestion('where is the nearest bank vault', DEFAULT_LAYERS),
    ).toEqual(['loot-heists']);
    expect(
      layersRequestedByQuestion('where can I pull off a heist', DEFAULT_LAYERS),
    ).toEqual(['loot-heists']);
    expect(
      layersRequestedByQuestion('where are the meditation spots', DEFAULT_LAYERS),
    ).toEqual(['loot-collectibles']);
    expect(
      layersRequestedByQuestion('where is the Off the Hook magazine', DEFAULT_LAYERS),
    ).toEqual(['loot-collectibles']);
    // A collectibles question asks for the trading-card sets AND the
    // Loot Map collectibles — never the bank jobs.
    const collectibles = layersRequestedByQuestion(
      'where are the collectibles',
      DEFAULT_LAYERS,
    );
    expect(collectibles).toContain('loot-collectibles');
    expect(collectibles.some((id) => id.startsWith('cards:'))).toBe(true);
    expect(collectibles).not.toContain('loot-heists');
    // A card question still routes to the cards — the Vicki card is
    // answered from the cards layer, not from the loot layer.
    expect(
      layersRequestedByQuestion('Where is the Vicki card?', DEFAULT_LAYERS),
    ).toContain('cards:delights-dancers');
    // "Rob a bank" is a shops question on the pre-existing wording —
    // only "bank job" / "vault" / "heist" asks for the jobs layer.
    expect(
      layersRequestedByQuestion('where can I rob a bank', DEFAULT_LAYERS),
    ).toEqual(['lootable']);
  });

  it('backup round-trip: found/collected marks on loot places survive export and import', () => {
    const time = '2026-11-25T12:00:00.000Z';
    const result = parseBackup({
      format: 'leonida-atlas',
      version: 2,
      exportedAt: time,
      favorites: [{ placeId: 'loot:guide-afternoon-delight', createdAt: time }],
      notes: [
        {
          placeId: 'loot:guide-meditation-jasons-house',
          text: 'Do as Jason',
          updatedAt: time,
        },
      ],
      visited: [{ placeId: 'loot:guide-harley-card', visitedAt: time }],
      explored: [{ placeId: 'loot:guide-starlet-motel-book', exploredAt: time }],
      collections: [
        {
          id: 'collection:loot',
          name: 'Loot',
          placeIds: ['loot:guide-afternoon-delight', 'loot:guide-vault-airport-fleeca'],
          createdAt: time,
          updatedAt: time,
        },
      ],
      markers: [],
      preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
    });
    expect(result.favorites.map((f) => f.placeId)).toEqual([
      'loot:guide-afternoon-delight',
    ]);
    expect(result.notes.map((n) => n.placeId)).toEqual([
      'loot:guide-meditation-jasons-house',
    ]);
    expect(result.visited.map((v) => v.placeId)).toEqual(['loot:guide-harley-card']);
    expect(result.explored.map((e) => e.placeId)).toEqual([
      'loot:guide-starlet-motel-book',
    ]);
    expect(result.collections[0]!.placeIds).toEqual([
      'loot:guide-afternoon-delight',
      'loot:guide-vault-airport-fleeca',
    ]);
  });
});
