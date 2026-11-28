// ViceWire v0.33 Lane A (§A9 + focus cuts) demo probe — 390px, DPR 2.
//
// Serves dist/ on port 4345 and drives the real app with Playwright
// Chromium, fresh profile, no key, no seed.
//
//   node scripts/check-v033-lane-a.mjs           # BEFORE mode: records the
//                                                # v0.32.1 behaviour (counts +
//                                                # screenshots, no assertions
//                                                # on the new behaviour)
//   node scripts/check-v033-lane-a.mjs --after   # AFTER mode: asserts the
//                                                # v0.33 Lane A behaviour
//
// BEFORE expectations (v0.32.1): "?" pins render at street zoom
// (is-unnamed markers > 0), "Discover Leonida" renders on region cards,
// "County art" renders in Settings, the index panel is unreachable.
// AFTER expectations: zero is-unnamed markers at island AND street zoom
// with layers on, named places still pin, "Discover Leonida" and
// "County art" are gone, and "Sort the unnamed places" is reachable in
// Settings and still lists the unnamed queue.
//
// Output: hidden_files/v033-demos/ (before-*.png / after-*.png +
// lane-a-checks.json). Screenshots must be LOOKED AT, not just logged.
/* global document */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const AFTER = process.argv.includes('--after');
const PREFIX = AFTER ? 'after' : 'before';
const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v033-demos/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const PORT = 4345;
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
const base = `http://127.0.0.1:${PORT}${BASE_PATH}`;

const results = [];
function check(name, pass, evidence) {
  results.push({ name, pass, evidence: String(evidence ?? '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} — ${evidence ?? ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));

const markerCounts = () =>
  page.evaluate(() => ({
    total: document.querySelectorAll('.atlas-map-marker').length,
    unnamed: document.querySelectorAll('.atlas-map-marker.is-unnamed').length,
    clusters: document.querySelectorAll('.atlas-map-marker.is-cluster').length,
    geoLabels: document.querySelectorAll('.atlas-geo-label').length,
  }));

const shot = (name) => page.screenshot({ path: `${OUT}${PREFIX}-${name}.png` });

try {
  // ---- (0) clean launch: island, everything off -------------------------
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-map-canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const clean = await markerCounts();
  check('clean launch: 0 markers, layers off', clean.total === 0, JSON.stringify(clean));
  await shot('00-clean-launch');

  // ---- (a/b) island zoom, layers on --------------------------------------
  await page.locator('.map-chip').first().click(); // "All"
  await page.waitForTimeout(2500);
  const island = await markerCounts();
  await shot('01-island-all-on');
  if (AFTER) {
    check('island zoom, All on: zero "?" pins', island.unnamed === 0, JSON.stringify(island));
    check('island zoom, All on: named places still pin', island.total > 0, JSON.stringify(island));
    check('island zoom: geo pills still render (geography nav kept)', island.geoLabels > 0, JSON.stringify(island));
  } else {
    check('island zoom, All on: counts recorded (before)', true, JSON.stringify(island));
  }

  // ---- (a) street zoom, downtown Vice City (NINE1NINE, L190) ------------
  // NOTE: the deep link reloads the page, so launch layers are off
  // again — turn All back on AFTER the navigation.
  await page.goto(`${base}?place=L190`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); // close the sheet; camera stays
  await page.waitForTimeout(800);
  await page.locator('.map-chip').first().click(); // "All" again post-reload
  await page.waitForTimeout(1500);
  const zoomIn = page.locator('.atlas-edge-zoom button[aria-label="Zoom in"]');
  for (let i = 0; i < 12; i++) {
    await zoomIn.click().catch(() => {});
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(2000);
  const street = await markerCounts();
  await shot('02-street-downtown-all-on');
  if (AFTER) {
    check('street zoom downtown, All on: zero "?" pins', street.unnamed === 0, JSON.stringify(street));
    check('street zoom downtown, All on: named places still pin', street.total > 0, JSON.stringify(street));
  } else {
    check('street zoom downtown, All on: counts recorded (before)', true, JSON.stringify(street));
  }

  // ---- (d) cut surface 1: "Discover Leonida" on a region card -----------
  await page.goto(`${base}?place=region:ambrosia`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const regional = await page.locator('.regional-research').count();
  const discoverText = await page.locator('text=Discover Leonida').count();
  if (regional > 0) {
    await page.locator('.regional-research').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
  }
  await shot('03-region-card');
  if (AFTER) {
    check('region card: "Discover Leonida" cut', regional === 0 && discoverText === 0, `regional-research nodes=${regional} text=${discoverText}`);
  } else {
    check('region card: "Discover Leonida" present (before)', regional > 0, `regional-research nodes=${regional}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // ---- (d) cut surface 2: "County art" in Settings -----------------------
  // Settings opens from the sidebar footer — on a phone the sidebar
  // only renders with Find open, so open Find first, then Settings.
  await page.locator('.map-search-pill').first().click();
  await page.waitForTimeout(1000);
  const settingsButton = page.getByRole('button', { name: /settings/i }).first();
  await settingsButton.click();
  await page.waitForTimeout(1200);
  const countyArt = await page.locator('text=County art').count();
  const backupSection = await page.locator('text=Back up my ViceWire').count();
  const askSection = await page.locator('text=Ask Nylah (AI)').count();
  if (countyArt > 0) {
    await page.locator('text=County art').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
  }
  await shot('04-settings');
  if (AFTER) {
    check('Settings: "County art" section cut', countyArt === 0, `matches=${countyArt}`);
    check('Settings: backup section kept', backupSection > 0, `matches=${backupSection}`);
    check('Settings: Ask key section kept', askSection > 0, `matches=${askSection}`);
  } else {
    check('Settings: "County art" present (before)', countyArt > 0, `matches=${countyArt}`);
  }

  // ---- (c) "Sort the unnamed places" list --------------------------------
  // After the lane: the panel lives in Settings (buried, collapsed).
  // Before: it is mounted nowhere in the app.
  let indexText = '';
  if (AFTER) {
    const hasPanel = (await page.locator('#index-panel').count()) > 0;
    if (!hasPanel) {
      // Collapsed <details> wrapper: open it first.
      const summary = page.locator('summary:has-text("Sort the unnamed places")').first();
      if ((await summary.count()) > 0) await summary.click();
      await page.waitForTimeout(1200);
    }
    const panel = page.locator('#index-panel');
    indexText = (await panel.textContent()) ?? '';
    await panel.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
    await shot('05-index-panel');
    check(
      'index job: "Sort the unnamed places" lists the unnamed queue',
      /To go/.test(indexText) && /indexed/.test(indexText) && /3,2\d\d/.test(indexText),
      (indexText.match(/[\d,]+ of [\d,]+ indexed|To go · [\d,]+/g) ?? ['no counts found']).join(' | '),
    );
    check(
      'index job: panel says a name is never invented',
      /never invented/i.test(indexText),
      'copy present',
    );
  } else {
    const hasPanel = (await page.locator('#index-panel').count()) > 0;
    check('index job: panel unreachable in the app (before)', !hasPanel, `mounted=${hasPanel}`);
    await shot('05-settings-no-index-panel');
  }

  check('no page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'none');
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | ') || 'none');
} finally {
  writeFileSync(`${OUT}lane-a-checks-${PREFIX}.json`, JSON.stringify({ after: AFTER, results, consoleErrors, failedRequests }, null, 2));
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  server.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${PREFIX} mode)`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((f) => f.name).join(' | ')}`);
  process.exit(1);
}
