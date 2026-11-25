// v0.31.1 loot layers walk (390px, DPR 2). Proves the two Loot Map
// layers end to end, in a real browser against the production build:
//   (a) first open shows zero pins — both loot layers off by default;
//   (b) turning both loot layers on renders their pins within the
//       120-DOM-marker cap, and the Layers sheet shows their counts;
//   (c) deep-linking a heist shows the Bank job badge and the Loot Map
//       unverified provenance, never presented as confirmed;
//   (d) deep-linking a collectible shows the Collectible badge and the
//       same provenance;
//   (e) Ask for a bank vault with both layers off shows bank jobs only,
//       layers untouched;
//   (f) street zoom with the loot layers on: pins stay readable;
//   (g) Turn everything off leaves zero markers.
// Served from dist/ on port 4338 (the v0.26 walk owns 4331, the v0.30
// spoiler probe 4332). No spoilers beyond the Loot Map places
// themselves, which the user asked to import.
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v031-loot/';
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
const PORT = 4338;
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
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
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  // Leaflet aborts in-flight tile requests when the camera flies
  // again; Chrome echoes each abort as a console "Failed to load
  // resource" for that tile. That is a cancelled request, not a
  // missing tile — ignore the echo.
  const locUrl = msg.location()?.url ?? '';
  if (/Failed to load resource/.test(msg.text()) && locUrl.includes('/tiles/')) {
    return;
  }
  consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  if (req.url().includes('/tiles/') && (req.failure()?.errorText ?? '').includes('ERR_ABORTED')) return;
  failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`);
});
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.url()} ${res.status()}`);
});

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const markerCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);
const highlightedCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker.is-highlighted').length);
const layersOnBadge = () => page.locator('.bottom-nav-badge').count();
const savedVisibleLayers = () =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('leonida-map-view-v1');
    if (!raw) return null;
    try {
      return JSON.parse(raw).visibleLayerIds ?? null;
    } catch {
      return null;
    }
  });

const skipOnboardingIfPresent = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};
const dismissSheetIfPresent = async () => {
  // The sheet's × is aria-label="Close place details" (an X icon, not
  // the text "×") — an exact [aria-label="Close"] never matches it.
  const close = page.locator('.place-sheet [aria-label="Close place details"]').first();
  if ((await close.count()) > 0) {
    await close.click();
    await page.waitForTimeout(800);
  }
};
/** Toggle a layer by its row label text — synthetic DOM click, as the
 *  Layers checkboxes can hit Playwright "not visible" timeouts. */
const toggleLayer = (labelText) =>
  page.evaluate((text) => {
    const input = [...document.querySelectorAll('.layer-row input[type="checkbox"]')].find(
      (i) => i.closest('label')?.textContent?.includes(text),
    );
    if (!input) return false;
    input.click();
    return true;
  }, labelText);
const openLayers = async () => {
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForSelector('.layer-row', { timeout: 10000 });
  await page.waitForTimeout(500);
};

const BASE = `http://localhost:${PORT}/gta6-leonida-atlas/`;

// (a) First open: zero pins, loot layers off.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
check('first open: zero pins', (await markerCount()) === 0, `${await markerCount()} markers`);
check('first open: no layer badge', (await layersOnBadge()) === 0);
check(
  'first open: loot layers not persisted on',
  !((await savedVisibleLayers()) ?? []).some((id) => id.startsWith('loot-')),
  JSON.stringify(await savedVisibleLayers()),
);
await shot('a-first-open');

// (b) Turn both loot layers on: pins render within the 120-DOM cap.
await dismissSheetIfPresent();
await openLayers();
const layersText = (await page.locator('.layer-manager').first().textContent()) ?? '';
check('Layers sheet lists Bank jobs & vaults · 29 places', /Bank jobs & vaults\s*·\s*29 places/.test(layersText), layersText.slice(0, 200));
check('Layers sheet lists Collectibles · Loot Map · 20 places', /Collectibles · Loot Map\s*·\s*20 places/.test(layersText), layersText.slice(0, 200));
check('turn on loot-heists', await toggleLayer('Bank jobs & vaults'));
check('turn on loot-collectibles', await toggleLayer('Collectibles · Loot Map'));
await page.waitForTimeout(2000);
const islandMarkers = await markerCount();
check('loot layers on: pins render', islandMarkers > 0, `${islandMarkers} markers`);
check('loot layers on: within the 120-DOM-marker cap', islandMarkers <= 120, `${islandMarkers} markers`);
await page.getByRole('button', { name: 'Map', exact: true }).click().catch(() => {});
await page.waitForTimeout(800);
await shot('b-loot-layers-island');

