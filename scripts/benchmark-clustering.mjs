// Clustering benchmark — v0.30.0 map lane.
//
// Compares the app's own grid clustering (src/features/map/spatial.ts
// clusterPlaces) against mapbox/supercluster on the SAME real catalogue
// and the SAME cameras, so the adopt/keep decision is evidence, not
// taste. Leaflet.markercluster needs a live Leaflet map + DOM, so it
// is benchmarked separately in the browser probe
// (scripts/check-v030-markercluster-probe.mjs).
//
// Run: node scripts/benchmark-clustering.mjs
// (tsx handles the .ts imports via the repo's tsx dependency.)
// Exit 0, prints a table. No files written, no network.
/* global performance */
import { readFileSync } from 'node:fs';
import Supercluster from 'supercluster';
import { catalogueFromSnapshot } from '../src/data/catalogue.ts';
import {
  buildSpatialIndex,
  clusterPlaces,
  querySpatialIndex,
} from '../src/features/map/spatial.ts';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places = catalogueFromSnapshot(snapshot);
const positioned = places.filter(
  (p) => p.position && Number.isFinite(p.position.x) && Number.isFinite(p.position.y),
);
console.log(`catalogue: ${places.length} places, ${positioned.length} positioned`);

// Cameras: [name, bounds, leaflet zoom]. District/street bounds are the
// Vice City views the walks screenshot; island is INITIAL_BOUNDS.
const CAMERAS = [
  {
    name: 'island',
    bounds: { west: -10000, east: 3300, south: -8000, north: 9200 },
    leafletZoom: -2.5,
  },
  {
    name: 'district (Vice City)',
    bounds: { west: -2500, east: 2500, south: -2500, north: 1500 },
    leafletZoom: -2,
  },
  {
    name: 'street (downtown VC)',
    bounds: { west: -1100, east: 200, south: -900, north: 300 },
    leafletZoom: 1,
  },
];

// Supercluster works in lng/lat with a Mercator projection, so the game
// coords are scaled into the Mercator-safe range (uniform scale, so
// relative geometry is preserved). Tile zoom = leaflet zoom + 5, the
// same mapping gtadbTileUrl uses. Radius 30px matches our 60px grid
// cell (a cluster's diameter); extent 512 is supercluster's default.
const toLng = (x) => x / 200;
const toLat = (y) => y / 200;
const features = positioned.map((p) => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [toLng(p.position.x), toLat(p.position.y)],
  },
  properties: { id: p.id },
}));

const timeit = (fn, runs = 21) => {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
};

const index = buildSpatialIndex(places);
const heapBefore = process.memoryUsage().heapUsed;
const indexStart = performance.now();
const sc = new Supercluster({ radius: 30, maxZoom: 6, minZoom: 0, extent: 512 });
sc.load(features);
const indexMs = performance.now() - indexStart;
const heapAfter = process.memoryUsage().heapUsed;
console.log(
  `index build: supercluster load ${indexMs.toFixed(1)} ms, heap +${((heapAfter - heapBefore) / 1024 / 1024).toFixed(1)} MB`,
);

for (const camera of CAMERAS) {
  const visible = querySpatialIndex(index, camera.bounds);
  const tileZoom = camera.leafletZoom + 5;
  const oursMs = timeit(() =>
    clusterPlaces(visible, { zoom: camera.leafletZoom, enabled: true, maxMarkers: 120 }),
  );
  const ours = clusterPlaces(visible, {
    zoom: camera.leafletZoom,
    enabled: true,
    maxMarkers: 120,
  });
  const oursSingles = ours.filter((g) => g.places.length === 1).length;
  const oursClusters = ours.length - oursSingles;
  const bbox = [
    toLng(camera.bounds.west),
    toLat(camera.bounds.south),
    toLng(camera.bounds.east),
    toLat(camera.bounds.north),
  ];
  const scMs = timeit(() => sc.getClusters(bbox, tileZoom));
  const scResult = sc.getClusters(bbox, tileZoom);
  const scClusters = scResult.filter((f) => f.properties.cluster);
  const scPoints = scResult.length - scClusters.length;
  console.log(
    `\n${camera.name} (leaflet ${camera.leafletZoom}, tile ${tileZoom}): ${visible.length} visible`,
  );
  console.log(
    `  ours (clusterPlaces): ${oursMs.toFixed(2)} ms median — ${ours.length} groups (${oursClusters} clusters + ${oursSingles} singles, capped at 120 DOM markers)`,
  );
  console.log(
    `  supercluster:         ${scMs.toFixed(2)} ms median — ${scResult.length} returned (${scClusters.length} clusters + ${scPoints} points, uncapped)`,
  );
}
