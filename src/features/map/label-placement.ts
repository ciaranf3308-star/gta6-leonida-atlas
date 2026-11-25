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
}

export type LabelPlacement = 'left' | 'right';

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
    const labelWidth = labelWidthFor(candidate.title);
    const hasPinToTheRight = allPoints.some(
      (other, oi) =>
        oi !== candidate.index &&
        Math.abs(other.y - candidate.point.y) < 28 &&
        other.x > candidate.point.x &&
        other.x - candidate.point.x < 90,
    );
    const side = decideLabelSide(
      candidate.point,
      labelWidth,
      geometry,
      hasPinToTheRight,
    );
    if (side === 'none') continue;
    const rect = {
      left:
        side === 'left'
          ? candidate.point.x - 10 - labelWidth
          : candidate.point.x + 10,
      right:
        side === 'left'
          ? candidate.point.x - 10
          : candidate.point.x + 10 + labelWidth,
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
    placed.set(candidate.index, side);
    placedRects.push(rect);
  }
  return placed;
}
