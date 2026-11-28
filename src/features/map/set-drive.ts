/**
 * Set drive mode (v0.33 Lane C, items 2 + 8 — D-3 + D-5). Pure
 * selectors over the GameDatabase + the catalogue places. No React,
 * no storage, no writes — the components and the App wiring read
 * these and nothing else, so the drive, the banner, the pill, the
 * pin dialog footer, the journal and the album can never disagree
 * about what a set's pins are or how many are found.
 *
 * A set drive shows ALL items of the set, whatever layer they ride
 * on: the `cards:<set>` pins AND the set's `loot-collectibles`
 * members (Harley for Delights, Marquise for Los Santos Panic,
 * Aimie for Nine1Nine). A pinned item's map pin is its catalogue
 * pin — the legacy `card:*` / `loot:*` place id — falling back to
 * its host location's place (a jot-matched slot pins to the player's
 * own marker). An item with neither draws no pin; the pinned count
 * still counts it, because it IS pinned — the count is about the
 * set, the pin list is about the map.
 *
 * Counts, kept apart (D-5):
 * - found/total — `setFoundLabel` (game-db.ts), from the completion
 *   log + set size. The "x / y found" string.
 * - pinned/total — `setPinnedCount` here. Labelled "pinned", never
 *   conflated with found/total.
 * - per-county — `setPinnedByCounty` here, counting PINNED cards by
 *   the county of their host place.
 */
import { COUNTIES, countyForPlace, countyIdForPosition } from '../../data/counties';
import {
  setProgress,
  type CollectibleItem,
  type GameDatabase,
} from '../../domain/game-db';
import type { Place } from '../../domain/types';

/** The set item behind one catalogue place id, if any. A loot
 * item's id IS its place id (meditations, magazines, the loot
 * dancer cards); a checklist card resolves through the legacy
 * bridge (`card:vicki` → its checklist slot). A host location
 * (L629 Delights) is NOT an item — it returns null. */
export function itemForPlace(
  db: GameDatabase,
  placeId: string,
): CollectibleItem | null {
  const direct = db.items.get(placeId);
  if (direct) return direct;
  const itemId = db.legacyItemIds.get(placeId);
  if (!itemId) return null;
  return db.items.get(itemId) ?? null;
}

/** The catalogue place id that draws one item's pin: its legacy
 * pin id first, else its host location's place id when that place
 * is in the catalogue (a jot-matched slot, or a loot card with no
 * catalogue pin). Null when the item has no place to draw. */
export function pinPlaceIdForItem(
  db: GameDatabase,
  places: readonly Place[],
  item: CollectibleItem,
): string | null {
  for (const [legacyId, itemId] of db.legacyItemIds) {
    if (itemId === item.id) return legacyId;
  }
  if (item.locationId && places.some((place) => place.id === item.locationId)) {
    return item.locationId;
  }
  return null;
}

export interface SetDriveMembers {
  /** Catalogue place ids that draw the set's pins — every layer
   * the set rides on, in set order. */
  placeIds: string[];
  /** The set's pinned items, in set order. */
  pinnedItems: CollectibleItem[];
}

/** The set's pinned slots and their map pins, measured from the
 * data at call time — never hard-coded. The count the drive
 * asserts against is `pinnedItems.length`, not a constant. */
export function setDriveMembers(
  db: GameDatabase,
  places: readonly Place[],
  setId: string,
): SetDriveMembers {
  const set = db.sets.get(setId);
  if (!set) throw new Error(`Unknown collectible set: ${setId}.`);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const legacyReverse = new Map<string, string>();
  for (const [legacyId, itemId] of db.legacyItemIds) {
    legacyReverse.set(itemId, legacyId);
  }
  const pinnedItems = set.itemIds
    .map((itemId) => db.items.get(itemId)!)
    .filter((item) => item.placement === 'pinned');
  const placeIds: string[] = [];
  for (const item of pinnedItems) {
    const pinId =
      legacyReverse.get(item.id) ??
      (item.locationId && placeById.has(item.locationId) ? item.locationId : null);
    if (pinId) placeIds.push(pinId);
  }
  return { placeIds, pinnedItems };
}

