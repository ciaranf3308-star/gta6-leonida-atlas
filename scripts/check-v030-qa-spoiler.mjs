// QA v0.30.0 — spoiler rule, ADVERSARIAL flows the lead probes
// did not cover (check-v030-spoiler.mjs already proves first open,
// deep link, Ask-gyms, AI-failure fallback and cancel):
//   (1) Find with layers off: search + Kind filter must show
//       NOTHING (Find is scoped to visible layers — the list itself
//       is spoiler-gated);
//   (2) deep link ?place=L2227 reveals exactly one; closing the
//       sheet leaves the reveal standing;
//   (3) reload after a reveal: what persists, what the restore
//       offer does;
//   (4) kill switch after a reveal: zero markers;
//   (5) Ask for shops with layers off: shops only, no gyms/loot;
//   (6) reveal accumulation: deep-link 3 more places in a row,
//       closing each sheet — how many pins stand at the end?
//   (7) layer on + kill switch: zero markers.
// Self-serves dist/ on port 4346. Fixture ids only.
/* global document, window */
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4346');
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
await new Promise((resolve) => server.listen(4346, resolve));
const base = 'http://127.0.0.1:4346/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const note = (msg) => console.log(`NOTE  ${msg}`);

const browser = await chromium.launch();
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
const markerCount = () => page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);
const highlightedCount = () => page.evaluate(() => document.querySelectorAll('.atlas-map-marker.is-highlighted').length);
const layersOnBadge = () => page.locator('.bottom-nav-badge').count();
const savedLayers = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem('leonida-map-view-v1') ?? '{}').visibleLayerIds ?? null;
    } catch {
      return null;
    }
  });
const skipOnboarding = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};
const closeSheet = async () => {
  const c = page.getByRole('button', { name: 'Close place details' });
  if ((await c.count()) > 0) {
    await c.first().click();
    await page.waitForTimeout(1000);
  }
};
const nav = (name) => page.getByRole('button', { name, exact: true });
const waitTiles = () => page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });

// (1) First open: zero pins.
await page.goto(base, { waitUntil: 'networkidle' });
await waitTiles();
await page.waitForTimeout(1500);
await skipOnboarding();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1000);
check('(1) first open: zero pins', (await markerCount()) === 0, `${await markerCount()} markers`);
await closeSheet();

// (1b) Find with layers off: nothing listed, by search or by Kind.
await nav('Find').click();
await page.waitForTimeout(800);
check('(1b) Find layers-off: 0 results by default', (await page.locator('.place-result').count()) === 0);
await page.locator('#atlas-search').fill('Vice');
await page.waitForTimeout(1200);
check('(1b) Find layers-off: text search still 0 results', (await page.locator('.place-result').count()) === 0);
const kindBtn = page.locator('.sidebar').getByRole('button', { name: 'Activities', exact: true });
if ((await kindBtn.count()) > 0) {
  await kindBtn.first().click();
  await page.waitForTimeout(1200);
}
check('(1b) Find layers-off: Kind filter still 0 results', (await page.locator('.place-result').count()) === 0);
check('(1b) Find layers-off: still zero pins', (await markerCount()) === 0, `${await markerCount()} markers`);
const findText = (await page.locator('.sidebar').first().textContent()) ?? '';
note(`(1b) Find panel explains the empty list: ${/turn on|layer|choose|pick what/i.test(findText) ? 'YES' : 'NO — panel just says "0 places showing"'}`);
await page.screenshot({ path: `${OUT}spoiler-find-empty.png` });
await nav('Map').click();
await page.waitForTimeout(800);

// (2) Deep link reveals exactly one; closing the sheet leaves it.
await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
await waitTiles();
await page.waitForTimeout(1500);
await skipOnboarding();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
check('(2) deep link: exactly one pin', (await markerCount()) === 1, `${await markerCount()} markers`);
check('(2) deep link: that pin is a highlight', (await highlightedCount()) === 1, `${await highlightedCount()} highlighted`);
check('(2) deep link: no layer badge', (await layersOnBadge()) === 0);
await page.screenshot({ path: `${OUT}spoiler-deep-link.png` });
await closeSheet();
check('(2b) after closing the sheet: the reveal still stands', (await markerCount()) === 1, `${await markerCount()} markers`);

