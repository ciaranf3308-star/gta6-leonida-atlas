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

// ---- Likely-area labels (v0.32 regions fix, lane 1) ----
//
// A likely-area label is a fixed-width block anchored on its
// region — the region IS the honest anchor, so the label may move
// inside its own region but never outside it. Placement is two
// passes over live geometry (the layer measures the real tooltip
// sizes and region boxes; nothing here is estimated):
// - Pass 1: a label that fits at its region's CENTRE stays there,
//   first in group order wins against pills and earlier labels.
// - Pass 2: a label that does not fit at centre is RE-PLACED —
//   the nearest clear anchor inside its own region, nearest the
//   centre first, so movement is minimal and the chip still sits
//   on the region it names. The Kelly County extent label goes
//   first in pass 2 (R3b requires it visible at island zoom);
//   the rest follow in group order.
// - A label with no clear anchor anywhere in its region is
//   suppressed, never moved off its region — the same precedent
//   as the geo pills and the pin labels in this file. At island
//   zoom that is unavoidable for some labels: 17 fixed-width
//   labels and 5 county pills cannot all fit a 390px viewport
//   (measured live 2026-11-26: 7 of 17 show, 0px² overlap).
//   Suppression is reversible: the layer re-runs the pass on every
//   moveend/zoomend, so a label returns as soon as the geometry
//   frees up (zoom in and all 17 show). The rect itself always
//   stays drawn — only the label chip is hidden, and the op stays
//   reachable via Find / Ask / Journal.

export interface LikelyAreaLabelCandidate {
  /** Group key (groupLikelyAreas key) — the caller maps it back. */
  key: string;
  /** The label's live screen size in px (the fixed CSS width, and
   *  the measured height — the height is content-dependent, so
   *  only the live measurement is true). */
  width: number;
  height: number;
  /** The region's centre in container points (the honest anchor,
   *  and the pass-1 position). */
  centre: { x: number; y: number };
  /** The region's screen box in container points — the pass-2
   *  search area. The anchor never leaves this box. */
  region: GeoLabelRect;
  /** True for the Kelly County extent group: R3b requires that
   *  label visible at island zoom, so it goes first in pass 2. */
  isPriority?: boolean;
}

/** The gap convention, shared with placeGeoLabels in this file: 4px
 *  horizontal, 2px vertical between neighbouring chips. */
const LIKELY_AREA_LABEL_GAP_X_PX = 4;
const LIKELY_AREA_LABEL_GAP_Y_PX = 2;

/** Pass-2 anchor grid step in px. 10px finds the live slots
 *  (measured 2026-11-26) while keeping the candidate count small. */
const LIKELY_AREA_ANCHOR_STEP_PX = 10;

/** Pass-2 never searches further than this from the centre: at
 *  close zoom a region's screen box is thousands of px across,
 *  and the grid over the whole box would be unbounded — while the
 *  slot that clears a pill is always nearby (a pill is ~32px). */
const LIKELY_AREA_SEARCH_RADIUS_PX = 300;

/** The chosen anchor per group key, in container points — or null
 *  when the label is suppressed (no clear anchor in its region). */
export type LikelyAreaPlacements = Map<
  string,
  { x: number; y: number } | null
>;

function likelyAreaLabelBox(
  anchor: { x: number; y: number },
  width: number,
  height: number,
): GeoLabelRect {
  return {
    left: anchor.x - width / 2,
    right: anchor.x + width / 2,
    top: anchor.y - height / 2,
    bottom: anchor.y + height / 2,
  };
}

/**
 * Where each likely-area label anchors: its region's centre when
 * that fits, the nearest clear anchor inside its own region when
 * it does not, null when no anchor in the region clears the geo
 * pills, the already-placed labels and the viewport. All rects
 * are in the same space (container points); the viewport is the
 * map container's size. Two passes: pass 1 keeps centre-fitting
 * labels exactly on centre (group order); pass 2 re-places the
 * rest, priority group first, nearest clear anchor first.
 */
