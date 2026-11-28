/** Coordinates are GTADB game units, never real-world latitude/longitude. */
import type { AiCategoryRecord } from '../features/categorise/categories';
import type { IndexJobState } from '../features/categorise/storage';

export type Position = {
  x: number;
  y: number;
};
/**
 * The game's own Map Index categories (pause map → D-pad Right → Map
 * Index), plus the three groups the game files elsewhere: Collectibles
 * (in-game: Progress > Collections), My markers (the user's own notes —
 * NEVER called "Personal": in the game, Personal means your vehicles,
 * safehouse/residence, owned garages and ATMs) and Unverified (places
 * with no confirmed name or use yet — never forced into a category).
 *
 * There is NO "Business" category in the game: shops are split across
 * Weapons, Style, Food & Drink, Vehicles and Robberies. The old
 * region/landmark/nature/transport/business/personal set was a GTADB
 * data-model label, not a GTA one — that mismatch is what v0.21.0
 * removes. 'personal' here means ONLY the game's Personal; no verified
 * Personal places exist in the public data yet, so it honestly counts 0.
 * 'story' (missions) is likewise unmapped so far — also 0, also stated.
 */
export type MapIndexCategory =
  | 'personal'
  | 'story'
  | 'robberies'
  | 'activities'
  | 'exploration'
  | 'vehicles'
  | 'weapons'
  | 'style'
  | 'food-drink';
export type Category =
  | MapIndexCategory
  | 'collectibles'
  | 'my-markers'
  | 'unverified';

export const MAP_INDEX_CATEGORIES: readonly MapIndexCategory[] = [
  'personal',
  'story',
  'robberies',
  'activities',
  'exploration',
  'vehicles',
  'weapons',
  'style',
  'food-drink',
];

export const ALL_CATEGORIES: readonly Category[] = [
  ...MAP_INDEX_CATEGORIES,
  'collectibles',
  'my-markers',
  'unverified',
];

/**
 * Pre-v0.21.0 categories, for backups and saved views written before
 * the rebuild. Only genuinely dead values migrate: region / landmark /
 * nature / business had no shop-type info attached, so they fall back
 * to Exploration (a point of interest) rather than being guessed into
 * Weapons / Style / Food & Drink; transport becomes Vehicles. A value
 * that is still a live category — including 'personal', which is now
 * the game's own Personal — passes through unchanged. The one
 * exception is a MARKER's 'personal': a user marker is never the
 * game's Personal, so parsePersonalMarker maps that one to
 * 'my-markers' itself instead of using this function.
 */
