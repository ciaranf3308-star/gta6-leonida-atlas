import { isUnnamedPlace, type Place } from './types';
import { isEnterablePlace } from './tags';

/**
 * Interiors and breakable homes.
 *
 * What the data actually says (GTADB snapshot d406fea, checked 2026-11-23):
 * - 385 places carry the `enterable` tag; 159 of them are named.
 * - 33 places are `residential` + `enterable` — houses with an interior.
 *   GTADB tags ZERO of them in Capri, and ZERO trailer tags anywhere, so
 *   "33 enterable houses" is a tagging gap, not the real game. Capri alone
 *   has ~15 rob houses (GameRant marked every house and garage you can
 *   break into there), and trailer parks in Lost Vista, Scattered Pines and
 *   Port Gellhorn are enterable too.
 * - Breakable homes are systemic, not a fixed list. The in-game map is the
 *   source of truth: a building drawn DARK BLUE has an interior you can
 *   enter, LIGHT BLUE is closed (HowToVideoGame, DualShockers, TheGamer).
 *   No open dataset has a fixed count, so the app never presents one.
 *
 * Honesty rules: a place with no `enterable` tag is "Interior unknown",
 * never "not enterable". A house with no tags is unknown, not closed.
 * The Breakable homes layer holds the 33 GTADB-tagged houses, the Capri
 * rob-house candidates, the Port Gellhorn trailer park, and guide-named
 * examples (searchable-only where no verified position exists) — it is
 * examples plus tagged houses, not every breakable home.
 */

export const DARK_BLUE_RULE =
  'On the in-game map, a building drawn dark blue has an interior you can go in; light blue means it is closed. ' +
  'Focus (L3+R3) highlights the doors — white is smashable, red is alarmed. ' +
  'Dark blue does not promise every door works: try a side or back door, or the garage. ' +
  'Some dark-blue buildings are mission-only until the mission.';

export const BREAKABLE_GAP_NOTE =
  'This list is examples and houses tagged in the data — not every breakable home. ' +
  'Most houses have no tag in the data at all, so check the in-game map: dark blue means you can go in.';

export type VenueType = 'house' | 'apartment' | 'trailer' | 'shop' | 'bar' | 'gym' | 'other';

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  house: 'House',
  apartment: 'Apartment',
  trailer: 'Trailer',
  shop: 'Shop',
  bar: 'Bar',
  gym: 'Gym',
  other: 'Other',
};

export const VENUE_TYPE_OPTIONS: readonly { value: VenueType | 'all'; label: string }[] = [
  { value: 'all', label: 'All interiors' },
  { value: 'house', label: 'Houses' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'trailer', label: 'Trailers' },
  { value: 'shop', label: 'Shops' },
  { value: 'bar', label: 'Bars' },
  { value: 'other', label: 'Other' },
];

const SHOP_LABELS: readonly [string, string][] = [
  ['#gas', 'Petrol station'],
  ['#supermarket', 'Supermarket'],
  ['#clothes', 'Clothing shop'],
  ['#shoes', 'Shoe shop'],
  ['#hair', 'Hairdresser'],
  ['#guns', 'Gun shop'],
  ['#food', 'Food shop'],
  ['#fastfood', 'Fast food'],
  ['#bar', 'Bar'],
  ['#liquor', 'Liquor store'],
  ['#electronics', 'Electronics shop'],
  ['#tattoos', 'Tattoo parlour'],
  ['#modshop', 'Mod shop'],
  ["#pay'n'spray", "Pay 'n' Spray"],
  ['#stripclub', 'Strip club'],
  ['#nightclub', 'Nightclub'],
  ['#pharmacy', 'Pharmacy'],
  ['#vendor', 'Street vendor'],
  ['#drinks', 'Drinks shop'],
  ['#carwash', 'Car wash'],
  ['#bikeshop', 'Bike shop'],
  ['#liquor', 'Liquor store'],
  ['retail', 'Shop'],
  ['restaurant', 'Restaurant'],
  ['hotel', 'Hotel'],
];

function isTrailer(place: Pick<Place, 'title' | 'tags'>): boolean {
  return (
    place.tags.some((tag) => tag.toLowerCase().includes('trailer')) ||
    /trailer/i.test(place.title)
  );
}

function isApartment(place: Pick<Place, 'title' | 'tags'>): boolean {
  return (
    place.tags.some((tag) => tag.toLowerCase().includes('apartment')) ||
    /apartment|apts\b/i.test(place.title)
  );
}

function shopLabel(place: Pick<Place, 'tags'>): string | null {
  for (const [tag, label] of SHOP_LABELS) {
    if (place.tags.includes(tag)) return label;
  }
  return null;
}

