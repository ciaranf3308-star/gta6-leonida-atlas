import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import { clusterPlaces, selectHeroPlaces } from '../../src/features/map/spatial';
import { savedLayersOffer, type SavedMapView } from '../../src/features/map/view-persistence';

const place = (
  id: string,
  x = 0,
  y = 0,
  layerId = 'community',
  title = id,
  evidence: Place['evidence'] = 'approximate',
): Place => ({
  id,
  title,
  description: '',
  category: 'exploration',
  position: { x, y },
  layerId,
  tags: [],
  region: '',
  source: { title: 'Test', url: '' },
  evidence,
});

const savedView = (visibleLayerIds: string[]): SavedMapView => ({
  visibleLayerIds,
  countyId: null,
  area: null,
  hideFound: false,
  remainingOnly: false,
  favoritesOnly: false,
  evidence: 'all',
  category: 'all',
  enterableOnly: false,
  lootableOnly: false,
  interiorHouseOnly: false,
  venueType: 'all',
});

describe('v0.16.0 clean launch', () => {
  it('offers the saved layers back, never restores them', () => {
    // The user's screenshot: 27 layers saved, 27 back on open. The
    // offer is what the empty-map prompt shows; the launch itself
    // starts with every public layer off.
    expect(
      savedLayersOffer(savedView(['interiors', 'shops-food', 'my-markers'])),
    ).toEqual(['interiors', 'shops-food']);
    expect(savedLayersOffer(null)).toEqual([]);
    expect(savedLayersOffer(savedView(['my-markers']))).toEqual([]);
  });
});

describe('v0.16.0 hero pins at full-map zoom', () => {
  it('caps at 24, regions first, unnamed places never draw', () => {
    const places: Place[] = [
      place('region-vice-city', 1000, 1000, 'regions', 'Vice City'),
      place('region-capri', -6000, 0, 'regions', 'Capri'),
      place('unnamed-1', 0, 0, 'community', '?', 'uncertain'),
      place('unnamed-2', 3000, 3000, 'uncertain', '?', 'uncertain'),
      ...Array.from({ length: 60 }, (_, i) =>
        place(`named-${i}`, -8000 + i * 300, -4000 + i * 200, 'interiors'),
      ),
    ];
    const hero = selectHeroPlaces(places);
    expect(hero.length).toBeLessThanOrEqual(24);
    expect(hero[0]?.layerId).toBe('regions');
    expect(hero[1]?.layerId).toBe('regions');
    expect(hero.some((p) => p.title === '?')).toBe(false);
  });

  it('spreads one hero pin per grid cell instead of bunching', () => {
    const places: Place[] = Array.from({ length: 40 }, (_, i) =>
      place(`bunched-${i}`, 100 + (i % 5), 100 + Math.floor(i / 5), 'shops-food'),
    );
    // 40 places in one cell: only one hero pin survives from that cell.
    expect(selectHeroPlaces(places)).toHaveLength(1);
  });

  it('v0.31.1: named Loot Map places can be heroes — unverified "?" places still cannot', () => {
    // Before v0.31.1 the hero filter dropped every 'uncertain' place,
    // so turning on Bank jobs at island zoom showed nothing at all —
    // the layers looked empty. Loot places are named guide positions
    // (only their verification is pending), so they belong on the
    // island overview. A tentative GTADB name ("Parsons Hotel?") is
    // still not a confirmed name, so it stays out.
    const places: Place[] = [
      place('loot:guide-afternoon-delight', -6360, 3590, 'loot-heists', 'Afternoon Delight', 'uncertain'),
      place('loot:guide-meditation-jasons-house', -2353, -5532, 'loot-collectibles', 'Jason’s House meditation', 'uncertain'),
      place('tentative-1', 3000, 5000, 'community', 'Parsons Hotel?', 'uncertain'),
      place('unnamed-1', -5000, -5000, 'community', '?', 'uncertain'),
      place('named-1', 2000, 8000, 'interiors', 'Dynamix Fitness'),
    ];
    expect(selectHeroPlaces(places).map((p) => p.id)).toEqual([
      'named-1',
      'loot:guide-afternoon-delight',
      'loot:guide-meditation-jasons-house',
    ]);
  });
});

describe('v0.16.0 marker cap — the lag fix', () => {
  it('never draws more than 120 markers no matter how many places are on', () => {
    const places: Place[] = Array.from({ length: 3000 }, (_, i) =>
      place(`p-${i}`, (i % 60) * 100 - 3000, Math.floor(i / 60) * 100 - 3000, 'community'),
    );
    const groups = clusterPlaces(places, { zoom: -1, enabled: true });
    expect(groups.length).toBeLessThanOrEqual(120);
  });

  it('still draws every place when the count is small', () => {
    const places: Place[] = [
      place('a', 0, 0),
      place('b', 3000, 3000),
      place('c', -5000, -5000),
    ];
    expect(clusterPlaces(places, { zoom: 0, enabled: true })).toHaveLength(3);
  });
});
