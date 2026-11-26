// Label placement — v0.30.0 map lane.
//
// Proves the first-label-wins / skip-on-overlap rules and the
// 65-label budget with synthetic geometry. The chrome-side rules
// (flip off the edge stack / zoom pill) live in chrome-geometry.test.ts.
import { describe, expect, it } from 'vitest';
import {
  computeLabelPlacements,
  geoLabelRectFor,
  geoLabelWidthFor,
  GEO_LABEL_HEIGHT_PX,
  labelOffsetForPin,
  labelWidthFor,
  placeGeoLabels,
  type GeoLabelCandidate,
  type LabelCandidate,
} from '../../src/features/map/label-placement';
import type { ChromeGeometry } from '../../src/features/map/chrome-geometry';

// Wide-open geometry: no chrome anywhere, so only the overlap and
// budget rules can bite.
const OPEN: ChromeGeometry = {
  width: 1000,
  height: 1000,
  heroBottom: 0,
  topChromeBottom: 0,
  topBand: 12,
  edgeStack: null,
  zoomControls: null,
  attributionTop: null,
  promptHeight: null,
  navHeight: 0,
};

const candidate = (
  index: number,
  title: string,
  x: number,
  y: number,
): LabelCandidate => ({ index, title, point: { x, y } });

describe('computeLabelPlacements (v0.30.0)', () => {
  it('places a lone label to the right', () => {
    const placed = computeLabelPlacements(
      [candidate(0, 'Vice City', 100, 400)],
      [{ x: 100, y: 400 }],
      OPEN,
    );
    expect(placed.get(0)).toEqual({ side: 'right', width: 70 });
  });

  it('skips a later label that would land on an earlier one (first wins)', () => {
    // Coincident pins: both labels run right from the same point, so
    // the second rect lands exactly on the first and is skipped.
    const placed = computeLabelPlacements(
      [
        candidate(0, 'Metro Station', 100, 400),
        candidate(1, 'Parking Lot', 100, 400),
      ],
      [
        { x: 100, y: 400 },
        { x: 100, y: 400 },
      ],
      OPEN,
    );
    expect(placed.get(0)).toEqual({ side: 'right', width: 94 });
    expect(placed.has(1)).toBe(false);
  });

  it('places a label that clears the earlier one', () => {
    const placed = computeLabelPlacements(
      [
        candidate(0, 'Metro Station', 100, 400),
        candidate(1, 'Parking Lot', 100, 460),
      ],
      [
        { x: 100, y: 400 },
        { x: 100, y: 460 },
      ],
      OPEN,
    );
    expect(placed.get(0)).toEqual({ side: 'right', width: 94 });
    expect(placed.get(1)).toEqual({ side: 'right', width: 82 });
  });

  it('flips a label left when another pin sits just to its right', () => {
    // v0.17.0: a label running right into the next pin flips left.
    // The pin sits at x 200 so the flipped label has room (200 - 10
    // - 88 = 102 >= 8); at x 100 it would be skipped outright.
    const placed = computeLabelPlacements(
      [candidate(0, 'Leonida Keys', 200, 400)],
      [
        { x: 200, y: 400 },
        { x: 250, y: 405 },
      ],
      OPEN,
    );
    expect(placed.get(0)).toEqual({ side: 'left', width: 88 });
  });

  it('considers only the first 65 eligible pins', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      candidate(i, `Place ${i}`, 100 + (i % 8) * 100, 100 + Math.floor(i / 8) * 60),
    );
    const points = many.map((c) => c.point);
    const placed = computeLabelPlacements(many, points, OPEN);
    // Every placed label is within the first 65 candidates.
    for (const index of placed.keys()) {
      expect(index).toBeLessThan(65);
    }
    expect(placed.size).toBeGreaterThan(0);
  });

  it('measures label width from the title, capped at 210', () => {
    expect(labelWidthFor('Vice City')).toBe(9 * 6 + 16);
    expect(labelWidthFor('A'.repeat(100))).toBe(210);
  });
});

