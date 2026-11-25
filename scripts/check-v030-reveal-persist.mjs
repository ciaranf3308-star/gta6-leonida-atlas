// Lead verification probe — v0.30.0 reveal persistence.
// Question: does a deep-link reveal survive closing the place sheet?
// The spoiler rule says a reveal is a place the user asked to see
// individually; the map lane flagged that closing the sheet seemed to
// clear it (0 markers). The code says select(null) and goMap() never
// clear highlightIds — only onClearHighlights does — so this probe
// settles it empirically: deep link ?place=L2227, close the sheet,
// count .atlas-map-marker pins with every layer still off.
// Self-serves dist/ on port 4332 (like the spoiler probe).
/* global document */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v030-walk-lead/';
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

const base = 'http://127.0.0.1:4332/gta6-leonida-atlas/';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const countMarkers = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);

const skipOnboarding = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};

// 1. Deep link to L2227 (downtown) with everything off.
await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForTimeout(1500);
const sheetOpen = (await page.getByRole('button', { name: 'Close place details' }).count()) > 0;
check('deep link opens the place sheet', sheetOpen);
const before = await countMarkers();
check('deep link reveals exactly one pin (layers off)', before === 1, `markers=${before}`);
await page.screenshot({ path: `${OUT}reveal-sheet-open.png` });

// 2. Close the sheet. The pin must SURVIVE — the user asked for this
// place; closing the sheet to look at the map must not erase it.
// Only an explicit clear (Ask "Clear highlights") may remove it.
const close = page.getByRole('button', { name: 'Close place details' });
if ((await close.count()) > 0) {
  await close.first().click();
  // The sheet close recenters the reveal into the visible band (the
  // camera fly is animated) — allow it to settle before counting.
  await page.waitForTimeout(1800);
}
const after = await countMarkers();
check('reveal survives closing the sheet', after === 1, `markers=${after}`);
await page.screenshot({ path: `${OUT}reveal-sheet-closed.png` });

// 2b. Instrument: is the highlight itself gone, or just the pin?
// The Ask panel keeps the TRUE highlight set — "Clear highlights (N)"
// shows the count honestly. Open Ask and read it.
const askTab = page.getByRole('button', { name: /^Ask/i });
if ((await askTab.count()) > 0) {
  await askTab.first().click();
  await page.waitForTimeout(1000);
}
const clearBtn = page.getByRole('button', { name: /Clear highlights/i });
const clearText = (await clearBtn.count()) > 0 ? (await clearBtn.first().textContent()) ?? '' : 'absent';
console.log(`Ask "Clear highlights" after sheet close: ${clearText}`);
await page.screenshot({ path: `${OUT}reveal-ask-after-close.png` });

// 3. Clearing the reveal (Ask "Clear highlights") must remove the pin.
// ("Turn everything off" now ALSO clears highlights — the v0.30
// kill-switch fix — and stays enabled while any highlight exists.
// Before that fix it only turned layers off and was disabled with no
// layer on, which is why an earlier version of this probe timed out
// clicking it. This probe clears via Ask instead, which is the
// explicit per-reveal path.)
// Click it while Ask is still open.
if ((await clearBtn.count()) > 0) {
  await clearBtn.first().click();
  await page.waitForTimeout(1200);
}
const cleared = await countMarkers();
check('clearing the reveal removes the pin', cleared === 0, `markers=${cleared}`);
const closeAsk = page.getByRole('button', { name: /Close Ask/i });
if ((await closeAsk.count()) > 0) {
  await closeAsk.first().click();
  await page.waitForTimeout(800);
}

await browser.close();
server.close();
console.log(failures.length ? `REVEAL PROBE: ${failures.length} FAILURES` : 'REVEAL PROBE: ALL PASS');
process.exit(failures.length ? 1 : 0);
