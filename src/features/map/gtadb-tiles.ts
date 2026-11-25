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
 *
 * RETINA (v0.22.0 fix — the v0.20.2 retina was broken and nobody
 * caught it): on DPR >= 2 the layer displays each 256px tile at 128
 * CSS px (tileSize 128). tileSize alone halves the rendered size
 * WITHOUT loading deeper tiles, so the fit view shrank to a small
 * island in a black frame. The caller must therefore pass
 * coords.z + 1 as the Leaflet zoom on retina: a 128-grid tile at
 * map zoom z covers exactly the ground of a 256-grid tile at zoom
 * z + 1, so the +1 loads the correct deeper tile with the correct
 * indices. The zoomOffset option must NOT be used for this — the
 * app overrides getTileUrl and Leaflet hands it coords.z, the tile
 * zoom; the offset only feeds the default URL builder, which the
 * override bypasses. The illustration label must use the same +1
 * or it will describe the wrong view at the switch.
 */
import type { MapBounds } from "./coordinates";

export const GTADB_DAY_TILE_REVISION =
  "d406fea099e1df2bce42fd6b87eed04bce646629" as const;
/**
 * Enhanced tiles (v0.20.2): the real GTADB day tiles through ONE realism
 * filter — scripts/enhance-tiles.py, a fixed per-pixel colour grade
 * (deeper teal sea, warmer land, richer greens, warm cream roads,
 * fine grain). Geography is locked 1:1: every output pixel comes from
 * exactly one source pixel at the same coordinates — no resampling, no
 * blur, no warp, no new roads, no new coastline. A pin on a road stays
 * on that road. The same fixed parameters run over all 31,022 tiles at
 * every zoom, so zooming in feels like getting closer to the same map,
 * never a different map loading.
 *
 * The ungraded originals stay in tiles/day/ as the source of truth.
 * v0.19.0/v0.20.0's illustrated redraw (tiles/redrawn/, a repaint)
 * is dead by the user's decision (2026-11-24 22:48): the reference
 * image is a render, not a real map, and the repaint ended up worse
 * than the real map. Do not revive it.
 *
 * CACHE RULE (the v0.20 lesson): a tile re-render must NEVER ship new
 * bytes at an old tile URL. The installed PWA caches tiles
 * cache-first, so same-filename tiles were served stale forever.
 * Every re-render changes the tile path (tiles/enhanced/ now) AND the
 * revision below AND the service-worker cache (finalize-build.mjs
 * folds the tile fingerprint into its content hash, and the generated
 * worker skipWaits so the update activates immediately).
 */
export const GTADB_ENHANCED_TILE_REVISION = "v0.20.2-realism-filter" as const;
/**
 * Illustrated island view (user decision 2026-11-25 00:34, after the
 * v0.20.2 grade measured as "0 difference" against the reference):
 * ONE AI-illustrated island image, traced from the real GTADB map
 * (scripts/illustrate-island.py — the generator's invented sea
 * features are cut back to the real coastline, so the island outline,
 * the lake and the cities sit where the real map puts them), sliced
 * into tiles for tile zooms 0-3 only (515 tiles). Tile zoom 4 and up
 * stay the real enhanced GTADB tiles: the street view is the real
 * in-game map, never an illustration. The z3 -> z4 switch pops — the
 * look changes from illustrated to real — same palette family, same
 * coastline, but a visible change, not a morph. Do not claim otherwise.
 *
 * CACHE RULE (same as enhanced): an illustrated re-render must change
 * the tile path AND the revision below AND the service-worker cache
 * (finalize-build.mjs folds both pyramids into its fingerprint).
 */
export const GTADB_ILLUSTRATED_TILE_REVISION = "v0.22-island-view" as const;
export const GTADB_ILLUSTRATED_MAX_ZOOM = 3 as const;
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
 * v0.20.2: serves the enhanced pyramid (tiles/enhanced/) — the real
 * GTADB day tiles through one realism filter, geography locked 1:1.
 * Not the pale day tiles, and not v0.19/v0.20's repaint.
 * Island view (2026-11-25): tile zooms 0-3 serve the illustrated
 * pyramid (tiles/illustrated/) — one AI illustration traced from the
 * real map; tile zooms 4-6 serve the real enhanced tiles. Pin
 * coordinates are unchanged: the illustration is only a backdrop, so
 * a pin lands on the same geographic spot at every zoom. */
export function gtadbTileUrl(
  base: string,
  leafletTileX: number,
  leafletTileY: number,
  leafletZoom: number,
): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const tile = leafletTileToGtadb(leafletTileX, leafletTileY, leafletZoom);
  const pyramid =
    tile.zoom <= GTADB_ILLUSTRATED_MAX_ZOOM ? "illustrated" : "enhanced";
  return `${prefix}assets/gta6-leonida-atlas/tiles/${pyramid}/${gtadbTileFileName(
    tile,
  )}`;
}
