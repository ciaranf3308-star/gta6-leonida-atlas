import type { Place, Position } from '../domain/types';
import type { MapBounds } from '../features/map/coordinates';

/**
 * Leonida's five counties. Extents are ESTIMATES, derived from the GTADB
 * records whose in-game address names the county (355 records at GTADB
 * revision d406fea): each rect is the bounding box of that county's named,
 * positioned records. The official poster prints county names but no
 * boundary lines, and GTADB notes its boundary lines remain disabled while
 * reviewed — so no rect here is an official border. A place is assigned to
 * the county its address names when it names one; otherwise to the rect it
 * falls in, nearest rect centre breaking overlaps.
 */
export interface County {
  id: string;
  name: string;
  area: string;
  bounds: MapBounds;
  /** Stunt jumps in this county (gta6-leonida-map-data counties CSV,
   * CC BY 4.0). Total across Leonida: 130. */
  stuntJumps: number;
  /** Art-directed regional photograph (After Hours), relative to the
   * app base. Null while a county has no photograph yet — the card
   * falls back to a slate surface, never to a stock image. */
  photo: string | null;
}

export const COUNTIES: County[] = [
  {
    id: 'lummox',
    name: 'Lummox County',
    stuntJumps: 19,
    area: 'North · Mount Kalaga',
    photo: 'assets/after-hours/county-lummox.jpg',
    bounds: { west: -8279, east: -100, south: 5205, north: 8929 },
  },
  {
    id: 'kelly',
    name: 'Kelly County',
    stuntJumps: 29,
    area: 'West · Port Gellhorn, Hamlet',
    photo: 'assets/after-hours/county-kelly.jpg',
    bounds: { west: -9382, east: -3023, south: 596, north: 5626 },
  },
  {
    id: 'leonard',
    name: 'Leonard County',
    stuntJumps: 13,
    area: 'Centre-east · Ambrosia',
    photo: 'assets/after-hours/county-leonard.jpg',
    bounds: { west: -2690, east: 1240, south: 1039, north: 6173 },
  },
  {
    id: 'vice-dale',
    name: 'Vice-Dale County',
    stuntJumps: 53,
    area: 'South-east · Vice City',
    photo: 'assets/after-hours/county-vice-dale.jpg',
    bounds: { west: -3779, east: 2559, south: -2650, north: 3235 },
  },
  {
    id: 'mariana',
    name: 'Mariana County',
    stuntJumps: 16,
    area: 'South · Leonida Keys',
    photo: 'assets/after-hours/county-mariana.jpg',
    bounds: { west: -8336, east: 85, south: -7928, north: 187 },
  },
];

export const COUNTY_EXTENT_NOTE =
  'County extents are estimates from GTADB records that name the county; no official boundary lines are published.';

const COUNTY_NAME_PATTERN = /(Lummox|Kelly|Leonard|Vice-Dale|Mariana)\s+County/i;
const COUNTY_ID_BY_NAME: Record<string, string> = {
  lummox: 'lummox',
  kelly: 'kelly',
  leonard: 'leonard',
  'vice-dale': 'vice-dale',
  mariana: 'mariana',
};

export function countyIdFromText(text: string | undefined | null): string | null {
  if (!text) return null;
  const match = COUNTY_NAME_PATTERN.exec(text);
  if (!match) return null;
  return COUNTY_ID_BY_NAME[match[1]!.toLowerCase()] ?? null;
}

function rectContains(bounds: MapBounds, position: Position): boolean {
  return (
    position.x >= bounds.west &&
    position.x <= bounds.east &&
    position.y >= bounds.south &&
    position.y <= bounds.north
  );
}

/** The county whose estimated extent contains a map position, if any. */
export function countyIdForPosition(position: Position): string | null {
  const matches = COUNTIES.filter((county) => rectContains(county.bounds, position));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!.id;
  let best = matches[0]!;
  let bestDistance = rectCentreDistanceSquared(best.bounds, position);
  for (const county of matches.slice(1)) {
    const distance = rectCentreDistanceSquared(county.bounds, position);
    if (distance < bestDistance) {
      best = county;
      bestDistance = distance;
    }
  }
  return best.id;
}

function rectCentreDistanceSquared(bounds: MapBounds, position: Position): number {
  const cx = (bounds.west + bounds.east) / 2;
  const cy = (bounds.south + bounds.north) / 2;
  return (position.x - cx) ** 2 + (position.y - cy) ** 2;
}

/** The county a place belongs to, or null when it cannot be placed in one. */
export function countyForPlace(
  place: Pick<Place, 'position' | 'region' | 'title'>,
): string | null {
  const named = countyIdFromText(place.region) ?? countyIdFromText(place.title);
  if (named) return named;
  if (!place.position) return null;
  const matches = COUNTIES.filter((county) => rectContains(county.bounds, place.position!));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!.id;
  let best = matches[0]!;
  let bestDistance = rectCentreDistanceSquared(best.bounds, place.position);
  for (const county of matches.slice(1)) {
    const distance = rectCentreDistanceSquared(county.bounds, place.position);
    if (distance < bestDistance) {
      best = county;
      bestDistance = distance;
    }
  }
  return best.id;
}
