// QA v0.30.0 — service worker, in the real browser with the worker
// ACTIVE (the basemap walk proves the map half with the worker
// blocked; this proves the worker half):
//   (a) a PRESENT land tile the server 404s must come back 404,
//       never ocean.jpg (the v0.24 P0);
//   (b) a PURE-SEA tile the server 404s must come back as ocean.jpg 200;
//   (c) an OUT-OF-GRID tile must come back as ocean.jpg 200;
//   (d) a present land tile that fetches fine must come back 200;
//   (e) a stale v0.29 cache seeded before load must be deleted by
//       the v0.30 worker's activate;
//   (f) with the server 404ing one land tile, the Ambrosia max-zoom
//       view must paint the hatched error tile, never ocean.jpg.
// Self-serves dist/ on port 4342 with a rig: paths in RIG_404 return
// 404. Fixture ids only.
/* global caches, document, navigator, Response */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
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
const RIG_404 = new Set();
let rigNextZ6 = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4342');
  let path = decodeURIComponent(url.pathname);
  if (path === '/qa-blank.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>qa blank</title><body>blank</body>');
    return;
  }
  if (!path.startsWith('/gta6-leonida-atlas/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const rel = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  if (RIG_404.has(rel)) {
    res.writeHead(404);
    res.end('QA rig 404');
    return;
  }
  if (rigNextZ6 && /tiles\/graded\/6\//.test(rel)) {
    rigNextZ6 = false;
    console.log('RIG: 404ing first z6 tile', rel);
    res.writeHead(404);
    res.end('QA rig 404');
    return;
  }
  const file = join(DIST, rel);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4342, resolve));
const base = 'http://127.0.0.1:4342/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};

const skipOnboarding = async (pg) => {
  const skip = pg.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await pg.waitForTimeout(800);
  }
};
const closeSheet = async (pg) => {
  const c = pg.getByRole('button', { name: 'Close place details' });
  if ((await c.count()) > 0) {
    await c.first().click();
    await pg.waitForTimeout(1000);
  }
};

const browser = await chromium.launch();

// Phase 1: collect two real land tiles from the live map, and take
// the pure-sea tile deterministically: z1 y=0 x=0 is a fill tile,
// byte-identical to ocean.jpg (verified below from disk).
let landTile = null;
let landTile2 = null;
let seaTile;
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll('.leaflet-tile-loaded[src*="tiles/graded/"]')].map((img) => img.getAttribute('src')),
  );
  const oceanBytes = readFileSync(join(DIST, 'assets/gta6-leonida-atlas/tiles/ocean.jpg'));
  for (const src of urls.slice(0, 16)) {
    const rel = src.replace(/^\/gta6-leonida-atlas\//, '');
    const bytes = readFileSync(join(DIST, rel));
    if (!bytes.equals(oceanBytes) && !landTile) landTile = src;
    else if (!bytes.equals(oceanBytes) && !landTile2) landTile2 = src;
    if (landTile && landTile2) break;
  }
  const seaRel = 'assets/gta6-leonida-atlas/tiles/graded/1/1,0,0.jpg';
  const seaBytes = readFileSync(join(DIST, seaRel));
  seaTile = seaBytes.equals(oceanBytes) ? `/gta6-leonida-atlas/${seaRel}` : null;
  console.log('land tile:', landTile);
  console.log('land tile 2:', landTile2);
  console.log('sea tile:', seaTile);
  check('probe setup: two land tiles + a verified pure-sea tile', Boolean(landTile && landTile2 && seaTile));
  await context.close();
}