describe('labelOffsetForPin — the selected pin’s label clears the ring (v0.32 step-9, Demo A a08)', () => {
  it('clears the pin face (18px, 21px at hero zoom) and the ring (32px, 35px hero)', () => {
    // Base: past the 21px hero face, with a px to spare.
    expect(labelOffsetForPin(false)).toBeGreaterThanOrEqual(22);
    // Ringed: past the 35px hero ring, with a px to spare.
    expect(labelOffsetForPin(true)).toBeGreaterThanOrEqual(36);
  });

  it('a ringed label near the right edge flips left where a plain label still fits right', () => {
    // "Gellhorn Motel" is 100px wide. At x 860 the plain label fits
    // right (860 + 22 + 100 = 982 ≤ 992); the ringed one does not
    // (860 + 36 + 100 = 996 > 992) and flips left
    // (860 − 36 − 100 = 724 ≥ 8, room on the left).
    const plain = computeLabelPlacements(
      [candidate(0, 'Gellhorn Motel', 860, 400)],
      [{ x: 860, y: 400 }],
      OPEN,
    );
    expect(plain.get(0)).toEqual({ side: 'right', width: 100 });
    const ringed = computeLabelPlacements(
      [{ ...candidate(0, 'Gellhorn Motel', 860, 400), ringed: true }],
      [{ x: 860, y: 400 }],
      OPEN,
    );
    expect(ringed.get(0)).toEqual({ side: 'left', width: 100 });
  });

  it('a ringed label with no room on the left is skipped, where a plain one fits', () => {
    // Forced left by a pin just to the right. "Motel" is 46px wide
    // (5 chars × 6 + 16). At x 88 the plain label fits left
    // (88 − 22 − 46 = 20 ≥ 8); the ringed one does not
    // (88 − 36 − 46 = 6 < 8) and is skipped rather than cut off.
    const points = [
      { x: 88, y: 400 },
      { x: 138, y: 405 },
    ];
    const plain = computeLabelPlacements(
      [candidate(0, 'Motel', 88, 400)],
      points,
      OPEN,
    );
    expect(plain.get(0)).toEqual({ side: 'left', width: 46 });
    const ringed = computeLabelPlacements(
      [{ ...candidate(0, 'Motel', 88, 400), ringed: true }],
      points,
      OPEN,
    );
    expect(ringed.has(0)).toBe(false);
  });
});

describe('ringed labels shrink to fit instead of vanishing (v0.32 step-9)', () => {
  // Phone geometry: the fly-to centres the selected pin, so at
  // 390px a full-width label fits on neither side.
  const PHONE: ChromeGeometry = { ...OPEN, width: 390 };
  const LONG_TITLE = 'Easy Inn Motel, Moonstone Hwy, Port Gellhorn'; // 41 chars → 210px

  it('a centred ringed label is placed fitted, not skipped', () => {
    // Pin at x 195 (centred): left room 195 − 36 − 8 = 151, right
    // room 390 − 8 − 195 − 36 = 151 — a 210px label fits nowhere
    // at full width, so it truncates to 151px on the right (tie).
    const placed = computeLabelPlacements(
      [{ ...candidate(0, LONG_TITLE, 195, 400), ringed: true }],
      [{ x: 195, y: 400 }],
      PHONE,
    );
    expect(placed.get(0)).toEqual({ side: 'right', width: 151 });
  });

  it('a plain centred label is still skipped — the fit is ringed-only', () => {
    const placed = computeLabelPlacements(
      [candidate(0, LONG_TITLE, 195, 400)],
      [{ x: 195, y: 400 }],
      PHONE,
    );
    expect(placed.has(0)).toBe(false);
  });

  it('a ringed label with under 80px on both sides stays skipped', () => {
    // 200px-wide canvas, pin at x 100: 56px of room each way.
    const narrow: ChromeGeometry = { ...OPEN, width: 200 };
    const placed = computeLabelPlacements(
      [{ ...candidate(0, LONG_TITLE, 100, 400), ringed: true }],
      [{ x: 100, y: 400 }],
      narrow,
    );
    expect(placed.has(0)).toBe(false);
  });
});

