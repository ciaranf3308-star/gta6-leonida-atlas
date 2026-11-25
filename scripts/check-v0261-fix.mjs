// v0.26.1 urgent-fix probe (390px, DPR 2). Verifies the three
// v0.26 re-review items: (1) clouds reverted to v0.25 strength —
// hills and Keys at the zoom-out camera must show the map filling
// the frame, no white-out; (2) the 9 Map Index groups are first in
// the Layers sheet — the first group title reads without scrolling;
// (3) no marker overlaps the zoom pill at the L2227 downtown
// max-zoom camera with everything on. Served from dist/ on 4331.
// Exits non-zero if any check fails.
/* global document, getComputedStyle */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0261-walk/';
mkdirSync(OUT, { recursive: true });
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.url()} ${res.status()}`);
});

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const nav = (label) => page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
const base = 'http://localhost:4331/gta6-leonida-atlas/';

const skipOnboarding = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};
const closePlaceSheet = async () => {
  const close = page.getByRole('button', { name: 'Close place details' });
  if (await close.isVisible({ timeout: 5000 }).catch(() => false)) {
    await close.click();
    await page.waitForTimeout(600);
  }
};
const zoomOut = async (n) => {
  for (let i = 0; i < n; i++) {
    const btn = page.getByRole('button', { name: 'Zoom out' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(350);
  }
};
const zoomInToMax = async () => {
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: 'Zoom in' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(350);
  }
};
// Cloud strength, measured from the spans themselves: max lobe
// alpha parsed from the computed gradients, and the share of the
// viewport the spans cover. v0.26 (broken): max alpha 0.98, spans
// 320–480px wide covering the whole map. v0.25 (known good): max
// alpha 0.60, spans 240–380px. The screenshots are the real check;
// this is the objective gate.
const cloudStats = async () =>
  page.evaluate(() => {
    const spans = [...document.querySelectorAll('.atlas-clouds span')];
    const layer = document.querySelector('.atlas-clouds');
    const layerOpacity = layer ? getComputedStyle(layer).opacity : '0';
    const alphas = [];
    for (const el of spans) {
      const bg = getComputedStyle(el).backgroundImage;
      for (const m of bg.matchAll(/rgba\(255, 255, 255, ([0-9.]+)\)/g)) alphas.push(Number(m[1]));
    }
    const coverage = spans.reduce((sum, el) => {
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, 390) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, 844) - Math.max(r.top, 0));
      return sum + w * h;
    }, 0) / (390 * 844);
    return { count: spans.length, layerOpacity, maxAlpha: alphas.length ? Math.max(...alphas) : 0, coverage: +coverage.toFixed(3) };
  });

// (1a) Northern hills at the zoom-out camera: ?place=L530, close
// the sheet, zoom out 3 — the exact camera the v0.26 review
// caught drowning in white blobs.
await page.goto(`${base}?place=L530`, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForTimeout(1500);
await closePlaceSheet();
await zoomOut(3);
await page.waitForTimeout(1200);
const hillsClouds = await cloudStats();
check('hills: clouds at v0.25 strength (max lobe alpha <= 0.6)', hillsClouds.maxAlpha <= 0.6, JSON.stringify(hillsClouds));
await shot('hills-z3');
const hillsTiles = await page.locator('.leaflet-tile-loaded[src*="tiles/vicewire-v3/"]').count();
check('hills: map tiles loaded across the frame', hillsTiles >= 20, `tiles=${hillsTiles}`);

// (1b) The Keys at the same camera.
await page.goto(`${base}?place=L269`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await closePlaceSheet();
await zoomOut(3);
await page.waitForTimeout(1200);
const keysClouds = await cloudStats();
check('keys: clouds at v0.25 strength (max lobe alpha <= 0.6)', keysClouds.maxAlpha <= 0.6, JSON.stringify(keysClouds));
await shot('keys-z3');

// (2) Layers sheet: the 9 Map Index groups first — the first group
// title must sit above the sheet's bottom edge on open, with no
// scrolling.
await page.goto(base, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForTimeout(1200);
// The first-open region sheet is up on a fresh profile — close it
// first, the way a user would, or it stacks on top of the Layers
// sheet and the rect checks go vacuous (the sheet underneath still
// measures "visible" while covered).
await closePlaceSheet();
await nav('Layers').click();
await page.waitForTimeout(800);
const layersFirst = await page.evaluate(() => {
  const sheet = document.querySelector('.sidebar.is-layers-sheet');
  const firstTitle = document.querySelector('.layer-group-title');
  const countyHeading = [...document.querySelectorAll('.county-cards h3')].map((el) => el.textContent?.trim());
  if (!sheet || !firstTitle) return { ok: false, detail: 'sheet or group title missing' };
  const s = sheet.getBoundingClientRect();
  const t = firstTitle.getBoundingClientRect();
  const groupTitles = [...document.querySelectorAll('.layer-group-title')].map((el) => el.textContent?.trim());
  return {
    sheetBottom: Math.round(s.bottom),
    firstTitleTop: Math.round(t.top),
    firstTitleBottom: Math.round(t.bottom),
    visibleWithoutScroll: t.bottom <= s.bottom - 4,
    firstGroup: groupTitles[0],
    firstNine: groupTitles.slice(0, 9),
    groupCount: groupTitles.length,
    countyHeading: countyHeading[0],
  };
});
check('layers: first Map Index group reads without scrolling', layersFirst.visibleWithoutScroll === true, JSON.stringify(layersFirst));
// groupSection is also used for My markers + Unverified, so the
// sheet has 11 group titles; the first 9 must be the Map Index
// groups, in the game's order.
const MAP_INDEX_NAMES = ['Personal', 'Story', 'Robberies', 'Activities', 'Exploration', 'Vehicles', 'Weapons', 'Style', 'Food & Drink'];
check(
  'layers: first 9 group titles are the Map Index groups in order',
  layersFirst.groupCount === 11 &&
    JSON.stringify(layersFirst.firstNine) === JSON.stringify(MAP_INDEX_NAMES),
  `groups=${layersFirst.groupCount} firstNine=${JSON.stringify(layersFirst.firstNine)}`,
);
await shot('layers-sheet-open');

// (3) Downtown max zoom with everything on: no marker may overlap
// the zoom pill (the v0.26 violation was a 48px roundel at
// (328, 559) behind the pill's top edge).
await page.goto(base, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Show everything/i }).click();
await page.waitForTimeout(1500);
await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await closePlaceSheet();
await zoomInToMax();
await page.waitForTimeout(1500);
const pillCheck = await page.evaluate(() => {
  const pill = document.querySelector('.atlas-edge-zoom');
  if (!pill) return { ok: false, detail: 'no zoom pill' };
  const pr = pill.getBoundingClientRect();
  const markers = [...document.querySelectorAll('.atlas-map-marker')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const overlaps = markers.filter(
    (m) => m.x < pr.right && m.x + m.w > pr.left && m.y < pr.bottom && m.y + m.h > pr.top,
  );
  return {
    pill: { left: Math.round(pr.left), top: Math.round(pr.top), right: Math.round(pr.right), bottom: Math.round(pr.bottom) },
    markerCount: markers.length,
    overlaps,
  };
});
check('downtown max zoom: 0 markers overlap the zoom pill', pillCheck.overlaps.length === 0, JSON.stringify(pillCheck));
check('downtown max zoom: markers on screen', (pillCheck.markerCount ?? 0) > 0, `markers=${pillCheck.markerCount}`);
await shot('downtown-max-everything-on');

check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));
// Fly-cancelled tile loads (Leaflet aborts superseded requests
// during zoom animation) and by-design ocean-row 404s are
// tolerated, as in the v0.26 app walk.
const realFailures = failedRequests.filter(
  (f) => !f.includes('tiles/ocean.jpg') && !f.includes('ERR_ABORTED'),
);
check('zero failed requests (except ocean-row 404s + fly-cancelled loads)', realFailures.length === 0, realFailures.join(' | ').slice(0, 300));

await browser.close();
server.close();
console.log(failures.length ? `\nWALK FAILED (${failures.length})` : '\nWALK PASSED');
process.exit(failures.length ? 1 : 0);
