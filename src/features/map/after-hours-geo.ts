import { useEffect, useState } from 'react';
import type { County } from '../../data/counties';

/**
 * Traced county outlines (After Hours, v0.15.0) — built by
 * scripts/dissect-map.py from the real GTADB day tiles, not drawn by hand.
 *
 * Per county: `loops` are the land rings inside the estimated rect (holes
 * for the isolation dim mask), `coast` runs are coastline traced from the
 * tiles, `estimate` runs sit on the estimated rect edge — no official
 * boundary lines exist, so those stay visibly dashed. Points are canonical
 * game [x, y]. The file is fetched lazily (94KB) and cached; a missing or
 * malformed file means the map falls back to the rect outline, never a crash.
 */

export interface CountyGeo {
  loops: [number, number][][];
  coast: [number, number][][];
  estimate: [number, number][][];
}

export interface AfterHoursGeo {
  counties: Record<string, CountyGeo>;
}

const GEO_URL = 'assets/after-hours/after-hours-geo.json';

let geoPromise: Promise<AfterHoursGeo | null> | null = null;

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isRun(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length >= 2 && value.every(isPoint);
}

function isCountyGeo(value: unknown): value is CountyGeo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CountyGeo>;
  return (
    Array.isArray(v.loops) &&
    v.loops.every(isRun) &&
    Array.isArray(v.coast) &&
    v.coast.every(isRun) &&
    Array.isArray(v.estimate) &&
    v.estimate.every(isRun)
  );
}

export function parseAfterHoursGeo(value: unknown): AfterHoursGeo | null {
  if (!value || typeof value !== 'object') return null;
  const counties = (value as { counties?: unknown }).counties;
  if (!counties || typeof counties !== 'object') return null;
  const out: Record<string, CountyGeo> = {};
  for (const [id, county] of Object.entries(counties as Record<string, unknown>)) {
    if (!isCountyGeo(county)) return null;
    out[id] = county;
  }
  return { counties: out };
}

export function loadAfterHoursGeo(
  fetchImpl: typeof fetch = fetch,
  base: string = import.meta.env.BASE_URL ?? '/',
): Promise<AfterHoursGeo | null> {
  if (!geoPromise) {
    const prefix = base.endsWith('/') ? base : `${base}/`;
    geoPromise = fetchImpl(`${prefix}${GEO_URL}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => parseAfterHoursGeo(json))
      .catch(() => null);
  }
  return geoPromise;
}

/** For tests: drop the cached promise so a fresh fetch runs. */
export function __resetAfterHoursGeoCache(): void {
  geoPromise = null;
}

/** Canonical [x, y] run -> Leaflet [lat, lng] (CRS.Simple treats them as raw y/x). */
export function runToLatLngs(run: readonly (readonly [number, number])[]): [number, number][] {
  return run.map(([x, y]) => [y, x]);
}

/**
 * Mini outline for a county card: the traced coast (solid) and the
 * estimated edges (dashed) as SVG paths over the county's rect.
 * SVG y runs down, so the game y is negated in both the points and
 * the viewBox. Null when there is no traced geometry for the county.
 */
export function countyOutlineSvg(
  county: County,
  geo: AfterHoursGeo | null,
): { viewBox: string; coast: string; estimate: string } | null {
  const countyGeo = geo?.counties[county.id];
  if (!countyGeo) return null;
  const toPath = (runs: [number, number][][]): string =>
    runs
      .map((run) => `M${run.map(([x, y]) => `${x},${-y}`).join(' L')}`)
      .join(' ');
  const b = county.bounds;
  return {
    viewBox: `${b.west} ${-b.north} ${b.east - b.west} ${b.north - b.south}`,
    coast: toPath(countyGeo.coast),
    estimate: toPath(countyGeo.estimate),
  };
}

/** Shared traced geometry, loaded once and cached across the map and panels. */
export function useAfterHoursGeo(): AfterHoursGeo | null {
  const [geo, setGeo] = useState<AfterHoursGeo | null>(null);
  useEffect(() => {
    let alive = true;
    loadAfterHoursGeo().then((loaded) => {
      if (alive) setGeo(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}
