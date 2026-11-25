// Label placement — v0.30.0 map lane.
//
// Proves the first-label-wins / skip-on-overlap rules and the
// 65-label budget with synthetic geometry. The chrome-side rules
// (flip off the edge stack / zoom pill) live in chrome-geometry.test.ts.
import { describe, expect, it } from 'vitest';
import {
  computeLabelPlacements,
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
    expect(placed.get(0)).toBe('right');
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
    expect(placed.get(0)).toBe('right');
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
    expect(placed.get(0)).toBe('right');
    expect(placed.get(1)).toBe('right');
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
    expect(placed.get(0)).toBe('left');
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
