import type { PlaceTags } from './types';

/**
 * The user's own secondary tags on ANY place — "sells t-shirts" on a
 * gas station, "sells clothes" on an Ammu-Nation, "workout equipment"
 * on a house / garage in Capri.
 *
 * The rule, from the user (2026-11-24): a tag is HIS label, never
 * verified data. It never changes the place's real Map Index category,
 * it sits alongside it, and everywhere it shows it reads "Your tag".
 * What it DOES do: make the place findable by that word, and make Ask
 * Nylah answer from it — a place he tagged "workout equipment"
 * answers a workout question, because on his device that IS verified
 * equipment (he saw it), even though no public source lists it.
 */

export const MAX_TAGS_PER_PLACE = 20;
export const MAX_TAG_LENGTH = 40;

/** One tag, cleaned: lowercased, single spaces, no leading '#'. */
export function normalizeUserTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

/** Is this a tag worth keeping? Letters, numbers, spaces, hyphens,
 * apostrophes — no URLs, no emoji spam, no empty strings. */
export function isValidUserTag(tag: string): boolean {
  const clean = normalizeUserTag(tag);
  if (clean.length < 2 || clean.length > MAX_TAG_LENGTH) return false;
  if (/https?:\/\//.test(clean) || clean.includes('www.')) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N} '\-/.&]*$/u.test(clean);
}

/** Split a free-text entry ("sells t-shirts, workout equipment") into
 * clean, deduped tags. A single tag without commas stays one tag. */
export function parseUserTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of input.split(',')) {
    const clean = normalizeUserTag(part);
    if (clean && isValidUserTag(clean) && !seen.has(clean)) {
      seen.add(clean);
      tags.push(clean);
    }
    if (tags.length >= MAX_TAGS_PER_PLACE) break;
  }
  return tags;
}

/** The user's tags on one place, as a plain list. */
export function userTagsFor(
  placeId: string,
  placeTags: readonly PlaceTags[] | ReadonlyMap<string, readonly string[]>,
): string[] {
  if (Array.isArray(placeTags))
    return placeTags.find((row) => row.placeId === placeId)?.tags ?? [];
  const byId = placeTags as ReadonlyMap<string, readonly string[]>;
  return [...(byId.get(placeId) ?? [])];
}

/** Rows as a lookup map, for search / Ask. */
export function userTagsMap(
  placeTags: readonly PlaceTags[],
): Map<string, readonly string[]> {
  return new Map(placeTags.map((row) => [row.placeId, row.tags]));
}

/** Words that mean the free gear, not a member club — the same
 * vocabulary as the equipment questions in gym-check.ts. */
const EQUIPMENT_TAG_WORDS = [
  'workout',
  'equipment',
  'bench',
  'weights',
  'weight',
  'kettlebell',
  'dumbbell',
  'squat',
  'deadlift',
  'calisthenics',
  'pull-up',
  'pull up',
  'punching bag',
];

/** Does one user tag say this place is the thing a layer asks for?
 * A tag is the user's own observation, so it counts the way a source
 * tag does in retrieval — but only for the layer the question asked
 * for. A "workout equipment" tag never answers a burglary question. */
export function userTagMatchesLayer(tag: string, layerId: string): boolean {
  const t = normalizeUserTag(tag);
  if (!t) return false;
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (layerId === 'equipment')
    return has(...EQUIPMENT_TAG_WORDS) || (has('gym') && has('home', 'free', 'outdoor'));
  if (layerId === 'gyms')
    return (
      (has('gym', 'fitness') && !has(...EQUIPMENT_TAG_WORDS)) ||
      has('member gym', 'gym membership')
    );
  if (layerId === 'breakable')
    return has('breakable', 'break into', 'break-in', 'can rob', 'rob this', 'robbery');
  if (layerId === 'lootable')
    return has('loot', 'rob', 'hold up', 'holdup', 'safe', 'cash');
  if (layerId === 'interiors') return has('enterable', 'can go inside', 'go inside', 'interior');
  if (layerId === 'shops-weapons') return has('gun', 'ammo', 'ammunation', 'ammunition');
  if (layerId === 'shops-style')
    return has('clothes', 'clothing', 't-shirt', 'tshirt', 'tattoo', 'hair', 'shoe', 'fashion');
  if (layerId === 'shops-food')
    return has('food', 'bar', 'drink', 'restaurant', 'cafe', 'coffee', 'supermarket', 'grocery', 'liquor', 'snack', 'convenience');
  if (layerId === 'shops-vehicles')
    return has('gas', 'petrol', 'fuel', 'mod shop', 'pay', 'spray', 'car wash', 'mechanic', 'rental', 'bike shop');
  if (layerId.startsWith('shops-')) return has('shop', 'store', 'sells', 'buy');
  return false;
}

/** Any of the place's user tags match the layer. */
export function userTagsMatchLayer(tags: readonly string[], layerId: string): boolean {
  return tags.some((tag) => userTagMatchesLayer(tag, layerId));
}

/** Search words for a place's user tags, so "t-shirts" finds the gas
 * station the user tagged "sells t-shirts". */
export function userTagSearchWords(tags: readonly string[]): string[] {
  return tags.flatMap((tag) => {
    const clean = normalizeUserTag(tag);
    return clean ? [clean, ...clean.split(' ')] : [];
  });
}
