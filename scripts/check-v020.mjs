/* global localStorage, window, PerformanceObserver, document, getComputedStyle, createImageBitmap */
/* v0.20.0 BLUR-FIX walk at 390px, DPR 2 (plus a DPR 3 probe): the v0.18.0 walk, plus the
 * regressions for his 7:08pm + 7:09pm screenshots — v0.18 was a
 * recolour, not a rebuild, and at street zoom EVERY road was a thick
 * bright-pink neon line. v0.19 redraws the map (tiles/redrawn/):
 * (g) every loaded tile comes from tiles/redrawn/, NO canvas
 * .sea-overlay exists, the tile pane has no CSS filter, and a sampled
 * ocean pixel from a loaded tile is deep teal (not pale day cyan);
 * (h) STREET ZOOM: zoomed into Vice City, the loaded z5/z6 tiles
 * are redrawn and their coral-pink pixel share is < 3% (minor
 * streets are cream, pink only on majors) while cream street pixels
 * are present; (i) the GTA VI text wordmark is in the header and the
 * banner is still a slim <=64px strip; (j) the Restore button is a
 * single non-wrapping line and the empty prompt is a slim bar
 * (<= 220px tall). Plus the v0.17 assertions:
 *   (a0) with a saved camera {x:800, y:-800, zoom:-2} seeded, the
 *        tiles that load are GTADB zoom 0 (whole map), the banner is
 *        a slim ≤64px strip, the empty prompt is a bottom bar, and
 *        the floating recenter button is visible on a phone.
 *   (a) a SAVED view with 27 layers on must NOT come back: 0 pins, the
 *       empty-map prompt, and a "Restore my last layers (27 on)" offer;
 *   (b) the hero: sunset banner + "Leonida Atlas / The complete GTA VI
 *       companion" + search pill + All/Locations/Activities/Stores/
 *       Collectibles chips;
 *   (c) tap "All" at full-map zoom: hero pins only — ≤24 markers, zero
 *       numbered cluster discs, zero pink blobs;
 *   (d) tap "Locations", tap the Vice City region pin: the sheet has
 *       a photo and Set Route / View Area / Add to List;
 *   (e) pan + zoom with a layer on: marker count stays ≤120 and no
 *       long task over 200ms fires while panning (the lag check);
 *   (f) Layers → "Turn everything off": 0 pins, no badge.
 * Screenshots land in /tmp/atlas-walk-v019/. Exits 1 on console errors,
 * overflow, or any flow assertion failing.
 * Run with: ./node_modules/.bin/tsx scripts/check-v019.mjs
 * (preview server must be running: ATLAS_BASE_PATH=/gta6-leonida-atlas/
 *  vite preview --host 127.0.0.1 --port 4330) */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const out = '/tmp/atlas-walk-v020';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const nav = (label) => page.locator('.bottom-nav').getByRole('button', { name: label });
const overflow = () =>
  page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);
const markerCount = () => page.locator('.atlas-map-marker').count();
function fail(message) {
  throw new Error(message);
}

// Seed the exact state from the user's screenshots: a saved view with
// 27 layers on (every public layer), as his phone had it — PLUS the
// saved camera zoomed into the Vice City shops, which is what put
// his 4:28pm map off-centre with the land cut off.
await page.addInitScript(() => {
  localStorage.setItem(
    'leonida-map-camera-v1',
    JSON.stringify({ center: { x: 800, y: -800 }, zoom: -2 }),
  );
  const layerIds = [
    'regions', 'community', 'interiors', 'breakable', 'shops', 'lootable',
    'gyms', 'equipment', 'uncertain',
    ...Array.from({ length: 18 }, (_, i) => `cards:set-${i}`),
  ];
  localStorage.setItem(
    'leonida-map-view-v1',
    JSON.stringify({
      visibleLayerIds: layerIds,
      countyId: null,
      area: null,
      hideFound: false,
      remainingOnly: false,
      favoritesOnly: false,
      evidence: 'all',
      category: 'all',
      enterableOnly: false,
      lootableOnly: false,
      interiorHouseOnly: false,
      venueType: 'all',
    }),
  );
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/redrawn/"]', { timeout: 30000 });

// Forced onboarding first.
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /Skip for now/ }).click();

