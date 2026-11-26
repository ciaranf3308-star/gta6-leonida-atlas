// Area isolation layer — v0.30.0 map lane.
//
// Moved verbatim out of MapView.tsx's isolation effect. No behaviour
// change: the surrounding counties desaturate (a dim mask over
// everything outside the isolated area, cut to the traced land
// rings when county geo is available), plus a delicate boundary
// line — the coastline solid ivory, the estimated rect edges
// dashed. The mask's outer ring is the full TILE bounds, not the
// app bounds, so a wide county fitted into a portrait phone shows
// no lit strip past the app edge.
//
// Returns the cleanup that removes every layer this call added.
import L from 'leaflet';
import { GTADB_TILE_BOUNDS } from './gtadb-tiles';
import { runToLatLngs, type AfterHoursGeo } from './after-hours-geo';
import type { Isolation } from './isolation';
import {
  ESTIMATED_EXTENT_TOOLTIP_CLASS,
  ESTIMATED_EXTENT_TOOLTIP_TEXT,
} from './isolation-label';

export function addIsolationLayers(
  map: L.Map,
  isolation: Isolation,
  geo: AfterHoursGeo | null,
): () => void {
  const outer: L.LatLngExpression[] = [
    [GTADB_TILE_BOUNDS.south, GTADB_TILE_BOUNDS.west],
    [GTADB_TILE_BOUNDS.south, GTADB_TILE_BOUNDS.east],
    [GTADB_TILE_BOUNDS.north, GTADB_TILE_BOUNDS.east],
    [GTADB_TILE_BOUNDS.north, GTADB_TILE_BOUNDS.west],
  ];
  const added: L.Layer[] = [];
  const countyGeo = isolation.countyId ? geo?.counties[isolation.countyId] : undefined;
  if (countyGeo && countyGeo.loops.length > 0) {
    const mask = L.polygon(
      [outer, ...countyGeo.loops.map((loop) => runToLatLngs(loop))],
      {
        color: '#0b1018',
        weight: 0,
        fillColor: '#0b1018',
        fillOpacity: 0.55,
        interactive: false,
      },
    ).addTo(map);
    added.push(mask);
    for (const run of countyGeo.coast) {
      const latlngs = runToLatLngs(run);
      added.push(
        L.polyline(latlngs, {
          color: '#0b1018',
          weight: 4,
          opacity: 0.5,
          interactive: false,
        }).addTo(map),
      );
      added.push(
        L.polyline(latlngs, {
          color: '#f6f0e5',
          weight: 2,
          opacity: 0.9,
          interactive: false,
        }).addTo(map),
      );
    }
    for (const run of countyGeo.estimate) {
      const latlngs = runToLatLngs(run);
      added.push(
        L.polyline(latlngs, {
          color: '#0b1018',
          weight: 3.5,
          opacity: 0.4,
          interactive: false,
        }).addTo(map),
      );
      added.push(
        L.polyline(latlngs, {
          color: '#f6f0e5',
          weight: 1.5,
          opacity: 0.75,
          dashArray: '5 5',
          interactive: false,
        }).addTo(map),
      );
    }
  } else {
    const b = isolation.bounds;
    const hole: L.LatLngExpression[] = [
      [b.south, b.west],
      [b.south, b.east],
      [b.north, b.east],
      [b.north, b.west],
    ];
    added.push(
      L.polygon([outer, hole], {
        color: '#0b1018',
        weight: 0,
        fillColor: '#0b1018',
        fillOpacity: 0.55,
        interactive: false,
      }).addTo(map),
    );
    // §6.2: town/city/area isolation keeps the rect outline — the
    // dashed edge marks the estimated extent (the member bbox),
    // an extent indicator, not a boundary line. No boundary lines
    // are drawn anywhere; counties keep their traced coastline
    // above (real geography). The rect carries a permanent
    // "estimated extent" label (step 5, §6.1: an estimate is
    // labelled as such everywhere it is shown) — a dark chip that
    // matches the map chrome, never Leaflet's default pale tooltip.
    const rect = L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      {
        color: '#f6f0e5',
        weight: 1,
        opacity: 0.65,
        dashArray: '5 5',
        fill: false,
        interactive: false,
      },
    ).bindTooltip(ESTIMATED_EXTENT_TOOLTIP_TEXT, {
      permanent: true,
      direction: 'center',
      className: ESTIMATED_EXTENT_TOOLTIP_CLASS,
      interactive: false,
    });
    added.push(rect.addTo(map));
  }
  return () => {
    for (const layer of added) layer.remove();
  };
}
