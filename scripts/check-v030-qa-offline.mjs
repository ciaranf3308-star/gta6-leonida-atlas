// QA v0.30.0 — offline recovery (airplane-mode reload after a
// first visit):
//   (a1) offline reload after exactly ONE warm visit -> the map
//       must render. FINDING #3: it does NOT — the static about
//       page shows instead, because the 3D chunk
//       (walk-geography-yrqsL7gC.js) is modulepreloaded at startup
//       but is in APP_FILES, not CORE: install never precaches it,
//       and the first visit's preload fetch races ahead of the
//       not-yet-controlling SW, so it never lands in the cache.
//       Offline the chunk fails and startup never hydrates.
//   (a2) offline reload after TWO online visits -> the map renders
//       (the second visit's preload goes through the SW and caches
//       the chunk). This bounds the bug to first-visit-only.
//   (b) cold offline first visit -> browser offline page EXPECTED.
// Self-serves dist/ on port 4352.
/* global caches */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/qa-v030/';
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
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4352');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith('/gta6-leonida-atlas/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4352, resolve));
const base = 'http://127.0.0.1:4352/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const note = (msg) => console.log(`NOTE  ${msg}`);

const browser = await chromium.launch();
const skipAndClose = async (pg) => {
  const skip = pg.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await pg.waitForTimeout(800);
  }
  const close = pg.getByRole('button', { name: 'Close place details' });
  if ((await close.count()) > 0) {
    await close.first().click();
    await pg.waitForTimeout(800);
  }
};

// (a1) One warm visit, then offline reload.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  const failedReqs = [];
  page.on('requestfailed', (req) => failedReqs.push(req.url()));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(8000);
  const chunkCached = await page.evaluate(async () => {
    const cache = await caches.open('atlas-b40404d5-2d4898649a1e');
    return Boolean(await cache.match('/gta6-leonida-atlas/assets/walk-geography-yrqsL7gC.js'));
  });
  note(`(a1) after one warm visit: 3D chunk cached = ${chunkCached}`);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  const mapView = await page.locator('.atlas-map-view').count();
  check('(a1) offline reload after ONE visit renders the map', mapView > 0 && tiles > 0, `mapView=${mapView} tiles=${tiles}; failed: ${failedReqs.slice(0, 2).join(', ')}`);
  await page.screenshot({ path: `${OUT}offline-first-visit.png` });
  await context.close();
}

// (a2) Two online visits, then offline reload.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(3000);
  const chunkCached = await page.evaluate(async () => {
    const cache = await caches.open('atlas-b40404d5-2d4898649a1e');
    return Boolean(await cache.match('/gta6-leonida-atlas/assets/walk-geography-yrqsL7gC.js'));
  });
  note(`(a2) after two online visits: 3D chunk cached = ${chunkCached}`);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  const mapView = await page.locator('.atlas-map-view').count();
  check('(a2) offline reload after TWO visits renders the map', mapView > 0 && tiles > 0, `mapView=${mapView} tiles=${tiles}`);
  await page.screenshot({ path: `${OUT}offline-reload.png` });
  const findOk = await page
    .getByRole('button', { name: 'Find', exact: true })
    .click()
    .then(async () => {
      await page.waitForTimeout(1000);
      return (await page.locator('.sidebar').count()) > 0;
    })
    .catch(() => false);
  check('(a2) Find opens offline', findOk);
  await page.getByRole('button', { name: 'Map', exact: true }).click().catch(() => {});
  await page.waitForTimeout(800);
  const layersOk = await page
    .getByRole('button', { name: 'Layers', exact: true })
    .click()
    .then(async () => {
      await page.waitForTimeout(1000);
      return (await page.locator('.layer-manager').count()) > 0;
    })
    .catch(() => false);
  check('(a2) Layers opens offline', layersOk);
  await page.screenshot({ path: `${OUT}offline-layers.png` });
  const realErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('(a2) no console errors offline (other than failed-resource logs)', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  await context.close();
}

// (b) Cold offline first visit — expected to fail with the browser
// offline page; record as expected, not a failure.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const result = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch((e) => e.message);
  const tiles = await page.locator('.leaflet-tile-loaded').count().catch(() => 0);
  note(`(b) cold offline first visit: ${typeof result === 'string' ? `navigation failed (${result.slice(0, 60)})` : `HTTP ${result?.status()}`}, tiles=${tiles} — browser offline page is EXPECTED here`);
  await context.close();
}

await browser.close();
server.close();
console.log(failures.length ? `QA OFFLINE: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA OFFLINE: ALL PASS');
process.exit(failures.length ? 1 : 0);
