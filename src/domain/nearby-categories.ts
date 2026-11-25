import { distanceBetween } from './distance';
import {
  MAP_INDEX_CATEGORIES,
  type Category,
  type Place,
  type Position,
} from './types';

/**
 * The top Map Index categories of verified places near a point — the
 * "what is here" chips on a region card (v0.25.0). Real counts from the
 * catalogue, never invented: for Vice City the answer is Exploration /
 * Vehicles / Robberies, because most of the places near it are still
 * unnamed "?" records. Unverified, My markers and Collectibles are
 * excluded — the chips are the game's own Map Index, not the
 * everything-else groups.
 */
export function topCategoriesNear(
  center: Position,
  allPlaces: readonly Place[],
  radius = 2000,
  limit = 2,
): { category: Category; count: number }[] {
  const counts = new Map<Category, number>();
  for (const place of allPlaces) {
    if (!place.position) continue;
    if (
      place.category === 'unverified' ||
      place.category === 'my-markers' ||
      place.category === 'collectibles'
    )
      continue;
    if (!(MAP_INDEX_CATEGORIES as readonly string[]).includes(place.category))
      continue;
    if (distanceBetween(place.position, center) > radius) continue;
    counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
