import { isUnnamedPlace, type Place } from './types';
import {
  aiCategoryShortLabel,
  type AiCategoryId,
} from '../features/categorise/categories';

/**
 * Resolve "?" places from the map data's own tags — no AI, no guessing.
 *
 * Of the 2,732 unnamed records in the GTADB snapshot, 581 carry a tag
 * that resolves to a real type (residential, a shop tag, transport…).
 * Those 581 get a resolved type here, labelled "from the map data" —
 * the name stays "?" and the type is only as good as the tag. A further
 * 101 carry only a hotel or industrial tag, which says "a building" and
 * nothing more — those stay unknown, not "Other". The other 2,050 carry
 * no usable tag (1,108 have no tags at all, 942 only internal notes
 * like `enterable`) and stay "not sure" until the AI job runs on the
 * user's phone or he marks them himself. Nothing here invents a type:
 * a tag that says nothing about use resolves to nothing.
 *
 * Counts (GTADB d406fea, checked 2026-11-23): residential 332, retail
 * 93, natural 47, transportation 37, leisure 25, government 13,
 * restaurant 11, shop tags ~40.
 */

export interface TagResolution {
  category: AiCategoryId;
  /** Shop kind, only when the type is `shop` (e.g. "supermarket"). */
  shopType?: string;
  /** Short label for lists ("House", "Petrol station"). */
  label: string;
}

const SHOP_TAG_TYPES: readonly [string, string][] = [
  ['#gas', 'petrol'],
  ['#supermarket', 'supermarket'],
  ['#clothes', 'clothing'],
  ['#shoes', 'shoes'],
  ['#hair', 'hairdresser'],
  ['#guns', 'gun shop'],
  ['#food', 'food'],
  ['#fastfood', 'fast food'],
  ['#electronics', 'electronics'],
  ['#tattoos', 'tattoo parlour'],
  ['#modshop', 'mod shop'],
  ["#pay'n'spray", "pay 'n' spray"],
  ['#carwash', 'car wash'],
  ['#bikeshop', 'bike shop'],
  ['#pharmacy', 'pharmacy'],
  ['#liquor', 'liquor store'],
  ['#vendor', 'street vendor'],
  ['#drinks', 'drinks'],
  ['retail', 'shop'],
];

/**
 * The type a place's tags resolve to, or null when its tags say nothing
 * about what it is. Only unnamed places resolve — a named place already
 * says what it is in its name, and its tags are shown as they are.
 */
export function tagResolutionFor(place: Pick<Place, 'title' | 'tags'>): TagResolution | null {
  if (!isUnnamedPlace(place)) return null;
  const tags = place.tags;
  if (tags.includes('#gas')) return { category: 'petrol', label: 'Petrol station' };
  if (tags.includes('#bar')) return { category: 'bar', label: 'Bar' };
  if (tags.includes('#nightclub') || tags.includes('#stripclub'))
    return { category: 'leisure', label: 'Leisure' };
  if (tags.includes('restaurant')) return { category: 'restaurant', label: 'Restaurant / food' };
  if (tags.includes('#food') || tags.includes('#fastfood'))
    return { category: 'restaurant', shopType: tags.includes('#fastfood') ? 'fast food' : 'food', label: 'Restaurant / food' };
  for (const [tag, shopType] of SHOP_TAG_TYPES) {
    if (tags.includes(tag))
      return { category: 'shop', shopType, label: 'Shop' };
  }
  if (tags.includes('residential')) return { category: 'house', label: 'House / residential' };
  if (tags.includes('transportation') || tags.includes('infrastructure') || tags.includes('infr'))
    return { category: 'transport', label: 'Transport' };
  if (tags.includes('leisure')) return { category: 'leisure', label: 'Leisure' };
  if (tags.includes('government') || tags.includes('office') || tags.includes('service'))
    return { category: 'services', label: 'Services' };
  if (tags.includes('natural') || tags.includes('agriculture'))
    return { category: 'landmark', label: 'Landmark' };
  // A hotel or industrial tag says "a building" and nothing more — it
  // does not resolve to a type. Those stay unknown, not "Other".
  return null;
}

/** Search words for a tag-resolved type, so "house" finds a residential "?". */
export function tagResolutionSearchWords(place: Pick<Place, 'title' | 'tags'>): string[] {
  const resolution = tagResolutionFor(place);
  if (!resolution) return [];
  return [
    resolution.category,
    aiCategoryShortLabel(resolution.category).toLowerCase(),
    ...(resolution.shopType ? [resolution.shopType] : []),
  ];
}

/** How many "?" places resolve per type, and how many are still unknown. */
export function tagResolutionCounts(places: readonly Place[]): {
  resolved: number;
  remaining: number;
  byCategory: Partial<Record<AiCategoryId, number>>;
} {
  const byCategory: Partial<Record<AiCategoryId, number>> = {};
  let resolved = 0;
  let remaining = 0;
  for (const place of places) {
    if (!isUnnamedPlace(place)) continue;
    const resolution = tagResolutionFor(place);
    if (resolution) {
      resolved += 1;
      byCategory[resolution.category] = (byCategory[resolution.category] ?? 0) + 1;
    } else {
      remaining += 1;
    }
  }
  return { resolved, remaining, byCategory };
}
