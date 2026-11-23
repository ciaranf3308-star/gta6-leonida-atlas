import type { LayerDefinition, Place } from '../../domain/types';

/**
 * First-run onboarding — the fix for "none of the places are showing".
 *
 * The map opens blank on purpose (spoiler-free: every public layer starts
 * off), but nothing on screen said that, or that 3,775 places are mapped
 * and waiting behind the layer toggles. The welcome sheet says so in plain
 * words, shows the real counts per layer, and offers one-tap quick starts
 * that turn on just one layer. Layers stay off until the user chooses one.
 */

export const WELCOME_SEEN_STORAGE_KEY = 'leonida-welcome-seen';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function hasSeenWelcome(storage: StorageLike | null = browserStorage()): boolean {
  try {
    return storage?.getItem(WELCOME_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(WELCOME_SEEN_STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — the sheet just shows again next launch.
  }
}

export interface LayerCount {
  layerId: string;
  name: string;
  total: number;
  positioned: number;
  unpositioned: number;
}

/**
 * Real per-layer counts from the loaded catalogue. Audited against the
 * GTADB snapshot d406fea: 3,775 places total — community 680 (647
 * positioned), interiors 81 (80), shops 39 (36), lootable 52 (52), gyms 8
 * (6), free outdoor 2 (2), regions 6 (6), uncertain 2,902 (2,848), cards 5
 * positioned pins across 18 sets (480 cards in total, the rest have no
 * verified position yet).
 */
export function layerCounts(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
): LayerCount[] {
  const byId = new Map<string, LayerCount>();
  for (const layer of layers) {
    if (layer.id === 'personal') continue;
    byId.set(layer.id, {
      layerId: layer.id,
      name: layer.name,
      total: 0,
      positioned: 0,
      unpositioned: 0,
    });
  }
  for (const place of places) {
    const entry = byId.get(place.layerId);
    if (!entry) continue;
    entry.total += 1;
    if (place.position) entry.positioned += 1;
    else entry.unpositioned += 1;
  }
  return [...byId.values()];
}

export function totalMappedPlaces(places: readonly Place[]): number {
  return places.filter((place) => place.layerId !== 'personal').length;
}

/** One-tap quick starts on the welcome sheet: turn on just that layer. */
export const QUICK_START_LAYERS: { layerId: string; label: string; hint: string }[] = [
  { layerId: 'gyms', label: 'Show gyms', hint: 'Member gyms + free outdoor gear' },
  { layerId: 'lootable', label: 'Show lootable', hint: 'Buildings you can hold up' },
  { layerId: 'interiors', label: 'Show interiors', hint: 'Enterable buildings' },
  { layerId: 'shops', label: 'Show shops', hint: 'Shops & services' },
];
