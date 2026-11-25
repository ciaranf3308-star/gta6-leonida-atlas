// v0.26.0 app-design round 3 walk (390px, DPR 2). Covers the v0.25
// re-review items: first-open region sheet (Vice City, with Pick
// what to see inside) replacing the empty-map banner; Layers as a
// compact bottom sheet, not a full screen; recenter hidden while a
// sheet is open; bold clouds; ?place= deep links opening straight
// to the place with no welcome intercept. Keeps the v0.25 regression
// checks (slim prompt for the layers-on-no-match case, chips fit,
// place card, tag/explored reload, region card, street-zoom "?"
// pills, turn everything off). Served from dist/ on port 4331 like
// the v0.21/v0.23/v0.25 walks.
/* global document, getComputedStyle */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v026-walk/';
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
const markerCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);

await page.goto('http://localhost:4331/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

// The forced indexing onboarding (v0.11) covers the screen on first
// launch — skip it, the way a returning user would.
const skipOnboarding = page.getByRole('button', { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}

// (a) First open is the Vice City region sheet, not a banner.
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const sheet = page.locator('.place-sheet');
const sheetText = (await sheet.textContent()) ?? '';
const sheetTitle = (await sheet.locator('h2').textContent()) ?? '';
check('first open is the Vice City region sheet', sheetTitle.trim() === 'Vice City', sheetTitle);
check('no empty-map banner on first open', (await page.locator('.empty-map-prompt').count()) === 0);
const cropBox = await page.locator('.place-map-crop').boundingBox();
const cropTiles = await page.locator('.place-map-crop .leaflet-tile-loaded').count();
check('first-open sheet photo crop renders', !!cropBox && cropBox.height >= 90 && cropTiles > 0, `h=${cropBox?.height} tiles=${cropTiles}`);
check('first-open sheet has Set Route / View Area / Add to List', ['Set Route', 'View Area', 'Add to List'].every((t) => sheetText.includes(t)));
check(
  'first-open sheet carries Pick what to see',
  sheetText.includes('Pick what to see') &&
    ['Show interiors', 'Show lootable', 'Show shops', 'Show everything'].every((t) => sheetText.includes(t)),
);
const sheetBox = await sheet.boundingBox();
check('first-open sheet is compact (60dvh)', !!sheetBox && sheetBox.height <= 510, JSON.stringify(sheetBox));
// The picker must read without scrolling: its last button sits
// above the sheet's bottom edge.
const pickerVisible = await page.evaluate(() => {
  const sheetEl = document.querySelector('.place-sheet');
  const picker = document.querySelector('.first-open-picker');
  if (!sheetEl || !picker) return false;
  const s = sheetEl.getBoundingClientRect();
  const p = picker.getBoundingClientRect();
  return p.bottom <= s.bottom - 4;
});
check('picker row reads without scrolling', pickerVisible);
await shot('a-first-open-sheet');

// (b) Picking layers from the sheet turns them on and closes it.
await page.getByRole('button', { name: /Show interiors/i }).click();
await page.waitForTimeout(1500);
check('picker closes the sheet', (await page.locator('.place-sheet').count()) === 0);
check('interiors pins appear after picking', (await markerCount()) > 0);
check('no empty-map banner after picking', (await page.locator('.empty-map-prompt').count()) === 0);
await shot('b-picker-interiors');

// (c) Hero + chips + subtle clouds + attribution on the map.
const chipBoxes = await page.locator('.map-chip').evaluateAll((els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    return { label: el.textContent?.trim(), left: r.left, right: r.right };
  }),
);
check(
  'all five chips fit on screen (no cut-off)',
  chipBoxes.length === 5 && chipBoxes.every((c) => c.left >= 0 && c.right <= 390),
  JSON.stringify(chipBoxes),
);
check('edge stack (layers + recenter) visible', (await page.locator('.atlas-edge-stack').isVisible()) && (await page.locator('.atlas-edge-stack button').count()) === 2);
check('zoom pill visible', await page.locator('.atlas-edge-zoom').isVisible());
// v0.31.2: the map view carries no text labels any more — the
// "ViceWire map: the real in-game map, restyled" note and the
// GTADB attribution footer are both gone from the map (the user
// asked for a clean map). The credit lives on in the app: the
// Layers sheet footer (checked in (d)) and About → Credits &
// sources (full GTADB section + CC BY 4.0 licence link).
check(
  'map view carries no text labels',
  (await page.locator('.atlas-map-attribution').count()) === 0 &&
    (await page.locator('.atlas-map-illustration-note').count()) === 0,
);
check('no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
const clouds = await page.evaluate(() =>
  [...document.querySelectorAll('.atlas-clouds span')].map((el) => ({
    w: el.getBoundingClientRect().width,
    h: el.getBoundingClientRect().height,
    filter: getComputedStyle(el).filter,
    bg: getComputedStyle(el).backgroundImage,
  })),
);
check(
  'clouds are five subtle clusters (v0.25 strength, <=0.6 alpha, 5px blur)',
  clouds.length === 5 &&
    // ±1px tolerance on the boundaries: the spans' CSS sizes sit
    // exactly on 240/380/90/130, so a subpixel rect read (380.4,
    // 239.6) flips an exact comparison while the render is unchanged
    // — the check failed three runs in a row on the same in-range
    // values before this was widened (lead, v0.30.0).
    clouds.every((c) => c.w >= 239 && c.w <= 381 && c.h >= 89 && c.h <= 131 && c.filter === 'blur(5px)') &&
    clouds.every((c) => !/0\.[789]/.test(c.bg) && !/0\.9[0-9]/.test(c.bg)),
  JSON.stringify(clouds.map((c) => `${Math.round(c.w)}x${Math.round(c.h)} ${c.filter}`)),
);

// (d) Layers is a compact bottom sheet, not a full screen.
await nav('Layers').click();
await page.waitForTimeout(800);
const layersSheet = page.locator('.sidebar.is-layers-sheet');
check('Layers renders as a sheet', (await layersSheet.count()) === 1);
const layersBox = await layersSheet.boundingBox();
check(
  'Layers sheet leaves the island visible above it',
  !!layersBox && layersBox.y >= 100 && layersBox.height <= 660,
  JSON.stringify(layersBox),
);
check('Layers sheet has a grabber', (await page.locator('.sidebar.is-layers-sheet .sheet-grabber').count()) === 1);
const layersText = await page.locator('.layer-manager').innerText();
const layersLower = layersText.toLowerCase();
check(
  'Layers sheet keeps all 9 Map Index groups',
  ['Personal', 'Story', 'Robberies', 'Activities', 'Exploration', 'Vehicles', 'Weapons', 'Style', 'Food & Drink'].every((g) =>
    layersLower.includes(g.toLowerCase()),
  ),
);
check('no Business group in Layers', !/\bBusiness\b/.test(layersText));
check('Layers sheet drops the intro paragraph', !/Nothing is shown until you choose it/.test(layersText));
// v0.31.2: the on-map attribution footer is gone, so the Layers
// sheet footer is one of the two places the GTADB credit still
// lives in the app (the other is About → Credits & sources).
const layersSheetText = await layersSheet.innerText();
check(
  'Layers footer still carries the GTADB credit (CC BY 4.0)',
  layersSheetText.includes('GTADB') && layersSheetText.includes('CC BY 4.0'),
  layersSheetText.slice(0, 120),
);
// The map hero (wordmark + search pill) is not in the DOM while a
// panel is open — the panel replaces it by design — so the probe
// for "the island is visible above the sheet" is the tiles
// themselves: real map tiles must be painted in the band above the
// sheet's top edge (the screenshot shows the sea and the north
// coast there).
const tilesAboveSheet = await page.evaluate((sheetTop) => {
  return [...document.querySelectorAll('.leaflet-tile-loaded')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < sheetTop;
  });
}, layersBox?.y ?? 0);
check('map tiles are painted in the band above the Layers sheet', tilesAboveSheet);
await shot('c-layers-sheet');
await page.locator('.sidebar.is-layers-sheet .brand-header .icon-button').click();
await page.waitForTimeout(800);
check('Layers sheet closes from its ×', (await page.locator('.sidebar').count()) === 0);

// (e) Place card: recenter hides while the sheet is open.
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('.place-result').first().click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const cardTitle = (await page.locator('.place-sheet h2').textContent()) ?? '';
check(
  'edge stack hidden while a place sheet is open (no half-button)',
  !(await page.locator('.atlas-edge-stack').isVisible()),
);
const recenterRect = await page.evaluate(() => {
  const btn = document.querySelector('.atlas-edge-stack button[aria-label="Show all of Leonida"]');
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  const style = getComputedStyle(btn.closest('.atlas-edge-stack'));
  return { display: style.display, w: r.width, h: r.height };
});
check('recenter button is display:none, not half-cut', recenterRect?.display === 'none', JSON.stringify(recenterRect));
await shot('d-place-card-recenter');
const cardSheetText = (await page.locator('.place-sheet').textContent()) ?? '';
check('card shows Set Route / View Area / Add to List', ['Set Route', 'View Area', 'Add to List'].every((t) => cardSheetText.includes(t)));
const cardSheetBox = await page.locator('.place-sheet').boundingBox();
check('sheet is compact (60dvh)', !!cardSheetBox && cardSheetBox.height <= 510, JSON.stringify(cardSheetBox));

// (f) Tags + explored on that card, then a reload to prove they stick.
const cardSheet = page.locator('.place-sheet');
await cardSheet.getByLabel(/Add your own tag/i).fill('sells t-shirts');
await cardSheet.getByRole('button', { name: 'Add tag', exact: true }).click();
await page.waitForTimeout(800);
check('tag appears as Your tag', ((await cardSheet.textContent()) ?? '').includes('Your tag: sells t-shirts'));
await cardSheet.getByRole('button', { name: /Mark as explored/ }).click();
await page.waitForTimeout(800);
check('explored button flips to Explored', ((await cardSheet.textContent()) ?? '').includes('Explored ✓'));
await shot('e-tag-and-explored');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1200);
// After a reload with nothing on, the first-open sheet is back —
// and it carries the restore button now, so the saved layers come
// back from inside the sheet instead of a banner.
const restore = page.getByRole('button', { name: /Restore my last layers/ });
check('first-open sheet offers the restore after reload', (await restore.count()) > 0);
if ((await restore.count()) > 0) {
  await restore.first().click();
  await page.waitForTimeout(1200);
}
check('restore closes the first-open sheet', (await page.locator('.place-sheet').count()) === 0);
check('layers are back after restore', (await markerCount()) > 0);
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill(cardTitle);
await page.waitForTimeout(1000);
await page
  .locator('.sidebar')
  .getByRole('button', { name: new RegExp(cardTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  .first()
  .click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(800);
const sheet2Text = (await page.locator('.place-sheet').textContent()) ?? '';
check('tag survives reload', sheet2Text.includes('Your tag: sells t-shirts'));
check('explored survives reload', sheet2Text.includes('Explored ✓'));
await shot('f-reload-sticks');
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);
check('edge stack back once the sheet closes', await page.locator('.atlas-edge-stack').isVisible());

// (g) Turn everything off (Layers sheet, not full screen).
await nav('Layers').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check('Turn everything off → 0 markers', (await markerCount()) === 0);
check('Layers sheet still a sheet after turning off', (await page.locator('.sidebar.is-layers-sheet').count()) === 1);
await nav('Map').click();
await page.waitForTimeout(800);

// (h) Deep link on a fresh profile: straight to the place, no
// welcome intercept. A second context is a fresh profile — no
// onboarding seen, no saved layers.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page2 = await ctx2.newPage();
page2.on('pageerror', (err) => consoleErrors.push(`deep-link: ${err}`));
page2.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`deep-link: ${msg.text()}`);
});
page2.on('requestfailed', (req) => failedRequests.push(`deep-link: ${req.url()} ${req.failure()?.errorText ?? ''}`));
page2.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`deep-link: ${res.url()} ${res.status()}`);
});
await page2.goto('http://localhost:4331/gta6-leonida-atlas/?place=region:vice-city', { waitUntil: 'networkidle' });
await page2.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page2.waitForTimeout(1500);
await page2.waitForSelector('.place-sheet', { timeout: 10000 });
await page2.waitForTimeout(1000);
const deepTitle = (await page2.locator('.place-sheet h2').textContent()) ?? '';
check('deep link opens the Vice City sheet', deepTitle.trim() === 'Vice City', deepTitle);
check(
  'no welcome dialog intercepts the deep link',
  (await page2.getByRole('button', { name: /Skip for now/ }).count()) === 0 &&
    !((await page2.locator('body').textContent()) ?? '').includes('Welcome to Leonida'),
);
await page2.screenshot({ path: `${OUT}g-deep-link.png` });
await ctx2.close();