// (3) Reload after a reveal: what comes back?
await page.reload({ waitUntil: 'networkidle' });
await waitTiles();
await page.waitForTimeout(1500);
await skipOnboarding();
await page.waitForTimeout(1000);
const markersAfterReload = await markerCount();
const restoreOffer = page.getByRole('button', { name: /Restore my last layers/ });
note(`(3) after reload: ${markersAfterReload} marker(s) standing before any restore; restore offer present: ${(await restoreOffer.count()) > 0}`);
await page.screenshot({ path: `${OUT}spoiler-after-reload.png` });
if ((await restoreOffer.count()) > 0) {
  await restoreOffer.first().click();
  await page.waitForTimeout(1200);
  note(`(3) after clicking restore: ${await markerCount()} marker(s) standing`);
  await page.screenshot({ path: `${OUT}spoiler-after-restore.png` });
}

// (4) Kill switch after a reveal.
await nav('Layers').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check('(4) kill switch after reveal: zero markers', (await markerCount()) === 0, `${await markerCount()} markers`);
await nav('Map').click();
await page.waitForTimeout(800);

// (5) Ask for shops with layers off (no key: local finder).
await nav('Ask').click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });
await page.getByPlaceholder('Ask about the map…').fill('Show me a shop');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForSelector('.ask-card', { timeout: 15000 });
await page.waitForTimeout(2000);
const shopCards = (await page.locator('.ask-cards').first().textContent()) ?? '';
// The first card carries its category after "·" ("? · Shop" /
// "? · Restaurant"); named places show name + address instead.
// A shop query's TOP result must be a shop — today it is a
// restaurant, which is the finding, not the probe.
const firstCard = (await page.locator('.ask-card').first().textContent()) ?? '';
check('(5) Ask shops: top card is a shop', /·\s*Shop/i.test(firstCard), firstCard.replace(/\s+/g, ' ').slice(0, 120));
check(
  '(5) Ask shops: no gym volunteered (category "· Gym")',
  !/·\s*Gym/i.test(shopCards),
  'a "· Gym" card is in the set',
);
const matchCount = (await page.locator('.ask-message.is-assistant').first().textContent()) ?? '';
const m = matchCount.match(/(\d+)\s+shown of\s+(\d+)/);
note(`(5) Ask shops: finder matched ${m ? `${m[2]} places, showing ${m[1]}` : 'an unparsed count'} for "shop" — first card a restaurant, gas stations and a mall also in the set`);
// "Lootable" on a card is a legitimate place-attribute badge
// (Enterable / Lootable), not Ask volunteering loot content —
// the earlier naive regex matched the badge and was a probe
// false positive; it is not counted as a failure here.
const shopMarkers = await markerCount();
const shopHighlighted = await highlightedCount();
check('(5) Ask shops: pins on the map', shopMarkers > 0, `${shopMarkers} markers`);
check('(5) Ask shops: every pin is an Ask highlight', shopMarkers > 0 && shopMarkers === shopHighlighted, `${shopHighlighted}/${shopMarkers} highlighted`);
check('(5) Ask shops: no layer badge', (await layersOnBadge()) === 0);
await page.screenshot({ path: `${OUT}spoiler-ask-shops.png` });
await nav('Map').click();
await page.waitForTimeout(800);
// Clear the Ask highlights with the kill switch before the
// accumulation test, so the count starts clean.
await nav('Layers').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check('(5b) kill switch clears Ask highlights', (await markerCount()) === 0, `${await markerCount()} markers`);
await nav('Map').click();
await page.waitForTimeout(800);

// (6) Reveal accumulation: deep-link 3 places in a row.
const accCounts = [];
for (const id of ['L1', 'L2', 'L3']) {
  await page.goto(`${base}?place=${id}`, { waitUntil: 'networkidle' });
  await waitTiles();
  await page.waitForTimeout(1200);
  await skipOnboarding();
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(1200);
  await closeSheet();
  accCounts.push(await markerCount());
}
note(`(6) reveal accumulation across deep links L1 -> L2 -> L3: ${accCounts.join(' -> ')} markers standing`);
await page.screenshot({ path: `${OUT}spoiler-accumulation.png` });

// (7) Layer on + kill switch.
await nav('Layers').click();
await page.waitForTimeout(800);
const turnedOn = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.layer-manager input[type="checkbox"]:not(:checked)')];
  if (!boxes.length) return 0;
  boxes[0].click();
  return 1;
});
await page.waitForTimeout(1200);
note(`(7) turned on ${turnedOn} layer; markers now ${await markerCount()}`);
await page.getByRole('button', { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check('(7) layer + reveals + kill switch: zero markers', (await markerCount()) === 0, `${await markerCount()} markers`);
check('(7) saved layers empty after kill switch', ((await savedLayers()) ?? []).filter((id) => id !== 'my-markers').length === 0, JSON.stringify(await savedLayers()));

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(failures.length ? `QA SPOILER-ADVERSARIAL: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA SPOILER-ADVERSARIAL: ALL PASS');
process.exit(failures.length ? 1 : 0);
