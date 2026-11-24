import type { Position } from './types';

/**
 * Distance in map units — the only honest unit the map has. The Leonida
 * map is ~12,000 units wide and the Vice City gyms sit ~2,800 units apart,
 * so raw numbers mean nothing to a player: the Find list shows words
 * ("Close by", "Nearby", "A long way away") and sorts nearest-first, and
 * never converts units into metres — there is no verified scale to do so.
 * Thresholds match Ask Nylah's proximity rule (see ask/retrieval.ts):
 * 2,000 units is a same-neighbourhood radius.
 */

export const CLOSE_DISTANCE_UNITS = 2000;
export const NEARBY_DISTANCE_UNITS = 4000;

export function distanceBetween(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Plain-words distance from the map centre, or null when unpositioned. */
export function distanceWord(units: number | null): string | null {
  if (units === null) return null;
  if (units < CLOSE_DISTANCE_UNITS) return 'Close by';
  if (units < NEARBY_DISTANCE_UNITS) return 'Nearby';
  return 'A long way away';
}
