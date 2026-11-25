// QA v0.30.0 — Ask failure modes the lead probe did not cover
// (check-v030-spoiler.mjs already proves the abort-failure fallback
// and Cancel; this proves the other two):
//   (a) 30 s timeout: OpenAI stalls 35 s -> the app must give up
//       at ~30 s with the honest "AI answer unavailable" label and
//       local cards, not hang;
//   (b) bad key (401): honest label + local cards, no crash, no
//       key leaked into the UI.
// Self-serves dist/ on port 4349. No key is real (sk-test-fake).
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4349');
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
await new Promise((resolve) => server.listen(4349, resolve));
const base = 'http://127.0.0.1:4349/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};

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
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);
const skip = page.getByRole('button', { name: /Skip for now/ });
if ((await skip.count()) > 0) {
  await skip.first().click();
  await page.waitForTimeout(800);
}
const close = page.getByRole('button', { name: 'Close place details' });
if ((await close.count()) > 0) {
  await close.first().click();
  await page.waitForTimeout(800);
}
// Seed a fake key so the app actually calls OpenAI.
await page.evaluate(() => window.localStorage.setItem('leonida-ask-api-key', 'sk-test-fake'));
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForSelector('.ask-panel', { timeout: 10000 });

// (a) Timeout: stall OpenAI 35 s; the app must time out at ~30 s.
await page.route('**/api.openai.com/**', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 35000));
  try {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: 'Late answer that must never land.' } }] }),
    });
  } catch {
    /* Request already aborted by the app's 30 s timeout — expected. */
  }
});
const beforeTimeout = await page.locator('.ask-message.is-assistant').count();
const t0 = Date.now();
await page.getByPlaceholder('Ask about the map…').fill('Where can I train?');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForFunction(
  (before) => document.querySelectorAll('.ask-message.is-assistant').length > before,
  beforeTimeout,
  { timeout: 40000 },
);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const timeoutText = (await page.locator('.ask-message.is-assistant').last().textContent()) ?? '';
console.log(`timeout: assistant message landed after ${elapsed}s`);
check('(a) timeout: answer lands at ~30 s, not 35 s+', Number(elapsed) < 33, `${elapsed}s`);
check('(a) timeout: honest label shown', timeoutText.includes('AI answer unavailable'), timeoutText.slice(0, 160));
check('(a) timeout: local cards still land', (await page.locator('.ask-message.is-assistant .ask-card').count()) > 0);
check('(a) timeout: the late AI answer never lands', !timeoutText.includes('Late answer that must never land'));
await page.waitForTimeout(6000);
const afterLate = (await page.locator('.ask-message.is-assistant').last().textContent()) ?? '';
check('(a) timeout: still no late answer 6 s after the stall ends', !afterLate.includes('Late answer that must never land'));
await page.unroute('**/api.openai.com/**');

// (b) Bad key: 401 from OpenAI.
await page.route('**/api.openai.com/**', (route) =>
  route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'Incorrect API key provided' } }),
  }),
);
const before401 = await page.locator('.ask-message.is-assistant').count();
await page.getByPlaceholder('Ask about the map…').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForFunction(
  (before) => document.querySelectorAll('.ask-message.is-assistant').length > before,
  before401,
  { timeout: 20000 },
);
await page.waitForTimeout(500);
const text401 = (await page.locator('.ask-message.is-assistant').last().textContent()) ?? '';
check('(b) 401: honest label shown', text401.includes('AI answer unavailable'), text401.slice(0, 160));
check('(b) 401: local cards still land', (await page.locator('.ask-message.is-assistant .ask-card').count()) > 0);
check('(b) 401: no key material in the UI', !text401.includes('sk-test-fake'));
check('(b) 401: spinner stops', (await page.locator('.ask-loading').count()) === 0);
await page.unroute('**/api.openai.com/**');

// The browser logs "Failed to load resource: 401" for the
// deliberately-failed OpenAI route — that is the fetch failing, not
// the app failing; the app handled it (honest label + local cards).
// Filter those expected resource errors out of the check.
const realErrors = consoleErrors.filter((e) => !/Failed to load resource.*401/.test(e) && !/api\.openai\.com/.test(e));
check('no console errors (other than the expected 401 resource log)', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(failures.length ? `QA ASK: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA ASK: ALL PASS');
process.exit(failures.length ? 1 : 0);