/** The venue type of a place, from its tags and title — never guessed. */
export function venueTypeFor(place: Pick<Place, 'title' | 'tags' | 'layerId'>): VenueType {
  if (isTrailer(place)) return 'trailer';
  if (isApartment(place)) return 'apartment';
  if (place.layerId === 'gyms' || place.tags.includes('gym')) return 'gym';
  if (place.tags.includes('#bar') || place.tags.includes('#nightclub') || place.tags.includes('#stripclub'))
    return 'bar';
  if (shopLabel(place)) return 'shop';
  if (place.tags.includes('residential') || place.layerId === 'breakable') return 'house';
  return 'other';
}

export interface InteriorInfo {
  /** 'enterable' only when the data says so; otherwise 'unknown' — never a false no. */
  status: 'enterable' | 'unknown';
  venueType: VenueType;
  /** Plain-words label, e.g. "House — enterable interior, can be broken into". */
  label: string;
  /** What you do inside, from verified shop-type data and robbery guides. */
  activity: string | null;
  /** A house / apartment / trailer you can break into for robbery. */
  breakable: boolean;
  /** A trailer (mobile home) with an interior. */
  trailer: boolean;
  /** A house with no enterable tag — "check it", not "closed". */
  possibleBreakable: boolean;
}

export function interiorInfoFor(place: Place): InteriorInfo {
  const enterable = isEnterablePlace(place);
  const venueType = venueTypeFor(place);
  const trailer = isTrailer(place);
  const breakable =
    place.layerId === 'breakable' || (place.tags.includes('residential') && enterable);
  const possibleBreakable = possibleBreakableHouse(place);
  let label: string;
  if (breakable && trailer) label = 'Trailer — enterable interior, can be broken into';
  else if (breakable && venueType === 'apartment')
    label = 'Apartment — enterable interior, can be broken into';
  else if (breakable) label = 'House — enterable interior, can be broken into';
  else if (enterable && venueType === 'shop')
    label = `${shopLabel(place) ?? 'Shop'} — enterable interior`;
  else if (enterable && venueType === 'bar') label = 'Bar — enterable interior';
  else if (enterable && venueType === 'gym') label = 'Gym — enterable interior';
  else if (enterable) label = 'Enterable — has an interior';
  else if (venueType === 'house') label = 'Interior unknown — house';
  else if (trailer) label = 'Interior unknown — trailer';
  else label = 'Interior unknown';
  let activity: string | null = null;
  if (breakable) {
    activity =
      'Break in and rob it — look for a safe, jewellery, and special cars in the garage.';
  } else if (place.layerId === 'lootable') {
    activity =
      'Buy things — most small stores like this can be held up; safes and alarms vary by store.';
  } else if (venueType === 'shop') {
    activity = 'Buy things.';
  } else if (venueType === 'bar') {
    activity = 'Drink.';
  } else if (venueType === 'gym') {
    activity = 'Work out — membership costs in-game cash.';
  } else if (enterable && venueType === 'house') {
    activity = 'Enterable home — story safehouse or mission interior.';
  }
  return { status: enterable ? 'enterable' : 'unknown', venueType, label, activity, breakable, trailer, possibleBreakable };
}

/**
 * An unnamed place that is plausibly a breakable house, even though the
 * data does not tag it: a residential-tagged "?" anywhere, or any "?" in
 * Capri (a residential area where most houses carry no tags at all — 139
 * of 197 Capri records have none). Unknown, not closed.
 */
export function possibleBreakableHouse(place: Place): boolean {
  if (!isUnnamedPlace(place) || !place.position) return false;
  if (place.tags.includes('residential')) return true;
  if (place.region.trim().toLowerCase().startsWith('capri')) return true;
  return false;
}

/** A place that belongs in the Breakable homes layer (or answers as one). */
export function isBreakablePlace(place: Place): boolean {
  return (
    place.layerId === 'breakable' ||
    (place.tags.includes('residential') && isEnterablePlace(place))
  );
}

/**
 * A user marker for a house / apartment / trailer he found breakable.
 * Works on the marker's Place form (see markerToPlace: a breakable
 * marker carries the 'breakable' tag) or on its title/description words,
 * the same shape as isWorkoutMarker.
 */
export function isBreakableMarker(place: Place): boolean {
  if (place.layerId !== 'personal') return false;
  if (place.tags.some((tag) => ['breakable'].includes(tag))) return true;
  const text = `${place.title} ${place.description}`.toLowerCase();
  return ['breakable', 'break into', 'break-in', 'robbery', 'can rob'].some((p) =>
    text.includes(p),
  );
}

/** Counts of enterable places per venue type — for the Interiors filter. */
export function venueTypeCounts(places: readonly Place[]): Record<VenueType, number> {
  const counts: Record<VenueType, number> = {
    house: 0,
    apartment: 0,
    trailer: 0,
    shop: 0,
    bar: 0,
    gym: 0,
    other: 0,
  };
  for (const place of places) {
    if (!isEnterablePlace(place)) continue;
    counts[venueTypeFor(place)] += 1;
  }
  return counts;
}
