// v0.30.0 spoiler audit walk (390px, DPR 2). Proves the deterministic
// spoiler rule end to end, in a real browser against the production
// build — no prompts, no defaults, only code:
//   (a) first open shows zero pins, zero layers on;
//   (b) a deep link reveals exactly ONE place, its layer still off;
//   (c) Ask for a gym with gyms off shows gyms only, layers untouched;
//   (d) an AI failure degrades to the local finder with an honest label;
//   (e) Cancel actually aborts the in-flight AI request — no late answer.
// Served from dist/ on port 4332 (the v0.26 walk owns 4331). No spoilers
// beyond already-public verified places (Dynamix Fitness) and the
// user's own markers (none here).
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v030-walk-spoiler/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4332');
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
await new Promise((resolve) => server.listen(4332, resolve));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  // Leaflet aborts in-flight tile requests when the camera flies
  // again (deep link → Ask fly-to); Chrome echoes each abort as a
  // console "Failed to load resource" for that tile. That is a
  // cancelled request, not a missing tile — ignore the echo. The
  // URL is not in the message text; it is in the location. The
  // deliberate OpenAI abort in (d) echoes the same way.
  const locUrl = msg.location()?.url ?? '';
  if (
    /Failed to load resource/.test(msg.text()) &&
    (locUrl.includes('/tiles/') || locUrl.includes('api.openai.com'))
  ) {
    return;
  }
  consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  // api.openai.com is aborted on purpose in (d); tile requests are
  // aborted on purpose by Leaflet whenever the camera moves again
  // before they land (ERR_ABORTED) — neither is a missing asset.
  if (req.url().includes('api.openai.com')) return;
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
const selectedCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker.is-selected').length);
/** Layers badge on the bottom nav — present only while a public layer is on. */
const layersOnBadge = () => page.locator('.bottom-nav-badge').count();
/** Persisted visible layers (null on a truly fresh profile). */
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

// (a) First open: zero pins, zero layers on.
await page.goto('http://localhost:4332/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
check('first open: zero pins', (await markerCount()) === 0, `${await markerCount()} markers`);
check('first open: no layer badge', (await layersOnBadge()) === 0);
check(
  'first open: no public layer persisted on',
  ((await savedVisibleLayers()) ?? []).filter((id) => id !== 'my-markers').length === 0,
  JSON.stringify(await savedVisibleLayers()),
);
await shot('a-first-open');

// (b) Deep link reveals exactly ONE place, its layer still off.
await page.goto('http://localhost:4332/gta6-leonida-atlas/?place=gym:dynamix', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const sheetTitle = (await page.locator('.place-sheet h2').first().textContent()) ?? '';
check('deep link opens Dynamix Fitness, not the first-open sheet', sheetTitle.trim() === 'Dynamix Fitness', sheetTitle);
check('deep link: exactly one pin', (await markerCount()) === 1, `${await markerCount()} markers`);
check('deep link: that pin is the selected place', (await selectedCount()) === 1, `${await selectedCount()} selected`);
check('deep link: gyms layer still off (no badge)', (await layersOnBadge()) === 0);
check(
  'deep link: gyms not in persisted visible layers',
  !((await savedVisibleLayers()) ?? []).includes('gyms'),
  JSON.stringify(await savedVisibleLayers()),
);
await shot('b-deep-link');

// (c) Ask for a gym with gyms off: gyms only, layers untouched.
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });
await page.getByPlaceholder('Ask about the map…').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForSelector('.ask-card', { timeout: 15000 });
await page.waitForTimeout(2000);
const cardText = (await page.locator('.ask-cards').first().textContent()) ?? '';
check('Ask gym: cards appear', (await page.locator('.ask-card').count()) > 0);
check(
  'Ask gym: cards are gyms, not cards/loot extras',
  /fitness|gym|zenith|dynamix|muscle/i.test(cardText) && !/trading card|lootable/i.test(cardText),
  cardText.slice(0, 120),
);
const cMarkers = await markerCount();
const cHighlighted = await highlightedCount();
check('Ask gym: pins on the map', cMarkers > 0, `${cMarkers} markers`);
check('Ask gym: every pin is an Ask highlight (nothing else leaked)', cMarkers > 0 && cMarkers === cHighlighted, `${cHighlighted}/${cMarkers} highlighted`);
check('Ask gym: gyms layer still off (no badge)', (await layersOnBadge()) === 0);
check(
  'Ask gym: gyms not in persisted visible layers',
  !((await savedVisibleLayers()) ?? []).includes('gyms'),
  JSON.stringify(await savedVisibleLayers()),
);
await shot('c-ask-gyms');

// (d) AI failure degrades to the local finder with an honest label.
await page.evaluate(() => window.localStorage.setItem('leonida-ask-api-key', 'sk-test-fake'));
await page.route('**/api.openai.com/**', (route) => route.abort());
const assistantsBeforeFailure = await page.locator('.ask-message.is-assistant').count();
await page.getByPlaceholder('Ask about the map…').fill('Where can I train?');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForFunction(
  (before) => document.querySelectorAll('.ask-message.is-assistant').length > before,
  assistantsBeforeFailure,
  { timeout: 20000 },
);
await page.waitForTimeout(500);
const assistantText = (await page.locator('.ask-message.is-assistant').last().textContent()) ?? '';
check(
  'AI failure: honest local-only label shown',
  assistantText.includes('AI answer unavailable'),
  assistantText.slice(0, 160),
);
check(
  'AI failure: local cards still land (not an error with zero cards)',
  (await page.locator('.ask-message.is-assistant .ask-card').count()) > 0,
);
await shot('d-ask-ai-failure');
await page.unroute('**/api.openai.com/**');

// (e) Cancel aborts the in-flight AI request — no late answer lands.
await page.route('**/api.openai.com/**', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: 'Dynamix Fitness is the nearest gym.' } }] }),
  });
});
const assistantsBefore = await page.locator('.ask-message.is-assistant').count();
await page.getByPlaceholder('Ask about the map…').fill('Where is the nearest gym?');
await page.getByRole('button', { name: 'Send' }).click();
await page.getByRole('button', { name: 'Cancel' }).click();
await page.waitForTimeout(700);
check('Cancel: spinner stops', (await page.locator('.ask-loading').count()) === 0);
check(
  'Cancel: no answer appended for the cancelled question',
  (await page.locator('.ask-message.is-assistant').count()) === assistantsBefore,
);
// The delayed response arrives ~3 s after send; it must still not land.
await page.waitForTimeout(3500);
check(
  'Cancel: the late AI response never lands',
  (await page.locator('.ask-message.is-assistant').count()) === assistantsBefore,
);
await shot('e-ask-cancel');
await page.unroute('**/api.openai.com/**');

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no failed requests (other than the deliberate OpenAI abort)', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`\nSPOILER PROBE: ${failures.length} FAILURES — ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nSPOILER PROBE: all checks passed');
