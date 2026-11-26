import type { Place } from "../../domain/types";
import { COUNTIES, type County } from "../../data/counties";
import { parseRegionPath } from "../../domain/geography";
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
  /** §6.1: no boundary lines are drawn anywhere. An area extent is a
   * camera focus + a dim mask, never a stroked outline — drawing the
   * bbox edge would invent a boundary. Set for area isolations;
   * counties keep their traced coastline (real geography, not a
   * boundary line). */
  noOutline?: boolean;
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
 * the area has no positioned places to draw a box around. The box is
 * a camera focus + dim mask only — noOutline: the extent is an
 * estimate, and a stroked edge would read as an invented boundary
 * (§6.1). */
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
    noOutline: true,
  };
}

export interface AreaOption {
  /** Region name, or a city parent such as "Vice City". */
  name: string;
  /** Positioned places in the area. */
  count: number;
}

/**
 * The areas worth isolating — EVERY named area, no restrictions
 * (§6.5, step 4: the 50 / 150 / top-15 restrictions are removed
 * entirely). Every parsed region path is independently selectable,
 * regardless of how many POIs it contains — including areas with a
 * single place, and areas whose places are all unpositioned
 * (selecting one shows its member list, not a camera move). The
 * count is the subtree total: a place counts for its own path and
 * for every ancestor ("Downtown, Vice City" counts for Downtown
 * and for Vice City), so a city's count is the whole city, not
 * just the places named exactly that. Biggest first.
 */
export function areaOptions(places: readonly Place[]): AreaOption[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    if (!place.region) continue;
    const path = parseRegionPath(place.region);
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(i).join(', ');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export { COUNTIES };
