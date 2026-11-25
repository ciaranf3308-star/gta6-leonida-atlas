import type { Place } from '../../domain/types';

/**
 * First-open region sheet (v0.26.0): the map opens blank on purpose,
 * so the first thing a new player sees is not a "nothing showing"
 * banner but the Vice City region sheet — the reference composition
 * (photo crop, county, description, Set Route / View Area / Add to
 * List) with a "Pick what to see" row inside it. The place is the
 * real region record from the catalogue (id region:vice-city), never
 * invented — if the catalogue ever stops carrying it, there is no
 * first-open sheet and the map opens clean instead.
 */
export function firstOpenPlace(allPlaces: readonly Place[]): Place | undefined {
  return allPlaces.find((place) => place.id === 'region:vice-city');
}
