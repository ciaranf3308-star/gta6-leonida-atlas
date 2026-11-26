// Likely-area regions on the map — v0.32 gang-op lane 1.
//
// The Leaflet half (thin, like isolation-layer.ts). The pure half —
// resolution, labels, grouping, measurement — is likely-area.ts, so
// the contract is unit-testable without a map.
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
import L from 'leaflet';
import type { LikelyAreaGroup } from './likely-area';

export const LIKELY_AREA_TOOLTIP_CLASS = 'likely-area-label';

/** Soft red for a likely area: distinct from the lootable red
 *  (#ff5c5c) by tint, and from every pin by the dash + the fill. */
export const LIKELY_AREA_COLOR = '#ff8f8f';

export function addLikelyAreaLayers(
  map: L.Map,
  groups: readonly LikelyAreaGroup[],
): () => void {
  const added: L.Layer[] = [];
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
  }
  return () => {
    for (const layer of added) layer.remove();
  };
}
