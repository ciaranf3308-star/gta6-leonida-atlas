/* Performance profile (v0.29, 2026-11-25): before/after harness.
   390px, DPR 2, against the preview server on 127.0.0.1:4330.
   Run AFTER the production build:
     ATLAS_BASE_PATH=/gta6-leonida-atlas/ npm run build
     ATLAS_BASE_PATH=/gta6-leonida-atlas/ npm run start   (port 4330)
     node scripts/check-v029-perf.mjs
   Outputs JSON to stdout (and a copy to hidden_files/v029-walk-perf/profile.json).
   Exit 1 only on harness failure, never on a slow number — the numbers
   ARE the result. Transfer sizes are 0 for every service-worker-
   controlled request (Chromium reports them that way), so network-vs-
   cache is measured by the cache audit and the prefetch hit rate,
   not by transferSize. */
/* global document, performance */
/* ^ browser globals, only used inside page.evaluate() callbacks —
   except performance, which Node also exposes (node:perf_hooks). */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const outDir = join(
  homedir(),
  'workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v029-walk-perf',
);
mkdirSync(outDir, { recursive: true });

const results = {};
const now = () => performance.now();

// Resource stats for resources whose URL contains `substr` (and, when
// given, ends with `suffix`).
const resourceStats = async (page, substr, suffix = '') =>
  page.evaluate(
    ({ needle, suffix: sfx }) => {
      const entries = performance
        .getEntriesByType('resource')
        .filter((e) => e.name.includes(needle) && (!sfx || e.name.endsWith(sfx)));
      let bytes = 0;
      let networkBytes = 0;
      let count = 0;
      let cached = 0;
      for (const e of entries) {
        count++;
        bytes += e.encodedBodySize || 0;
        // transferSize 0 = served from cache / service worker.
        if (e.transferSize === 0) cached++;
        else networkBytes += e.transferSize || 0;
      }
      return { count, bytes, networkBytes, cached };
    },
    { needle: substr, suffix },
  );

const tileStats = (page) => resourceStats(page, '/tiles/graded/');
const jsStats = (page) => resourceStats(page, '/assets/', '.js');
const catalogueStats = (page) =>
  resourceStats(page, 'gtadb-landmarks');

const loadedTileCount = (page) =>
  page.evaluate(
    () => document.querySelectorAll('.leaflet-tile-loaded').length,
  );

// All tile URLs currently in the service-worker cache.
const cachedTileUrls = (page) =>
  page.evaluate(async () => {
    const urls = [];
    for (const name of await globalThis.caches.keys()) {
      const cache = await globalThis.caches.open(name);
      for (const request of await cache.keys()) {
        if (request.url.includes('/tiles/graded/')) urls.push(request.url);
      }
    }
    return urls;
  });

