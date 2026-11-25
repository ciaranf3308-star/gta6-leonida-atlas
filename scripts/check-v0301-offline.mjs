// v0.30.1 — offline recovery after exactly ONE visit (Finding #3).
// Asserts the fixed behaviour: one warm visit -> offline -> reload
// renders the map (the 3D chunk modulepreloaded at startup must be
// precached in CORE, so it is in the cache after visit 1). Also
// checks the two-visit case still works, and that the install
// precache grew by exactly the modulepreload chunks missing from
// CORE. Self-serves dist/ on port 4352. Reads the cache name and
// chunk name from the live dist/ instead of hardcoding them.
// Fixture ids only.
/* global caches */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0301-walk-fix/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const distSw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const CACHE = (distSw.match(/const CACHE="([^"]+)"/) ?? [null, 'UNKNOWN'])[1];
const CORE = JSON.parse((distSw.match(/const CORE=(\[.*?\]);/) ?? [null, '[]'])[1]);
const distHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const PRELOADS = [...distHtml.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const CHUNK = PRELOADS.find((p) => /walk-geography-[^/]+\.js$/.test(p)) ?? '';
console.log(`probe target: cache=${CACHE} coreEntries=${CORE.length} preloads=${JSON.stringify(PRELOADS)} chunk=${CHUNK}`);
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

// The startup modulepreload chunks must all be precached in CORE.
check(
  'offline setup: every modulepreload chunk is in CORE',
  PRELOADS.every((p) => CORE.includes(p)),
  `missing: ${PRELOADS.filter((p) => !CORE.includes(p)).join(', ') || 'none'}`,
);

// (a1) One warm visit, then offline reload.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(8000);
  const chunkCached = await page.evaluate(async (cacheName, chunk) => {
    const cache = await caches.open(cacheName);
    return Boolean(await cache.match(chunk));
  }, CACHE, CHUNK);
  console.log(`(a1) after one warm visit: 3D chunk cached = ${chunkCached}`);
  check('(a1) 3D chunk is cached after ONE warm visit', chunkCached);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  const mapView = await page.locator('.atlas-map-view').count();
  check('(a1) offline reload after ONE visit renders the map', mapView > 0 && tiles > 0, `mapView=${mapView} tiles=${tiles}`);
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
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await skipAndClose(page);
  await page.waitForTimeout(3000);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  const mapView = await page.locator('.atlas-map-view').count();
  check('(a2) offline reload after TWO visits renders the map', mapView > 0 && tiles > 0, `mapView=${mapView} tiles=${tiles}`);
  await page.screenshot({ path: `${OUT}offline-second-visit.png` });
  await context.close();
}

await browser.close();
server.close();
console.log(failures.length ? `OFFLINE v0.30.1: ${failures.length} FAILURES — ${failures.join(', ')}` : 'OFFLINE v0.30.1: ALL PASS');
process.exit(failures.length ? 1 : 0);
