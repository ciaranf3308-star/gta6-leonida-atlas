import { describe, expect, it } from 'vitest';
import {
  loadSavedMapView,
  mapViewFromState,
  saveMapView,
  type SavedMapView,
} from '../../src/features/map/view-persistence';
import { DEFAULT_FILTERS } from '../../src/stores/atlas';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const VIEW: SavedMapView = {
  visibleLayerIds: ['lootable', 'shops'],
  countyId: 'kelly',
  hideFound: true,
  remainingOnly: false,
  favoritesOnly: false,
  evidence: 'all',
  category: 'all',
};

describe('Map-view persistence — layers survive a reload', () => {
  it('round-trips a saved view through localStorage', () => {
    const storage = memoryStorage();
    saveMapView(VIEW, storage);
    expect(loadSavedMapView(storage)).toEqual(VIEW);
  });

  it('returns null when nothing was saved, and on corrupt or foreign values', () => {
    expect(loadSavedMapView(memoryStorage())).toBeNull();
    expect(
      loadSavedMapView(memoryStorage({ 'leonida-map-view-v1': 'not json' })),
    ).toBeNull();
    expect(
      loadSavedMapView(
        memoryStorage({ 'leonida-map-view-v1': JSON.stringify({ visibleLayerIds: 'lootable' }) }),
      ),
    ).toBeNull();
    expect(
      loadSavedMapView(
        memoryStorage({ 'leonida-map-view-v1': JSON.stringify({ nope: true }) }),
      ),
    ).toBeNull();
  });

  it('builds a saved view from live layer + filter state', () => {
    const view = mapViewFromState(['lootable', 'personal'], {
      ...DEFAULT_FILTERS,
      countyId: 'vice-dale',
    });
    expect(view.visibleLayerIds).toEqual(['lootable', 'personal']);
    expect(view.countyId).toBe('vice-dale');
  });

  it('first launch stays blank: the default layers are all off except My markers', () => {
    const visible = DEFAULT_LAYERS.filter((l) => l.visible).map((l) => l.id);
    expect(visible).toEqual(['personal']);
  });

  it('lists the useful layers first and the card sets last', () => {
    const ordered = [...DEFAULT_LAYERS].sort((a, b) => b.order - a.order);
    const names = ordered.map((l) => l.name);
    expect(names.slice(0, 5)).toEqual([
      'Lootable buildings',
      'Interiors / Enterable',
      'Shops & services',
      'Gyms / Strength',
      'Free outdoor equipment',
    ]);
    expect(names.slice(-2)).toEqual([
      'Cards · Vice City Narcos',
      'Cards · Vice City Flamingos',
    ]);
    expect(ordered[ordered.length - 1]?.id.startsWith('cards:')).toBe(true);
    const firstCard = ordered.findIndex((l) => l.id.startsWith('cards:'));
    expect(ordered.slice(0, firstCard).every((l) => !l.id.startsWith('cards:'))).toBe(true);
  });
});