// (a0) The saved zoomed-in camera must NOT come back: the map opens
// on the whole of Leonida. Proof is in the tiles: whole-map zoom
// loads GTADB zoom 0 tiles; the saved zoom -2 would load zoom 3.
const tileZooms = await page
  .locator('.leaflet-tile-pane img[src*="tiles/redrawn/"]')
  .evaluateAll((imgs) =>
    [...new Set(imgs.map((img) => img.getAttribute('src')?.split('/').pop()?.split(',')[0]))],
  );
console.log('tile zooms on open with a saved zoomed-in camera:', JSON.stringify(tileZooms));
if (!tileZooms.includes('0') || tileZooms.some((z) => z !== '0'))
  fail(`saved camera came back — tiles at GTADB zoom ${JSON.stringify(tileZooms)}, expected only 0`);
await shot('a0-whole-leonida');
// (k) v0.20.0 BLUR FIX: every loaded redrawn tile is a 512px file
// displayed at 256 CSS px — 1:1 device pixels at DPR 2. v0.19's
// 256px tiles were stretched 2x here (3x at DPR 3).
const tileProof = await page
  .locator('.leaflet-tile-pane img[src*="tiles/redrawn/"]')
  .evaluateAll((imgs) =>
    imgs.map((img) => ({
      natural: img.naturalWidth,
      css: img.clientWidth,
      device: img.clientWidth * window.devicePixelRatio,
    })),
  );
console.log('tile density proof (DPR 2):', JSON.stringify(tileProof.slice(0, 3)));
if (tileProof.length === 0) fail('no redrawn tiles loaded to prove density');
if (tileProof.some((t) => t.natural !== 512 || t.css !== 256 || t.device !== 512))
  fail(`tiles are not 1:1 at DPR 2: ${JSON.stringify(tileProof.slice(0, 3))}`);
// The banner is a slim strip now, not a big floating card.
const bannerBox = await page.locator('.map-hero-banner').boundingBox();
console.log('banner height:', bannerBox?.height);
if (!bannerBox || bannerBox.height > 64) fail(`hero banner is ${bannerBox?.height}px tall, cap is 64`);
// The empty prompt is a bottom bar, not a card over the middle.
const promptBox = await page.locator('.empty-map-prompt').boundingBox();
console.log('prompt box:', JSON.stringify(promptBox));
if (!promptBox || promptBox.y + promptBox.height < 720 || promptBox.height > 220)
  fail(`empty prompt is not a bottom bar: ${JSON.stringify(promptBox)}`);
// The recenter button is visible on a phone — the way back.
if (!(await page.locator('.atlas-recenter').isVisible()))
  fail('recenter button is not visible on a 390px phone');

// (a) Clean launch despite the saved 27-layer view: 0 pins.
await page.locator('.empty-map-prompt').waitFor({ timeout: 10000 });
console.log('markers on open:', await markerCount());
if ((await markerCount()) !== 0) fail('map opened with pins — the saved view came back');
if ((await page.locator('.bottom-nav-badge').count()) !== 0)
  fail('Layers badge is showing on a clean launch');
const promptText = await page.locator('.empty-map-prompt').innerText();
console.log('empty-map prompt:', JSON.stringify(promptText.slice(0, 200)));
if (!/nothing showing yet/i.test(promptText)) fail('empty-map prompt missing its headline');
const restoreButton = page
  .locator('.empty-map-prompt')
  .getByRole('button', { name: /Restore my last layers/ });
