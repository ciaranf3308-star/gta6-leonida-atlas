import type { Position } from '../../domain/types';
import { isValidPosition } from './coordinates';

/**
 * Camera persistence (After Hours) — open the app and resume where
 * the player left off: the last map centre and zoom, saved on every
 * moveend/zoomend. One versioned localStorage key, validated on read;
 * a corrupt or foreign value falls back to the full map, never a crash.
 * Separate from the saved map view (layers/filters): this is the
 * camera, not the view state.
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
