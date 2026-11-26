// Label placement — v0.30.0 map lane.
//
// Proves the first-label-wins / skip-on-overlap rules and the
// 65-label budget with synthetic geometry. The chrome-side rules
// (flip off the edge stack / zoom pill) live in chrome-geometry.test.ts.
import { describe, expect, it } from 'vitest';
import {
  computeLabelPlacements,
  labelOffsetForPin,
  labelWidthFor,
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
