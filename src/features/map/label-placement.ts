// Label placement — v0.30.0 map lane.
//
// Moved out of MapView.tsx's marker render loop, which interleaved
// label geometry with marker creation, click handling and drag
// handling. The rules are unchanged:
// - A label runs right from its pin unless another pin sits just to
//   its right (v0.17.0), it would run off the screen edge, or it
//   would run into the right-edge chrome (v0.25.0) — see
//   decideLabelSide in chrome-geometry.ts for the chrome part.
// - A label that would land on top of an earlier label is skipped
//   instead of piling up (v0.25.0 — three 200px labels from pins
//   30px apart read as one smudge). The first label wins; the
//   skipped pin still shows.
// - A RINGED label (selected / Ask highlight) that fits nowhere at
//   full width is shrunk to the roomier side instead of being
//   dropped (v0.32 step-9): the fly-to centres the pin, so at 390px
//   a 210px label needs 246px of run and fits neither way —
//   truncating to the ~150px that is there still reads, and the
//   placement carries the fitted width so the tooltip renders
//   exactly what was measured. Ordinary labels keep the old rule.
// - At most 65 labels are considered per render (the first 65
//   eligible pins in shown order).
// The caller decides eligibility (not a cluster, labels on, not an
// unnamed "?" pin, selected/highlight/region or zoomed in) and binds
// the tooltip; this module only decides WHICH side each label runs,
// or that it does not run at all.

import { decideLabelSide, type ChromeGeometry } from './chrome-geometry';

export interface LabelCandidate {
  /** Index into the shown-groups array (the caller maps it back). */
  index: number;
  title: string;
  point: { x: number; y: number };
  /** True when this pin wears a ring (selected, or an Ask
   * highlight) — its label starts further out, clear of the ring. */
  ringed?: boolean;
}

export interface LabelPlacement {
  side: 'left' | 'right';
  /** Rendered width in px — labelWidthFor(title), or the fitted
   * width when a ringed label was shrunk to the roomier side. The
   * caller caps the tooltip at this width, so placement and
   * rendering agree. */
  width: number;
}

/** A shrunk-to-fit ringed label still has to read: below this the
 * truncation ("Easy …") says nothing, so the label stays skipped. */
export const FITTED_LABEL_MIN_WIDTH = 80;

/**
 * How far a label's near edge sits from its pin's centre
 * (v0.32 step-9, Demo A shot a08: the selected pin's label was
 * partly obscured by the pin icon itself).
 *
 * The pin face is 32px (38px at hero zoom) with a 2px border, so
 * its outer edge is 18px (21px hero) from the centre — a label
 * starting at the old 10px began underneath the face. A ringed pin
 * adds a 3px outline + 3px offset + 8px glow, so its outer edge
 * is 32px (35px hero) from the centre — the gold ring covered the
 * middle of the label ("GELLHORN MOTEL"). The clearance clears
 * both, with a couple of px to spare, at either zoom; the caller
 * uses the same number for the tooltip offset, and the rect math
 * below uses it too, so placement and rendering agree.
 */
export function labelOffsetForPin(ringed: boolean): number {
  return ringed ? 36 : 22;
}

export function labelWidthFor(title: string): number {
  return Math.min(210, title.length * 6 + 16);
}

export function computeLabelPlacements(
  candidates: readonly LabelCandidate[],
  /** Container points of ALL shown groups (labels avoid pins, not
   * just other labelled pins). */
  allPoints: readonly { x: number; y: number }[],
  geometry: ChromeGeometry,
  maxLabels = 65,
): Map<number, LabelPlacement> {
  const placed = new Map<number, LabelPlacement>();
  const placedRects: { left: number; right: number; top: number; bottom: number }[] = [];
  let considered = 0;
  for (const candidate of candidates) {
    if (considered >= maxLabels) break;
    considered++;
    const clearance = labelOffsetForPin(candidate.ringed ?? false);
    const fullWidth = labelWidthFor(candidate.title);
    const hasPinToTheRight = allPoints.some(
      (other, oi) =>
        oi !== candidate.index &&
        Math.abs(other.y - candidate.point.y) < 28 &&
        other.x > candidate.point.x &&
        other.x - candidate.point.x < 90,
    );
    const side = decideLabelSide(
      candidate.point,
      fullWidth,
      geometry,
      hasPinToTheRight,
      clearance,
    );
    let placement: LabelPlacement | null = null;
    if (side !== 'none') {
      placement = { side, width: fullWidth };
    } else if (candidate.ringed) {
      // A selected/highlighted pin is the one the player is looking
      // at — and the fly-to centres it, so at 390px a full-width
      // label fits on neither side (a 210px label needs 246px of
      // run from a centred pin). Shrink it to the roomier side
      // instead of dropping it: the label truncates with an ellipsis
      // (map.css, white-space: nowrap) and still reads. Ordinary
      // labels keep the old rule and stay skipped, and a pin to the
      // right still forbids running right.
      const leftSpace = candidate.point.x - clearance - 8;
      const rightSpace = geometry.width - 8 - candidate.point.x - clearance;
      const fittedSide =
        !hasPinToTheRight && rightSpace >= leftSpace ? 'right' : 'left';
      const fittedWidth = fittedSide === 'left' ? leftSpace : rightSpace;
      if (fittedWidth >= FITTED_LABEL_MIN_WIDTH) {
        placement = { side: fittedSide, width: Math.min(fullWidth, fittedWidth) };
      }
    }
    if (!placement) continue;
    // The rect is the label box as rendered: its near edge sits
    // one clearance from the pin centre (labelOffsetForPin), never
    // underneath the face or the ring.
    const rect = {
      left:
        placement.side === 'left'
          ? candidate.point.x - clearance - placement.width
          : candidate.point.x + clearance,
      right:
        placement.side === 'left'
          ? candidate.point.x - clearance
          : candidate.point.x + clearance + placement.width,
      top: candidate.point.y - 10,
      bottom: candidate.point.y + 10,
    };
    const overlaps = placedRects.some(
      (r) =>
        rect.left < r.right + 4 &&
        rect.right > r.left - 4 &&
        rect.top < r.bottom + 2 &&
        rect.bottom > r.top - 2,
    );
    if (overlaps) continue;
    placed.set(candidate.index, placement);
    placedRects.push(rect);
  }
  return placed;
}

