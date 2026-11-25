import { isUnnamedPlace, type Place } from './types';
import {
  aiCategoryShortLabel,
  type AiCategoryId,
} from '../features/categorise/categories';

/**
 * Resolve "?" places from the map data's own tags — no AI, no guessing.
 *
 * Of the 3,280 unnamed records in the GTADB snapshot, 580 carry a tag
 * that resolves to a real type (house 331, transport 37, services 17,
 * restaurant 14, shop 104, leisure 28, landmark 47, petrol 2 — the
 * extended rules below). Those get a resolved type here, labelled "from
 * the map data" — the name stays "?" and the type is only as good as
 * the tag. A further 98 carry only a hotel or industrial tag, which
 * says "a building" and nothing more — those stay unknown, not
 * "Other". The rest carry no usable tag (1,711 have no tags at all,
 * 989 carry tags that resolve to nothing) and stay "not sure" until
 * the resolver's coordinate / guide / analogue steps or the AI job
 * runs on the user's phone, or he marks them himself. Nothing here
 * invents a type: a tag that says nothing about use resolves to
 * nothing.
 *
 * Counts (GTADB 2e9e194, checked 2026-11-25): house 331, transport 37,
 * services 17, restaurant 14, shop 104, leisure 28, landmark 47,
 * petrol 2.
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
 * `tagResolutionForTags` is the tag-only core, shared with the index
 * resolver's coordinate step (a named place's type, from its tags).
 */
export function tagResolutionForTags(tags: readonly string[]): TagResolution | null {
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
  // Extended rules (resolver v2, 2026-11-24): a gym tag IS a gym — 0
  // GTADB records carry one, so this fires for seeded/user data and
  // future snapshots, never for today's snapshot. A hospital or police
  // tag is a service; a cinema, tennis court, racetrack or marina is
  // leisure; a metro/metromover tag is transport. A hotel or industrial
  // tag still says "a building" and nothing more — it does not resolve
  // to a type. Those stay unknown, not "Other".
  if (
    tags.includes('gym') ||
    tags.includes('fitness') ||
    tags.includes('workout') ||
    tags.includes('strength')
  )
    return { category: 'gym', label: 'Gym / workout' };
  if (tags.includes('#hospital') || tags.includes('#police'))
    return { category: 'services', label: 'Services' };
  if (
    tags.includes('#cinema') ||
    tags.includes('#tennis') ||
    tags.includes('#racetrack') ||
    tags.includes('#marina')
  )
    return { category: 'leisure', label: 'Leisure' };
  if (tags.includes('#metro') || tags.includes('#metromover'))
    return { category: 'transport', label: 'Transport' };
  return null;
}

export function tagResolutionFor(place: Pick<Place, 'title' | 'tags'>): TagResolution | null {
  if (!isUnnamedPlace(place)) return null;
  return tagResolutionForTags(place.tags);
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
