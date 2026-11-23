import type { Collection, Filters, Place, PlaceNote } from './types';
import { countyForPlace } from '../data/counties';
import {
  aiCategorySearchWords,
  type AiCategoryRecord,
} from '../features/categorise/categories';

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** All filters intersect. Unpositioned entries remain searchable. */
export function filterPlaces(
  places: Place[],
  filters: Filters,
  favoriteIds: string[],
  notes: PlaceNote[],
  collections: Collection[],
  visitedIds: string[] = [],
  /**
   * AI-suggested types (on-device only). A search for "gym" finds a "?"
   * the AI suggested is a gym; "house" finds an AI-suggested house.
   * Low-confidence / "not sure" records never match.
   */
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>,
): Place[] {
  const favorites = new Set(favoriteIds);
  const visited = new Set(visitedIds);
  const members = filters.collectionId
    ? new Set(collections.find((c) => c.id === filters.collectionId)?.placeIds ?? [])
    : null;
  const noteIndex = new Map(notes.map((n) => [n.placeId, n.text]));
  const terms = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  const hideFound = filters.hideFound || filters.remainingOnly;
  return places.filter((place) => {
    if (hideFound && visited.has(place.id)) return false;
    if (filters.countyId) {
      if (!place.position) return false;
      if (countyForPlace(place) !== filters.countyId) return false;
    }
    if (filters.category !== 'all' && filters.category !== place.category) return false;
    if (filters.favoritesOnly && !favorites.has(place.id)) return false;
    if (filters.personalOnly && place.evidence !== 'personal') return false;
    if (filters.evidence !== 'all' && filters.evidence !== place.evidence) return false;
    if (members && !members.has(place.id)) return false;
    if (!terms.length) return true;
    const haystack = normalizeSearch(
      [
        place.title,
        place.category,
        place.region,
        place.description,
        ...place.tags,
        ...aiCategorySearchWords(aiCategories?.[place.id]),
        noteIndex.get(place.id) ?? '',
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