if (!(await restoreButton.isVisible())) fail('no "Restore my last layers" offer');
console.log('restore offer:', JSON.stringify(await restoreButton.innerText()));
const restoreBox = await restoreButton.boundingBox();
console.log('restore button height:', restoreBox?.height);
if (!restoreBox || restoreBox.height > 44)
  fail(`restore button wraps onto more than one line (height ${restoreBox?.height}px)`);

// (b) The hero: sunset banner, wordmark, search, chips.
await page.locator('.map-hero-banner').waitFor({ timeout: 10000 });
const heroImg = await page.locator('.map-hero-banner img').getAttribute('src');
console.log('hero image:', heroImg);
if (!/hero-sunset\.jpg/.test(heroImg ?? '')) fail('hero banner has no sunset image');
const gtaVi = await page.locator('.gta-vi').innerText();
console.log('GTA wordmark:', JSON.stringify(gtaVi));
if (!/^VI$/.test(gtaVi.trim())) fail('header has no GTA VI wordmark');
const brand = await page.locator('.map-hero-brand').innerText();
const sub = await page.locator('.map-hero-sub').innerText();
console.log('brand:', JSON.stringify(brand), 'sub:', JSON.stringify(sub));
if (!/leonida atlas/i.test(brand)) fail('hero wordmark wrong');
if (!/complete gta vi companion/i.test(sub)) fail('hero subtitle wrong');
for (const label of ['All', 'Locations', 'Activities', 'Stores', 'Collectibles']) {
  if (!(await page.locator('.map-chips').getByRole('button', { name: label, exact: true }).isVisible()))
    fail(`chip missing: ${label}`);
}
await shot('a-clean-open');
if ((await overflow()) > 0) fail('horizontal overflow on the clean map');

// (c) "All" at full-map zoom: hero pins only, no numbered discs.
await page.locator('.map-chips').getByRole('button', { name: 'All', exact: true }).click();
await page.waitForSelector('.atlas-map-marker', { timeout: 10000 });
await page.waitForTimeout(1500);
const heroMarkers = await markerCount();
const clusterDiscs = await page.locator('.atlas-cluster-face').count();
console.log('markers after All at full zoom:', heroMarkers, 'cluster discs:', clusterDiscs);
if (heroMarkers === 0) fail('no hero pins appeared after All');
if (heroMarkers > 24) fail(`hero mode drew ${heroMarkers} markers, cap is 24`);
if (clusterDiscs !== 0) fail(`hero mode drew ${clusterDiscs} cluster discs`);
await shot('b-hero-pins');

// (d) Locations chip, then the Vice City region pin → the sheet.
await page.locator('.map-chips').getByRole('button', { name: 'Locations', exact: true }).click();
await page.waitForTimeout(1200);
const viceCityPin = page.locator('.atlas-map-marker[aria-label^="Vice City"]');
await viceCityPin.first().waitFor({ timeout: 10000 });
await viceCityPin.first().click();
await page.locator('.place-sheet').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
const sheetTitle = await page.locator('.place-sheet h2').innerText();
console.log('sheet title:', JSON.stringify(sheetTitle));
if (!/vice city/i.test(sheetTitle)) fail(`sheet opened for ${sheetTitle}, not Vice City`);
const photo = await page.locator('.place-photo img').getAttribute('src');
console.log('sheet photo:', photo);
if (!photo || !/county-vice-dale\.jpg/.test(photo)) fail('Vice City sheet has no county photo');
for (const label of ['Set Route', 'View Area', 'Add to List']) {
  if (!(await page.locator('.place-sheet').getByRole('button', { name: label }).isVisible()))
    fail(`Vice City sheet missing action: ${label}`);
}
await shot('c-vice-city-sheet');
// Close the sheet: the map is the screen again.
await page.locator('.place-sheet').getByRole('button', { name: 'Close place details' }).click();
await page.waitForTimeout(500);

