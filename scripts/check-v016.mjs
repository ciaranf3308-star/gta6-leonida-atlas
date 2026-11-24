/* global localStorage, window, PerformanceObserver */
/* v0.16.0 "Clean, fast, pretty" walk at 390px: the user walks it as a
 * player, not a tester. Fresh profile, first launch:
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
 * Screenshots land in /tmp/atlas-walk-v016/. Exits 1 on console errors,
 * overflow, or any flow assertion failing.
 * Run with: ./node_modules/.bin/tsx scripts/check-v016.mjs
 * (preview server must be running: ATLAS_BASE_PATH=/gta6-leonida-atlas/
 *  vite preview --host 127.0.0.1 --port 4330) */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const out = '/tmp/atlas-walk-v016';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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

// Seed the exact state from the user's screenshot: a saved view with
// 27 layers on (every public layer), as his phone had it.
await page.addInitScript(() => {
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
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/day/"]', { timeout: 30000 });

// Forced onboarding first.
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /Skip for now/ }).click();

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

// (b) The hero: sunset banner, wordmark, search, chips.
await page.locator('.map-hero-banner').waitFor({ timeout: 10000 });
const heroImg = await page.locator('.map-hero-banner img').getAttribute('src');
console.log('hero image:', heroImg);
if (!/hero-sunset\.jpg/.test(heroImg ?? '')) fail('hero banner has no sunset image');
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
await browser.close();
console.log('v0.16.0 walk passed');
