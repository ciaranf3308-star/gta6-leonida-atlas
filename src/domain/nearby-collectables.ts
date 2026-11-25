import type { Place } from './types';

/**
 * "Hidden collectables" for the place card — ONLY verified pins.
 * Today that means the 5 trading-card pins with a verified host
 * building (Starlet Motel, Gellhorn Drive-In, Dynamix Fitness). The
 * other 475 cards have no verified position in any source checked and
 * are never placed by guess — so a place with no verified card nearby
 * honestly says "None verified here". WAiNK, flamingos and the rest
 * have no verified pins at all yet, so they never appear here until a
 * guide pins one.
 *
 * "Near" is 600 game units — the same building or the same block.
 * The pin is the host building, not the shelf: the card's own
 * description says the exact spot inside.
 */

export const NEAR_COLLECTABLE_UNITS = 600;

export interface NearbyCollectable {
  place: Place;
  distanceUnits: number;
}

export function collectablesNear(
  place: Place,
  allPlaces: readonly Place[],
  radiusUnits = NEAR_COLLECTABLE_UNITS,
): NearbyCollectable[] {
  if (!place.position) return [];
  const found: NearbyCollectable[] = [];
  for (const candidate of allPlaces) {
    if (!candidate.position || candidate.id === place.id) continue;
    if (!candidate.layerId.startsWith('cards:')) continue;
    const distanceUnits = Math.hypot(
      candidate.position.x - place.position.x,
      candidate.position.y - place.position.y,
    );
    if (distanceUnits <= radiusUnits) found.push({ place: candidate, distanceUnits });
  }
  return found.sort((a, b) => a.distanceUnits - b.distanceUnits);
}
