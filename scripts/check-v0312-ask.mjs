// v0.31.2 Ask regression probe (390px, DPR 2). Covers the two fixes
// reported 2026-11-25:
// (1) "Nightclub in vice city" answered "Nothing in the map data"
//     though NINE1NINE and The Vault both carry #nightclub — the
//     retrieval had no nightlife keywords, so no layer was ever
//     requested and the all-layers-off first-open state returned
//     zero records.
// (2) The Ask sheet captured hasKey once at mount, so adding the key
//     in Settings left the "Add your OpenAI key" prompts showing
//     while the sheet stayed open behind the dialog.
// Served from dist/ on port 4341 like the other walks. The OpenAI
// call is blocked: the probe uses a fake key for the hasKey refresh
// check, and the AI text is never what is asserted — the local
// cards are, via the fast local fallback.
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0312-walk-ask/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4341');
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
await new Promise((resolve) => server.listen(4341, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(req.url()));
// The OpenAI call is blocked on purpose (see the header): a fake key
// is used for the hasKey refresh check, and the local fallback is
// what the probe asserts.
await page.route('**/api.openai.com/**', (route) => route.abort());

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const nav = (label) => page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });

await page.goto('http://localhost:4341/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

// The forced indexing onboarding (v0.11) covers the screen on first
// launch — skip it, the way a returning user would.
const skipOnboarding = page.getByRole('button', { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}
// Close the first-open Vice City sheet so the Ask tab is reachable.
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);

async function ask(question) {
  await page.getByPlaceholder('Ask about the map').fill(question);
  await page.getByRole('button', { name: 'Send' }).click();
}

const cardsText = async () => {
  const lists = await page.locator('.ask-cards').allInnerTexts();
  return lists.join('\n');
};

// (1) Nightclub, no key: the local finder must return the two clubs.
await nav('Ask').click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });
await ask('Nightclub in vice city');
await page.waitForSelector('.ask-cards', { timeout: 15000 });
await page.waitForTimeout(800);
const firstCards = await cardsText();
check('nightclub ask returns NINE1NINE', firstCards.includes('NINE1NINE'), firstCards);
check('nightclub ask returns The Vault', firstCards.includes('The Vault'), firstCards);
check(
  'no "Nothing in the map data" for nightclubs',
  !(await page.locator('.ask-panel').innerText()).includes('Nothing in the map data'),
);
check(
  'key prompt shows while there is no key (baseline)',
  (await page.locator('.ask-panel').innerText()).includes('Written answers need your OpenAI key'),
);
await shot('a-nightclub-no-key');

// (2) Add the key mid-session — exactly what Settings does — while
// Ask stays open. The next ask must clear the stale prompt.
await page.evaluate(() =>
  window.localStorage.setItem('leonida-ask-api-key', 'sk-test-probe-key'),
);
await ask('Nightclub in vice city');
await page.waitForFunction(
  () => document.querySelectorAll('.ask-cards').length >= 2,
  null,
  { timeout: 20000 },
);
await page.waitForTimeout(800);
const panelText = await page.locator('.ask-panel').innerText();
check(
  'key prompt gone after adding the key mid-session',
  !panelText.includes('Written answers need your OpenAI key') &&
    !panelText.includes('Add your OpenAI key in Settings'),
  panelText.slice(0, 200),
);
check(
  'footer says the key is saved on this device',
  panelText.includes('Key saved on this device'),
  panelText.slice(0, 200),
);
const secondCards = await cardsText();
check(
  'nightclub cards still show with a key (local fallback)',
  secondCards.includes('NINE1NINE') && secondCards.includes('The Vault'),
  secondCards,
);
await shot('b-nightclub-with-key');

// A "Failed to load resource" console error is the blocked OpenAI
// call's own noise (see the route above) — it counts only when no
// OpenAI request was aborted, i.e. when some other resource failed.
const openAiBlocked = failedRequests.some((url) => url.includes('api.openai.com'));
const realErrors = consoleErrors.filter(
  (error) => !(openAiBlocked && error.includes('Failed to load resource')),
);
check('no console errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));

await browser.close();
server.close();
if (failures.length > 0) {
  console.log(`ASK PROBE: ${failures.length} FAILURES — ${failures.join('; ')}`);
  process.exit(1);
}
console.log('ASK PROBE: all checks passed');
