import type { Position } from '../../domain/types';
import { isValidPosition } from './coordinates';

/**
 * Camera persistence (After Hours) — open the app and resume where
 * the player left off: the last map centre and zoom, saved on every
 * moveend/zoomend. One versioned localStorage key, validated on read;
 * a corrupt or foreign value falls back to the full map, never a crash.
 * Separate from the saved map view (layers/filters): this is the
 * camera, not the view state. v0.17.0: the resume is gated —
 * shouldResumeCamera below — so a zoomed-in camera from an old
 * session never opens the map on a partial view again.
 */

export const MAP_CAMERA_STORAGE_KEY = 'leonida-map-camera-v1';

export interface SavedCamera {
  center: Position;
  zoom: number;
}

export function loadSavedCamera(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): SavedCamera | null {
  try {
    const raw = storage?.getItem(MAP_CAMERA_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<SavedCamera>;
    if (!isValidPosition(value.center)) return null;
    if (typeof value.zoom !== 'number' || !Number.isFinite(value.zoom)) return null;
    return { center: value.center, zoom: Math.max(-5, Math.min(1, value.zoom)) };
  } catch {
    return null;
  }
}

export function saveCamera(
  camera: SavedCamera,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  try {
    storage?.setItem(MAP_CAMERA_STORAGE_KEY, JSON.stringify(camera));
  } catch {
    // Storage unavailable — the camera just does not persist this time.
  }
}

/**
 * v0.17.0 — the saved camera is only resumed when it still shows the
 * whole of Leonida. His 4:28pm screenshot was a saved camera from a
 * previous session, zoomed into the Vice City shops: land cut off at
 * the right edge, a huge empty sea on the left, a few pins on the
 * right edge — and with the zoom buttons hidden on phones he had no
 * obvious way back. A zoomed-in or panned-away camera is ignored on
 * open and the map fits all of Leonida instead; the stale value is
 * overwritten by the fit camera on the next moveend. Resuming is kept
 * for the case it was built for — reopening on the full map you left.
 */
export function shouldResumeCamera(
  saved: SavedCamera,
  fitZoom: number,
  fitCenter: Position,
): boolean {
  // Zoomed in past the whole-map fit: the open would show a partial
  // map, not Leonida. Half a zoom step of slack for rounding.
  if (saved.zoom > fitZoom + 0.5) return false;
  const dx = saved.center.x - fitCenter.x;
  const dy = saved.center.y - fitCenter.y;
  // Panned away from the whole-map centre: same partial-map open.
  return Math.hypot(dx, dy) <= 1200;
}
