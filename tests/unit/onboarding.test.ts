import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import {
  QUICK_START_LAYERS,
  hasSeenWelcome,
  layerCounts,
  markWelcomeSeen,
  totalMappedPlaces,
  type StorageLike,
} from '../../src/features/onboarding/onboarding';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('onboarding audit — the places really are mapped', () => {
  const places = catalogueFromSnapshot(snapshot);
  const counts = new Map(layerCounts(places, DEFAULT_LAYERS).map((c) => [c.layerId, c]));

  it('has 3,781 places in the catalogue', () => {
    expect(places.length).toBe(3781);
    expect(totalMappedPlaces(places)).toBe(3781);
  });

  it('matches the counts the UI claims per layer', () => {
    expect(counts.get('interiors')).toMatchObject({ total: 77, positioned: 76, unpositioned: 1 });
    expect(counts.get('breakable')).toMatchObject({ total: 52, positioned: 47, unpositioned: 5 });
    expect(counts.get('shops')).toMatchObject({ total: 39, positioned: 36, unpositioned: 3 });
    expect(counts.get('lootable')).toMatchObject({ total: 52, positioned: 52, unpositioned: 0 });
    expect(counts.get('gyms')).toMatchObject({ total: 8, positioned: 6, unpositioned: 2 });
    expect(counts.get('equipment')).toMatchObject({ total: 3, positioned: 2, unpositioned: 1 });
    expect(counts.get('community')).toMatchObject({ total: 679, positioned: 646 });
    expect(counts.get('uncertain')).toMatchObject({ total: 2860, positioned: 2806 });
    expect(counts.get('regions')).toMatchObject({ total: 6, positioned: 6 });
  });

  it('has only 5 verified card pins across the 18 card sets', () => {
    const cards = [...counts.values()].filter((c) => c.layerId.startsWith('cards:'));
    expect(cards).toHaveLength(18);
    expect(cards.reduce((sum, c) => sum + c.positioned, 0)).toBe(5);
    expect(cards.reduce((sum, c) => sum + c.total, 0)).toBe(5);
  });

  it('quick starts only name layers that exist and start off', () => {
    const byId = new Map(DEFAULT_LAYERS.map((layer) => [layer.id, layer]));
    for (const quick of QUICK_START_LAYERS) {
      expect(byId.get(quick.layerId)?.visible).toBe(false);
    }
    expect(QUICK_START_LAYERS.map((q) => q.layerId)).toEqual([
      'gyms',
      'equipment',
      'breakable',
      'lootable',
      'interiors',
      'shops',
    ]);
  });
});

describe('welcome seen flag', () => {
  it('is unseen until marked, then stays seen', () => {
    const storage = fakeStorage();
    expect(hasSeenWelcome(storage)).toBe(false);
    markWelcomeSeen(storage);
    expect(hasSeenWelcome(storage)).toBe(true);
    expect(storage.map.get('leonida-welcome-seen')).toBe('1');
  });

  it('treats broken storage as unseen instead of throwing', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('no storage');
      },
      setItem: () => {
        throw new Error('no storage');
      },
    };
    expect(hasSeenWelcome(broken)).toBe(false);
    expect(() => markWelcomeSeen(broken)).not.toThrow();
  });
});
