import type { Filters } from '../../domain/types';

/**
 * Map-view persistence (v0.16.0: clean launch).
 *
 * Layer choices are saved on this device in localStorage — but they are
 * NOT re-applied on the next launch. v0.15.0 restored them, so a saved
 * "Show everything" reopened as a wall of pink clusters with a "27"
 * badge — the exact screenshot the user sent back. The map always opens
 * clean (zero public pins); the saved layers are offered back in one
 * tap on the empty-map prompt ("Restore my last layers"). The camera
 * (position + zoom) still resumes — that is the map, not the spoilers.
 * My markers are always on regardless.
 *
 * This is separate from the IndexedDB user data (markers, notes, found
 * places): it is view state, not user data, and localStorage is the right
 * size for it. One versioned key, validated on read — a corrupt or
 * foreign value falls back to the blank first launch, never a crash.
 */

export const MAP_VIEW_STORAGE_KEY = 'leonida-map-view-v1';

export interface SavedMapView {
  visibleLayerIds: string[];
  countyId: string | null;
  area: string | null;
  hideFound: boolean;
  remainingOnly: boolean;
  favoritesOnly: boolean;
  evidence: Filters['evidence'];
  category: Filters['category'];
  enterableOnly: boolean;
  lootableOnly: boolean;
  interiorHouseOnly: boolean;
  venueType: Filters['venueType'];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function loadSavedMapView(
  storage: StorageLike | null = browserStorage(),
): SavedMapView | null {
  try {
    const raw = storage?.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<SavedMapView>;
    if (!isStringArray(value.visibleLayerIds)) return null;
    return {
      // Layer rename (v0.10.0): 'gyms-outdoor' became 'equipment' when
      // Gyms and Workout equipment were split. Old saved views still
      // open with the equipment layer on.
      visibleLayerIds: value.visibleLayerIds.map((id) =>
        id === 'gyms-outdoor' ? 'equipment' : id,
      ),
      countyId: typeof value.countyId === 'string' ? value.countyId : null,
      area: typeof value.area === 'string' ? value.area : null,
      hideFound: value.hideFound === true,
      remainingOnly: value.remainingOnly === true,
      favoritesOnly: value.favoritesOnly === true,
      evidence:
        value.evidence === 'approximate' || value.evidence === 'uncertain'
          ? value.evidence
          : 'all',
      category:
        value.category === 'region' ||
        value.category === 'landmark' ||
        value.category === 'nature' ||
        value.category === 'transport' ||
        value.category === 'business' ||
        value.category === 'personal'
          ? value.category
          : 'all',
      enterableOnly: value.enterableOnly === true,
      lootableOnly: value.lootableOnly === true,
      interiorHouseOnly: value.interiorHouseOnly === true,
      venueType:
        value.venueType === 'house' ||
        value.venueType === 'apartment' ||
        value.venueType === 'trailer' ||
        value.venueType === 'shop' ||
        value.venueType === 'bar' ||
        value.venueType === 'gym' ||
        value.venueType === 'other'
          ? value.venueType
          : 'all',
    };
  } catch {
    return null;
  }
}

export function saveMapView(
  view: SavedMapView,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Storage unavailable — the view just does not persist this time.
  }
}

export function mapViewFromState(
  visibleLayerIds: string[],
  filters: Filters,
): SavedMapView {
  return {
    visibleLayerIds,
    countyId: filters.countyId,
    area: filters.area,
    hideFound: filters.hideFound,
    remainingOnly: filters.remainingOnly,
    favoritesOnly: filters.favoritesOnly,
    evidence: filters.evidence,
    category: filters.category,
    enterableOnly: filters.enterableOnly,
    lootableOnly: filters.lootableOnly,
    interiorHouseOnly: filters.interiorHouseOnly,
    venueType: filters.venueType,
  };
}

/**
 * v0.16.0 clean launch: the saved view is an OFFER, never a restore.
 * The app opens with every public layer off; the empty-map prompt may
 * offer these ids back in one tap ("Restore my last layers"). 'personal'
 * is excluded — My markers are always on anyway, they are not an offer.
 */
export function savedLayersOffer(saved: SavedMapView | null): string[] {
  if (!saved) return [];
  return saved.visibleLayerIds.filter((id) => id !== 'personal');
}