// Wait for tiles to settle after an action. Reports BOTH the time
// until the first NEW tile paints and the time until the count stops
// changing (100ms quiet window — the 300ms window in v1 inflated
// every number by ~300ms).
const settleTiles = async (page, timeoutMs = 10000) => {
  const start = now();
  const startCount = await loadedTileCount(page);
  let firstNewMs = -1;
  let lastCount = startCount;
  let quietSince = now();
  let finalCount = startCount;
  while (now() - start < timeoutMs) {
    const count = await loadedTileCount(page);
    if (firstNewMs === -1 && count > startCount) firstNewMs = Math.round(now() - start);
    if (count !== lastCount) {
      lastCount = count;
      quietSince = now();
    } else if (now() - quietSince > 100) {
      finalCount = count;
      break;
    }
    await page.waitForTimeout(50);
  }
  return {
    firstNewMs,
    settledMs: Math.round(now() - start),
    startCount,
    finalCount,
  };
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
// Every distinct tile URL the page asks for, across navigations.
// Leaflet tile loads are image requests; the prefetcher's own
// warming is fetch() — tracked separately, because the prefetch
// floods the resource-timing buffer (default 250 entries) and its
// fetches must never count as Leaflet tile requests in a hit rate.
const tileUrlsRequested = new Set();
const tileFetchUrlsRequested = new Set();
page.on('request', (req) => {
  if (!req.url().includes('/tiles/graded/')) return;
  if (req.resourceType() === 'image') tileUrlsRequested.add(req.url());
  else tileFetchUrlsRequested.add(req.url());
});
// The prefetch issues hundreds of fetch() calls; without a bigger
// resource-timing buffer the entries stop being recorded mid-run and
// the tile-request counts read 0.
await page.addInitScript(() => {
  performance.setResourceTimingBufferSize(10000);
});

const dismissWelcome = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(800);
  }
};
const closePlaceSheet = async () => {
  // The sheet's close button is real and visible, but Playwright's
  // actionability check flakes on it (the sheet + zoom pill animate
  // while the prompt state settles). A DOM click is what the walks
  // effectively do — the button itself is proven tappable there.
  const closed = await page
    .evaluate(() => {
      const btn = document.querySelector(
        'button[aria-label="Close place details"]',
      );
      if (!btn) return false;
      btn.click();
      return true;
    })
    .catch(() => false);
  if (closed) {
    await page
      .waitForSelector('.place-sheet', { state: 'detached', timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(600);
  }
};

// ---------- 1. COLD LOAD (fresh profile) ----------
const t0 = now();
await page.goto(base, { waitUntil: 'domcontentloaded' });
const tDom = Math.round(now() - t0);
await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
const tFirstTile = Math.round(now() - t0);
const settled = await settleTiles(page);
const tSettled = Math.round(now() - t0);
let tCatalogue = -1;
try {
  await page.getByText(/4,407 places are in the map/).waitFor({ timeout: 15000 });
  tCatalogue = Math.round(now() - t0);
} catch {
  // tCatalogue stays -1: the catalogue text never appeared.
}
const firstTileUrl = [...tileUrlsRequested][0] ?? null;
results.coldLoad = {
  domContentLoadedMs: tDom,
  firstTileMs: tFirstTile,
  tilesSettledMs: tSettled,
  settledTileCount: settled.finalCount,
  firstNewTileAfterGotoMs: settled.firstNewMs,
  catalogueReadyMs: tCatalogue,
  tiles: await tileStats(page),
  js: await jsStats(page),
  catalogue: await catalogueStats(page),
};
console.log('COLD LOAD', JSON.stringify(results.coldLoad, null, 2));
await dismissWelcome();
// The first-open Vice City sheet stays up after the welcome is
// skipped and covers the zoom pill — close it so the map is bare
// before any pan/zoom measurement.
await closePlaceSheet();
await page.waitForTimeout(500);

// ---------- 1b. PREFETCH: idle warming after cold load ----------
// The prefetcher runs on idle after the first tiles settle (low-zoom
// island z0–z2 = 252 tiles, plus the current view's neighbours and
// child/parent zooms). Give it 6s, then audit the cache: how many of
// the 252 low-zoom tiles are already cached, and how many tiles total.
await page.waitForTimeout(6000);
{
  const cached = await cachedTileUrls(page);
  const lowZoom = [0, 1, 2].map(
    (z) => cached.filter((u) => u.includes(`/tiles/graded/${z}/`)).length,
  );
  results.prefetch = {
    lowZoomCached: lowZoom,
    lowZoomTotal: 252,
    tileEntries: cached.length,
    prefetchFetches: tileFetchUrlsRequested.size,
  };
  console.log('PREFETCH', JSON.stringify(results.prefetch, null, 2));
}

// ---------- 2. PAN: drag the island, measure first-new + settle ----------
const pan = async (dx, dy, label) => {
  const before = await tileStats(page);
  const requestedBefore = new Set(tileUrlsRequested);
  await page.mouse.move(195, 420);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(195 + (dx * i) / 10, 420 + (dy * i) / 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const s = await settleTiles(page);
  const after = await tileStats(page);
  return {
    label,
    firstNewTileMs: s.firstNewMs,
    settledMs: s.settledMs,
    tilesRequested: after.count - before.count,
    // Image requests only — the tileStats count also sweeps up the
    // prefetcher's own fetch() calls.
    imageTilesRequested: [...tileUrlsRequested].filter(
      (u) => !requestedBefore.has(u),
    ).length,
    networkBytesDelta: after.networkBytes - before.networkBytes,
  };
};
results.pan = [
  await pan(-260, 0, 'pan-left-260px'),
  await pan(260, 0, 'pan-right-260px-back'),
];
console.log('PAN', JSON.stringify(results.pan, null, 2));

// ---------- 3. ZOOM: in to max at the current view, then back out ----------
// Click helper: the zoom pill's enabled state flakes under load (the
// button flips disabled transiently while the map settles — the
// graded walk hits the same pill fine after a ?place= close). Retry
// once with force and record it; a genuinely disabled button (max
// zoom) still breaks the loop via isDisabled().
const clickZoom = async (btn) => {
  try {
    await btn.click({ timeout: 3000 });
    return 'click';
  } catch {
    await btn.click({ force: true, timeout: 3000 });
    return 'force';
  }
};
const zoomIn = page.getByRole('button', { name: 'Zoom in' });
const zoomOut = page.getByRole('button', { name: 'Zoom out' });
{
  const before = await tileStats(page);
  // Prefetch hit rate: which tiles was Leaflet about to ask for that
  // were already in the service-worker cache before this zoom started?
  const requestedBeforeZoom = new Set(tileUrlsRequested);
  const cachedBeforeZoom = new Set(await cachedTileUrls(page));
  const t1 = now();
  let forceClicks = 0;
  for (let i = 0; i < 16; i++) {
    if (await zoomIn.isDisabled()) break;
    if ((await clickZoom(zoomIn)) === 'force') forceClicks++;
    await page.waitForTimeout(120);
  }
  const s = await settleTiles(page);
  const after = await tileStats(page);
  const newUrls = [...tileUrlsRequested].filter((u) => !requestedBeforeZoom.has(u));
  const hits = newUrls.filter((u) => cachedBeforeZoom.has(u)).length;
  results.zoomInToMax = {
    totalMs: Math.round(now() - t1),
    firstNewTileMs: s.firstNewMs,
    settledAfterLastClickMs: s.settledMs,
    tilesRequested: after.count - before.count,
    // Image requests only (tileStats also counts prefetch fetches).
    imageTilesRequested: newUrls.length,
    networkBytesDelta: after.networkBytes - before.networkBytes,
    forceClicks,
    prefetchHitRate: newUrls.length ? hits / newUrls.length : null,
    prefetchHits: hits,
    prefetchMisses: newUrls.length - hits,
  };
  const t2 = now();
  let forceClicksOut = 0;
  for (let i = 0; i < 8; i++) {
    if (await zoomOut.isDisabled()) break;
    if ((await clickZoom(zoomOut)) === 'force') forceClicksOut++;
    await page.waitForTimeout(120);
  }
  const s2 = await settleTiles(page);
  const after2 = await tileStats(page);
  results.zoomOut = {
    totalMs: Math.round(now() - t2),
    firstNewTileMs: s2.firstNewMs,
    settledAfterLastClickMs: s2.settledMs,
    tilesRequested: after2.count - after.count,
    networkBytesDelta: after2.networkBytes - after.networkBytes,
    forceClicks: forceClicksOut,
  };
}
console.log('ZOOM', JSON.stringify({ in: results.zoomInToMax, out: results.zoomOut }, null, 2));

// ---------- 4. LAYER TOGGLE (island zoom): Show everything ----------
// Poll marker count: time to FIRST marker and time to stable.
const toggleTiming = async (click) => {
  const t1 = now();
  await click();
  let firstMs = -1;
  let last = -1;
  let quietSince = now();
  let stableMs = -1;
  let markers = 0;
  const start = now();
  while (now() - start < 10000) {
    markers = await page.locator('.atlas-map-marker').count();
    if (firstMs === -1 && markers > 0) firstMs = Math.round(now() - t1);
    if (markers === last) {
      if (now() - quietSince > 100) {
        stableMs = Math.round(now() - t1);
        break;
      }
    } else {
      last = markers;
      quietSince = now();
    }
    await page.waitForTimeout(50);
  }
  return { firstMarkerMs: firstMs, stableMs, markersRendered: markers };
};
{
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
  await dismissWelcome();
  const showAll = page.getByRole('button', { name: /SHOW EVERYTHING/i });
  results.layerToggleIsland = {
    label: 'show-everything-first-open',
    ...(await toggleTiming(() => showAll.click())),
  };
  console.log('LAYER TOGGLE (island)', JSON.stringify(results.layerToggleIsland, null, 2));
}

// ---------- 5. LAYER TOGGLE (street zoom, 120-marker case) ----------
{
  await page.goto(`${base}?place=L6`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
  await dismissWelcome();
  await closePlaceSheet();
  for (let i = 0; i < 16; i++) {
    if (await zoomIn.isDisabled()) break;
    await clickZoom(zoomIn);
    await page.waitForTimeout(120);
  }
  await settleTiles(page);
  // Layers tab -> Interiors checkbox (386 enterable places; dense downtown).
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForTimeout(600);
  const interiors = page.getByRole('checkbox', { name: /Interiors/ });
  const before = await page.locator('.atlas-map-marker').count();
  const timing = await toggleTiming(() => interiors.check());
  // Toggle it off and on again at the same camera: the second ON
  // should hit the v0.29 grouping memo, the first ON is a cold
  // grouping. Same run, same camera — the difference is the memo.
  await interiors.uncheck();
  await page.waitForTimeout(400);
  const timingAgain = await toggleTiming(() => interiors.check());
  results.layerToggleStreet = {
    label: 'layers-sheet-interiors-at-max-zoom',
    markersBefore: before,
    ...timing,
    secondOnMs: timingAgain,
  };
  console.log('LAYER TOGGLE (street)', JSON.stringify(results.layerToggleStreet, null, 2));
  await page.screenshot({ path: join(outDir, 'perf-street-interiors.png') });
}

// ---------- 6. CACHE-CAP PROOF TOUR ----------
// Drive the map through 8 spots at max zoom. Each full zoom-in loads
// ~190 tiles; the tour should push the session well past the SW's
// 1500-optional-entry cap. Then check: how many tiles are cached, and
// is the FIRST tile of the session (cold-load island tile) still there?
const TOUR = ['L6', 'L400', 'L530', 'L269', 'L208', 'L1062', 'L1', 'L900'];
for (const place of TOUR) {
  await page.goto(`${base}?place=${place}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
  await dismissWelcome();
  await closePlaceSheet();
  for (let i = 0; i < 16; i++) {
    if (await zoomIn.isDisabled()) break;
    await clickZoom(zoomIn);
    await page.waitForTimeout(100);
  }
  await settleTiles(page);
  await page.waitForTimeout(200);
}
results.cacheCapTour = {
  distinctTilesRequested: tileUrlsRequested.size,
  ...(await page.evaluate(async (firstUrl) => {
    const keys = await globalThis.caches.keys();
    let tileEntries = 0;
    let totalEntries = 0;
    let firstStillCached = false;
    for (const name of keys) {
      const cache = await globalThis.caches.open(name);
      const entries = await cache.keys();
      totalEntries += entries.length;
      tileEntries += entries.filter((r) => r.url.includes('/tiles/graded/')).length;
    }
    if (firstUrl) {
      for (const name of keys) {
        const cache = await globalThis.caches.open(name);
        if (await cache.match(firstUrl)) {
          firstStillCached = true;
          break;
        }
      }
    }
    return { cacheNames: keys, totalEntries, tileEntries, firstStillCached };
  }, firstTileUrl)),
};
console.log('CACHE CAP TOUR', JSON.stringify(results.cacheCapTour, null, 2));

// ---------- 7. SECOND LOAD (same profile, reload) ----------
{
  const t1 = now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const tDom2 = Math.round(now() - t1);
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 });
  const tFirstTile2 = Math.round(now() - t1);
  const s = await settleTiles(page);
  results.secondLoad = {
    domContentLoadedMs: tDom2,
    firstTileMs: tFirstTile2,
    firstNewTileMs: s.firstNewMs,
    tilesSettledMs: Math.round(now() - t1),
    settledTileCount: s.finalCount,
    tiles: await tileStats(page),
    js: await jsStats(page),
  };
  console.log('SECOND LOAD', JSON.stringify(results.secondLoad, null, 2));
}

results.errors = errors;
writeFileSync(join(outDir, 'profile.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log('PROFILE DONE — wrote', join(outDir, 'profile.json'));
