import { describe, expect, it } from 'vitest';
import {
  layersForLaunch,
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
  visibleLayerIds: ['lootable', 'shops-food'],
  countyId: 'kelly',
  area: null,
  hideFound: true,
  remainingOnly: false,
  favoritesOnly: false,
  evidence: 'all',
  category: 'all',
  enterableOnly: false,
  lootableOnly: false,
  interiorHouseOnly: false,
  venueType: 'all',
};

describe('v0.32 gang-op follow-up — an explicit My markers OFF survives a reload', () => {
  const myMarkers = (layers: ReturnType<typeof layersForLaunch>) =>
    layers.find((l) => l.id === 'my-markers')?.visible;

  it('fresh player (no saved view): My markers stays on, the default', () => {
    expect(myMarkers(layersForLaunch(DEFAULT_LAYERS, null))).toBe(true);
  });

  it('saved view without my-markers: it stays off on launch', () => {
    const launched = layersForLaunch(DEFAULT_LAYERS, {
      ...VIEW,
      visibleLayerIds: [],
    });
    expect(myMarkers(launched)).toBe(false);
  });

  it('saved view with my-markers: it stays on — and the persist round-trip keeps it', () => {
    const storage = memoryStorage();
    saveMapView({ ...VIEW, visibleLayerIds: ['my-markers'] }, storage);
    const launched = layersForLaunch(DEFAULT_LAYERS, loadSavedMapView(storage));
    expect(myMarkers(launched)).toBe(true);
    // The launch state re-saved is the same view — a reload must not
    // flip it back (the old mount reset overwrote the saved view with
    // the default ON after every reload).
    expect(
      mapViewFromState(
        launched.filter((l) => l.visible).map((l) => l.id),
        DEFAULT_FILTERS,
      ).visibleLayerIds,
    ).toEqual(['my-markers']);
  });

  it('clean launch still holds for public layers: a saved ON layer opens off', () => {
    const launched = layersForLaunch(DEFAULT_LAYERS, {
      ...VIEW,
      visibleLayerIds: ['lootable', 'shops-food', 'my-markers'],
    });
    expect(launched.find((l) => l.id === 'lootable')?.visible).toBe(false);
    expect(launched.find((l) => l.id === 'shops-food')?.visible).toBe(false);
    expect(myMarkers(launched)).toBe(true);
  });

  it('a legacy saved "personal" id still counts as My markers on', () => {
    const loaded = loadSavedMapView(
      memoryStorage({
        'leonida-map-view-v1': JSON.stringify({
          ...VIEW,
          visibleLayerIds: ['personal'],
        }),
      }),
    );
    expect(myMarkers(layersForLaunch(DEFAULT_LAYERS, loaded))).toBe(true);
  });
});
