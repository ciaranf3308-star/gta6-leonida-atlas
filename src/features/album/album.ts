/**
 * The premium collection album (DESIGN-ADDENDUM §3) — pure selectors
 * over the SAME CollectibleItem records and the SAME completion log
 * the journal reads. No second database, no second checklist: a set
 * cover, its 480 checklist slots, and the sold join are all derived
 * here from `GameDatabase` + `PersonalItemState` rows.
 *
 * The two hard lines (§3.3) are enforced in code, not just in the
 * component: `albumArtwork` returns a silhouette for every
 * uncollected card even when a photo URL is handed to it, and there
 * is no code path anywhere in this module that produces a generated
 * card face — the face is a real licensed artwork reference, the
 * player's own photo, or the honest empty slot.
 */
import { setProgress, type CollectibleItem, type GameDatabase } from '../../domain/game-db';
import type { PersonalItemState } from '../../domain/album';

export type AlbumFilter = 'all' | 'found' | 'remaining' | 'unpositioned' | 'sold';

export const ALBUM_FILTERS: { id: AlbumFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'found', label: 'Found' },
  { id: 'remaining', label: 'Remaining' },
  { id: 'unpositioned', label: 'Unpositioned' },
  { id: 'sold', label: 'Sold' },
];

/** The 480 in-game checklist slots, in set order (the in-game
 * progress-menu order the player compares against). Non-slot
 * game-text variants are NOT slots and never appear here — the album
 * lists them under "Also in the game files", like the journal. */
export function albumSlots(db: GameDatabase, setId: string): CollectibleItem[] {
  const set = db.sets.get(setId);
  if (!set) return [];
  return set.itemIds
    .map((id) => db.items.get(id))
    .filter((item): item is CollectibleItem => item !== undefined && item.checklistSlot);
}

/** Every checklist slot in the album, across all 18 sets. */
export function allAlbumSlots(db: GameDatabase): CollectibleItem[] {
  return [...db.sets.values()].flatMap((set) => albumSlots(db, set.id));
}

/** The sold join: item ids with a live sale (`soldAt` set). A row
 * with `soldAt: null` is an undone sale — the audit trail, not a
 * sold card. */
export function soldIdsFromStates(states: readonly PersonalItemState[]): ReadonlySet<string> {
  return new Set(states.filter((state) => state.soldAt !== null).map((state) => state.itemId));
}

export function slotMatchesFilter(
  item: CollectibleItem,
  found: boolean,
  sold: boolean,
  filter: AlbumFilter,
): boolean {
  switch (filter) {
    case 'found':
      return found;
    case 'remaining':
      return !found;
    case 'unpositioned':
      return item.placement !== 'pinned';
    case 'sold':
      return sold;
    case 'all':
    default:
      return true;
  }
}

/** Filter counts over the 480 slots. `sold` counts collected cards
 * the player has sold — sold never moves a progress number (§3.4),
 * so it is a display count only. */
export function albumCounts(
  db: GameDatabase,
  soldIds: ReadonlySet<string>,
): Record<AlbumFilter, number> {
  const slots = allAlbumSlots(db);
  return {
    all: slots.length,
    found: slots.filter((item) => db.completedItemIds.has(item.id)).length,
    remaining: slots.filter((item) => !db.completedItemIds.has(item.id)).length,
    unpositioned: slots.filter((item) => item.placement !== 'pinned').length,
    sold: slots.filter((item) => soldIds.has(item.id)).length,
  };
}

/** A set counts complete when all its checklistSlot items are
 * collected. Non-slot variants never block a set (§3.2). */
export function isSetComplete(db: GameDatabase, setId: string): boolean {
  const progress = setProgress(db, setId);
  return progress.total > 0 && progress.found === progress.total;
}

export type AlbumArtwork =
  | { kind: 'silhouette' }
  | { kind: 'empty' }
  | { kind: 'photo'; url: string };

/**
 * What the card face shows (addendum §3.3, the two hard lines).
 *
 * - Uncollected: silhouette ONLY — name + silhouette, never artwork.
 *   A photo URL passed for an uncollected card is ignored on purpose:
 *   the artwork is the reveal, earned by finding the card. There is
 *   no branch that returns a photo for an uncollected card.
 * - Collected + the player's own photo: the photo, labelled as theirs.
 * - Collected + no photo: the honest empty slot — "No licensed
 *   artwork yet". No fake face is ever generated: no AI illustration
 *   may decorate a card front, so this function has no such branch.
 */
export function albumArtwork(
  item: CollectibleItem,
  found: boolean,
  photoUrl: string | null,
): AlbumArtwork {
  void item;
  if (!found) return { kind: 'silhouette' };
  if (photoUrl) return { kind: 'photo', url: photoUrl };
  return { kind: 'empty' };
}

/** Rarity frame treatment (§3.2, CSS only, no assets). The class is
 * applied ONLY to collected cards — an uncollected card never shows
 * a gold shimmer for a card the player does not have. */
export function rarityFrameClass(item: CollectibleItem): string {
  switch (item.rarity.tier) {
    case 'gold':
      return 'rarity-gold';
    case 'silver':
      return 'rarity-silver';
    case 'bronze':
      return 'rarity-bronze';
    case 'standard':
    default:
      return 'rarity-standard';
  }
}
