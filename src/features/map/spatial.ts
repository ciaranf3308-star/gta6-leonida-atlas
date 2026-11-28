import type { Place, Position } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { BASEMAP_BOUNDS, containsPosition, isValidPosition, type MapBounds } from './coordinates';

type PositionedPlace = Place & { position: Position };
export interface SpatialIndex {
  cellSize: number;
  cells: Map<string, PositionedPlace[]>;
}
export interface PlaceCluster {
  id: string;
  position: Position;
  places: PositionedPlace[];
}
export interface ClusterOptions {
  zoom: number;
  enabled: boolean;
  selectedId?: string | null;
  maxMarkers?: number;
}

/**
 * Hero pins (v0.16.0): at full-map zoom the reference shows about a
 * dozen small icon pins, never a wall of numbered circles. When the
 * user is zoomed all the way out, only the most useful places draw:
 * named regions first, then named places spread one per grid cell so
 * they cover the map instead of bunching in Vice City. Everything else
 * waits for a zoom-in — the data is still there, it just does not pay
 * a DOM node until the player is close enough to read it.
 */
export function selectHeroPlaces(
  places: readonly Place[],
  maxHero = 24,
): PositionedPlace[] {
  const positioned = places.filter((place): place is PositionedPlace =>
    isValidPosition(place.position),
  );
  const named = (place: PositionedPlace) =>
    // §A9.3 / v0.33 D-1: unnamed is isUnnamedPlace, not `title !== '?'`
    // — the old check let "?, Downtown, Vice City" through as a hero
    // pin (its title is not exactly "?"). A typed "?" is still
    // unnamed, so it never draws as a hero pin either; it pins at
    // closer zooms once the index job has typed it (pin-visibility).
    !isUnnamedPlace(place) &&
    // v0.31.1: the Loot Map places are named guide positions, only
    // their verification is pending — unlike the unnamed "?" places
    // they belong on the island overview. Tentative GTADB names
    // ("Name?") stay out: their names are not confirmed.
    (place.evidence !== 'uncertain' ||
      place.layerId === 'loot-heists' ||
      place.layerId === 'loot-collectibles');
  const regions = positioned.filter((place) => place.layerId === 'regions').slice(0, 12);
  const picked: PositionedPlace[] = [...regions];
  const pickedIds = new Set(picked.map((place) => place.id));
  const priority = (place: PositionedPlace) =>
    place.layerId === 'lootable'
      ? 0
      : place.layerId === 'interiors'
        ? 1
        : place.layerId.startsWith('shops-')
          ? 2
          : 3;
  const cell = 2200;
  const usedCells = new Set<string>();
  for (const place of regions) {
    usedCells.add(
      `${Math.floor(place.position.x / cell)}:${Math.floor(place.position.y / cell)}`,
    );
  }
  const candidates = positioned
    .filter((place) => !pickedIds.has(place.id) && named(place))
    .sort((a, b) => priority(a) - priority(b));
  for (const place of candidates) {
    if (picked.length >= maxHero) break;
    const key = `${Math.floor(place.position.x / cell)}:${Math.floor(place.position.y / cell)}`;
    if (usedCells.has(key)) continue;
    usedCells.add(key);
    picked.push(place);
  }
  return picked;
}

