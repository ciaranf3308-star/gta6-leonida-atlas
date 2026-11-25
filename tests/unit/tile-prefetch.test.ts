import { describe, expect, it } from 'vitest';
import {
  GRADED_GRID_EXTENTS,
  lowZoomIslandUrls,
  parseTileUrl,
  viewPrefetchUrls,
  type LoadedTileRef,
} from '../../src/features/map/tile-prefetch';

const BASE = '/gta6-leonida-atlas/';

describe('tile-prefetch', () => {
  it('grid extents match the on-disk graded pyramid counts', () => {
    const counts = [12, 48, 192, 768, 1496, 5829, 23182];
    expect(GRADED_GRID_EXTENTS).toHaveLength(7);
    for (let zoom = 0; zoom < 7; zoom++) {
      const [cols, rows] = GRADED_GRID_EXTENTS[zoom]!;
      expect(cols * rows).toBe(counts[zoom]);
    }
  });

  it('low-zoom island set is exactly z0–z2, 252 tiles', () => {
    const urls = lowZoomIslandUrls(BASE);
    expect(urls).toHaveLength(252);
    expect(new Set(urls).size).toBe(252);
    const byZoom = [0, 1, 2].map(
      (z) => urls.filter((u) => u.includes(`/tiles/graded/${z}/`)).length,
    );
    expect(byZoom).toEqual([12, 48, 192]);
    expect(urls[0]).toBe(
      '/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,0,0.jpg',
    );
  });

  it('parses loaded tile srcs and ignores anything else', () => {
    expect(
      parseTileUrl(
        '/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/5/5,69,57.jpg',
      ),
    ).toEqual({ zoom: 5, tileY: 69, tileX: 57 });
    expect(parseTileUrl('/gta6-leonida-atlas/assets/icons/icon-192.png')).toBeNull();
    expect(parseTileUrl('')).toBeNull();
  });

  it('view sets: neighbours +2 rings, child doubled +1 ring, parent halved +1 ring', () => {
    const loaded: LoadedTileRef[] = [];
    for (let y = 60; y <= 63; y++) {
      for (let x = 50; x <= 55; x++) {
        loaded.push({ zoom: 5, tileY: y, tileX: x });
      }
    }
    const { neighbours, child, parent, grandchild } = viewPrefetchUrls(BASE, loaded);
    // Neighbours: z5 x 48..57 (6 + 2 + 2), y 58..65 (4 + 2 + 2) = 80.
    expect(neighbours).toHaveLength(80);
    expect(neighbours[0]).toContain('/tiles/graded/5/5,58,48.jpg');
    // Child: z6 x 99..112, y 119..128 = 140.
    expect(child).toHaveLength(140);
    expect(child[0]).toContain('/tiles/graded/6/6,119,99.jpg');
    // Parent: z4 x 24..28, y 29..32 = 20.
    expect(parent).toHaveLength(20);
    expect(parent[0]).toContain('/tiles/graded/4/4,29,24.jpg');
    // Grandchild: z7 does not exist (loaded z5 + 2), so empty.
    expect(grandchild).toEqual([]);
    for (const url of [...neighbours, ...child, ...parent, ...grandchild]) {
      expect(url.startsWith(BASE)).toBe(true);
    }
  });

  it('grandchild warms the central half of the child range, two levels down', () => {
    const loaded: LoadedTileRef[] = [];
    for (let y = 30; y <= 33; y++) {
      for (let x = 20; x <= 25; x++) {
        loaded.push({ zoom: 4, tileY: y, tileX: x });
      }
    }
    const { child, grandchild } = viewPrefetchUrls(BASE, loaded);
    // Child: z5 x 39..52, y 59..68 = 140.
    expect(child).toHaveLength(140);
    // Grandchild: central half of the child range, doubled — z6
    // x 83..100, y 121..134 = 252, inside the 134x173 extent.
    expect(grandchild).toHaveLength(252);
    expect(grandchild[0]).toContain('/tiles/graded/6/6,121,83.jpg');
    expect(grandchild.every((u) => u.includes('/tiles/graded/6/'))).toBe(true);
  });

  it('clamps to the pyramid extents instead of prefetching 404s', () => {
    const loaded: LoadedTileRef[] = [
      { zoom: 6, tileY: 0, tileX: 0 },
      { zoom: 6, tileY: 172, tileX: 133 },
    ];
    const { neighbours, child, parent, grandchild } = viewPrefetchUrls(BASE, loaded);
    expect(child).toEqual([]);
    expect(grandchild).toEqual([]);
    expect(neighbours.every((u) => !u.includes('/6,173,') && !u.includes(',134.jpg'))).toBe(true);
    expect(parent.length).toBeGreaterThan(0);
  });

  it('has no parent below z0 and no child above z6', () => {
    const z0 = viewPrefetchUrls(BASE, [{ zoom: 0, tileY: 1, tileX: 1 }]);
    expect(z0.parent).toEqual([]);
    expect(z0.child.length).toBeGreaterThan(0);
    expect(z0.grandchild.length).toBeGreaterThan(0);
    const z6 = viewPrefetchUrls(BASE, [{ zoom: 6, tileY: 100, tileX: 100 }]);
    expect(z6.child).toEqual([]);
    expect(z6.grandchild).toEqual([]);
    expect(z6.parent.length).toBeGreaterThan(0);
  });

  it('returns empty sets with no loaded tiles', () => {
    expect(viewPrefetchUrls(BASE, [])).toEqual({
      neighbours: [],
      child: [],
      parent: [],
      grandchild: [],
    });
  });
});
