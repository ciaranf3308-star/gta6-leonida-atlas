/**
 * GTADB In-Game Day tiles — the real in-game pause-menu map, not a reconstruction.
 *
 * Source: GTADB / Map GTA (github.com/rolux/gtadb.org), `maps/tiles/6/day`,
 * CC BY 4.0; map artwork © Rockstar Games. Tile files are named
 * `{zoom},{tileY},{tileX}.jpg` on the same global grid as the old Yanis
 * reconstruction tiles: at tile zoom 5 one tile pixel is one GTADB canonical
 * unit, with the grid origin at canonical (-16384, 16384).
 *
 * Verified 23 Nov 2026: the tile at Ajax Gym's GTADB position (1420, 1766)
 * is day z5 tile (57, 69) — it shows the same SW 4th St waterfront as the
 * Yanis tile of the same index — and the z6 tile (114, 139) exists. The
 * full z6 land extent is 134 x 174 tiles = 34,304 x 44,544 px.
 *
 * Leaflet (CRS.Simple) zoom maps to tile zoom with an offset of 5:
 * Leaflet -5 shows tile zoom 0 (whole map) and Leaflet 1 shows tile zoom 6
 * (native max detail, one tile pixel per canonical unit). The tile layer
 * must declare minZoom -5 / maxZoom 1 in Leaflet zoom (GridLayer defaults
 * minZoom 0, which loads nothing below zoom 0) and must NOT use
 * zoomOffset / minNativeZoom / maxNativeZoom — those clamp the tile zoom
 * Leaflet computes, which would break the mapping above.
 */
import type { MapBounds } from './coordinates';

export const GTADB_DAY_TILE_REVISION = 'd406fea099e1df2bce42fd6b87eed04bce646629' as const;
/**
 * Redrawn tiles (v0.20.0): a NEW illustrated basemap painted from the
 * GTADB day tiles by scripts/redraw-tiles.py — flat illustrated fills
 * per surface, vector-drawn roads (cream minor streets, thin coral
 * majors, sunset highways), sea depth bands and clustered clouds.
 * Same filenames, coordinates, zooms and geometry as the day tiles;
 * the geography is real, the shading and detail are artistic.
 * The ungraded originals stay in tiles/day/ as the source of truth.
 * v0.18.0's recoloured pyramid (tiles/styled/) is deleted in v0.20.0:
 * superseded, unreferenced, 175 MB.
 * v0.20.0 re-renders every tile at 512x512 (2x display density),
 * pixel by pixel with no blur step anywhere: each output pixel's
 * class comes from exactly one source pixel (nearest lookup, never
 * a blend), colours are flat fills, roads are hard vector strokes.
 * Leaflet tileSize stays 256, so a 512px tile displays at 256 CSS
 * px — 1:1 device pixels on a DPR 2 phone. Leaflet's detectRetina
 * is deliberately NOT used: it clamps the layer minZoom to 0 and
 * this map lives at Leaflet zoom -5..1.
 */
export const GTADB_REDRAWN_TILE_REVISION = 'v0.20.0-redraw-512' as const;
export const GTADB_DAY_TILE_ZOOM_OFFSET = 5 as const;
export const GTADB_DAY_TILE_MIN_ZOOM = 0 as const;
export const GTADB_DAY_TILE_MAX_ZOOM = 6 as const;

/** Full tile coverage in GTADB canonical units: 3 x 4 tiles at zoom 0. */
export const GTADB_TILE_BOUNDS: MapBounds = {
  west: -16384,
  east: 8192,
  south: -16384,
  north: 16384,
};

export interface GtadbTileRef {
  zoom: number;
  tileY: number;
  tileX: number;
}

/** Leaflet tile coordinates (CRS.Simple) -> GTADB tile file coordinates. */
export function leafletTileToGtadb(
  leafletTileX: number,
  leafletTileY: number,
  leafletZoom: number,
): GtadbTileRef {
  const zoom = leafletZoom + GTADB_DAY_TILE_ZOOM_OFFSET;
  const offset = 2 ** (zoom + 1);
  return { zoom, tileX: leafletTileX + offset, tileY: leafletTileY + offset };
}

export function gtadbTileFileName(tile: GtadbTileRef): string {
  return `${tile.zoom}/${tile.zoom},${tile.tileY},${tile.tileX}.jpg`;
}

/** Same-origin tile URL for a Leaflet tile request.
 * v0.19.0: serves the redrawn pyramid (tiles/redrawn/), the true
 * rebuild — not the pale day tiles, and not v0.18's recolour. */
export function gtadbTileUrl(
  base: string,
  leafletTileX: number,
  leafletTileY: number,
  leafletZoom: number,
): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}assets/gta6-leonida-atlas/tiles/redrawn/${gtadbTileFileName(
    leafletTileToGtadb(leafletTileX, leafletTileY, leafletZoom),
  )}`;
}
