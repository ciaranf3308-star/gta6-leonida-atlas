// Leaflet.markercluster browser probe — v0.30.0 map lane.
//
// markercluster needs a live Leaflet map + DOM, so it cannot be
// benchmarked in node like supercluster (scripts/benchmark-
// clustering.mjs). This probe serves a minimal Leaflet page from the
// repo itself, loads the SAME 3,682 positioned catalogue places, and
// measures cluster formation + DOM nodes at the SAME three cameras,
// so the numbers are comparable to our custom implementation.
//
// Run: node scripts/check-v030-markercluster-probe.mjs
// Exit 0 prints the table; exits 1 if the probe page errors.
/* global window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
};
const ALLOWED = [
  '/node_modules/leaflet/dist/leaflet.js',
  '/node_modules/leaflet/dist/leaflet.css',
  '/node_modules/leaflet.markercluster/dist/leaflet.markercluster.js',
  '/node_modules/leaflet.markercluster/dist/MarkerCluster.css',
  '/public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
];

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/leaflet/dist/leaflet.css">
<link rel="stylesheet" href="/node_modules/leaflet.markercluster/dist/MarkerCluster.css">
<style>html,body{margin:0;height:100%}#map{width:390px;height:844px}</style>
</head><body><div id="map"></div>
<script src="/node_modules/leaflet/dist/leaflet.js"></script>
<script src="/node_modules/leaflet.markercluster/dist/leaflet.markercluster.js"></script>
<script>
window.__probe = (async () => {
  const res = await fetch('/public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json');
  const snap = await res.json();
  // The snapshot landmarks carry inGameCoordinates [x, y]; the app
  // normalises them through catalogueFromSnapshot, but for a
  // clustering probe the raw coordinates are the same points.
  const points = snap.landmarks
    .filter((lm) => Array.isArray(lm.inGameCoordinates) && lm.inGameCoordinates.length === 2)
    .map((lm) => ({ id: lm.id, x: lm.inGameCoordinates[0], y: lm.inGameCoordinates[1] }));
  const map = L.map('map', { crs: L.CRS.Simple, minZoom: -5, maxZoom: 1, zoomControl: false });
  map.fitBounds([[-8000, -10000], [9200, 3300]]);
  const group = L.markerClusterGroup({
    maxClusterRadius: 30,
    disableClusteringAtZoom: 1,
    chunkedLoading: false,
    animate: false,
    spiderfyOnMaxZoom: false,
  });
  const icon = L.divIcon({ className: 'probe-pin', iconSize: [48, 48], iconAnchor: [24, 24] });
  const t0 = performance.now();
  const markers = points.map((p) => L.marker([p.y, p.x], { icon }));
  group.addLayers(markers);
  map.addLayer(group);
  const addMs = performance.now() - t0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const atCamera = async (name, center, zoom) => {
    const s = performance.now();
    map.setView(center, zoom, { animate: false });
    await sleep(350);
    const ms = performance.now() - s;
    return {
      name,
      ms: Math.round(ms),
      domMarkers: document.querySelectorAll('.leaflet-marker-icon').length,
      clusters: group.getLayers().length,
    };
  };
  const results = {
    points: points.length,
    addLayersMs: Math.round(addMs),
    cameras: [
      await atCamera('island', [600, -3350], -2.5),
      await atCamera('district (Vice City)', [-500, 0], -2),
      await atCamera('street (downtown VC)', [-295, -465], 1),
    ],
  };
  window.__probeDone = true;
  return results;
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4332');
  if (url.pathname === '/probe') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
    return;
  }
  const path = decodeURIComponent(url.pathname);
  if (!ALLOWED.includes(path)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = join(ROOT, path);
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4332, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto('http://127.0.0.1:4332/probe');
await page.waitForFunction(() => window.__probeDone, null, { timeout: 30000 });
const results = await page.evaluate(() => window.__probe);
await browser.close();
server.close();

console.log(`markercluster probe: ${results.points} points, addLayers ${results.addLayersMs} ms`);
for (const cam of results.cameras) {
  console.log(
    `  ${cam.name}: settle ${cam.ms} ms, DOM marker nodes ${cam.domMarkers} (group holds ${cam.clusters} layers)`,
  );
}
if (errors.length > 0) {
  console.error('probe page errors:', errors);
  process.exit(1);
}
