/** Coordinates are GTADB game units, never real-world latitude/longitude. */
import type { AiCategoryRecord } from '../features/categorise/categories';
import type { IndexJobState } from '../features/categorise/storage';

export interface Position {
  x: number;
  y: number;
}
export type Category = 'region' | 'landmark' | 'nature' | 'transport' | 'business' | 'personal';
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
   */
  kind?: 'workout' | 'breakable';
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
  collections: Collection[];
  markers: PersonalMarker[];
  visited: VisitedPlace[];
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
 * "?, Washington Beach, Vice Beach". 2,768 of the 3,754 records at GTADB
 * revision d406fea have no confirmed name (986 do); 2,732 of the 2,768 are
 * still "?" and the other 36 show a tentative name with a "?" ("Parsons
 * Hotel?"). They stay on
 * the map, in the unverified layer: no name is ever invented for them, and
 * the only way back in is a verified name from GTADB or another trusted
 * source. What a "?" record DOES often already carry is tags saying what
 * kind of place it is — see src/domain/tags.ts. A tag is halfway to a name.
 */
export function isUnnamedPlace(place: Pick<Place, 'title'>): boolean {
  const name = place.title.split(',')[0]?.trim() ?? '';
  // "?", "? (N)", "? Concert Hall", "? Flare" — the name itself is a
  // question mark. A real name with a "?" qualifier ("Parsons Hotel?",
  // "Turn ?") is a named place, just an uncertain one, and stays visible.
  return name === '' || name.startsWith('?') || name.startsWith('Unnamed ');
}

/** Places with a real name — the only ones the map, counts, search and Ask show by default. */
export function namedPlaces<T extends Pick<Place, 'title'>>(places: readonly T[]): T[] {
  return places.filter((place) => !isUnnamedPlace(place));
}
export const EMPTY_USER_DATA: UserData = {
  favorites: [],
  notes: [],
  collections: [],
  markers: [],
  visited: [],
  preferences: DEFAULT_PREFERENCES,
};
