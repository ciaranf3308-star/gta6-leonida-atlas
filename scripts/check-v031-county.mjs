// v0.31.0 county + completion probe (390px, DPR 2). Proves the new
// county/completion UI end to end in a real browser against the
// production build:
//   (a) first open shows zero pins and no spoiler content anywhere
//       (no chapter titles, mission names, safehouse names, cheats);
//   (b) the county cards carry the per-county stunt jumps from the
//       gta6-leonida-map-data counties CSV (53/29/19/16/13, 130 total);
//   (c) the completion panel renders all 19 thresholds with their
//       required/total numbers, the stunts breakdown, and the
//       per-county stunt split;
//   (d) tapping + persists the count across a reload, and Start over
//       clears it (two-tap confirm);
//   (e) picking a county isolates it on the map;
//   (f) the About/Credits page credits gta6-leonida-map-data (CC BY
//       4.0, Zenodo DOI).
// Served from dist/ on port 4337 (other lanes own 4330/4331/4332).
/* global document */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v031-county/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4337');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice(BASE_PATH.length) || 'index.html';
  const file = join(DIST, path);
  // Static routes (e.g. /about) are directories with an index.html.
  const resolved = existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
  if (!existsSync(resolved) || !resolved.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream' });
  createReadStream(resolved).pipe(res);
});
await new Promise((resolve) => server.listen(4337, resolve));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const locUrl = msg.location()?.url ?? '';
  if (/Failed to load resource/.test(msg.text()) && locUrl.includes('/tiles/')) return;
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
const bodyText = () => page.evaluate(() => document.body.innerText);

const skipOnboardingIfPresent = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};
const dismissPlaceSheetIfPresent = async () => {
  const close = page.getByRole('button', { name: /Close place details/i });
  if ((await close.count()) > 0) {
    await close.first().click();
    await page.waitForTimeout(800);
  }
};
const openLayers = async () => {
  await page.getByRole('button', { name: /^Layers/i }).click();
  await page.waitForSelector('.sidebar.is-layers-sheet', { timeout: 10000 });
  await page.waitForTimeout(500);
};
const scrollTo = async (selector) => {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'start' });
  }, selector);
  await page.waitForTimeout(600);
};

