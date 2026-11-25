import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Position } from '../../domain/types';
import { toMapCoordinate } from '../map/coordinates';
import { GTADB_TILE_BOUNDS, gtadbTileUrl } from '../map/gtadb-tiles';
import { MAX_ZOOM, MIN_ZOOM } from '../map/coordinates';

/** The tile bounds as a Leaflet bounds expression (same as MapView's
 * local leafletBounds helper). */
function tileBounds(): L.LatLngBoundsExpression {
  return [
    [GTADB_TILE_BOUNDS.south, GTADB_TILE_BOUNDS.west],
    [GTADB_TILE_BOUNDS.north, GTADB_TILE_BOUNDS.east],
  ];
}

/**
 * The honest picture on a place card: a zoomed crop of the real
 * in-game map at the building's actual spot — the same sharp v0.20
 * tiles as the map itself, labelled as the map, never as a photo.
 * Non-interactive: no zoom, no drag, no markers to tap. The user can
 * replace it with his own screenshot ("Add your photo").
 */
export default function PlaceMapCrop({ position }: { position: Position }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const base = import.meta.env.BASE_URL ?? '/';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const map = L.map(host, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 1,
      zoomDelta: 1,
    });
    const tiles = L.tileLayer('', {
      tileSize: 256,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bounds: tileBounds(),
      errorTileUrl: `${base.endsWith('/') ? base : `${base}/`}assets/gta6-leonida-atlas/tiles/ocean.jpg`,
      noWrap: true,
      keepBuffer: 1,
    });
    tiles.getTileUrl = (coords: L.Coords) => gtadbTileUrl(base, coords.x, coords.y, coords.z);
    tiles.addTo(map);
    // Close in: Leaflet zoom 0 is tile zoom 5 — the building fills the
    // frame at phone width, the way a photo of it would.
    map.setView(toMapCoordinate(position), 0);
    const dot = L.marker(toMapCoordinate(position), {
      icon: L.divIcon({ className: 'place-crop-dot', iconSize: [14, 14], iconAnchor: [7, 7] }),
      interactive: false,
      keyboard: false,
    });
    dot.addTo(map);
    return () => {
      map.remove();
    };
    // Rebuild when the place changes — the crop is per place.
  }, [position.x, position.y]);

  return <div ref={hostRef} className="place-map-crop" aria-label="Map view of this spot" />;
}