// ---- Geo-label pills (§6.4, v0.32 lane 3) ----
//
// One rule: a geo pill renders only if its screen rect is clear —
// clear of every ringed pin's face+ring box (the selected pin and
// Ask-highlight pins) and clear of every pill already placed. First
// in geoLabelsForView order (alphabetical by area name) wins; the
// rest are suppressed, never moved.
//
// Why this rule, and why the candidates lost:
// - Suppress-vs-selected-pin alone leaves pill/pill overlap when
//   nothing is selected, and misses the second instance (a county
//   pill behind ringed Ask-highlight diamonds at island zoom).
// - Hide-only-the-selected-place's-own-area pill leaves the sibling
//   pill standing: at Starlet Motel the "Gellhorn" pill is a different
//   area from the selected place, and it still overlapped the pin
//   face by 992px² (DEMOS-STEP9 Gap 2).
// - Stagger/stack the pills that share an anchor: stacking keeps
//   them centred on the pin face, so the pin still punches through;
//   moving a pill off its anchor invents a position for an area whose
//   only honest anchor is its centroid (member-bbox centre).
// Suppression is also the existing precedent in this file: a pin
// label that would land on an earlier label is skipped, not moved.
//
// The two pills at Starlet Motel share (nearly) one anchor because
// their areas' centroids are 38 map-units apart: area:gellhorn
// (-5354.67, 3461.86) and area:starlet-motel--kelly-county
// (-5316.82, 3471.64). The same shape recurs wherever two areas
// nearly coincide (duplicate-name areas: Port Gellhorn, Millport).

export interface GeoLabelCandidate {
  areaId: string;
  name: string;
  /** Map coordinates of the area centroid (the marker anchor). */
  position: { x: number; y: number };
  /** Container point of the centroid (the pill's screen centre). */
  point: { x: number; y: number };
}

/**
 * Estimated pill width in px. Measured live 2026-11-26 at 390px
 * DPR 2: Gellhorn 92px / 8 chars, Starlet Motel 124 / 13, Kelly
 * County 118 / 12, Leonard County 140 / 14, Vice-Dale County 149 /
 * 15 — 7.7–8.7px per char over the 24px horizontal padding (5px
 * 12px in map.css, 13px condensed caps + 2px letter-spacing), so
 * 9px/char + 24px covers every measured pill. Over-estimating is
 * the safe direction: a pill whose estimate touches a pin is
 * suppressed, never drawn under one.
 */
export function geoLabelWidthFor(name: string): number {
  return name.length * 9 + 24;
}

/** Pill height in px — measured 31.5px live (padding + 13px caps). */
export const GEO_LABEL_HEIGHT_PX = 32;

export interface GeoLabelRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The pill's screen box: centred on its anchor, estimated width. */
export function geoLabelRectFor(
  anchor: { x: number; y: number },
  name: string,
): GeoLabelRect {
  const halfWidth = geoLabelWidthFor(name) / 2;
  const halfHeight = GEO_LABEL_HEIGHT_PX / 2;
  return {
    left: anchor.x - halfWidth,
    right: anchor.x + halfWidth,
    top: anchor.y - halfHeight,
    bottom: anchor.y + halfHeight,
  };
}

/**
 * Half-size of a ringed pin's keep-out box: the pin face is 32px
 * and a ringed pin's outer edge sits 32px from its centre
 * (labelOffsetForPin), plus a 4px margin — the same clearance the
 * place-label tooltip uses, so the two label systems agree about
 * where a ringed pin ends.
 */
export const RINGED_PIN_KEEPOUT_HALF_PX = 36;

export function placeGeoLabels(
  candidates: readonly GeoLabelCandidate[],
  /** Container points of the ringed pins (selected + highlighted). */
  ringedPinPoints: readonly { x: number; y: number }[],
): GeoLabelCandidate[] {
  const placed: GeoLabelCandidate[] = [];
  const placedRects: GeoLabelRect[] = [];
  for (const candidate of candidates) {
    const rect = geoLabelRectFor(candidate.point, candidate.name);
    const underRingedPin = ringedPinPoints.some(
      (pin) =>
        rect.left < pin.x + RINGED_PIN_KEEPOUT_HALF_PX &&
        rect.right > pin.x - RINGED_PIN_KEEPOUT_HALF_PX &&
        rect.top < pin.y + RINGED_PIN_KEEPOUT_HALF_PX &&
        rect.bottom > pin.y - RINGED_PIN_KEEPOUT_HALF_PX,
    );
    if (underRingedPin) continue;
    // Same gap convention as computeLabelPlacements above: 4px
    // horizontal, 2px vertical between neighbouring pills.
    const overlapsPlaced = placedRects.some(
      (other) =>
        rect.left < other.right + 4 &&
        rect.right > other.left - 4 &&
        rect.top < other.bottom + 2 &&
        rect.bottom > other.top - 2,
    );
    if (overlapsPlaced) continue;
    placed.push(candidate);
    placedRects.push(rect);
  }
  return placed;
}