// Phase 2: fresh context, rig both tiles to 404, load, ask the
// WORKER for them via page fetch.
if (landTile && landTile2 && seaTile) {
  const landRel = landTile.replace(/^\/gta6-leonida-atlas\//, '');
  const seaRel = seaTile.replace(/^\/gta6-leonida-atlas\//, '');
  RIG_404.add(landRel);
  RIG_404.add(seaRel);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  // Seed a stale v0.29 cache before the app loads (e).
  await page.goto('http://127.0.0.1:4342/qa-blank.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(async () => {
    const cache = await caches.open('atlas-b40404d5-f08ffcf507d2');
    await cache.put('/gta6-leonida-atlas/assets/index-AY5db6r8.js', new Response('stale v0.29 bundle'));
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  // Wait until the v0.30 worker controls the page.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 }).catch(() => {});
  const controller = await page.evaluate(() => navigator.serviceWorker?.controller?.scriptURL ?? 'none');
  console.log('SW controller:', controller);
  check('SW: v0.30 worker controls the page', controller.endsWith('/sw.js'), controller);
  const cacheNames = await page.evaluate(async () => [...(await caches.keys())]);
  console.log('caches after load:', JSON.stringify(cacheNames));
  check('SW: only the v0.30 cache remains', cacheNames.length === 1 && cacheNames[0] === 'atlas-b40404d5-2d4898649a1e', JSON.stringify(cacheNames));
  check('SW (e): stale v0.29 cache deleted by activate', !cacheNames.includes('atlas-b40404d5-f08ffcf507d2'), JSON.stringify(cacheNames));

  const fetchTile = (url) =>
    page.evaluate(async (u) => {
      const res = await fetch(u);
      const buf = new Uint8Array(await res.arrayBuffer());
      return { status: res.status, url: res.url, bytes: buf.length, head: [...buf.slice(0, 4)] };
    }, url);
  const land = await fetchTile(landTile);
  check('(a) failed LAND tile returns 404, never ocean', land.status === 404, `status=${land.status} url=${land.url}`);
  const sea = await fetchTile(seaTile);
  const seaIsOcean = sea.status === 200 && sea.url.endsWith('ocean.jpg');
  check('(b) failed pure-sea tile returns ocean.jpg 200', seaIsOcean, `status=${sea.status} url=${sea.url}`);
  const outOfGrid = await fetchTile(`${base}assets/gta6-leonida-atlas/tiles/graded/6/6,200,200.jpg`);
  check('(c) out-of-grid tile returns ocean.jpg 200', outOfGrid.status === 200 && outOfGrid.url.endsWith('ocean.jpg'), `status=${outOfGrid.status} url=${outOfGrid.url}`);
  // A present land tile the server does NOT rig must come back 200.
  const ok = await fetchTile(landTile2);
  check('(d) unrigged present land tile returns 200', ok.status === 200 && !ok.url.endsWith('ocean.jpg'), `status=${ok.status} url=${ok.url}`);
  await context.close();
}

// Phase 3 (f): error tile renders with the worker ACTIVE.
// Two passes: first learn which z6 tile sits at the centre of the
// L2227 max-zoom view, then in a FRESH context rig exactly that tile
// to 404 before first load — the map requests it cold, the worker
// must return the 404 (present land tile, never ocean), and Leaflet
// must paint the hatched error tile into the slot.
{
  let centerTile;
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
    await skipOnboarding(page);
    await page.waitForSelector('.place-sheet', { timeout: 10000 });
    await closeSheet(page);
    for (let i = 0; i < 16; i++) {
      const btn = page.getByRole('button', { name: 'Zoom in' });
      if (await btn.isDisabled()) break;
      await btn.click();
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1500);
    centerTile = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.leaflet-tile[src*="tiles/graded/6/"]')];
      let best = null;
      let bestD = Infinity;
      for (const img of tiles) {
        const r = img.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(cx - 195, cy - 422);
        if (d < bestD) {
          bestD = d;
          best = img.getAttribute('src');
        }
      }
      return best;
    });
    console.log('centre z6 tile:', centerTile);
    await context.close();
  }
  check('error-tile setup: found the centre z6 tile', Boolean(centerTile));
  if (centerTile) {
    RIG_404.add(centerTile.replace(/^\/gta6-leonida-atlas\//, ''));
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
    await skipOnboarding(page);
    await page.waitForSelector('.place-sheet', { timeout: 10000 });
    await closeSheet(page);
    for (let i = 0; i < 16; i++) {
      const btn = page.getByRole('button', { name: 'Zoom in' });
      if (await btn.isDisabled()) break;
      await btn.click();
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(2000);
    const errorTiles = await page.locator('.leaflet-tile[src^="data:image/svg+xml"]').count();
    const oceanTiles = await page.locator('.leaflet-tile-loaded[src*="tiles/ocean.jpg"]').count();
    console.log('error-tile probe (SW active): error tiles', errorTiles, 'ocean tiles', oceanTiles);
    check('(f) failed land tile paints the error tile (SW active)', errorTiles >= 1, `error tiles=${errorTiles}`);
    check('(f) failed land tile never paints ocean (SW active)', oceanTiles === 0, `ocean tiles=${oceanTiles}`);
    await page.screenshot({ path: `${OUT}sw-error-tile.png` });
    await context.close();
  }
}

await browser.close();
server.close();
console.log(failures.length ? `QA SW: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA SW: ALL PASS');
process.exit(failures.length ? 1 : 0);