/** Pinned vs set size — the "N pinned of M" number, labelled
 * "pinned" wherever it is shown. */
export function setPinnedCount(
  db: GameDatabase,
  setId: string,
): { pinned: number; total: number } {
  const set = db.sets.get(setId);
  if (!set) throw new Error(`Unknown collectible set: ${setId}.`);
  const pinned = set.itemIds.filter(
    (itemId) => db.items.get(itemId)?.placement === 'pinned',
  ).length;
  return { pinned, total: set.size };
}

export interface PinnedByCounty {
  countyId: string;
  countyName: string;
  count: number;
}

/** PINNED cards by county, from each pinned card's host place —
 * the named county in its area text first, else the county rect
 * its host falls in. Count desc, then name asc. */
export function setPinnedByCounty(
  db: GameDatabase,
  places: readonly Place[],
  setId: string,
): PinnedByCounty[] {
  const { pinnedItems } = setDriveMembers(db, places, setId);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const counts = new Map<string, number>();
  for (const item of pinnedItems) {
    const host = item.locationId ? placeById.get(item.locationId) : undefined;
    const countyId =
      (host ? countyForPlace(host) : null) ??
      (host?.position ? countyIdForPosition(host.position) : null) ??
      (item.locationId
        ? (() => {
            const location = db.locations.get(item.locationId!);
            return location?.position ? countyIdForPosition(location.position) : null;
          })()
        : null) ??
      'unknown';
    counts.set(countyId, (counts.get(countyId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([countyId, count]) => ({
      countyId,
      countyName:
        COUNTIES.find((county) => county.id === countyId)?.name ?? 'Unknown county',
      count,
    }))
    .sort((a, b) => b.count - a.count || a.countyName.localeCompare(b.countyName));
}

/** The layers a set drive turns on: the distinct layers of the
 * set's member pins. Every other public layer goes off; my-markers
 * is untouched (the caller's job — this returns layer ids only). */
export function setDriveLayerIds(
  db: GameDatabase,
  places: readonly Place[],
  setId: string,
): string[] {
  const { placeIds } = setDriveMembers(db, places, setId);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const layers = new Set<string>();
  for (const placeId of placeIds) {
    const place = placeById.get(placeId);
    if (place) layers.add(place.layerId);
  }
  return [...layers];
}

export interface NextInSet {
  item: CollectibleItem;
  /** The catalogue pin to jump to (centres the map, opens its dialog). */
  pinPlaceId: string;
}

/**
 * The next UNCOLLECTED pinned card in the set, in set order after
 * the current item, wrapping to the start. Only pinned cards can
 * be jumped to — an unpinned card has no pin dialog to open. Null
 * when every pinned card is found (the footer then reads "Set
 * complete" when the whole set is found, else "All pinned cards
 * found"). A pinned card whose pin place is missing from the
 * catalogue is skipped, never jumped to.
 */
export function nextInSet(
  db: GameDatabase,
  places: readonly Place[],
  setId: string,
  currentItemId: string | null,
): NextInSet | null {
  const { pinnedItems } = setDriveMembers(db, places, setId);
  if (pinnedItems.length === 0) return null;
  const currentIndex = pinnedItems.findIndex((item) => item.id === currentItemId);
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let step = 0; step < pinnedItems.length; step++) {
    const item = pinnedItems[(start + step) % pinnedItems.length]!;
    if (db.completedItemIds.has(item.id)) continue;
    const pinPlaceId = pinPlaceIdForItem(db, places, item);
    if (!pinPlaceId) continue;
    return { item, pinPlaceId };
  }
  return null;
}

/** The footer line for a set that has no next pinned card: "Set
 * complete" only when the whole set is found — otherwise the honest
 * remainder, which lives in the journal (unpinned cards have no
 * pin to jump to). Pure, so the footer text is testable without
 * driving the sheet. */
export function noNextInSetLabel(db: GameDatabase, setId: string): string {
  const { found, total } = setProgress(db, setId);
  if (found >= total) return 'Set complete ✓';
  return `All pinned cards found — ${total - found} still to find in the journal`;
}
