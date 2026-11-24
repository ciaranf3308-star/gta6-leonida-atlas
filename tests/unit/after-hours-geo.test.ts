import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../../src/data/counties';
import {
  countyOutlineSvg,
  parseAfterHoursGeo,
  runToLatLngs,
  type AfterHoursGeo,
} from '../../src/features/map/after-hours-geo';

/** The real artifact scripts/dissect-map.py wrote — read it off disk. */
function loadRealGeo(): AfterHoursGeo {
  const raw = readFileSync(
    new URL('../../public/assets/after-hours/after-hours-geo.json', import.meta.url),
    'utf8',
  );
  const parsed = parseAfterHoursGeo(JSON.parse(raw));
  expect(parsed).not.toBeNull();
  return parsed!;
}

describe('traced county outlines (After Hours geo)', () => {
  it('parses the real artifact: all five counties, coast + estimate runs', () => {
    const geo = loadRealGeo();
    expect(Object.keys(geo.counties).sort()).toEqual(
      COUNTIES.map((c) => c.id).sort(),
    );
    for (const county of COUNTIES) {
      const c = geo.counties[county.id]!;
      // Every county touches the sea somewhere: traced coast exists.
      expect(c.coast.length).toBeGreaterThan(0);
      // Every county also has estimated inland edges (no official lines).
      expect(c.estimate.length).toBeGreaterThan(0);
      // Land rings exist for the dim-mask holes.
      expect(c.loops.length).toBeGreaterThan(0);
      for (const run of [...c.coast, ...c.estimate]) {
        expect(run.length).toBeGreaterThanOrEqual(2);
        for (const [x, y] of run) {
          // Inside the full tile bounds the traces came from.
          expect(x).toBeGreaterThanOrEqual(-16384);
          expect(x).toBeLessThanOrEqual(8192);
          expect(y).toBeGreaterThanOrEqual(-16384);
          expect(y).toBeLessThanOrEqual(16384);
        }
      }
    }
    // The whole file stays small enough to fetch lazily on demand.
    const totalPoints = Object.values(geo.counties).reduce(
      (sum, c) =>
        sum +
        c.coast.flat().length +
        c.estimate.flat().length +
        c.loops.flat().length,
      0,
    );
    expect(totalPoints).toBeLessThan(20000);
  });

  it('rejects malformed geo instead of drawing garbage', () => {
    expect(parseAfterHoursGeo(null)).toBeNull();
    expect(parseAfterHoursGeo({})).toBeNull();
    expect(parseAfterHoursGeo({ counties: { lummox: { coast: [[1]] } } })).toBeNull();
    expect(
      parseAfterHoursGeo({
        counties: { lummox: { loops: [], coast: [[[0, 0], [1, 1]]], estimate: [] } },
      }),
    ).not.toBeNull();
  });

  it('converts canonical runs to Leaflet [lat, lng] ([y, x])', () => {
    expect(
      runToLatLngs([
        [-100, 200],
        [300, -400],
      ]),
    ).toEqual([
      [200, -100],
      [-400, 300],
    ]);
  });

  it('builds a county-card outline: viewBox from the rect, y flipped for SVG', () => {
    const geo = loadRealGeo();
    const county = COUNTIES.find((c) => c.id === 'vice-dale')!;
    const svg = countyOutlineSvg(county, geo);
    expect(svg).not.toBeNull();
    expect(svg!.viewBox).toBe('-3779 -3235 6338 5885');
    expect(svg!.coast).toContain('M');
    expect(svg!.coast).toContain(' L');
    expect(svg!.estimate).toContain('M');
    expect(countyOutlineSvg(county, null)).toBeNull();
  });
});