export function placeLikelyAreaLabels(
  candidates: readonly LikelyAreaLabelCandidate[],
  geoPillRects: readonly GeoLabelRect[],
  viewport: { width: number; height: number },
): LikelyAreaPlacements {
  const placements: LikelyAreaPlacements = new Map();
  const placedRects: GeoLabelRect[] = [];
  const overlaps = (rect: GeoLabelRect, other: GeoLabelRect) =>
    rect.left < other.right + LIKELY_AREA_LABEL_GAP_X_PX &&
    rect.right > other.left - LIKELY_AREA_LABEL_GAP_X_PX &&
    rect.top < other.bottom + LIKELY_AREA_LABEL_GAP_Y_PX &&
    rect.bottom > other.top - LIKELY_AREA_LABEL_GAP_Y_PX;
  const boxFits = (box: GeoLabelRect) =>
    box.left >= 0 &&
    box.right <= viewport.width &&
    box.top >= 0 &&
    box.bottom <= viewport.height &&
    !geoPillRects.some((pill) => overlaps(box, pill)) &&
    !placedRects.some((placed) => overlaps(box, placed));

  // Pass 1 — the centre, in group order.
  const suppressed: LikelyAreaLabelCandidate[] = [];
  for (const candidate of candidates) {
    const box = likelyAreaLabelBox(
      candidate.centre,
      candidate.width,
      candidate.height,
    );
    if (boxFits(box)) {
      placements.set(candidate.key, { ...candidate.centre });
      placedRects.push(box);
    } else {
      suppressed.push(candidate);
    }
  }

  // Pass 2 — re-place inside the region, nearest the centre first.
  // The priority group (Kelly County extent, R3b) goes first; the
  // rest follow in group order.
  const pass2 = [
    ...suppressed.filter((candidate) => candidate.isPriority),
    ...suppressed.filter((candidate) => !candidate.isPriority),
  ];
  for (const candidate of pass2) {
    const anchor = nearestClearAnchor(candidate, boxFits);
    if (anchor) {
      placements.set(candidate.key, anchor);
      placedRects.push(
        likelyAreaLabelBox(anchor, candidate.width, candidate.height),
      );
    } else {
      placements.set(candidate.key, null);
    }
  }
  // Labels that fit at centre were set in pass 1; every suppressed
  // label is set in pass 2 (anchor or null) — the map is complete.
  return placements;
}

/**
 * The nearest anchor to the region's centre, inside the region
 * box, whose label box fits (viewport + pills + placed labels).
 * Anchors are tried on a 10px grid ordered by distance from the
 * centre, so movement is minimal; the search never leaves the
 * region box or a 300px radius around the centre.
 */
function nearestClearAnchor(
  candidate: LikelyAreaLabelCandidate,
  boxFits: (box: GeoLabelRect) => boolean,
): { x: number; y: number } | null {
  const { centre, region } = candidate;
  const minX = Math.max(
    region.left,
    centre.x - LIKELY_AREA_SEARCH_RADIUS_PX,
  );
  const maxX = Math.min(
    region.right,
    centre.x + LIKELY_AREA_SEARCH_RADIUS_PX,
  );
  const minY = Math.max(
    region.top,
    centre.y - LIKELY_AREA_SEARCH_RADIUS_PX,
  );
  const maxY = Math.min(
    region.bottom,
    centre.y + LIKELY_AREA_SEARCH_RADIUS_PX,
  );
  const points: { x: number; y: number; d: number }[] = [];
  for (let x = minX; x <= maxX; x += LIKELY_AREA_ANCHOR_STEP_PX) {
    for (let y = minY; y <= maxY; y += LIKELY_AREA_ANCHOR_STEP_PX) {
      points.push({ x, y, d: Math.hypot(x - centre.x, y - centre.y) });
    }
  }
  // The centre itself is a candidate too (it was tried in pass 1
  // and failed, but it anchors the sort); nearest first keeps the
  // movement minimal.
  points.sort((a, b) => a.d - b.d);
  for (const point of points) {
    const box = likelyAreaLabelBox(point, candidate.width, candidate.height);
    if (boxFits(box)) return { x: point.x, y: point.y };
  }
  return null;
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
