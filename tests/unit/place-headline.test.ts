import { describe, expect, it } from 'vitest';
import { topCategoriesNear } from '../../src/domain/nearby-categories';
import { displayTitleFor, type Place } from '../../src/domain/types';

const makePlace = (overrides: Partial<Place>): Place => ({
  id: 'x',
  title: 'Café Beach',
  description: '',
  category: 'food-drink',
  position: { x: 0, y: 0 },
  layerId: 'community',
  tags: [],
  region: '',
  source: { title: 'GTADB', url: 'https://example.invalid' },
  evidence: 'approximate',
  ...overrides,
});

describe('displayTitleFor', () => {
  it('keeps a named title untouched', () => {
    expect(displayTitleFor(makePlace({ title: 'Café Beach' }))).toBe('Café Beach');
  });

  it('headlines an unnamed place by its area, never "?"', () => {
    expect(displayTitleFor(makePlace({ title: '?, Washington Beach, Vice Beach' }))).toBe(
      'Washington Beach, Vice Beach',
    );
  });

  it('treats a "? Concert Hall" name as unnamed and shows the area', () => {
    expect(displayTitleFor(makePlace({ title: '? Concert Hall, Vice City' }))).toBe('Vice City');
  });

  it('falls back to the region when there is no area', () => {
    expect(displayTitleFor(makePlace({ title: '?', region: 'Vice City' }))).toBe(
      'Unnamed place in Vice City',
    );
  });

  it('falls back to Unnamed place with no area and no region', () => {
    expect(displayTitleFor(makePlace({ title: '?' }))).toBe('Unnamed place');
  });

  it('keeps a real name carrying a "?" qualifier', () => {
    expect(displayTitleFor(makePlace({ title: 'Parsons Hotel?, Vice City' }))).toBe(
      'Parsons Hotel?, Vice City',
    );
  });
});

describe('topCategoriesNear', () => {
  const all = [
    makePlace({ id: 'a', category: 'exploration', position: { x: 100, y: 0 } }),
    makePlace({ id: 'b', category: 'exploration', position: { x: 200, y: 0 } }),
    makePlace({ id: 'c', category: 'vehicles', position: { x: 300, y: 0 } }),
    makePlace({ id: 'd', category: 'unverified', position: { x: 50, y: 0 } }),
    makePlace({ id: 'e', category: 'food-drink', position: { x: 5000, y: 0 } }),
    makePlace({ id: 'f', category: 'my-markers', position: { x: 60, y: 0 } }),
  ];

  it('ranks real Map Index categories by count, nearest first', () => {
    expect(topCategoriesNear({ x: 0, y: 0 }, all)).toEqual([
      { category: 'exploration', count: 2 },
      { category: 'vehicles', count: 1 },
    ]);
  });

  it('ignores unverified places, my markers and out-of-radius places', () => {
    expect(topCategoriesNear({ x: 0, y: 0 }, all, 40, 3)).toEqual([]);
  });

  it('respects the limit', () => {
    expect(topCategoriesNear({ x: 0, y: 0 }, all, 2000, 1)).toEqual([
      { category: 'exploration', count: 2 },
    ]);
  });
});
