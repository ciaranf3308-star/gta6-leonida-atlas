/**
 * View Area resolution (v0.32 step 5) — pure.
 *
 * The location card's "View Area" is the area's OWN extent via
 * resolveAreaBounds (the member bbox, an estimate), falling back to
 * the county only when the area has none — and saying so. Places
 * with no area in the database keep the old county-by-position
 * behaviour. The component applies the resolution (filters, camera,
 * isolation); this module only decides WHAT to show.
 */
import { COUNTIES } from '../../data/counties';
import { resolveAreaBounds } from '../../domain/geography';
import type { GameDatabase } from '../../domain/game-db';
import type { Place } from '../../domain/types';
import type { MapBounds } from '../map/coordinates';

export type ViewAreaResolution =
  | {
      kind: 'area';
      bounds: MapBounds;
      areaName: string;
      /** The area's full region path, for the area filter. */
      areaPath: string | null;
      placeCount: number;
      note: null;
    }
  | {
      kind: 'county';
      bounds: MapBounds;
      countyId: string;
      /** Why the county, not the area — null on the legacy
       * county-by-position path, where there is no area at all. */
      note: string | null;
    }
  | { kind: 'none'; note: string };

export function resolveViewArea(
  db: GameDatabase | null,
  place: Pick<Place, 'id' | 'title' | 'position'>,
): ViewAreaResolution {
  const location = db?.locations.get(place.id);
  const areaId = location?.areaId ?? null;
  if (db && areaId) {
    const node = db.areas.get(areaId);
    const resolved = resolveAreaBounds(db.areas, areaId);
    if (!resolved.bounds) return { kind: 'none', note: resolved.reason };
    if (resolved.fallback === 'county' && resolved.countyId) {
      const county = COUNTIES.find((c) => c.id === resolved.countyId);
      if (!county) return { kind: 'none', note: resolved.reason };
      return {
        kind: 'county',
        bounds: { ...county.bounds },
        countyId: county.id,
        note: resolved.reason,
      };
    }
    return {
      kind: 'area',
      bounds: resolved.bounds,
      areaName: node?.name ?? place.title,
      areaPath: node?.path ?? null,
      placeCount: node?.locationIds.length ?? 0,
      note: null,
    };
  }
  const county =
    COUNTIES.find(
      (c) => c.area.includes(place.title) || c.name.includes(place.title),
    ) ??
    COUNTIES.find(
      (c) =>
        place.position &&
        place.position.x >= c.bounds.west &&
        place.position.x <= c.bounds.east &&
        place.position.y >= c.bounds.south &&
        place.position.y <= c.bounds.north,
    );
  if (!county) {
    return { kind: 'none', note: 'No area or county found for this place.' };
  }
  return {
    kind: 'county',
    bounds: { ...county.bounds },
    countyId: county.id,
    note: null,
  };
}
