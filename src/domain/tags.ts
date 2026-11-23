import type { Place } from './types';
import { isUnnamedPlace } from './types';

/**
 * Tags, in plain English — the halfway point for the 2,732 unnamed "?"
 * records.
 *
 * A "?" record does not need a full proper name to be useful: a correct
 * TAG says what it is. 1,624 of the 2,732 unnamed records already carry
 * some tag in the GTADB data — but 582 of those carry only internal
 * notes (map-level tags like l4, or //notes), so 1,042 carry a tag that
 * actually says what the place is (residential 332, enterable 218,
 * retail 93, hotel 41, shop types, …) — and 1,108 carry no tag at all.
 * The app just never showed any of them in plain words. No tags are
 * invented here: these labels only translate tags the source already
 * supplied. GTADB's own newer data is byte-identical to the pinned
 * snapshot (checked 23 Nov 2026), and no other trusted source names
 * these places — so nothing below adds a tag, it only reads them.
 * The user's bet — that a lot of them are gym equipment in houses — is
 * NOT confirmed by any tag: 0 GTADB records carry a gym/fitness/
 * workout/strength tag. (The only gym-tagged places in the catalogue are
 * the 10 curated gyms.) A place is only ever called a gym when a source
 * says so, or when the user marks it as a workout spot himself (a
 * "workout spot" My marker).
 */

/** Plain-English label for a GTADB tag. Unknown tags fall back to the raw tag. */
export const TAG_LABELS: Record<string, string> = {
  enterable: 'You can go inside',
  residential: 'House',
  retail: 'Shop',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  industrial: 'Industrial building',
  natural: 'Nature',
  transportation: 'Transport',
  infr: 'Infrastructure',
  infrastructure: 'Infrastructure',
  agriculture: 'Farm',
  leisure: 'Leisure',
  office: 'Office',
  service: 'Service',
  government: 'Government building',
  utilities: 'Utilities',
  construction: 'Building site',
  landmark: 'Landmark',
  'point-of-interest': 'Point of interest',
  recreation: 'Recreation',
  public: 'Public place',
  closed: 'Closed',
  events: 'Events place',
  '#gas': 'Petrol station',
  '#supermarket': 'Supermarket',
  '#clothes': 'Clothes shop',
  '#hair': 'Hairdresser',
  '#guns': 'Gun shop',
  '#food': 'Food',
  '#vendor': 'Street vendor',
  '#electronics': 'Electronics shop',
  '#shoes': 'Shoe shop',
  '#tattoos': 'Tattoo shop',
  '#fastfood': 'Fast food',
  '#bar': 'Bar',
  '#stripclub': 'Strip club',
  '#nightclub': 'Nightclub',
  '#modshop': 'Mod shop',
  "#pay'n'spray": "Pay 'n' Spray",
  '#drinks': 'Drinks',
  '#carwash': 'Car wash',
  '#bikeshop': 'Bike shop',
  '#liquor': 'Off-licence',
  '#pharmacy': 'Pharmacy',
  '#marina': 'Marina',
  '#police': 'Police',
  '#hospital': 'Hospital',
  '#tennis': 'Tennis',
  '#metromover': 'Metromover',
  '#metro': 'Metro',
  '#racetrack': 'Racetrack',
  '#cinema': 'Cinema',
  '#fence': 'Fenced',
  fence: 'Fenced',
  gym: 'Gym',
  fitness: 'Gym',
  workout: 'Workout spot',
  strength: 'Strength training',
  unconfirmed: 'Not confirmed',
  demolished: 'Demolished',
  cancelled: 'Cancelled',
};

/** Tags that are GTADB-internal notes, not facts about the place. */
export function isInternalTag(tag: string): boolean {
  return (
    tag.startsWith('/') ||
    /^l[1-8]$/i.test(tag) ||
    tag.includes('reused') ||
    tag === 'dexter'
  );
}

/** Status tags — what is NOT certain about the place. */
const STATUS_TAGS = new Set(['unconfirmed', 'demolished', 'cancelled']);

export function tagLabel(tag: string): string {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag]!;
  return tag.replace(/^#/, '').replace(/-/g, ' ');
}

/** Plain-English labels for a place's tags, internal notes stripped. */
export function displayTagsFor(place: Pick<Place, 'tags'>): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const tag of place.tags) {
    if (isInternalTag(tag)) continue;
    const label = tagLabel(tag);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

/** What kind of place this is, from its tags — e.g. "House · You can go inside". */
export function placeTypeLine(place: Pick<Place, 'tags'>): string {
  const labels = displayTagsFor(place).filter(
    (label) => !['Not confirmed', 'Demolished', 'Cancelled'].includes(label),
  );
  return labels.join(' · ');
}

/** Status warnings from the tags, if any. */
export function placeStatusLine(place: Pick<Place, 'tags'>): string | null {
  const statuses = place.tags
    .filter((tag) => STATUS_TAGS.has(tag) || tag === '//may-not-exist')
    .map((tag) => (tag === '//may-not-exist' ? 'May not exist' : tagLabel(tag)));
  return statuses.length > 0 ? [...new Set(statuses)].join(' · ') : null;
}

export function isEnterablePlace(place: Pick<Place, 'tags'>): boolean {
  return place.tags.includes('enterable');
}

/** Tag counts across the unnamed "?" records — the tagging audit. */
export function unnamedTagAudit(places: readonly Place[]): {
  unnamed: number;
  /** Carries a tag that says what the place is (house, shop, …). */
  withUsefulTags: number;
  /** Carries only internal notes (map-level tags, //notes) — nothing usable. */
  onlyInternalTags: number;
  /** Carries no tag at all. */
  noTags: number;
} {
  const unnamed = places.filter((place) => isUnnamedPlace(place));
  let withUsefulTags = 0;
  let onlyInternalTags = 0;
  let noTags = 0;
  for (const place of unnamed) {
    if (place.tags.length === 0) noTags++;
    else if (displayTagsFor(place).length > 0) withUsefulTags++;
    else onlyInternalTags++;
  }
  return { unnamed: unnamed.length, withUsefulTags, onlyInternalTags, noTags };
}