// (c) Deep-link a heist: badge + Loot Map provenance, layer still off.
await page.goto(`${BASE}?place=loot:guide-afternoon-delight`, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const heistTitle = (await page.locator('.place-sheet h2').first().textContent()) ?? '';
check('deep link opens Afternoon Delight', heistTitle.trim() === 'Afternoon Delight', heistTitle);
check('deep link heist: exactly one pin', (await markerCount()) === 1, `${await markerCount()} markers`);
const heistBadges = (await page.locator('.place-badges').first().textContent()) ?? '';
check('heist detail: Bank job badge', /Bank job/.test(heistBadges), heistBadges);
const heistEvidence = (await page.locator('.evidence-label').first().textContent()) ?? '';
check(
  'heist detail: Loot Map unverified provenance',
  /Loot Map · community-sourced, unverified/.test(heistEvidence),
  heistEvidence,
);
const heistSource = (await page.locator('.source-link').first().textContent()) ?? '';
check('heist detail: source link names Loot Map (MIT)', /Loot Map \(MIT\)/.test(heistSource), heistSource);
check('deep link heist: loot-heists layer still off (no badge)', (await layersOnBadge()) === 0);
await shot('c-heist-detail');

// (d) Deep-link a collectible: Collectible badge + same provenance.
await page.goto(`${BASE}?place=loot:guide-meditation-jasons-house`, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const medTitle = (await page.locator('.place-sheet h2').first().textContent()) ?? '';
check('deep link opens Jason’s House meditation', medTitle.trim() === 'Jason’s House meditation', medTitle);
check('deep link meditation: exactly one pin', (await markerCount()) === 1, `${await markerCount()} markers`);
const medBadges = (await page.locator('.place-badges').first().textContent()) ?? '';
check('meditation detail: Collectible badge', /Collectible/.test(medBadges), medBadges);
const medEvidence = (await page.locator('.evidence-label').first().textContent()) ?? '';
check(
  'meditation detail: Loot Map unverified provenance',
  /Loot Map · community-sourced, unverified/.test(medEvidence),
  medEvidence,
);
await shot('d-collectible-detail');

// (e) Ask for a bank vault with both layers off: bank jobs only.
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });
await page.getByPlaceholder('Ask about the map…').fill('Where is the nearest bank vault?');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForSelector('.ask-card', { timeout: 15000 });
await page.waitForTimeout(2000);
const askText = (await page.locator('.ask-cards').first().textContent()) ?? '';
check('Ask vault: cards appear', (await page.locator('.ask-card').count()) > 0);
check(
  'Ask vault: cards are bank jobs, not gyms/cards extras',
  /vault|bank/i.test(askText) && !/gym|trading card|Dynamix/i.test(askText),
  askText.slice(0, 160),
);
const eMarkers = await markerCount();
const eHighlighted = await highlightedCount();
check('Ask vault: pins on the map', eMarkers > 0, `${eMarkers} markers`);
check('Ask vault: every pin is an Ask highlight (nothing else leaked)', eMarkers > 0 && eMarkers === eHighlighted, `${eHighlighted}/${eMarkers} highlighted`);
check('Ask vault: loot layers still off (no badge)', (await layersOnBadge()) === 0);
check(
  'Ask vault: loot layers not in persisted visible layers',
  !((await savedVisibleLayers()) ?? []).some((id) => id.startsWith('loot-')),
  JSON.stringify(await savedVisibleLayers()),
);
await shot('e-ask-vault');

// (f) Street zoom with the loot layers on: pins stay readable.
await page.goto(`${BASE}?place=loot:guide-vault-airport-fleeca`, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
await dismissSheetIfPresent();
await openLayers();
check('street: turn on loot-heists', await toggleLayer('Bank jobs & vaults'));
check('street: turn on loot-collectibles', await toggleLayer('Collectibles · Loot Map'));
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Map', exact: true }).click().catch(() => {});
await page.waitForTimeout(500);
// Zoom in twice from the deep-link zoom for a street view.
const zoomIn = page.locator('.leaflet-control-zoom-in');
if ((await zoomIn.count()) > 0) {
  await zoomIn.first().click();
  await page.waitForTimeout(1200);
  await zoomIn.first().click();
  await page.waitForTimeout(1500);
}
const streetMarkers = await markerCount();
check('street zoom: pins render', streetMarkers > 0, `${streetMarkers} markers`);
check('street zoom: within the 120-DOM-marker cap', streetMarkers <= 120, `${streetMarkers} markers`);
await shot('f-street-zoom-loot');

// (g) Turn everything off leaves zero markers.
await openLayers();
await page.getByRole('button', { name: 'Turn everything off' }).click();
await page.waitForTimeout(1500);
check('kill switch: zero markers', (await markerCount()) === 0, `${await markerCount()} markers`);
await shot('g-everything-off');

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`\nLOOT PROBE: ${failures.length} FAILURES — ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nLOOT PROBE: all checks passed');
