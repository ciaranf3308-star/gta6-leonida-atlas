import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import {
  QUICK_START_LAYERS,
  hasSeenIndexOnboarding,
  hasSeenWelcome,
  layerCounts,
  markIndexOnboardingSeen,
  markWelcomeSeen,
  totalMappedPlaces,
  type StorageLike,
} from '../../src/features/onboarding/onboarding';
import { useAiIndexStore } from '../../src/features/categorise/store';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
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

  it('has 4,456 places in the catalogue', () => {
    expect(places.length).toBe(4456);
    expect(totalMappedPlaces(places)).toBe(4456);
  });

  it('matches the counts the UI claims per layer', () => {
    expect(counts.get('interiors')).toMatchObject({ total: 83, positioned: 82, unpositioned: 1 });
    expect(counts.get('breakable')).toMatchObject({ total: 47, positioned: 42, unpositioned: 5 });
    expect(counts.get('shops-food')).toMatchObject({ total: 30, positioned: 27, unpositioned: 3 });
    expect(counts.get('shops-vehicles')).toMatchObject({ total: 9, positioned: 9, unpositioned: 0 });
    expect(counts.get('shops-weapons')).toMatchObject({ total: 0, positioned: 0, unpositioned: 0 });
    // Style was 1 until v0.31.3 — six named clothes / hair / tattoo
    // shops moved out of lootable into shops-style (STYLE_SHOP_TAGS).
    expect(counts.get('shops-style')).toMatchObject({ total: 7, positioned: 7, unpositioned: 0 });
    expect(counts.get('lootable')).toMatchObject({ total: 47, positioned: 47, unpositioned: 0 });
    expect(counts.get('loot-heists')).toMatchObject({ total: 29, positioned: 29, unpositioned: 0 });
    expect(counts.get('loot-collectibles')).toMatchObject({ total: 20, positioned: 20, unpositioned: 0 });
    expect(counts.get('gyms')).toMatchObject({ total: 8, positioned: 6, unpositioned: 2 });
    expect(counts.get('equipment')).toMatchObject({ total: 3, positioned: 2, unpositioned: 1 });
    expect(counts.get('community')).toMatchObject({ total: 747, positioned: 717 });
    expect(counts.get('uncertain')).toMatchObject({ total: 3415, positioned: 3355 });
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
      'shops-food',
      'shops-vehicles',
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

describe('forced indexing onboarding (v0.11.0)', () => {
  it('is unseen until marked, on its own key — the old welcome flag does not count', () => {
    const storage = fakeStorage();
    markWelcomeSeen(storage);
    expect(hasSeenWelcome(storage)).toBe(true);
    // A user who dismissed the old welcome sheet still gets the forced
    // indexing onboarding once after this update.
    expect(hasSeenIndexOnboarding(storage)).toBe(false);
    markIndexOnboardingSeen(storage);
    expect(hasSeenIndexOnboarding(storage)).toBe(true);
    expect(storage.map.get('leonida-index-onboarding-seen')).toBe('1');
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
    expect(hasSeenIndexOnboarding(broken)).toBe(false);
    expect(() => markIndexOnboardingSeen(broken)).not.toThrow();
  });

  it('the onboarding Start request bumps the index store trigger', () => {
    useAiIndexStore.setState({ startRequestId: 0 });
    expect(useAiIndexStore.getState().startRequestId).toBe(0);
    useAiIndexStore.getState().requestIndexStart();
    expect(useAiIndexStore.getState().startRequestId).toBe(1);
    useAiIndexStore.getState().requestIndexStart();
    expect(useAiIndexStore.getState().startRequestId).toBe(2);
  });
});
