// Leaflet.markercluster 2.0.0-beta.2 browser probe — v0.30.0 map lane.
//
// Same harness as scripts/check-v030-markercluster-probe.mjs (1.5.3),
// but against the beta the research lane recommends adopting, and with
// a second pass at maxClusterRadius 80: the only tuning knob that
// could bring the beta's DOM-node count under our hard 120 cap.
// If neither radius holds the cap, the adopt decision fails on
// measured numbers (see the report) and our custom clustering stays.
//
// Run: node scripts/check-v030-markercluster-beta-probe.mjs
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
  '/node_modules/leaflet.markercluster/dist/leaflet.markercluster-global.js',
  '/node_modules/leaflet.markercluster/dist/MarkerCluster.css',
  '/public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
];

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/leaflet/dist/leaflet.css">
<link rel="stylesheet" href="/node_modules/leaflet.markercluster/dist/MarkerCluster.css">
<style>html,body{margin:0;height:100%}#map{width:390px;height:844px}</style>
</head><body><div id="map"></div>
<script src="/node_modules/leaflet/dist/leaflet.js"></script>
<script src="/node_modules/leaflet.markercluster/dist/leaflet.markercluster-global.js"></script>
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
  const icon = L.divIcon({ className: 'probe-pin', iconSize: [48, 48], iconAnchor: [24, 24] });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const makeGroup = (radius) => {
    const group = L.markerClusterGroup({
      maxClusterRadius: radius,
      disableClusteringAtZoom: 1,
      chunkedLoading: false,
      animate: false,
      spiderfyOnMaxZoom: false,
    });
    const t0 = performance.now();
    group.addLayers(points.map((p) => L.marker([p.y, p.x], { icon })));
    map.addLayer(group);
    return { group, addMs: Math.round(performance.now() - t0) };
  };
  const atCamera = async (group, name, center, zoom) => {
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
  const runPass = async (radius) => {
    const { group, addMs } = makeGroup(radius);
    const cameras = [
      await atCamera(group, 'island', [600, -3350], -2.5),
      await atCamera(group, 'district (Vice City)', [-500, 0], -2),
      await atCamera(group, 'street (downtown VC)', [-295, -465], 1),
    ];
    map.removeLayer(group);
    return { radius, addLayersMs: addMs, cameras };
  };
  const results = {
    points: points.length,
    passes: [await runPass(30), await runPass(80), await runPass(120)],
  };
  window.__probeDone = true;
  return results;
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4333');
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
await new Promise((resolve) => server.listen(4333, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto('http://127.0.0.1:4333/probe');
await page.waitForFunction(() => window.__probeDone, null, { timeout: 30000 });
const results = await page.evaluate(() => window.__probe);
await browser.close();
server.close();

console.log(`markercluster 2.0.0-beta.2 probe: ${results.points} points`);
for (const pass of results.passes) {
  console.log(`  radius ${pass.radius}: addLayers ${pass.addLayersMs} ms`);
  for (const cam of pass.cameras) {
    console.log(
      `    ${cam.name}: settle ${cam.ms} ms, DOM marker nodes ${cam.domMarkers} (group holds ${cam.clusters} layers)`,
    );
  }
}
if (errors.length > 0) {
  console.error('probe page errors:', errors);
  process.exit(1);
}