export function migrateLegacyCategory(value: unknown): Category | 'all' {
  if (typeof value !== 'string') return 'all';
  if ((ALL_CATEGORIES as readonly string[]).includes(value)) return value as Category;
  switch (value) {
    case 'region':
    case 'landmark':
    case 'nature':
    case 'business':
      return 'exploration';
    case 'transport':
      return 'vehicles';
    default:
      return 'all';
  }
}
export interface Place {
  id: string;
  title: string;
  description: string;
  category: Category;
  position: Position | null;
  layerId: string;
  tags: string[];
  region: string;
  source: { title: string; url: string; license?: string };
  evidence: 'approximate' | 'uncertain' | 'personal';
}
export interface PersonalMarker {
  id: string;
  title: string;
  description: string;
  category: Category;
  position: Position;
  icon: 'pin' | 'star' | 'flag';
  /**
   * "workout" = a house gym / workout spot the user marked (e.g. gym gear
   * inside a house in Capri). Ask Nylah treats these as workout answers;
   * the public map data has no house gyms at all, so the user's own marks
   * are the only way they get on the map.
   * "breakable" = a house / apartment / trailer the user found he can
   * break into. Ask Nylah treats these as breakable-home answers; most
   * breakable homes have no tag in the public data at all, so the user's
   * own marks are the only way they get on the map.
   * "vehicle-loot" = a safe / garage / bunker the user found holding a
   * vehicle or a safe code (Demo C jot path): a gang-op site the guides
   * have not published, a safe code from the aggregator lists, a
   * standout vehicle in a garage. The jot is the data acquisition for
   * vehicle loot — most such spots have no published position at all.
   * The marker's description carries what is inside (and the code);
   * the looted record's note carries the code actually used.
   */
  kind?: 'workout' | 'breakable' | 'vehicle-loot';
  /** Optional marker colour (hex from the editor palette). Defaults to the layer colour. */
  color?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Favorite {
  placeId: string;
  createdAt: string;
}
/** A place the user has marked as found/visited. Local only, like favorites. */
export interface VisitedPlace {
  placeId: string;
  visitedAt: string;
}
export interface PlaceNote {
  placeId: string;
  text: string;
  updatedAt: string;
}
/**
 * The user's own secondary tags on a place ("sells t-shirts" on a gas
 * station, "workout equipment" on a house in Capri). They are the
 * user's labels, never verified data: they never change the place's
 * real Map Index category, they sit alongside it, and they are always
 * shown as "Your tag". One row per place, like notes.
 */
export interface PlaceTags {
  placeId: string;
  tags: string[];
  updatedAt: string;
}
/** A place the user has marked as explored — been there and checked it
 * out. Separate from found (visited): found is "got the thing / did
 * the thing", explored is "been here". Explored places fade on the map. */
export interface ExploredPlace {
  placeId: string;
  exploredAt: string;
}
export interface Collection {
  id: string;
  name: string;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface Preferences {
  reducedMotion: boolean;
  showLabels: boolean;
  clusterMarkers: boolean;
}
export interface UserData {
  favorites: Favorite[];
  notes: PlaceNote[];
  placeTags: PlaceTags[];
  collections: Collection[];
  markers: PersonalMarker[];
  visited: VisitedPlace[];
  explored: ExploredPlace[];
  preferences: Preferences;
}
/**
 * The AI index, carried in the same backup file as everything else
 * (v3). Categories and job state live in localStorage on the phone;
 * without this, a phone wipe, browser-data clear, PWA uninstall or
 * new phone would lose hours of indexing. The OpenAI key is NEVER in
 * a backup — it stays on the device it was typed on.
 */
export interface Backup extends UserData {
  format: 'leonida-atlas';
  version: 3;
  exportedAt: string;
  aiCategories: AiCategoryRecord[];
  aiIndexJob: IndexJobState;
}
export interface LayerDefinition {
  id: string;
  name: string;
  description?: string;
  category: string;
  /**
   * The game's Map Index group this layer belongs to (v0.21.0) — the
   * Layers list is grouped by it, in the game's own order. A layer that
   * spans categories (Interiors: venues of every kind) sits in
   * Exploration, with the split visible in Find instead.
   */
  mapIndex: Category;
  visible: boolean;
  order: number;
  source: string;
  minZoom?: number;
  maxZoom?: number;
  style: { color: string; radius: number };
  icon?: string;
  interactive: boolean;
  metadata?: Record<string, string>;
}
export interface Filters {
  query: string;
  category: Category | 'all';
  favoritesOnly: boolean;
  personalOnly: boolean;
  evidence: 'all' | 'approximate' | 'uncertain';
  collectionId: string | null;
  /** Isolate one county (estimated extents, see src/data/counties.ts). */
  countyId: string | null;
  /** Isolate one town/city/area by region name ("Capri", "Vice City") —
   * a region, or a neighbourhood of it ("Downtown, Vice City" is Vice
   * City). Cleared when a county is chosen, and vice versa. */
  area: string | null;
  /** Hide places already marked as found. */
  hideFound: boolean;
  /** Show only places not yet marked as found (the 99% case). Implies hideFound. */
  remainingOnly: boolean;
  /** Show only places you can go inside (tag `enterable`, or the Interiors layer). */
  enterableOnly: boolean;
  /** Show only lootable buildings (the Lootable layer). */
  lootableOnly: boolean;
  /**
   * Show only enterable houses — residential + enterable ("Interior
   * house"). The 33 places GTADB tags that way, none of them in Capri;
   * Capri rob houses live in the Breakable homes layer instead.
   */
  interiorHouseOnly: boolean;
  /**
   * Narrow enterable places by venue type (house / apartment / trailer /
   * shop / bar / other). 'all' means no venue narrowing.
   */
  venueType: 'all' | 'house' | 'apartment' | 'trailer' | 'shop' | 'bar' | 'gym' | 'other';
  /** In the Find list, nearest to the map centre first. */
  sortNearest: boolean;
}
export const DEFAULT_PREFERENCES: Preferences = {
  reducedMotion: false,
  showLabels: true,
  clusterMarkers: true,
};

/**
 * An unnamed GTADB record: its in-game address starts with "?" — e.g.
 * "?, Washington Beach, Vice Beach". 3,316 of the 4,380 records at GTADB
 * revision 2e9e194 have no confirmed name (1,064 do); 3,280 of the 3,316 are
 * still "?" and the other 36 show a tentative name with a "?" ("Parsons
 * Hotel?"). They draw NO map pin until typed (§A9.3 / v0.33 D-1 — see
 * isPlacePinnable): the AI index job stores a type for them, or a player
 * correction/jot names them. A typed record pins with its type glyph; an
 * untyped one renders as nothing on the map — it stays searchable in
 * Find and listed in the index job's queue, and no name is ever invented
 * for it. What a "?" record DOES often already carry is tags saying what
 * kind of place it is — see src/domain/tags.ts. A tag is halfway to a name.
 */
export function isUnnamedPlace(place: Pick<Place, 'title'>): boolean {
  const name = place.title.split(',')[0]?.trim() ?? '';
  // "?", "? (N)", "? Concert Hall", "? Flare" — the name itself is a
  // question mark. A real name with a "?" qualifier ("Parsons Hotel?",
  // "Turn ?") is a named place, just an uncertain one, and stays visible.
  return name === '' || name.startsWith('?') || name.startsWith('Unnamed ');
}

/**
 * The headline a "?" place shows where a title is the headline (the
 * place sheet, the marker tooltip): the in-game address minus its "?"
 * name — "?, Washington Beach, Vice Beach" becomes "Washington Beach,
 * Vice Beach". The "?" is never the headline: the sheet's own "What we
 * know" section already says the name is unknown, and the area is the
 * useful part. A bare "?" with no address falls back to the area, then
 * to "Unnamed place". Named places keep their title untouched.
 */
export function displayTitleFor(place: Pick<Place, 'title' | 'region'>): string {
  if (!isUnnamedPlace(place)) return place.title;
  const rest = place.title.split(',').slice(1).join(',').trim();
  if (rest) return rest;
  if (place.region) return `Unnamed place in ${place.region}`;
  return 'Unnamed place';
}

/** Places with a real name — the only ones the map, counts, search and Ask show by default. */
export function namedPlaces<T extends Pick<Place, 'title'>>(places: readonly T[]): T[] {
  return places.filter((place) => !isUnnamedPlace(place));
}
export const EMPTY_USER_DATA: UserData = {
  favorites: [],
  notes: [],
  placeTags: [],
  collections: [],
  markers: [],
  visited: [],
  explored: [],
  preferences: DEFAULT_PREFERENCES,
};
