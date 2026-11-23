/** Coordinates are GTADB game units, never real-world latitude/longitude. */
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
   */
  kind?: 'workout';
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
export interface Backup extends UserData {
  format: 'leonida-atlas';
  version: 2;
  exportedAt: string;
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
  /** Hide places already marked as found. */
  hideFound: boolean;
  /** Show only places not yet marked as found (the 99% case). Implies hideFound. */
  remainingOnly: boolean;
}
export const DEFAULT_PREFERENCES: Preferences = {
  reducedMotion: false,
  showLabels: true,
  clusterMarkers: true,
};

/**
 * An unnamed GTADB record: its in-game address starts with "?" — e.g.
 * "?, Washington Beach, Vice Beach". 2,732 of the 3,754 records at GTADB
 * revision d406fea are unnamed (only 1,022 have a real name). They stay on
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
