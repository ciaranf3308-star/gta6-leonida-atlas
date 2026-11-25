// Chrome geometry — v0.30.0 map lane.
//
// These tests prove the CLAMP RULES with synthetic geometry, using
// the rects the calibration probe measured on the real app
// (scripts/check-v030-geometry-calibration.mjs: phone 390x844 DPR 2,
// desktop 1280x800). The DOM reading itself is proved by the
// Playwright probe (scripts/check-v030-geometry.mjs): change a
// chrome height in the harness and watch the clamp follow.
import { describe, expect, it } from 'vitest';
import {
  BOTTOM_STRIP,
  decideLabelSide,
  fitPaddingFor,
  markerBoxHidden,
  type ChromeGeometry,
} from '../../src/features/map/chrome-geometry';

// Phone 390x844 DPR 2, from the calibration probe: hero bottom 198,
// note bottom 217, stack x330-378 y196-302, pill x328-378 y596-695,
// attribution top 740, canvas 390x771, nav 73.
const PHONE: ChromeGeometry = {
  width: 390,
  height: 771,
  heroBottom: 198,
  topChromeBottom: 217,
  topBand: 229,
  edgeStack: { left: 330, top: 196, right: 378, bottom: 302 },
  zoomControls: { left: 328, top: 596, right: 378, bottom: 695 },
  attributionTop: 740,
  promptHeight: null,
  navHeight: 73,
};

// Desktop 1280x800, from the calibration probe: hero bottom 150,
// note bottom 177, no stack/pill, navigation x1210-1260 y505-653,
// attribution top 715, canvas 1280x727.
const DESKTOP: ChromeGeometry = {
  width: 1280,
  height: 727,
  heroBottom: 150,
  topChromeBottom: 177,
  topBand: 189,
  edgeStack: null,
  zoomControls: { left: 1210, top: 505, right: 1260, bottom: 653 },
  attributionTop: 715,
  promptHeight: null,
  navHeight: 73,
};

describe('markerBoxHidden (v0.30.0 measured chrome)', () => {
  it('hides a pin whose box starts inside the top band (hero + note)', () => {
    // Centre y 240: box top 216 < 229 — under the note (bottom 217).
    expect(markerBoxHidden({ x: 100, y: 240 }, 24, PHONE)).toBe(true);
    // Centre y 260: box top 236 > 229 — clear of the band.
    expect(markerBoxHidden({ x: 100, y: 260 }, 24, PHONE)).toBe(false);
  });

  it('hides a pin overlapping the right-edge stack, shows one just left of it', () => {
    // y 280 puts the box below the top band (top 256 > 229).
    expect(markerBoxHidden({ x: 350, y: 280 }, 24, PHONE)).toBe(true);
    // Box 276-324: right edge 324 < stack left 330 — clear.
    expect(markerBoxHidden({ x: 300, y: 280 }, 24, PHONE)).toBe(false);
  });

  it('hides a pin whose 48px box overlaps the zoom pill, shows one just above it', () => {
    // v0.26.1 regression shape: the whole BOX is tested, not the
    // centre point — a centre that clears the pill can still hang
    // its bottom half behind it. x 320 keeps the box clear of the
    // right-edge clearance (right 344 < 366).
    expect(markerBoxHidden({ x: 320, y: 590 }, 24, PHONE)).toBe(true);
    expect(markerBoxHidden({ x: 320, y: 560 }, 24, PHONE)).toBe(false);
  });

  it('keeps pins 24px from the left and right screen edges', () => {
    expect(markerBoxHidden({ x: 20, y: 400 }, 24, PHONE)).toBe(true);
    expect(markerBoxHidden({ x: 370, y: 400 }, 24, PHONE)).toBe(true);
    expect(markerBoxHidden({ x: 48, y: 400 }, 24, PHONE)).toBe(false);
  });

  it('keeps pins out of the bottom strip (attribution or 40px)', () => {
    // Bottom limit is min(attribution 740, 771-40=731) = 731.
    expect(markerBoxHidden({ x: 100, y: 720 }, 24, PHONE)).toBe(true);
    expect(markerBoxHidden({ x: 100, y: 700 }, 24, PHONE)).toBe(false);
    expect(BOTTOM_STRIP).toBe(40);
  });

  it('follows the attribution when it moves up', () => {
    const moved = { ...PHONE, attributionTop: 700 };
    // Box bottom 714 > 700 — hidden under the moved attribution.
    expect(markerBoxHidden({ x: 100, y: 690 }, 24, moved)).toBe(true);
    // Same pin, attribution back at 740 — visible again.
    expect(markerBoxHidden({ x: 100, y: 690 }, 24, PHONE)).toBe(false);
  });

  it('hides a pin under the desktop navigation column', () => {
    expect(markerBoxHidden({ x: 1235, y: 580 }, 24, DESKTOP)).toBe(true);
    expect(markerBoxHidden({ x: 1150, y: 580 }, 24, DESKTOP)).toBe(false);
  });
});

describe('decideLabelSide (v0.30.0 measured chrome)', () => {
  it('runs a label right when nothing is in the way', () => {
    expect(decideLabelSide({ x: 100, y: 400 }, 100, PHONE, false)).toBe('right');
  });

  it('runs a label left when it would run off the right edge', () => {
    expect(decideLabelSide({ x: 300, y: 400 }, 100, PHONE, false)).toBe('left');
  });

  it('runs a label left when it would run into the edge stack', () => {
    // Width 60 keeps the label clear of the screen edge (right edge
    // 370 < 382), so only the stack can flip it.
    expect(decideLabelSide({ x: 300, y: 250 }, 60, PHONE, false)).toBe('left');
    // Same pin, lower down where the stack does not reach — right.
    expect(decideLabelSide({ x: 300, y: 400 }, 60, PHONE, false)).toBe('right');
  });

  it('runs a label left when it would run into the zoom pill', () => {
    expect(decideLabelSide({ x: 300, y: 620 }, 100, PHONE, false)).toBe('left');
  });

  it('skips a label that fits on neither side', () => {
    // A pin to the right forces left, but the label is too wide.
    expect(decideLabelSide({ x: 100, y: 400 }, 150, PHONE, true)).toBe('none');
  });

  it('uses the desktop navigation as the right-edge chrome', () => {
    expect(decideLabelSide({ x: 1150, y: 550 }, 100, DESKTOP, false)).toBe('left');
    expect(decideLabelSide({ x: 1150, y: 400 }, 100, DESKTOP, false)).toBe('right');
  });
});

describe('fitPaddingFor (v0.30.0 measured chrome)', () => {
  it('frames the island below the hero and above the nav (phone)', () => {
    // Hero bottom 198 + 6; nav 73 + 11 — the v0.29 constants,
    // reproduced from measured heights.
    expect(fitPaddingFor(PHONE, false)).toEqual({ top: 204, bottom: 84 });
  });

  it('lifts the framing above the empty-map prompt while it is up', () => {
    const withPrompt = { ...PHONE, promptHeight: 132 };
    expect(fitPaddingFor(withPrompt, true)).toEqual({ top: 204, bottom: 150 });
  });

  it('frames below the hero on desktop too', () => {
    expect(fitPaddingFor(DESKTOP, false)).toEqual({ top: 156, bottom: 84 });
  });

  it('falls back to the nav height when the nav is absent', () => {
    const noNav = { ...PHONE, navHeight: 0 };
    expect(fitPaddingFor(noNav, false)).toEqual({ top: 204, bottom: 84 });
  });
});
