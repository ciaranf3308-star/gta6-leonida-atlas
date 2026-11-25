// Marker icons — v0.30.0 map lane.
//
// Moved verbatim out of MapView.tsx (which carried them inline
// alongside 1,000+ lines of map lifecycle). No behaviour change:
// a cluster is a small icon pin with a count badge, a single place
// is a GTA blip (white pictogram in the layer-coloured roundel),
// unnamed "?" pins wear is-unnamed, and every pin's hit area is
// 48px with the visible face centred inside it.
import L from 'leaflet';
import type { LayerDefinition, Place } from '../../domain/types';
import type { PlaceCluster } from './spatial';

export function markerIcon(
  group: PlaceCluster,
  layer: LayerDefinition | undefined,
  selected: boolean,
  color?: string,
  found?: boolean,
  highlighted?: boolean,
  iconSvg?: string,
  clusterIconSvg?: string,
  explored?: boolean,
): L.DivIcon {
  const cluster = group.places.length > 1;
  const content = document.createElement('span');
  content.className = cluster ? 'atlas-cluster-face' : 'atlas-pin-face';
  content.style.setProperty('--pin-color', color ?? layer?.style.color ?? '#e8823a');
  content.setAttribute('aria-hidden', 'true');
  // Unnamed "?" pins wear the is-unnamed class: small, quiet, never
  // labelled — the street-zoom noise was dozens of full-size black
  // roundels with long "?, Downtown, Vice City" pills.
  const unnamed = group.places[0]?.title?.startsWith('?') ?? false;
  if (cluster) {
    // v0.16.0: a cluster is a small icon pin, not a giant pink number.
    // It wears its best member's glyph (named first, enterable next)
    // and carries the count as one tiny badge — the reference never
    // shows a number as the whole marker.
    content.innerHTML = clusterIconSvg ?? '';
    const badge = document.createElement('span');
    badge.className = 'atlas-cluster-count';
    badge.textContent = group.places.length > 99 ? '99+' : String(group.places.length);
    content.append(badge);
  } else {
    // A GTA blip: white pictogram in the layer-coloured roundel — never a
    // bare coloured dot. Found places keep their glyph and gain a tick.
    content.innerHTML = iconSvg ?? '';
    if (found) {
      const badge = document.createElement('span');
      badge.className = 'atlas-found-badge';
      badge.textContent = '✓';
      content.append(badge);
    }
  }
  // The hit area is 48px on every pin — a thumb-sized target, not the
  // 24px roundel. The visible blip face stays 28px (38px for clusters)
  // centred inside it, via map.css. The map still shows the same pins.
  const size = 48;
  return L.divIcon({
    html: content,
    className: `atlas-map-marker ${cluster ? 'is-cluster' : ''} ${selected ? 'is-selected' : ''} ${found && !cluster ? 'is-found' : ''} ${explored && !found && !cluster ? 'is-explored' : ''} ${highlighted ? 'is-highlighted' : ''} ${group.places[0]?.layerId === 'regions' ? 'is-region' : ''} ${unnamed ? 'is-unnamed' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function markerColor(place: Place): string | undefined {
  const tag = place.tags.find((tag) => tag.startsWith('color:'));
  return tag?.slice('color:'.length);
}
