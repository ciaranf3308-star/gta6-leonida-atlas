import { describe, expect, it } from 'vitest';
import {
  GTADB_DAY_TILE_MAX_ZOOM,
  gtadbTileFileName,
  gtadbTileUrl,
  leafletTileToGtadb,
} from '../../src/features/map/gtadb-tiles';

// P0 regression (2026-11-25, baseline review): on DPR >= 2 the caller
// passes coords.z + 1, so at map zoom 1 the computed tile zoom was 7 —
// a tile that does not exist. The SW ocean fallback answered the 404s
// with 200, so deepest zoom rendered as flat teal ocean over land,
// silently. The fix clamps to tile zoom 6 AND halves the indices;
// a bare Math.min(zoom, 6) would point at the wrong tile (zoom-7
// indices run ~2x the zoom-6 range) and still 404.
//
// Ground truth used throughout: Ajax Gym at canonical (1420, 1766)
// is day z5 tile (tileY 57, tileX 69) and z6 tile (114, 139).

describe('leafletTileToGtadb', () => {
  it('maps the Ajax Gym ground truth at tile zoom 5', () => {
    // Non-retina, map zoom 0: Leaflet 256-grid coords for (1420, 1766).
    const tile = leafletTileToGtadb(5, -7, 0);
    expect(tile).toEqual({ zoom: 5, tileX: 69, tileY: 57 });
  });

  it('clamps the retina max-zoom request to tile zoom 6 with halved indices', () => {
    // Retina, map zoom 1: Leaflet 128-grid coords for (1420, 1766).
    const retina = leafletTileToGtadb(22, -28, 2);
    expect(retina.zoom).toBe(GTADB_DAY_TILE_MAX_ZOOM);
    expect(retina).toEqual({ zoom: 6, tileX: 139, tileY: 114 });
  });

  it('loads the same tile on retina and non-retina at max zoom', () => {
    const retina = leafletTileToGtadb(22, -28, 2);
    const plain = leafletTileToGtadb(11, -14, 1);
    expect(retina).toEqual(plain);
    expect(plain).toEqual({ zoom: 6, tileX: 139, tileY: 114 });
  });

  it('never returns a tile zoom above the pyramid max', () => {
    for (let leafletZoom = -5; leafletZoom <= 3; leafletZoom += 1) {
      for (const [x, y] of [
        [0, 0],
        [-128, -128],
        [127, 127],
        [-256, 200],
      ] as const) {
        const tile = leafletTileToGtadb(x, y, leafletZoom);
        expect(tile.zoom).toBeLessThanOrEqual(GTADB_DAY_TILE_MAX_ZOOM);
        expect(tile.zoom).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps normal zooms unchanged', () => {
    expect(leafletTileToGtadb(5, -7, 0)).toEqual({ zoom: 5, tileX: 69, tileY: 57 });
    expect(leafletTileToGtadb(11, -14, 1)).toEqual({ zoom: 6, tileX: 139, tileY: 114 });
    // Retina fit view: map zoom -5 passes leafletZoom -4 -> tile zoom 1.
    expect(leafletTileToGtadb(-2, -1, -4).zoom).toBe(1);
  });
});

describe('gtadbTileUrl', () => {
  it('never requests a zoom-7 tile at retina max zoom', () => {
    const url = gtadbTileUrl('/gta6-leonida-atlas/', 22, -28, 2);
    expect(url).toContain('/tiles/vicewire-v1/6/6,114,139.jpg');
    expect(url).not.toContain('/7/');
    expect(gtadbTileFileName(leafletTileToGtadb(22, -28, 2))).toBe('6/6,114,139.jpg');
  });
});
