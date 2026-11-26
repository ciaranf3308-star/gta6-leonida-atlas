// v0.31.4 Ask card probe (390px, DPR 2). Covers the failure reported
// 2026-11-26 — "I need any cards for delight dancers near Capri"
// answered with the Smooth Sand meditation, because the "cards"
// question pulled the whole Loot Map collectibles bucket and the
// meditation was the only eligible place with "Capri" in its region;
// and "help me find the Delights Dancers card set" returned all 25
// collectibles, five cards from five different sets plus every
// meditation, magazine and watch, because nothing narrowed by set.
// Served from dist/ on port 4343 like the other walks. The OpenAI
// call is blocked: no key is set, so the local fallback is what the
// probe asserts — the verdict text plus the local cards.
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0314-walk-ask-cards/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4343');
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
await new Promise((resolve) => server.listen(4343, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(req.url()));
await page.route('**/api.openai.com/**', (route) => route.abort());

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const nav = (label) => page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });

await page.goto('http://localhost:4343/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
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

async function ask(question) {
  await page.getByPlaceholder('Ask about the map').fill(question);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.ask-cards').length >= 1,
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(800);
}

const lastAnswer = async () => {
  const cards = await page.locator('.ask-cards').last().innerText();
  const panel = await page.locator('.ask-panel').innerText();
  return { cards, panel };
};

await nav('Ask').click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });

// (1) His exact question: Delights Dancers cards near Capri. The
// answer is the set's two cards, nearest first — and the verdict
// says honestly that no card is near Capri.
await ask('I need any cards for delight dancers near Capri');
{
  const { cards, panel } = await lastAnswer();
  check('Capri card ask shows Vicki', cards.includes('Vicki'), cards.slice(0, 200));
  check('Capri card ask shows Harley dancer card', cards.includes('Harley'), cards.slice(0, 200));
  check(
    'Capri card ask shows no meditation',
    !cards.toLowerCase().includes('meditation'),
    cards.slice(0, 200),
  );
  check(
    'verdict says no card is near Capri',
    panel.toLowerCase().includes('no card near capri'),
    panel.slice(0, 300),
  );
  check(
    'verdict names the nearest card in Port Gellhorn',
    panel.includes('Harley dancer card') && panel.includes('Port Gellhorn'),
    panel.slice(0, 300),
  );
  await shot('a-cards-near-capri');
}

// (2) Naming the set narrows to the set only — two cards, not all 25
// collectibles and not other sets' cards.
await ask('help me find the Delights Dancers card set');
{
  const { cards } = await lastAnswer();
  check('set ask shows Vicki', cards.includes('Vicki'), cards.slice(0, 200));
  check('set ask shows Harley dancer card', cards.includes('Harley'), cards.slice(0, 200));
  check(
    'set ask shows no other set’s cards',
    !cards.includes('Victor Maravilla') &&
      !cards.includes('Reggie Pierce') &&
      !cards.includes('Lexi Campbell') &&
      !cards.includes('Kyle Lewicky'),
    cards.slice(0, 400),
  );
  check(
    'set ask shows no meditation, magazine or watch',
    !cards.toLowerCase().includes('meditation') &&
      !cards.toLowerCase().includes('magazine') &&
      !cards.toLowerCase().includes('watch'),
    cards.slice(0, 400),
  );
  await shot('b-delights-dancers-set');
}

// (3) A generic collectibles question still takes the whole bucket —
// the narrowing is for card questions only.
await ask('where are the collectibles?');
{
  const { cards } = await lastAnswer();
  check(
    'collectibles ask still shows a meditation',
    cards.toLowerCase().includes('meditation'),
    cards.slice(0, 200),
  );
  await shot('c-collectibles-still-broad');
}

const openAiBlocked = failedRequests.some((url) => url.includes('api.openai.com'));
const realErrors = consoleErrors.filter(
  (error) => !(openAiBlocked && error.includes('Failed to load resource')),
);
check('no console errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`ASK CARDS PROBE: ${failures.length} FAILURES — ${failures.join('; ')}`);
  process.exit(1);
}
console.log('ASK CARDS PROBE: all checks passed');
