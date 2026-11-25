/* global document, innerWidth, innerHeight */
/* ^ browser globals, only used inside page.evaluate() callbacks. */
/* ViceWire basemap walk (round 2, 2026-11-25): 390px, DPR 2, fresh AND
   cached loads. Proves the new vicewire-v2 pyramid at every zoom and
   the P0 fix (deepest zoom on land must show land tiles, never the
   ocean fallback), plus the v2 review items: the Ambrosia highway
   must read as a clean road (eye-check 04), the y=0 ocean rows at
   z1-3 must be real tiles (no ocean.jpg fallback on the fit view).
   Run AFTER the production build:
     ATLAS_BASE_PATH=/gta6-leonida-atlas/ npm run build
     ATLAS_BASE_PATH=/gta6-leonida-atlas/ npm run start   (port 4330)
     node scripts/check-vicewire-walk.mjs
   Screenshots land in hidden_files/v024-walk-basemap/ (goal workspace).
   Exit 1 on any failed assertion. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const outDir = join(
  homedir(),
  'workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v024-walk-basemap',
);
mkdirSync(outDir, { recursive: true });

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
};

// Places: L400 Ambrosia (inland, max-zoom-on-land), L530 Mount Kalaga
// (northern hills), L269 Key Lento cell tower (the Keys), L6 Vice Beach
// (Vice City street zoom).
const PLACES = { vc: 'L6', ambrosia: 'L400', kalaga: 'L530', keys: 'L269' };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
const failedRequests = [];
const tileUrls = new Set();
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
page.on('requestfailed', (req) => {
  const err = req.failure()?.errorText;
  // Leaflet cancels in-flight tile requests when the view moves on —
  // a client-side abort, not a missing tile. Real failures are HTTP
  // >= 400 (caught in the response handler) or other network errors.
  if (err === 'net::ERR_ABORTED') return;
  failedRequests.push(`${req.url()} :: ${err}`);
});
page.on('response', (res) => {
  const url = res.url();
  if (url.includes('/tiles/')) {
    tileUrls.add(url);
    if (res.status() >= 400) failedRequests.push(`${url} :: HTTP ${res.status()}`);
  }
});

const dismissWelcome = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(800);
  }
};
// ?place= opens the place detail sheet, which covers the map and
// intercepts pointer events — close it before touching zoom controls.
const closePlaceSheet = async () => {
  const close = page.getByRole('button', { name: 'Close place details' });
  if (await close.isVisible({ timeout: 5000 }).catch(() => false)) {
    await close.click();
    await page.waitForTimeout(600);
  }
};
const loadedTiles = (zoom) =>
  page.locator(`.leaflet-tile-loaded[src*="tiles/vicewire-v2/${zoom}/"]`);
const zoomInToMax = async () => {
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: 'Zoom in' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(350);
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
// Distinct vs total loaded z6 tile URLs. If the same file is served
// at several Leaflet slots (the pre-maxNativeZoom 2x2 repetition),
// total >> distinct. At max zoom every slot must be a different tile.
const z6Stats = async () =>
  page.evaluate(() => {
    const srcs = [...document.querySelectorAll('.leaflet-tile-loaded')]
      .map((img) => img.getAttribute('src'))
      .filter((s) => s && s.includes('vicewire-v2/6/'));
    return { total: srcs.length, distinct: new Set(srcs).size };
  });
// fallback (ocean.jpg) is flat teal, variance ~0. Draws the loaded tile
// nearest the viewport centre into a canvas and reads its stddev.
const centreTileStddev = async () =>
  page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.leaflet-tile-loaded')]
      .map((img) => {
        const r = img.getBoundingClientRect();
        return { img, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      })
      .filter(({ cx, cy }) => cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight);
    if (!imgs.length) return -1;
    const best = imgs.reduce((a, b) => {
      const da = Math.hypot(a.cx - innerWidth / 2, a.cy - innerHeight / 2);
      const db = Math.hypot(b.cx - innerWidth / 2, b.cy - innerHeight / 2);
      return da < db ? a : b;
    });
    const canvas = document.createElement('canvas');
    canvas.width = best.img.naturalWidth;
    canvas.height = best.img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(best.img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const n = data.length / 4;
    let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < data.length; i += 4) { mr += data[i]; mg += data[i + 1]; mb += data[i + 2]; }
    mr /= n; mg /= n; mb /= n;
    let vr = 0, vg = 0, vb = 0;
    for (let i = 0; i < data.length; i += 4) {
      vr += (data[i] - mr) ** 2; vg += (data[i + 1] - mg) ** 2; vb += (data[i + 2] - mb) ** 2;
    }
    return Math.sqrt((vr + vg + vb) / (3 * n));
  });

// 1. Fresh load: island fit view.
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
await dismissWelcome();
await page.waitForTimeout(1500);
const islandTiles = await page.locator('.leaflet-tile-loaded').count();
console.log('island tiles loaded:', islandTiles);
check(islandTiles > 0, 'island fit view loads tiles');
// v2: the fill-ocean rows — the fit view must load real y=0 tiles at
// z1 (the review's missing rows) and must NOT fall back to ocean.jpg
// anywhere on the island view.
const oceanFit = await page.locator('.leaflet-tile-loaded[src*="tiles/ocean.jpg"]').count();
check(oceanFit === 0, `island fit view shows no ocean-fallback tiles — saw ${oceanFit}`);
const y0Tiles = [...tileUrls].filter((u) => /\/vicewire-v2\/1\/1,0,/.test(u));
check(y0Tiles.length > 0, `island fit view requests real z1 y=0 fill tiles — saw ${y0Tiles.length}`);
await page.screenshot({ path: join(outDir, '01-island.png') });

// 2. Vice City district (zoom out from the place-open view).
await page.goto(`${base}?place=${PLACES.vc}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await closePlaceSheet();
await zoomOut(2);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '02-vc-district.png') });
console.log('district tiles:', await page.locator('.leaflet-tile-loaded').count());

// 3. Vice City street, max zoom.
await page.goto(`${base}?place=${PLACES.vc}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await closePlaceSheet();
await zoomInToMax();
await page.waitForTimeout(1500);
const z6vc = await loadedTiles(6).count();
const z6vcStats = await z6Stats();
const stddevVc = await centreTileStddev();
console.log('VC max zoom: z6 tiles', z6vc, 'distinct', z6vcStats.distinct, 'centre stddev', stddevVc.toFixed(1));
check(z6vc >= 4, 'VC max zoom loads >= 4 z6 tiles');
check(z6vcStats.distinct === z6vcStats.total && z6vcStats.total >= 8, `VC max zoom: every z6 tile distinct (${z6vcStats.distinct}/${z6vcStats.total}) — no 2x2 repetition`);
check(stddevVc > 15, 'VC max zoom centre tile is land, not flat ocean');
await page.screenshot({ path: join(outDir, '03-vc-street-max.png') });

// 4. P0 — Ambrosia, max zoom ON LAND. Before the clamp this rendered
// as flat teal ocean (z7 404s answered by ocean.jpg). The centre tile
// must be varied land, and no tile may be the ocean fallback.
await page.goto(`${base}?place=${PLACES.ambrosia}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await closePlaceSheet();
await zoomInToMax();
await page.waitForTimeout(1500);
const z6amb = await loadedTiles(6).count();
const z6ambStats = await z6Stats();
const stddevAmb = await centreTileStddev();
const oceanTiles = await page.locator('.leaflet-tile-loaded[src*="tiles/ocean.jpg"]').count();
console.log('Ambrosia max zoom: z6 tiles', z6amb, 'distinct', z6ambStats.distinct, 'centre stddev', stddevAmb.toFixed(1), 'ocean-fallback tiles', oceanTiles);
check(z6amb >= 4, 'Ambrosia max zoom loads >= 4 z6 tiles');
check(z6ambStats.distinct === z6ambStats.total && z6ambStats.total >= 8, `Ambrosia max zoom: every z6 tile distinct (${z6ambStats.distinct}/${z6ambStats.total}) — no 2x2 repetition (P0)`);
check(stddevAmb > 15, 'Ambrosia max zoom centre tile is land, not flat ocean (P0)');
check(oceanTiles === 0, 'Ambrosia max zoom shows no ocean-fallback tiles (P0)');
await page.screenshot({ path: join(outDir, '04-ambrosia-maxzoom.png') });

// 5. Northern hills (z3-ish): Mount Kalaga, zoom out from place view.
await page.goto(`${base}?place=${PLACES.kalaga}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await closePlaceSheet();
await zoomOut(3);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '05-hills-z3.png') });

// 6. The Keys (z3-ish).
await page.goto(`${base}?place=${PLACES.keys}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await closePlaceSheet();
await zoomOut(3);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '06-keys-z3.png') });

// 7. Pan across tile edges, then cached reload.
await page.mouse.move(195, 422);
await page.mouse.down();
await page.mouse.move(95, 422, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '07-pan.png') });
// Back to the plain island URL first: the last ?place= would reopen
// its detail sheet on reload and hide the cached map in the shot.
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const cachedTiles = await page.locator('.leaflet-tile-loaded').count();
console.log('cached reload tiles:', cachedTiles);
check(cachedTiles > 0, 'cached reload still loads tiles');
await page.screenshot({ path: join(outDir, '08-island-cached.png') });

// Global assertions: no z7 requests (the P0 regression), no failed
// tile requests on a fresh profile, no console errors.
const z7 = [...tileUrls].filter((u) => /\/tiles\/[^/]+\/7\//.test(u));
check(z7.length === 0, `no tile zoom 7 requests (P0) — saw ${z7.length}`);
const tileFailures = failedRequests.filter((f) => f.includes('/tiles/'));
check(tileFailures.length === 0, `zero failed tile requests on fresh profile — saw ${tileFailures.length}`);
if (tileFailures.length) console.log(tileFailures.slice(0, 10).join('\n'));
check(errors.length === 0, `no console errors — saw ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
const overflow = await page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);
check(overflow === 0, `no horizontal overflow (${overflow}px)`);
writeFileSync(join(outDir, 'walk-result.json'), JSON.stringify({
  islandTiles, oceanFit, y0TilesRequested: y0Tiles.length,
  z6vc, z6vcDistinct: z6vcStats.distinct, stddevVc,
  z6amb, z6ambDistinct: z6ambStats.distinct, stddevAmb, oceanTiles, cachedTiles,
  tileUrlsSeen: tileUrls.size, z7Requests: z7.length,
  failedTileRequests: tileFailures.length, consoleErrors: errors.length,
  failures,
}, null, 2));
await browser.close();
if (failures.length) {
  console.log('WALK FAILED:', failures.join(' | '));
  process.exit(1);
}
console.log('ViceWire basemap walk OK');
