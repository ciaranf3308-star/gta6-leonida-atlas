import type { Collection, Filters, Place, PlaceNote } from './types';
import { countyForPlace } from '../data/counties';
import { matchesArea } from '../features/map/isolation';
import { isEnterablePlace } from './tags';
import { venueTypeFor } from './interiors';
import { tagResolutionSearchWords } from './resolve-tags';
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
    if (
      filters.enterableOnly &&
      !isEnterablePlace(place) &&
      place.layerId !== 'interiors' &&
      // Breakable homes are enterable by definition — the Capri
      // rob-house candidates carry a residential tag, not the
      // enterable one, and must still show under "Can go inside".
      place.layerId !== 'breakable'
    )
      return false;
    if (filters.lootableOnly && place.layerId !== 'lootable') return false;
    if (
      filters.interiorHouseOnly &&
      !(place.tags.includes('residential') && isEnterablePlace(place))
    )
      return false;
    if (filters.venueType !== 'all') {
      // A venue type is a kind of INTERIOR: it only ever matches
      // enterable places. (Seeded breakable examples carry the
      // 'enterable' tag, so they match too.)
      if (!isEnterablePlace(place) || venueTypeFor(place) !== filters.venueType)
        return false;
    }
    if (filters.countyId) {
      if (!place.position) return false;
      if (countyForPlace(place) !== filters.countyId) return false;
    }
    if (filters.area) {
      if (!place.position) return false;
      if (!matchesArea(place, filters.area)) return false;
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
        // A "?" the tags resolve to a type is searchable by that type:
        // "house" finds a residential "?", "petrol" finds a #gas "?".
        ...tagResolutionSearchWords(place),
        ...aiCategorySearchWords(aiCategories?.[place.id]),
        noteIndex.get(place.id) ?? '',
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
