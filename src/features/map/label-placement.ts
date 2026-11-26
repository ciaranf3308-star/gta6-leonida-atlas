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