// (e) Lag check: turn a layer on, pan and zoom, watch marker count and
// long tasks. One layer on at full zoom is hero mode; zoom in twice and
// the clusters must stay capped at 120.
await page.evaluate(() => {
  window.__longtasks = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__longtasks.push(Math.round(entry.duration));
  });
  observer.observe({ entryTypes: ['longtask'] });
  window.__observer = observer;
});
await page.locator('.map-chips').getByRole('button', { name: 'Activities', exact: true }).click();
await page.waitForTimeout(1200);
const mapBox = await page.locator('.atlas-map-canvas').boundingBox();
if (!mapBox) fail('no map box for the pan test');
// Drag the map in a slow pan, then zoom in twice via the keyboard.
await page.mouse.move(mapBox.x + 195, mapBox.y + 500);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(mapBox.x + 195 - i * 8, mapBox.y + 500 - i * 4);
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.keyboard.press('+');
await page.waitForTimeout(1200);
await page.keyboard.press('+');
await page.waitForTimeout(1500);
const zoomedMarkers = await markerCount();
const longtasks = await page.evaluate(() => window.__longtasks ?? []);
console.log('markers after zoom-in:', zoomedMarkers, 'longtasks:', JSON.stringify(longtasks));
if (zoomedMarkers > 120) fail(`zoomed-in map drew ${zoomedMarkers} markers, cap is 120`);
if (longtasks.some((d) => d > 200)) fail(`long task over 200ms while panning: ${JSON.stringify(longtasks)}`);
await shot('d-zoomed-in');

// (f) Layers → Turn everything off: back to a clean map, no badge.
await nav('Layers').click();
await page.getByRole('button', { name: 'Turn everything off' }).click();
await nav('Map').click();
await page.waitForTimeout(1000);
console.log('markers after Turn everything off:', await markerCount());
if ((await markerCount()) !== 0) fail('pins remain after Turn everything off');
if ((await page.locator('.bottom-nav-badge').count()) !== 0)
  fail('Layers badge remains after Turn everything off');
await shot('e-clean-again');

if (errors.length > 0) fail(`console errors: ${errors.join(' | ')}`);
if ((await overflow()) > 0) fail('horizontal overflow at the end of the walk');

// (l) v0.20.0 DPR 3 probe: same open view at deviceScaleFactor 3 —
// tiles must still be 512px files (1.5x upscale, was 3x), no errors.
const page3 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page3.goto(base, { waitUntil: 'networkidle' });
await page3.waitForSelector('.leaflet-tile-loaded[src*="tiles/redrawn/"]', { timeout: 30000 });
await page3.getByText('Welcome to Leonida').waitFor({ timeout: 30000 }).catch(() => {});
await page3.getByRole('button', { name: /Skip for now/ }).click().catch(() => {});
await page3.waitForTimeout(1500);
const proof3 = await page3
  .locator('.leaflet-tile-pane img[src*="tiles/redrawn/"]')
  .evaluateAll((imgs) => imgs.slice(0, 3).map((img) => ({
    natural: img.naturalWidth, css: img.clientWidth,
    device: img.clientWidth * window.devicePixelRatio,
  })));
console.log('tile density proof (DPR 3):', JSON.stringify(proof3));
if (proof3.some((t) => t.natural !== 512 || t.device !== 768))
  fail(`tiles are not 512px at DPR 3: ${JSON.stringify(proof3)}`);
await page3.screenshot({ path: `${out}/g-open-dpr3.png` });
await page3.close();
console.log('v0.20.0 walk: PASS');

