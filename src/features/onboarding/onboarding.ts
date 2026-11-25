import type { LayerDefinition, Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';

/**
 * First-run onboarding — the fix for "none of the places are showing".
 *
 * The map opens blank on purpose (spoiler-free: every public layer starts
 * off), but nothing on screen said that, or that 4,407 places are mapped
 * and waiting behind the layer toggles. The welcome sheet says so in plain
 * words, shows the real counts per layer, and offers one-tap quick starts
 * that turn on just one layer. Layers stay off until the user chooses one.
 */

export const WELCOME_SEEN_STORAGE_KEY = 'leonida-welcome-seen';

/**
 * v0.11.0 forced indexing onboarding — a NEW key on purpose. Everyone
 * sees it once after this update, including users who already dismissed
 * the old welcome sheet: the old sheet never forced the indexing job,
 * so "seen the welcome" must not count as "seen the indexing job".
 */
export const INDEX_ONBOARDING_SEEN_STORAGE_KEY = 'leonida-index-onboarding-seen';

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

/** First launch after v0.11.0 shows the forced indexing onboarding. */
export function hasSeenIndexOnboarding(
  storage: StorageLike | null = browserStorage(),
): boolean {
  try {
    return storage?.getItem(INDEX_ONBOARDING_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIndexOnboardingSeen(
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(INDEX_ONBOARDING_SEEN_STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — the onboarding just shows again next launch.
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
 * GTADB snapshot 2e9e194: 4,407 places total — community 747 (717
 * positioned), interiors 83 (82), breakable homes 47 (42 positioned, 5
 * guide examples searchable-only), shops 46 (43), lootable 47 (47), gyms 8
 * (6), free outdoor 3 (2 positioned, 1 listed by name only), regions 6
 * (6), uncertain 3,415 (3,355), cards 5 positioned pins across 18 sets
 * (480 cards in total, the rest have no verified position yet). The 3,280
 * unnamed "?" records stay in these counts and on the map, in the
 * unverified layer — they are the level of detail the map needs, and
 * hiding them would hide the work still to do. Names: 1,064 confirmed,
 * 3,316 without a confirmed name (3,280 still "?" plus 36 tentative
 * "Name?" records) — see nameCounts(). There is no "5k".
 */
export function layerCounts(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
): LayerCount[] {
  const byId = new Map<string, LayerCount>();
  for (const layer of layers) {
    if (layer.id === 'my-markers') continue;
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
  return places.filter((place) => place.layerId !== 'my-markers').length;
}

/** Unnamed "?" records — still on the map, still to be resolved. */
export function countUnnamedPlaces(places: readonly Place[]): number {
  return places.filter((place) => isUnnamedPlace(place)).length;
}

export interface NameCounts {
  /** GTADB records in the catalogue (not regions, gyms, cards or markers). */
  total: number;
  /** Confirmed name — the snapshot's own knownNameCount. Verified 25 Nov 2026: 1,064. */
  known: number;
  /** No confirmed name — the snapshot's unknownNameCount: 3,316. */
  unknown: number;
  /** Still "?" — the AI job's scope: 3,280. */
  questionMark: number;
  /** Shows a name with a "?" ("Parsons Hotel?") — the name itself is not confirmed: 36. */
  tentative: number;
}

/**
 * The real name counts, from the GTADB snapshot's own counts field
 * (recordCount 4,380, knownNameCount 1,064, unknownNameCount 3,316 —
 * verified against the snapshot 25 Nov 2026). There is no "5k": that was
 * ever only a rough guess, never a count. The 36-record gap between the
 * app's "?" count (3,280) and the snapshot's unknown count (3,316) is
 * the tentative names — "Parsons Hotel?" and the like, where the name
 * itself carries a "?" and the source counts it unknown. Those 36 keep
 * showing their tentative name; only the 3,280 still-"?" records are in
 * the AI job's scope.
 */
export function nameCounts(places: readonly Place[]): NameCounts {
  // GTADB records carry L-ids; regions, gyms, equipment, guide
  // examples and cards do not. Breakable homes are GTADB records too
  // (their layer is 'breakable'), so the filter is by id, not layer.
  const gtadb = places.filter((place) => place.id.startsWith('L'));
  let known = 0;
  let questionMark = 0;
  let tentative = 0;
  for (const place of gtadb) {
    const first = place.title.split(',')[0]?.trim() ?? '';
    if (first === '' || first.startsWith('?') || first.startsWith('Unnamed ')) {
      questionMark++;
    } else if (first.includes('?')) {
      tentative++;
    } else {
      known++;
    }
  }
  return {
    total: gtadb.length,
    known,
    unknown: questionMark + tentative,
    questionMark,
    tentative,
  };
}

/** One-tap quick starts on the welcome sheet: turn on just that layer. */
export const QUICK_START_LAYERS: { layerId: string; label: string; hint: string }[] = [
  { layerId: 'gyms', label: 'Show gyms', hint: 'Member gyms in Vice City' },
  { layerId: 'equipment', label: 'Show workout equipment', hint: 'Free gear — beach, decks, benches' },
  { layerId: 'breakable', label: 'Show breakable homes', hint: 'Houses you can break into' },
  { layerId: 'lootable', label: 'Show lootable', hint: 'Buildings you can hold up' },
  { layerId: 'interiors', label: 'Show interiors', hint: 'Enterable buildings' },
  { layerId: 'shops-food', label: 'Show food & drink shops', hint: 'Bars, restaurants, convenience stores' },
  { layerId: 'shops-vehicles', label: 'Show vehicle services', hint: 'Gas, mod shops, Pay ’n’ Spray' },
];
