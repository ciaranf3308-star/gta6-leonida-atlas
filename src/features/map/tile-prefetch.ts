/**
 * Tile prefetch / cache warming (v0.29.0).
 *
 * The user's verdict: performance is POXY, preload the layers so it's
 * snappy. Profiled (2026-11-25, 390px DPR 2, localhost): cold load
 * settles tiles in ~1.6s, a full zoom-in fires ~190 tile requests,
 * and panning re-fetches tiles the service worker already evicted
 * (old 1500-entry cap). Preloading ALL 31,527 tiles (~197 MB) up
 * front would thrash his phone and is NOT the answer — the working
 * set is: the whole low-zoom island (z0–z2, 252 tiles, ~1.5 MB),
 * the rings around the current view, and the child/parent/grandchild
 * zooms of the viewport, fetched on idle AFTER first paint, never blocking
 * it. The service worker caches every prefetch (same-origin GET),
 * so the next pan or zoom step reads from cache.
 *
 * The prefetch set is derived from the tiles Leaflet itself already
 * loaded (their <img> srcs), never from re-implemented projection
 * math: the current tile range at the deepest loaded zoom gives the
 * neighbours (expand by 2), the child zoom (double the indices, one
 * extra ring) and the parent zoom (halve the indices, one extra
 * ring). If the math were wrong the hit-rate check in the perf walk
 * would show it — prefetched URLs that Leaflet never asks for.
 */
import type L from 'leaflet';
import { GTADB_GRADED_TILE_DIR } from './gtadb-tiles';

/** Tile-grid extents per tile zoom (cols x rows), from the on-disk
 * graded pyramid: z0 3x4, z1 6x8, z2 12x16, z3 24x32, z4 34x44,
 * z5 67x87, z6 134x173 — the products are exactly the file counts
 * (12/48/192/768/1496/5829/23182), so the file set is the full
 * rectangle at every zoom. File indices are 0-based from the west /
 * north edges: z0 files run 0,0,0.jpg .. 0,3,2.jpg. */
export const GRADED_GRID_EXTENTS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [6, 8],
  [12, 16],
  [24, 32],
  [34, 44],
  [67, 87],
  [134, 173],
] as const;

export const GRADED_MAX_TILE_ZOOM = 6 as const;

export interface LoadedTileRef {
  zoom: number;
  tileY: number;
  tileX: number;
}

const TILE_URL_RE = /\/tiles\/graded\/(\d+)\/\1,(\d+),(\d+)\.jpg$/;

/** Parse a loaded tile <img> src into its tile ref, or null. */
export function parseTileUrl(src: string): LoadedTileRef | null {
  const match = TILE_URL_RE.exec(src);
  if (!match) return null;
  return {
    zoom: Number(match[1]),
    tileY: Number(match[2]),
    tileX: Number(match[3]),
  };
}

