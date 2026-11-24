import type { Place } from "../../domain/types";
import { COUNTIES, type County } from "../../data/counties";
import type { MapBounds } from "./coordinates";

/**
 * Area isolation (v0.14.0) — the county picker from the v2 brief,
 * finally working ON THE MAP, not just in the list.
 *
 * The user (2026-11-24): selecting a county or a town/city/area
 * filtered the list but the rest of the map stayed lit and cluttered.
 * Isolation means: zoom to that area, dim/mask everything outside it,
 * show only that area's places, name the area on the map, and offer
 * one big "Show all of Leonida" exit. The mask is a Leaflet polygon:
 * the whole basemap rect with the isolated bounds cut out as a hole.
 *
 * A county isolates by its estimated COUNTIES bounds. A town/city/area
 * isolates by the bounding box of its own places in the catalogue —
 * the area's real extent as mapped, padded so its edge pins are not
 * on the line. An "area" is a region name (e.g. Capri, Port Gellhorn),
 * or a city parent: every region ending ", Vice City" belongs to the
 * Vice City area, so isolating Vice City shows all its neighbourhoods,
 * not just the 60 places whose region is exactly "Vice City".
 */

export interface Isolation {
  /** "Capri", "Vice-Dale County", "Vice City" — shown on the map. */
  label: string;
  /** "North · Mount Kalaga", or "196 places" — the map title's second line. */
  subtitle: string;
  bounds: MapBounds;
  /** County id when this is a county isolation — the map then draws the
   * traced coastline from after-hours-geo.json instead of the rect.
   * Undefined for towns/areas, which keep the rect outline. */
  countyId?: string;
}

function pad(bounds: MapBounds, fraction = 0.12): MapBounds {
  const padX = Math.max((bounds.east - bounds.west) * fraction, 200);
  const padY = Math.max((bounds.north - bounds.south) * fraction, 200);
  return {
    west: bounds.west - padX,
    east: bounds.east + padX,
    south: bounds.south - padY,
    north: bounds.north + padY,
  };
}

/** The bounding box of a set of positioned places, padded. Null when
 * nothing in the set has a position. */
export function boundsForPlaces(places: readonly Place[]): MapBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const place of places) {
    if (!place.position) continue;
    west = Math.min(west, place.position.x);
    east = Math.max(east, place.position.x);
    south = Math.min(south, place.position.y);
    north = Math.max(north, place.position.y);
  }
  if (!Number.isFinite(west)) return null;
  return pad({ west, east, south, north });
}

/** Does this place belong to the named area? Exact region, or a
 * neighbourhood of it ("Downtown, Vice City" belongs to Vice City). */
export function matchesArea(place: Place, area: string): boolean {
  if (!place.region) return false;
  return place.region === area || place.region.endsWith(`, ${area}`);
}

/** Isolation for one county, from its estimated bounds. */
export function countyIsolation(county: County): Isolation {
  return {
    label: county.name,
    subtitle: county.area,
    bounds: county.bounds,
    countyId: county.id,
  };
}

/** Isolation for one town/city/area, from its own places. Null when
 * the area has no positioned places to draw a box around. */
export function areaIsolation(
  area: string,
  places: readonly Place[],
): Isolation | null {
  const inArea = places.filter((place) => matchesArea(place, area));
  const bounds = boundsForPlaces(inArea);
  if (!bounds) return null;
  return {
    label: area,
    subtitle: `${inArea.length.toLocaleString()} places`,
    bounds,
  };
}

export interface AreaOption {
  /** Region name, or a city parent such as "Vice City". */
  name: string;
  /** Positioned places in the area. */
  count: number;
}

/**
 * The areas worth isolating, by how many places they hold: exact
 * regions with at least 50 places, plus city parents (the part after
 * the last ", " of a region) with at least 150 places across their
 * neighbourhoods — so Vice City shows as one city, not as a dozen
 * neighbourhoods. Biggest first, capped at 15 so the picker stays a
 * picker, not a list.
 */
export function areaOptions(places: readonly Place[]): AreaOption[] {
  const exact = new Map<string, number>();
  const parents = new Map<string, number>();
  for (const place of places) {
    if (!place.position || !place.region) continue;
    exact.set(place.region, (exact.get(place.region) ?? 0) + 1);
    const comma = place.region.lastIndexOf(", ");
    if (comma >= 0) {
      const parent = place.region.slice(comma + 2);
      parents.set(parent, (parents.get(parent) ?? 0) + 1);
    }
  }
  const options = new Map<string, number>();
  for (const [name, count] of exact) {
    if (count >= 50) options.set(name, count);
  }
  // A city parent counts its neighbourhoods too — "Vice City" is all
  // of its ", Vice City" regions plus the 60 places named exactly
  // that, so the parent total wins over the exact count.
  for (const [name, count] of parents) {
    if (count >= 150) {
      options.set(name, (options.get(name) ?? 0) + count);
    }
  }
  return [...options.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export { COUNTIES };
