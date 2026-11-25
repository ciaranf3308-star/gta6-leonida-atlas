// v0.31.3 Style filing probe (390px, DPR 2). Covers the fix reported
// 2026-11-25: "EVERY clothes store is missing". Six named clothes /
// hair / tattoo shops filed under Robberies because the lootable check
// ran first and their generic 'retail' tag is robbable — Kind → Style
// showed one place (Au Courant). A Style tag now files to shops-style
// first, so Kind → Style lists seven, and the Kind picker + category
// tiles say what "Style" means (Clothing, tattoos, hair & makeup).
// Served from dist/ on port 4342 like the other walks.
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0313-walk-style/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4342');
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
await new Promise((resolve) => server.listen(4342, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const nav = (label) => page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });

await page.goto('http://localhost:4342/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const skipOnboarding = page.getByRole('button', { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);

// Find → Kind → Style: the seven named Style shops. Picking the kind
// turns its layer on (layersWithCategoryEnabled) — before that fix,
// Kind → Style showed "0 places showing" with every layer off and no
// hint why, so the probe failed here on the first run.
await nav('Find').click();
await page.waitForSelector('.find-count', { timeout: 10000 });
const kindSelect = page.getByLabel('Show one kind of place');
const styleOption = await kindSelect.locator('option[value="style"]').innerText();
check(
  'Kind picker says what Style means',
  styleOption.includes('Style') && styleOption.includes('Clothing, tattoos, hair'),
  styleOption,
);
await kindSelect.selectOption('style');
await page.waitForTimeout(800);
const countText = await page.locator('.find-count').innerText();
check(
  'Kind → Style shows 7 places',
  countText.toLowerCase().includes('7 places showing'),
  countText,
);
const resultsText = await page.locator('.place-result').allInnerTexts();
const resultsJoined = resultsText.join('\n');
for (const name of [
  'Stock 305',
  'A1 Fashions',
  'Electric Fang Tattoo',
  'Sara',
  'Kurt',
  'The Old Mill Barber Shop',
  'Au Courant',
]) {
  check(`Style results include ${name}`, resultsJoined.includes(name), resultsJoined.slice(0, 300));
}
check(
  'We Have Shoes is NOT in Style (demolished, stays Unverified)',
  !resultsJoined.includes('We Have Shoes'),
  resultsJoined.slice(0, 300),
);
await shot('a-kind-style');

// The category tile says it too — and the pick turned the layer on.
const tilesText = await page.locator('.category-tiles').innerText();
check(
  'Style tile carries the clothing blurb',
  tilesText.toLowerCase().includes('style') &&
    tilesText.toLowerCase().includes('clothing, tattoos, hair & makeup.'),
  tilesText.slice(0, 300),
);
await shot('b-style-tile');
await nav('Layers').click();
await page.waitForTimeout(800);
check(
  'picking Kind → Style turned the Style layer on',
  await page.getByRole('checkbox', { name: /Style shops/ }).isChecked(),
);

check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`STYLE PROBE: ${failures.length} FAILURES — ${failures.join('; ')}`);
  process.exit(1);
}
console.log('STYLE PROBE: all checks passed');