export function buildSpatialIndex(places: readonly Place[], cellSize = 512): SpatialIndex {
  if (!Number.isFinite(cellSize) || cellSize <= 0)
    throw new Error('Spatial cell size must be positive.');
  const cells = new Map<string, PositionedPlace[]>();
  for (const place of places) {
    if (!isValidPosition(place.position)) continue;
    const key = `${Math.floor(place.position.x / cellSize)}:${Math.floor(place.position.y / cellSize)}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(place as PositionedPlace);
    cells.set(key, bucket);
  }
  return { cellSize, cells };
}

/** Cell lookup avoids scanning the full catalogue for each settled map movement. */
export function querySpatialIndex(index: SpatialIndex, bounds: MapBounds): PositionedPlace[] {
  if (![bounds.west, bounds.east, bounds.south, bounds.north].every(Number.isFinite)) return [];
  const west = Math.max(bounds.west, BASEMAP_BOUNDS.west);
  const east = Math.min(bounds.east, BASEMAP_BOUNDS.east);
  const south = Math.max(bounds.south, BASEMAP_BOUNDS.south);
  const north = Math.min(bounds.north, BASEMAP_BOUNDS.north);
  if (west > east || south > north) return [];
  const result: PositionedPlace[] = [];
  for (
    let column = Math.floor(west / index.cellSize);
    column <= Math.floor(east / index.cellSize);
    column++
  ) {
    for (
      let row = Math.floor(south / index.cellSize);
      row <= Math.floor(north / index.cellSize);
      row++
    ) {
      for (const place of index.cells.get(`${column}:${row}`) ?? []) {
        if (containsPosition(bounds, place.position)) result.push(place);
      }
    }
  }
  return result;
}

/** Screen-sized cells create stable groups. At extreme density grouping is a mandatory DOM budget. */
export function clusterPlaces(places: readonly Place[], options: ClusterOptions): PlaceCluster[] {
  const positioned = places.filter((place): place is PositionedPlace =>
    isValidPosition(place.position),
  );
  // v0.16.0: never render thousands of DOM pins — that was the real
  // lag on his phone. 120 markers max at any zoom; hero mode below
  // takes over entirely at full-map zoom.
  const maxMarkers = Math.max(32, options.maxMarkers ?? 120);
  if (!options.enabled && positioned.length <= maxMarkers) {
    return positioned.map((place) => ({ id: place.id, position: place.position, places: [place] }));
  }
  let cellSize = 60 / Math.pow(2, Number.isFinite(options.zoom) ? options.zoom : 0);
  // Keep the small reference-region set legible while reserving a bounded part of the DOM budget.
  const referenceIds = new Set(
    positioned
      .filter((place) => place.layerId === 'regions')
      .slice(0, 12)
      .map((place) => place.id),
  );
  // The selected place and the regional labels are never absorbed into
  // a cluster — they stay independently focusable. Everything else
  // may merge (see mergeCloseClusters).
  const protectedMemberIds = new Set<string>(referenceIds);
  if (options.selectedId) protectedMemberIds.add(options.selectedId);
  let groups: PlaceCluster[] = [];
  // Doubling cell size converges to at most four spatial quadrants plus the selected place.
  for (let pass = 0; pass < 32; pass++) {
    const buckets = new Map<string, PositionedPlace[]>();
    for (const place of positioned) {
      const key =
        place.id === options.selectedId || referenceIds.has(place.id)
          ? `reference:${place.id}`
          : `grid:${cellSize}:${Math.floor(place.position.x / cellSize)}:${Math.floor(place.position.y / cellSize)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(place);
      buckets.set(key, bucket);
    }
    groups = [...buckets].map(([id, members]) => ({
      id: members.length === 1 ? members[0]!.id : id,
      position: members.reduce(
        (sum, place) => ({
          x: sum.x + place.position.x / members.length,
          y: sum.y + place.position.y / members.length,
        }),
        { x: 0, y: 0 },
      ),
      places: members,
    }));
    if (groups.length <= maxMarkers) return mergeCloseClusters(groups, options, protectedMemberIds);
    cellSize *= 2;
  }
  return mergeCloseClusters(groups, options, protectedMemberIds);
}

/**
 * Neighbouring grid buckets can still sit almost on top of each other
 * when their centroids land near a shared cell edge, so their circles
 * overlap on screen — the one thing the reference screens never do.
 * Merge any two clusters closer than a cluster's own diameter
 * (48 screen px, a 40px circle plus breathing room), repeating until
 * every pair is separated or the pass budget runs out. Merging never
 * drops a place: the merged cluster carries both member lists.
 */
function mergeCloseClusters(
  groups: PlaceCluster[],
  options: ClusterOptions,
  protectedMemberIds: ReadonlySet<string>,
): PlaceCluster[] {
  const zoom = Number.isFinite(options.zoom) ? options.zoom : 0;
  const minSeparation = 48 / Math.pow(2, zoom);
  const merged = [...groups];
  for (let pass = 0; pass < 8; pass++) {
    let didMerge = false;
    for (let i = 0; i < merged.length && !didMerge; i++) {
      const a = merged[i]!;
      // A group holding the selected place or a regional label is
      // never absorbed — its id is the plain place id for a single,
      // so the check is on its members, not the bucket id.
      if (a.places.some((place) => protectedMemberIds.has(place.id))) continue;
      for (let j = i + 1; j < merged.length; j++) {
        const b = merged[j]!;
        if (b.places.some((place) => protectedMemberIds.has(place.id))) continue;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        if (dx * dx + dy * dy < minSeparation * minSeparation) {
          const members = [...a.places, ...b.places];
          merged[i] = {
            id: `merged:${a.id}+${b.id}`,
            position: members.reduce(
              (sum, place) => ({
                x: sum.x + place.position.x / members.length,
                y: sum.y + place.position.y / members.length,
              }),
              { x: 0, y: 0 },
            ),
            places: members,
          };
          merged.splice(j, 1);
          didMerge = true;
          break;
        }
      }
    }
    if (!didMerge) return merged;
  }
  return merged;
}
