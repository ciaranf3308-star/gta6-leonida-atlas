// Chrome-geometry calibration probe — v0.30.0 map lane.
//
// Reports the ACTUAL on-screen rects of every chrome element that
// overlays the map, at phone and desktop viewports, so the measured-
// geometry module can be calibrated to reproduce the current
// hardcoded exclusions (topChrome 200/162, pill 99x48, edge stack)
// on standard layouts — and follow real geometry when the layout
// changes. Run against the current dist/ build.
//
// Run: node scripts/check-v030-geometry-calibration.mjs
/* global document, getComputedStyle */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const BASE_PATH = '/gta6-leonida-atlas/';
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4331');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice(BASE_PATH.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4331, resolve));

const SELECTORS = [
  '.atlas-map-view',
  '.atlas-map-canvas',
  '.map-hero',
  '.map-hero-banner',
  '.map-search-pill',
  '.map-chips',
  '.atlas-map-illustration-note',
  '.atlas-edge-stack',
  '.atlas-edge-zoom',
  '.atlas-map-navigation',
  '.atlas-map-attribution',
  '.bottom-nav',
  '.empty-map-prompt',
];

const browser = await chromium.launch();
for (const viewport of [
  { width: 390, height: 844, deviceScaleFactor: 2, label: 'phone 390x844 DPR2' },
  { width: 1280, height: 800, deviceScaleFactor: 1, label: 'desktop 1280x800' },
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:4331${BASE_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-map-canvas .leaflet-tile-loaded', { timeout: 30000 });
  await page.waitForTimeout(800);
  const rects = await page.evaluate((selectors) => {
    const out = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[sel] = {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
        display: cs.display,
        visible: r.width > 0 && r.height > 0,
      };
    }
    return out;
  }, SELECTORS);
  console.log(`\n=== ${viewport.label} ===`);
  for (const [sel, r] of Object.entries(rects)) {
    console.log(
      `  ${sel}: ${r ? `x${r.x} y${r.y} ${r.w}x${r.h} bottom${r.bottom} right${r.right} display=${r.display}` : 'absent'}`,
    );
  }
  await page.close();
}
await browser.close();
server.close();