describe('geo-label pills vs ringed pins and each other (v0.32 lane 3)', () => {
  const geo = (
    areaId: string,
    name: string,
    x: number,
    y: number,
  ): GeoLabelCandidate => ({
    areaId,
    name,
    position: { x: 0, y: 0 },
    point: { x, y },
  });

  it('the width estimator covers every pill measured live at 390px DPR 2', () => {
    // Live widths, lane-3 probe 2026-11-26: Gellhorn 92, Starlet
    // Motel 124, Kelly County 118, Leonard County 140, Vice-Dale
    // County 149, Port Gellhorn International Raceway 297; height 31.5.
    const measured: [string, number][] = [
      ['Gellhorn', 92],
      ['Starlet Motel', 124],
      ['Kelly County', 118],
      ['Leonard County', 140],
      ['Vice-Dale County', 149],
      ['Port Gellhorn International Raceway', 297],
    ];
    for (const [name, width] of measured) {
      expect(geoLabelWidthFor(name)).toBeGreaterThanOrEqual(width);
    }
    expect(GEO_LABEL_HEIGHT_PX).toBeGreaterThanOrEqual(31.5);
  });

  it('a lone pill with no ringed pin survives, centred on its anchor', () => {
    const placed = placeGeoLabels(
      [geo('area:port-gellhorn', 'Port Gellhorn', 200, 200)],
      [],
    );
    expect(placed.map((label) => label.areaId)).toEqual(['area:port-gellhorn']);
    expect(geoLabelRectFor({ x: 200, y: 200 }, 'Port Gellhorn')).toEqual({
      left: 200 - geoLabelWidthFor('Port Gellhorn') / 2,
      right: 200 + geoLabelWidthFor('Port Gellhorn') / 2,
      top: 200 - GEO_LABEL_HEIGHT_PX / 2,
      bottom: 200 + GEO_LABEL_HEIGHT_PX / 2,
    });
  });

  it('the Starlet pair collapses to one pill when nothing is selected', () => {
    // The two centroids project ~5px apart at district zoom, so
    // the pills sit on top of each other (measured 2622px² live).
    // First in geoLabelsForView order (alphabetical) wins.
    const placed = placeGeoLabels(
      [
        geo('area:gellhorn', 'Gellhorn', 195, 200),
        geo('area:starlet-motel--kelly-county', 'Starlet Motel', 200, 200),
      ],
      [],
    );
    expect(placed.map((label) => label.areaId)).toEqual(['area:gellhorn']);
  });

  it('a pill centred on a ringed pin is suppressed; a clear pill survives', () => {
    // Ringed keep-out is a 72px box (32px ring outer + 4px margin
    // each way); "Gellhorn" is 96px wide, so centred at x 280 its
    // rect (232–328) still touches the pin box (164–236).
    const placed = placeGeoLabels(
      [
        geo('area:gellhorn', 'Gellhorn', 200, 200),
        geo('area:starlet-motel--kelly-county', 'Starlet Motel', 280, 200),
        geo(
          'area:port-gellhorn-international-raceway',
          'Port Gellhorn International Raceway',
          200,
          100,
        ),
      ],
      [{ x: 200, y: 200 }],
    );
    expect(placed.map((label) => label.areaId)).toEqual([
      'area:port-gellhorn-international-raceway',
    ]);
  });

  it('a pill clear of the pin by the full keep-out survives', () => {
    // Centred at x 300, the 96px "Gellhorn" rect (252–348) clears
    // the pin box (164–236) entirely.
    const placed = placeGeoLabels(
      [geo('area:gellhorn', 'Gellhorn', 300, 200)],
      [{ x: 200, y: 200 }],
    );
    expect(placed).toHaveLength(1);
  });

  it('the Starlet view with the pin selected keeps only the distant pill', () => {
    // Live shape: Gellhorn + Starlet Motel at the pin, Port
    // Gellhorn International Raceway far away — after the fix the
    // view shows exactly that one pill, and the pin face is clear.
    const placed = placeGeoLabels(
      [
        geo('area:gellhorn', 'Gellhorn', 195, 200),
        geo('area:starlet-motel--kelly-county', 'Starlet Motel', 200, 200),
        geo(
          'area:port-gellhorn-international-raceway',
          'Port Gellhorn International Raceway',
          200,
          100,
        ),
      ],
      [{ x: 200, y: 200 }],
    );
    expect(placed.map((label) => label.areaId)).toEqual([
      'area:port-gellhorn-international-raceway',
    ]);
  });

  it('a county pill behind a ringed highlight pin is suppressed', () => {
    // Island-zoom shape (demo-g g11): the Kelly County pill sits
    // under a ringed diamond highlight pin — the highlight point
    // suppresses it exactly like a selected pin does.
    const placed = placeGeoLabels(
      [geo('county:kelly', 'Kelly County', 200, 200)],
      [{ x: 210, y: 205 }],
    );
    expect(placed).toHaveLength(0);
  });
});
