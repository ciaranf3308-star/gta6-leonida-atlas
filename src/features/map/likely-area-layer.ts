// Likely-area regions on the map — v0.32 gang-op lane 1.
//
// The Leaflet half (thin, like isolation-layer.ts). The pure half —
// resolution, labels, grouping, measurement — is likely-area.ts, so
// the contract is unit-testable without a map. The placement rule
// (which labels may show) is the pure placeLikelyAreaLabels() in
// label-placement.ts; this file only measures live rects and hides
// what it decides.
//
// One dashed-outline rectangle per group of ops sharing an extent
// (groupLikelyAreas), faintly filled so it reads as a region, with a
// permanent centred label naming every op in it + "likely area"
// (+ the county-estimate suffix when the extent is a county's).
// No icon, no point, non-interactive: a region is not a pin and
// tapping it opens nothing — the op is reached via Find / Ask /
// Journal. A region never becomes a pin on zoom: the effect that
// adds these layers has no zoom dependency, and the places behind
// them have no position for the marker pipeline to pin.
//
// v0.32 regions fix (lane 1): the labels are fixed-width blocks
// (LIKELY_AREA_LABEL_WIDTH_PX, map.css) and collision-checked —
// against the geo-label pills and against each other, first in
// group order wins, the rest suppressed (display:none on the
// tooltip element, never unbound, so a later pan/zoom can bring
// one back). The rect itself always stays drawn; only the chip
// hides. The pass re-runs on every moveend/zoomend, and every pass
// starts by un-hiding all labels, so each pass is a fresh decision
// on live geometry — a label suppressed at island zoom returns
// the moment the player zooms into room for it.
import L from 'leaflet';
import type { LikelyAreaGroup } from './likely-area';
import {
  placeLikelyAreaLabels,
  type GeoLabelRect,
  type LikelyAreaLabelCandidate,
} from './label-placement';

export const LIKELY_AREA_TOOLTIP_CLASS = 'likely-area-label';

/** The label's real width in px — map.css
 *  (.leaflet-tooltip.likely-area-label) sets exactly this. A fixed
 *  width, not a max-width: Leaflet's tooltip pane shrink-wraps, so
 *  max-width alone collapsed the 8-name Kelly label to a 68px-wide
 *  one-word-per-line column (DEMOS-GANGOP Finding 1). The CSS
 *  value and this constant must stay in sync — the unit test
 *  reads the CSS and compares. */
export const LIKELY_AREA_LABEL_WIDTH_PX = 200;

/** Soft red for a likely area: distinct from the lootable red
 *  (#ff5c5c) by tint, and from every pin by the dash + the fill. */
export const LIKELY_AREA_COLOR = '#ff8f8f';

interface LikelyAreaTooltip {
  key: string;
  /** The live tooltip element (undefined until Leaflet lays it out). */
  element: () => HTMLElement | undefined;
}

function rectOf(el: Element): GeoLabelRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

export function addLikelyAreaLayers(
  map: L.Map,
  groups: readonly LikelyAreaGroup[],
): () => void {
  const added: L.Layer[] = [];
  const tooltips: LikelyAreaTooltip[] = [];
  for (const group of groups) {
    const rect = L.rectangle(
      [
        [group.bounds.south, group.bounds.west],
        [group.bounds.north, group.bounds.east],
      ],
      {
        color: LIKELY_AREA_COLOR,
        weight: 1.5,
        opacity: 0.85,
        dashArray: '6 4',
        fill: true,
        fillColor: LIKELY_AREA_COLOR,
        fillOpacity: 0.06,
        interactive: false,
      },
    ).bindTooltip(group.label, {
      permanent: true,
      direction: 'center',
      className: LIKELY_AREA_TOOLTIP_CLASS,
      interactive: false,
    });
    // The bounds are game units in this app's CRS.Simple mapping
    // (lat = y, lng = x), so [south, west] / [north, east] are the
    // rectangle's corners unchanged — the same pair order as
    // leafletBounds() in MapView.
    added.push(rect.addTo(map));
    const tooltip = rect.getTooltip();
    if (tooltip) {
      tooltips.push({
        key: group.key,
        element: () => tooltip.getElement(),
      });
    }
  }

  let disposed = false;
  let frame = 0;
  const runPlacement = () => {
    if (disposed) return;
    // Un-hide first: a pan/zoom may have freed space, and a hidden
    // tooltip measures 0×0 — every pass is a fresh decision.
    for (const tooltip of tooltips) {
      const el = tooltip.element();
      if (el) el.style.display = '';
    }
    // Defer a frame: Leaflet repositions tooltips and the geo
    // effect re-renders its pills synchronously inside the
    // moveend/zoomend dispatch, and this handler was registered
    // before the geo render — measuring in this frame would read
    // the old pill positions. A frame later both have settled.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (disposed) return;
      const container = map.getContainer();
      const pillRects: GeoLabelRect[] = Array.from(
        container.querySelectorAll('.atlas-geo-label'),
        rectOf,
      );
      const candidates: LikelyAreaLabelCandidate[] = [];
      for (const tooltip of tooltips) {
        const el = tooltip.element();
        if (el) candidates.push({ key: tooltip.key, rect: rectOf(el) });
      }
      const kept = placeLikelyAreaLabels(candidates, pillRects);
      for (const tooltip of tooltips) {
        const el = tooltip.element();
        if (el && !kept.has(tooltip.key)) el.style.display = 'none';
      }
    });
  };

  runPlacement();
  map.on('moveend zoomend', runPlacement);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    map.off('moveend zoomend', runPlacement);
    for (const layer of added) layer.remove();
  };
}