// (h) v0.20.0 STREET ZOOM (pink-mess regression, carried over) — the pink-mess regression. Reload (the map
// re-opens on the whole of Leonida), then wheel-zoom toward Vice City
// in the south-east until GTADB tile zoom 5 loads. (Keyboard '+' never
// reached the map in the first v0.19 walk, and double-clicks only
// register every other time — the map swallows alternate dblclicks —
// so the walk wheels in a loop and checks the loaded tile zoom each
// step instead of assuming a fixed number of inputs.)
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 }).catch(() => {});
await page.getByRole('button', { name: /Skip for now/ }).click().catch(() => {});
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/redrawn/"]', { timeout: 30000 });
await page.mouse.move(275, 500);
let streetZooms = [];
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(1000);
  streetZooms = await page
    .locator('.leaflet-tile-pane img[src*="tiles/redrawn/"]')
    .evaluateAll((imgs) => [...new Set(imgs.map((img) => img.getAttribute('src')?.match(/redrawn\/(\d)\//)?.[1]))]);
  console.log(`wheel #${i + 1}: tile zooms`, JSON.stringify(streetZooms));
  if (streetZooms.includes('5') || streetZooms.includes('6')) break;
}
if (!streetZooms.includes('5') && !streetZooms.includes('6'))
  fail(`wheel zoom never reached street zoom: ${JSON.stringify(streetZooms)}`);
await shot('f-street-zoom');
const streetSample = await page.evaluate(async () => {
  // Aggregate over EVERY loaded z5/z6 tile in view: the first tile in
  // the DOM can be a sandy coast or open water with almost no roads,
  // which says nothing about the street network. The aggregate is the
  // honest measure of the whole street-zoom viewport.
  const imgs = [...document.querySelectorAll('.leaflet-tile-pane img[src*="tiles/redrawn/"]')];
  const srcs = [...new Set(
    imgs.map((i) => i.getAttribute('src') ?? '').filter((src) => /\/[56]\//.test(src)),
  )];
  if (srcs.length === 0) return null;
  let coral = 0, cream = 0, total = 0;
  for (const src of srcs) {
    const res = await fetch(src);
    const bmp = await createImageBitmap(await res.blob());
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, 512, 512).data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 200 && g < 150 && b > 90 && b < 170 && r - g > 60) coral++;
      if (r > 225 && g > 215 && b > 190) cream++;
      total++;
    }
  }
  return { tiles: srcs.length, coral: coral / total, cream: cream / total };
});
console.log('street-zoom tile sample:', JSON.stringify(streetSample));
if (!streetSample) fail('no z5/z6 redrawn tile loaded at street zoom');
if (streetSample.coral >= 0.001)
  fail(`street zoom is still a pink mess: ${(streetSample.coral * 100).toFixed(3)}% coral pixels`);
if (streetSample.cream < 0.01)
  fail(`street zoom has no cream streets: ${(streetSample.cream * 100).toFixed(1)}% cream pixels`);

// (g) v0.20.0: the colour is IN the tiles — no overlay left to seam.
// No sea canvas anywhere, no CSS filter on the tile pane, every loaded
// tile is a styled tile, and a sampled ocean pixel from a loaded tile
// is deep teal, not the pale day-tile cyan (49,146,178).
if ((await page.locator('canvas.sea-overlay').count()) !== 0)
  fail('sea-overlay canvas still exists — the overlay was supposed to be deleted');
const paneFilter = await page
  .locator('.leaflet-tile-pane')
  .evaluate((el) => getComputedStyle(el).filter);
console.log('tile pane filter:', paneFilter);
if (paneFilter !== 'none') fail(`tile pane still has a CSS filter: ${paneFilter}`);
const oceanSample = await page.evaluate(async () => {
  // The known-open-ocean tile: z0 (0,0,0) is the NW corner, pure ocean.
  const res = await fetch('/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/redrawn/0/0,0,0.jpg');
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob());
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(128, 128, 1, 1).data;
  return [px[0], px[1], px[2]];
});
console.log('sampled redrawn-tile ocean pixel:', JSON.stringify(oceanSample));
if (!oceanSample) fail('no redrawn tile loaded to sample');
const [sr, sg, sb] = oceanSample;
if (!(sr < 40 && sg >= 40 && sg <= 140 && sb > sg && sb - sr > 30))
  fail(`redrawn ocean pixel is not deep teal: rgb(${sr},${sg},${sb})`);
await browser.close();
console.log('v0.20.0 walk passed');
