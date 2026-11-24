import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Filters, Place } from '../../src/domain/types';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { filterPlaces } from '../../src/domain/filter';
import {
  DARK_BLUE_RULE,
  interiorInfoFor,
  isBreakablePlace,
  possibleBreakableHouse,
  venueTypeCounts,
} from '../../src/domain/interiors';
import {
  tagResolutionCounts,
  tagResolutionFor,
} from '../../src/domain/resolve-tags';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'title' | 'layerId'>): Place {
  return {
    description: '',
    category: 'landmark',
    position: { x: 0, y: 0 },
    tags: [],
    region: '',
    source: { title: 'test', url: '' },
    evidence: 'approximate',
    ...overrides,
  };
}

const baseFilters: Filters = {
  query: '',
  category: 'all',
  favoritesOnly: false,
  personalOnly: false,
  evidence: 'all',
  collectionId: null,
  countyId: null,
  area: null,
  hideFound: false,
  remainingOnly: false,
  enterableOnly: false,
  lootableOnly: false,
  interiorHouseOnly: false,
  venueType: 'all',
  sortNearest: false,
};

describe('Interiors — the status on tap', () => {
  it('says a breakable house plainly, with what is inside', () => {
    const info = interiorInfoFor(
      place({
        id: 'L192',
        title: 'Venture Apts North, Rockridge, Vice City',
        layerId: 'breakable',
        tags: ['enterable', 'residential'],
      }),
    );
    expect(info.status).toBe('enterable');
    expect(info.breakable).toBe(true);
    expect(info.venueType).toBe('apartment');
    expect(info.label).toMatch(/Apartment — enterable interior, can be broken into/);
    expect(info.activity).toMatch(/Break in and rob it/);
  });

  it('says a shop interior plainly, with what you do inside', () => {
    const info = interiorInfoFor(
      place({
        id: 'L1',
        title: 'Corner Store, Capri',
        layerId: 'lootable',
        tags: ['enterable', 'retail'],
      }),
    );
    expect(info.status).toBe('enterable');
    expect(info.breakable).toBe(false);
    expect(info.venueType).toBe('shop');
    expect(info.activity).toMatch(/held up/);
  });

  it('never calls a house without the enterable tag "not enterable"', () => {
    const info = interiorInfoFor(
      place({
        id: 'L818',
        title: '?, Capri',
        layerId: 'uncertain',
        tags: ['residential'],
        region: 'Capri',
      }),
    );
    expect(info.status).toBe('unknown');
    expect(info.label).toBe('Interior unknown — house');
    expect(info.possibleBreakable).toBe(true);
    expect(DARK_BLUE_RULE).toMatch(/dark blue/);
  });

  it('says a trailer plainly', () => {
    const info = interiorInfoFor(
      place({
        id: 'breakable:scattered-pines-trailer',
        title: 'Scattered Pines trailer',
        layerId: 'breakable',
        position: null,
        tags: ['breakable', 'house', 'enterable', 'trailer'],
        region: 'Scattered Pines',
      }),
    );
    expect(info.trailer).toBe(true);
    expect(info.breakable).toBe(true);
    expect(info.label).toMatch(/Trailer — enterable interior/);
  });
});

describe('Breakable homes — the systemic model, not a list', () => {
  it('treats an untagged "?" house in Capri as possible, not closed', () => {
    expect(
      possibleBreakableHouse(
        place({ id: 'L900', title: '?, Capri', layerId: 'uncertain', tags: [], region: 'Capri' }),
      ),
    ).toBe(true);
    expect(
      possibleBreakableHouse(
        place({ id: 'L901', title: '?, Capri', layerId: 'uncertain', tags: ['residential'], region: 'Capri' }),
      ),
    ).toBe(true);
  });

  it('does not call a named place or a non-residential Vice City "?" possible', () => {
    expect(
      possibleBreakableHouse(
        place({ id: 'L902', title: 'Lou’s, Rockridge, Vice City', layerId: 'community', tags: ['residential'], region: 'Rockridge, Vice City' }),
      ),
    ).toBe(false);
    expect(
      possibleBreakableHouse(
        place({ id: 'L903', title: '?, Vice City', layerId: 'uncertain', tags: [], region: 'Vice City' }),
      ),
    ).toBe(false);
  });

  it('holds the 33 GTADB-tagged houses, the 13 Capri candidates and the trailer park — and labels the gap', () => {
    const places = catalogueFromSnapshot(snapshot);
    const breakable = places.filter((p) => p.layerId === 'breakable');
    expect(breakable).toHaveLength(52);
    expect(breakable.filter((p) => p.position)).toHaveLength(47);
    const resEnt = places.filter(
      (p) => p.tags.includes('residential') && p.tags.includes('enterable'),
    );
    expect(resEnt).toHaveLength(33);
    expect(resEnt.every((p) => p.layerId === 'breakable')).toBe(true);
    expect(breakable.filter((p) => p.region.startsWith('Capri'))).toHaveLength(13);
    const trailerPark = places.find((p) => p.id === 'L1062');
    expect(trailerPark?.layerId).toBe('breakable');
    expect(isBreakablePlace(trailerPark!)).toBe(true);
    // The 33 is a tagging count, not the real total — Capri has ~15 rob
    // houses and GTADB tags 0 of them.
    expect(resEnt.filter((p) => p.region.startsWith('Capri'))).toHaveLength(0);
  });

  it('counts enterable places by venue type — 390 in total, houses included', () => {
    const places = catalogueFromSnapshot(snapshot);
    const counts = venueTypeCounts(places);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(390);
    expect(counts).toEqual({
      house: 36,
      apartment: 5,
      trailer: 2,
      shop: 138,
      bar: 6,
      gym: 0,
      other: 203,
    });
  });
});