// The graded pyramid (v0.28+) has the y=0 ocean fill (505 tiles),
// so an ocean-row 404 should never occur — but if one does, it is
// the by-design "missing tiles are ocean the source never drew" case
// and is tolerated and counted. The vicewire-v1/v2/v3 pyramids were
// removed in v0.28; the matchers below read the live graded path.
// A tile load cancelled mid-flight aborts instead of 404ing — the
// camera flies away before it arrives, so the load is no longer
// needed. ERR_ABORTED on a tile URL is the fly cancelling, not a
// failure; the tile re-requests if the camera comes back.
const isOceanRow404 = (r) =>
  /\/tiles\/graded\/\d+\/\d+,0,\d+\.jpg 404/.test(r);
const isAbortedTile = (r) =>
  /\/tiles\/graded\//.test(r) && /ERR_ABORTED/.test(r);
// Render-pending was a v0.26 vicewire-v3 concept (the v3 render was
// still running while the walk executed). The graded pyramid is
// complete, so this matcher can never fire; kept for the failure
// classification below.
const isRenderPending404 = () => false;
const vicewire404s = failedRequests.filter(isOceanRow404);
const renderPending404s = failedRequests.filter(
  (r) => !isOceanRow404(r) && isRenderPending404(r),
);
// Tile loads cancelled mid-flight abort instead of 404ing — the
// camera flies away before they arrive, so the load is no longer
// needed. ERR_ABORTED on a tile URL is the fly cancelling, not a
// failure; the tile re-requests if the camera comes back.
const abortedTiles = failedRequests.filter(isAbortedTile);
const otherFailures = failedRequests.filter(
  (r) => !isOceanRow404(r) && !isAbortedTile(r) && !isRenderPending404(r),
);
check(
  'zero failed requests except by-design ocean-row 404s, render-pending v3 tiles and fly-cancelled tile loads',
  otherFailures.length === 0,
  otherFailures.slice(0, 3).join(' | '),
);
console.log(`tolerated graded ocean-row 404s: ${vicewire404s.length}`);
console.log(`tolerated render-pending v3 tiles: ${renderPending404s.length}`);
console.log(`tolerated fly-cancelled tile loads: ${abortedTiles.length}`);
const tile404ConsoleErrors = consoleErrors.filter((e) => /404/.test(e));
check(
  'zero console errors except the same tile 404s',
  consoleErrors.length === tile404ConsoleErrors.length &&
    tile404ConsoleErrors.length ===
      vicewire404s.length + renderPending404s.length,
  consoleErrors.slice(0, 3).join(' | '),
);

await browser.close();
server.close();
console.log(failures.length === 0 ? '\nWALK PASSED' : `\nWALK FAILED: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
