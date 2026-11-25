import type { Place } from './types';
import { GUIDE_BREAKABLE_LOOT } from '../data/breakable-homes';
import { isEnterablePlace } from './tags';

/**
 * "Available loot" for the place card — ONLY from verified sources.
 * The rule is the same as everywhere else in this app: never invent
 * loot. A lootable shop can be held up (The Games Wiki's Enterable
 * Buildings guidance: most small stores can be held up; safes and
 * alarms vary by store) — but which stores have a safe is NOT
 * confirmed per store, so the card says that. A breakable home from
 * the robbery guides names its loot (a safe, a car in the garage);
 * a GTADB-tagged breakable house names none, so its card says
 * "Loot unknown". Anything that is not a robbery target has no loot
 * row at all — a gym does not get a "Loot unknown" line.
 */

export type LootStatus = 'verified' | 'robable' | 'unknown';

export interface LootInfo {
  status: LootStatus;
  /** One or two plain sentences. */
  text: string;
  /** Where the fact came from, when there is one. */
  source: string | null;
}

/** Places that get a loot row: robbery targets and enterable shops. */
export function hasLootRow(place: Pick<Place, 'layerId' | 'tags'>): boolean {
  if (place.layerId === 'lootable' || place.layerId === 'breakable') return true;
  if (place.layerId.startsWith('shops-')) return true;
  if (place.layerId === 'interiors' && isEnterablePlace(place)) return true;
  if (place.layerId === 'community' && isEnterablePlace(place)) return true;
  return false;
}

export function lootFor(place: Place): LootInfo | null {
  if (!hasLootRow(place)) return null;
  if (place.layerId === 'lootable') {
    return {
      status: 'robable',
      text: 'Can be held up — cash from the till. Whether this store has a safe, and whether it is alarmed, is not confirmed for this store.',
      source: 'Robbery guidance: The Games Wiki, Enterable Buildings',
    };
  }
  if (place.layerId === 'breakable') {
    const guideLoot = GUIDE_BREAKABLE_LOOT.get(place.id);
    if (guideLoot) {
      return { status: 'verified', text: guideLoot, source: 'Robbery guides: GameRant, HowToVideoGame' };
    }
    return {
      status: 'unknown',
      text: 'Loot unknown — breakable homes can hold a safe, cash or jewellery, but nothing is confirmed for this house. Check it in game and add your own note.',
      source: null,
    };
  }
  // A named shop that is NOT lootable (Ammu-Nation, clothes, hair):
  // nothing in any source says it can be held up.
  return {
    status: 'unknown',
    text: 'Loot unknown — no source says this place can be robbed. If you find out otherwise in game, add your own note.',
    source: null,
  };
}