function tileUrl(
  base: string,
  zoom: number,
  tileY: number,
  tileX: number,
): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}assets/gta6-leonida-atlas/tiles/${GTADB_GRADED_TILE_DIR}/${zoom}/${zoom},${tileY},${tileX}.jpg`;
}

function clampRange(
  zoom: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const extents = GRADED_GRID_EXTENTS[zoom];
  if (!extents) return null;
  const [cols, rows] = extents;
  const loX = Math.max(0, minX);
  const hiX = Math.min(cols - 1, maxX);
  const loY = Math.max(0, minY);
  const hiY = Math.min(rows - 1, maxY);
  if (loX > hiX || loY > hiY) return null;
  return { minX: loX, maxX: hiX, minY: loY, maxY: hiY };
}

function urlsForRange(
  base: string,
  zoom: number,
  range: { minX: number; maxX: number; minY: number; maxY: number },
): string[] {
  const urls: string[] = [];
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      urls.push(tileUrl(base, zoom, y, x));
    }
  }
  return urls;
}

/** The whole low-zoom island: every tile at z0–z2 (12 + 48 + 192 =
 * 252 tiles, ~1.5 MB). Cheap enough to warm eagerly on first idle;
 * it makes zooming back out to the island instant from cache. */
export function lowZoomIslandUrls(base: string): string[] {
  const urls: string[] = [];
  for (let zoom = 0; zoom <= 2; zoom++) {
    const range = clampRange(zoom, 0, Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER);
    if (range) urls.push(...urlsForRange(base, zoom, range));
  }
  return urls;
}

/**
 * Prefetch URLs for the current view, from the tiles Leaflet already
 * loaded. Takes the deepest loaded zoom's tile range and returns:
 * neighbours (same zoom, +2 rings), child (zoom +1, doubled indices
 * +1 ring), parent (zoom -1, halved indices +1 ring) and grandchild
 * (zoom +2, the central half of the child range doubled +1 ring —
 * the zoom pill zooms toward the centre, so the centre is what the
 * next zoom step will need). Two levels deep, not one: a rapid zoom
 * crosses two levels before the prefetcher gets a quiet window to
 * re-queue, and the first after-profile measured a 0 hit rate on a
 * 16-click zoom-in with one-level warming. Each set is clamped to
 * the pyramid extents, so no 404 is ever prefetched. Returns empty
 * sets at the pyramid ends (no child above z6, no parent below z0).
 * Pure — unit-tested, no Leaflet needed.
 */
export function viewPrefetchUrls(
  base: string,
  loaded: readonly LoadedTileRef[],
): {
  neighbours: string[];
  child: string[];
  parent: string[];
  grandchild: string[];
} {
  const empty = { neighbours: [], child: [], parent: [], grandchild: [] };
  if (loaded.length === 0) return empty;
  const zoom = Math.max(...loaded.map((t) => t.zoom));
  const atZoom = loaded.filter((t) => t.zoom === zoom);
  const minX = Math.min(...atZoom.map((t) => t.tileX));
  const maxX = Math.max(...atZoom.map((t) => t.tileX));
  const minY = Math.min(...atZoom.map((t) => t.tileY));
  const maxY = Math.max(...atZoom.map((t) => t.tileY));
  const neighbours: string[] = [];
  const child: string[] = [];
  const parent: string[] = [];
  const grandchild: string[] = [];
  const nRange = clampRange(zoom, minX - 2, maxX + 2, minY - 2, maxY + 2);
  if (nRange) neighbours.push(...urlsForRange(base, zoom, nRange));
  const cMinX = minX * 2 - 1;
  const cMaxX = maxX * 2 + 2;
  const cMinY = minY * 2 - 1;
  const cMaxY = maxY * 2 + 2;
  if (zoom < GRADED_MAX_TILE_ZOOM) {
    const cRange = clampRange(zoom + 1, cMinX, cMaxX, cMinY, cMaxY);
    if (cRange) child.push(...urlsForRange(base, zoom + 1, cRange));
  }
  if (zoom + 2 <= GRADED_MAX_TILE_ZOOM) {
    // Central half of the child range, doubled: the zoom target.
    const gMinX = cMinX + Math.floor((cMaxX - cMinX) / 4);
    const gMaxX = cMaxX - Math.floor((cMaxX - cMinX) / 4);
    const gMinY = cMinY + Math.floor((cMaxY - cMinY) / 4);
    const gMaxY = cMaxY - Math.floor((cMaxY - cMinY) / 4);
    const gRange = clampRange(
      zoom + 2,
      gMinX * 2 - 1,
      gMaxX * 2 + 2,
      gMinY * 2 - 1,
      gMaxY * 2 + 2,
    );
    if (gRange) grandchild.push(...urlsForRange(base, zoom + 2, gRange));
  }
  if (zoom > 0) {
    const pRange = clampRange(
      zoom - 1,
      Math.floor(minX / 2) - 1,
      Math.floor(maxX / 2) + 1,
      Math.floor(minY / 2) - 1,
      Math.floor(maxY / 2) + 1,
    );
    if (pRange) parent.push(...urlsForRange(base, zoom - 1, pRange));
  }
  return { neighbours, child, parent, grandchild };
}

/** Read the tiles Leaflet currently holds, from the DOM. */
export function loadedTilesFromDom(): LoadedTileRef[] {
  const refs: LoadedTileRef[] = [];
  for (const img of document.querySelectorAll<HTMLImageElement>(
    '.leaflet-tile-loaded',
  )) {
    const ref = parseTileUrl(img.getAttribute('src') ?? '');
    if (ref) refs.push(ref);
  }
  return refs;
}

export interface TilePrefetchHandle {
  stop: () => void;
}

const IDLE_SLICE = 8;

/**
 * Warm the tile cache on idle. Queues the low-zoom island once, then
 * the current view's neighbours/child/parent after every settled
 * move; cancels in-flight work the moment the user starts moving
 * again, so prefetch never competes with the tiles the user is
 * actually looking at. Fetches run at low priority through the
 * service worker, which caches them; a URL already fetched this
 * session is never fetched twice. Skips entirely on save-data or
 * slow-2g connections, and while the tab is hidden.
 */
export function startTilePrefetch(
  map: L.Map,
  tiles: L.TileLayer,
  base: string,
): TilePrefetchHandle {
  const prefetched = new Set<string>();
  const pending: string[] = [];
  const queued = new Set<string>();
  let stopped = false;
  let idleHandle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: AbortController | undefined;
  let lowZoomQueued = false;

  const shouldSkip = (): boolean => {
    if (stopped || document.hidden) return true;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return true;
    if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g')
      return true;
    return false;
  };

  const enqueue = (urls: readonly string[]) => {
    for (const url of urls) {
      if (!prefetched.has(url) && !queued.has(url)) {
        queued.add(url);
        pending.push(url);
      }
    }
    schedule();
  };

  const pump = () => {
    idleHandle = undefined;
    if (stopped || pending.length === 0) return;
    if (shouldSkip()) {
      // Retry later; the moveend trigger re-queues anyway.
      scheduleDelayed(4000);
      return;
    }
    const controller = new AbortController();
    abort = controller;
    const slice = pending.splice(0, IDLE_SLICE);
    for (const url of slice) queued.delete(url);
    const fetches = slice.map((url) =>
      fetch(url, {
        priority: 'low',
        signal: controller.signal,
        credentials: 'same-origin',
      } as RequestInit)
        .then((response) => {
          if (response.ok) prefetched.add(url);
        })
        .catch(() => {
          // A failed prefetch is not an error — the tile loads
          // normally when Leaflet asks for it.
        }),
    );
    void Promise.all(fetches).then(() => {
      if (stopped || pending.length === 0) return;
      schedule();
    });
  };

  const schedule = () => {
    if (stopped || pending.length === 0 || idleHandle !== undefined) return;
    if (typeof requestIdleCallback === 'function') {
      idleHandle = requestIdleCallback(
        (deadline) => {
          idleHandle = undefined;
          if (deadline.timeRemaining() <= 0 && pending.length > 0) {
            scheduleDelayed(500);
            return;
          }
          pump();
        },
        { timeout: 3000 },
      );
    } else {
      scheduleDelayed(800);
    }
  };

  const scheduleDelayed = (ms: number) => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      pump();
    }, ms);
  };

  const queueCurrentView = () => {
    if (stopped) return;
    if (!lowZoomQueued) {
      lowZoomQueued = true;
      enqueue(lowZoomIslandUrls(base));
    }
    const { neighbours, child, parent, grandchild } = viewPrefetchUrls(
      base,
      loadedTilesFromDom(),
    );
    enqueue([...neighbours, ...child, ...parent, ...grandchild]);
  };

  const cancelInFlight = () => {
    abort?.abort();
    abort = undefined;
    if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(idleHandle);
      idleHandle = undefined;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const onTilesLoad = () => queueCurrentView();
  const onMoveStart = () => cancelInFlight();
  // v0.29.0 (second pass): 400ms, not 1200ms — after a zoom step the
  // next level's tiles are what the user is about to need, and the
  // prefetcher is low-priority already, so waiting 1.2s just wastes
  // the quiet window. The queue survives a cancel; only the
  // in-flight slice is aborted, so work resumes where it left off.
  const onMoveEnd = () => scheduleDelayed(400);

  tiles.on('load', onTilesLoad);
  map.on('movestart', onMoveStart);
  map.on('zoomstart', onMoveStart);
  map.on('moveend', onMoveEnd);

  return {
    stop: () => {
      stopped = true;
      cancelInFlight();
      tiles.off('load', onTilesLoad);
      map.off('movestart', onMoveStart);
      map.off('zoomstart', onMoveStart);
      map.off('moveend', onMoveEnd);
    },
  };
}