// (a) First open: zero pins, no spoiler content.
await page.goto('http://localhost:4337/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
await skipOnboardingIfPresent();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
check('first open: zero pins', (await markerCount()) === 0, `${await markerCount()} markers`);
const firstText = await bodyText();
const spoilerStrings = [
  'Just Like Paradise',
  'Paradise Lost',
  'Tits, Ass, Drug Money',
  'Vice City, Baby',
  'Top of the World, Ma',
  'Daily Driver',
  'safehouse',
  'cheat code',
];
const foundSpoilers = spoilerStrings.filter((s) => firstText.toLowerCase().includes(s.toLowerCase()));
check('first open: no spoiler content in the DOM', foundSpoilers.length === 0, foundSpoilers.join(', '));
await shot('a-first-open');
await dismissPlaceSheetIfPresent();

// (b) County cards carry the per-county stunt jumps (CSV values).
await openLayers();
await scrollTo('.county-cards');
const countyText = (await page.locator('.county-cards').innerText()) ?? '';
const expectedStunts = [
  ['Vice-Dale', '53 stunt jumps'],
  ['Kelly', '29 stunt jumps'],
  ['Lummox', '19 stunt jumps'],
  ['Mariana', '16 stunt jumps'],
  ['Leonard', '13 stunt jumps'],
  ['All Leonida', '130 stunt jumps across Leonida'],
];
for (const [name, line] of expectedStunts) {
  check(`county card: ${name} shows "${line}"`, countyText.includes(line), countyText.slice(0, 200));
}
check('county cards: estimates honesty kept', countyText.includes('inland edges are estimates'), '');
await shot('b-county-cards');

// (c) Completion panel: 19 thresholds, stunts breakdown, county split.
await scrollTo('.completion-panel');
const panel = page.locator('.completion-panel');
const summaryText = (await panel.locator('summary').innerText()) ?? '';
check(
  'completion summary: 0% — 0 of 1,325 required',
  /100% completion · 0% — 0 of 1,325 required/.test(summaryText),
  summaryText,
);
await panel.locator('summary').click();
await page.waitForTimeout(600);
const panelText = (await panel.innerText()) ?? '';
const expectedRows = [
  ['Main Story Missions', '0 / 91'],
  ['Gang Operations', '0 / 39'],
  ['Bank Jobs', '0 / 22'],
  ['Payday Loan Jobs', '0 / 7'],
  ["Smash 'n' Grabs", '0 / 34'],
  ['Convenience Store Stick Ups', '0 / 50'],
  ['Collectible Card Sets', '0 / 15 of 18 in the game'],
  ['Cocaine Flamingos', '0 / 100 of 125 in the game'],
  ['WAiNK Landmark Scans', '0 / 100'],
  ['Combined Stunts', '0 / 300 of 397 in the game'],
  ['Underwater Discoveries', '0 / 33'],
  ['Magazines, Books & Comics', '0 / 30'],
  ['Meditation Spots', '0 / 15'],
  ['Vehicles Scanned (WAiNK)', '0 / 200 of 557 in the game'],
  ['Animals Studied (Binoculars)', '0 / 100 of 255 in the game'],
  ["Bret's Hunting Questline", '0 / 15'],
  ['Basketball Hoops', '0 / 90'],
  ['Drone Time Trials', '0 / 42'],
  ['Shooting Range Gold Medals', '0 / 42'],
];
for (const [name, counts] of expectedRows) {
  check(`completion row: ${name} ${counts}`, panelText.includes(name) && panelText.includes(counts), panelText.slice(0, 160));
}
check(
  'completion: stunts breakdown line',
  panelText.includes('130 stunt jumps · 25 base jumps · 40 knife flights · 202 under the bridge'),
  panelText.slice(0, 300),
);
check(
  'completion: per-county stunt split on the stunts row',
  panelText.includes('Lummox 19 · Kelly 29 · Leonard 13 · Vice-Dale 53 · Mariana 16'),
  panelText.slice(0, 300),
);
check('completion: 19 rows render', (await panel.locator('.completion-row').count()) === 19, `${await panel.locator('.completion-row').count()} rows`);
check(
  'completion: no spoiler content in the panel',
  !spoilerStrings.some((s) => panelText.toLowerCase().includes(s.toLowerCase())),
  '',
);
check('completion: backup limitation is stated', panelText.includes('not in the Atlas backup yet'), '');
await shot('c-completion-panel');

// (d) Tap + persists across reload; Start over clears it.
const missionsRow = panel.locator('.completion-row', { hasText: 'Main Story Missions' });
await missionsRow.getByRole('button', { name: /One more Main Story Missions/ }).click();
await page.waitForTimeout(400);
const afterTap = (await panel.innerText()) ?? '';
check('completion: + makes missions 1 / 91', afterTap.includes('1 / 91'), afterTap.slice(0, 160));
const summaryAfterTap = (await panel.locator('summary').innerText()) ?? '';
check(
  'completion: summary updates to 1 of 1,325',
  /1 of 1,325 required/.test(summaryAfterTap),
  summaryAfterTap,
);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await skipOnboardingIfPresent();
await dismissPlaceSheetIfPresent();
await openLayers();
await scrollTo('.completion-panel');
await panel.locator('summary').click();
await page.waitForTimeout(600);
const afterReload = (await panel.innerText()) ?? '';
check('completion: count survives reload', afterReload.includes('1 / 91'), afterReload.slice(0, 160));
// Two-tap reset clears it.
await panel.getByRole('button', { name: 'Start over' }).click();
await page.waitForTimeout(300);
const resetLabel = (await panel.getByRole('button', { name: /Tap again to clear/ }).count()) === 1;
check('completion: reset asks for a second tap', resetLabel, '');
await panel.getByRole('button', { name: 'Tap again to clear all counts' }).click();
await page.waitForTimeout(400);
const afterReset = (await panel.innerText()) ?? '';
check('completion: reset clears missions to 0 / 91', afterReset.includes('0 / 91'), afterReset.slice(0, 160));
await shot('d-completion-after-reset');

// (e) Picking a county isolates it.
await scrollTo('.county-cards');
await page.locator('.county-card', { hasText: 'Vice-Dale' }).first().click();
await page.waitForTimeout(1200);
const activeCard = (await page.locator('.county-card.active').innerText()) ?? '';
// innerText renders the card name uppercased (CSS text-transform).
check('county: Vice-Dale card is active after tap', /vice-dale/i.test(activeCard), activeCard);
await shot('e-county-selected-vice-dale');

// (f) Credits & sources page credits the dataset.
await page.goto('http://localhost:4337/gta6-leonida-atlas/credits', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const aboutText = await bodyText();
check('credits: gta6-leonida-map-data named', aboutText.includes('gta6-leonida-map-data'), aboutText.slice(0, 200));
check('credits: Zenodo DOI shown', aboutText.includes('10.5281/zenodo.24412576'), '');
check('credits: 130 stunt jumps + 19 categories', aboutText.includes('130 across Leonida') && aboutText.includes('19 categories'), '');
check('credits: markers-not-imported reason stated', aboutText.includes('NOT imported'), '');
check('credits: schematic coordinates named', aboutText.toLowerCase().includes('schematic coordinates'), '');
await shot('f-credits');

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`\nCOUNTY PROBE: ${failures.length} FAILURES — ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nCOUNTY PROBE: all checks passed');