describe('Interior houses + venue type filters', () => {
  it('Interior houses is residential + enterable, nothing else', () => {
    const places = catalogueFromSnapshot(snapshot);
    const houses = filterPlaces(places, { ...baseFilters, interiorHouseOnly: true }, [], [], []);
    expect(houses).toHaveLength(33);
    expect(houses.every((p) => p.tags.includes('residential'))).toBe(true);
  });

  it('venue type narrows enterable places only', () => {
    const places = catalogueFromSnapshot(snapshot);
    const trailers = filterPlaces(places, { ...baseFilters, venueType: 'trailer' }, [], [], []);
    expect(trailers).toHaveLength(2);
    expect(trailers.every((p) => p.tags.includes('enterable'))).toBe(true);
    const houses = filterPlaces(places, { ...baseFilters, venueType: 'house' }, [], [], []);
    expect(houses).toHaveLength(36);
  });
});

describe('Resolve every POI — from the map data’s own tags', () => {
  it('resolves a residential "?" to a house, a #gas "?" to petrol, a retail "?" to a shop', () => {
    expect(
      tagResolutionFor(place({ id: 'L1', title: '?, Capri', layerId: 'uncertain', tags: ['residential'] }))?.category,
    ).toBe('house');
    expect(
      tagResolutionFor(place({ id: 'L2', title: '?, Ambrosia', layerId: 'uncertain', tags: ['#gas', 'enterable'] }))?.category,
    ).toBe('petrol');
    expect(
      tagResolutionFor(place({ id: 'L3', title: '?, Vice City', layerId: 'uncertain', tags: ['retail'] }))?.category,
    ).toBe('shop');
  });

  it('resolves nothing for a "?" with no usable tags, and never for a named place', () => {
    expect(
      tagResolutionFor(place({ id: 'L4', title: '?, Capri', layerId: 'uncertain', tags: [] })),
    ).toBeNull();
    expect(
      tagResolutionFor(place({ id: 'L5', title: '?, Capri', layerId: 'uncertain', tags: ['enterable'] })),
    ).toBeNull();
    expect(
      tagResolutionFor(place({ id: 'L6', title: 'Lou’s, Rockridge, Vice City', layerId: 'community', tags: ['residential'] })),
    ).toBeNull();
  });

  it('counts the real resolution: 588 resolved from tags, 2,144 still unknown', () => {
    const places = catalogueFromSnapshot(snapshot);
    const counts = tagResolutionCounts(places);
    expect(counts.resolved).toBe(588);
    expect(counts.remaining).toBe(2144);
    expect(counts.byCategory.house).toBe(332);
    expect(counts.byCategory.shop).toBe(106);
    // Extended rules (resolver v2): hospital/police 2 services,
    // cinema/tennis/racetrack/marina 5 leisure.
    expect(counts.byCategory.services).toBe(19);
    expect(counts.byCategory.leisure).toBe(30);
  });

  it('searching "house" finds a residential "?"', () => {
    const places = catalogueFromSnapshot(snapshot);
    const found = filterPlaces(places, { ...baseFilters, query: 'house' }, [], [], []);
    expect(found.some((p) => p.tags.includes('residential') && p.title.startsWith('?'))).toBe(true);
  });
});
