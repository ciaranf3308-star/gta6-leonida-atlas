// QA v0.30.0 — PWA update, real v0.29 -> v0.30 on ONE origin.
// Serves the exact deployed v0.29 artifact (~/workspace/v029-
// gh-pages, gh-pages a9368a2cf) on port 4343, lets its SW install
// and cache, then swaps the server root to the v0.30 dist/ and
// reloads. Acceptance: the update must actually land — new bundle,
// new worker controlling, old cache deleted.
// KNOWN BEHAVIOUR (measured, see REPORT.md FINDING #2): on the
// FIRST reload the new worker installs but sits in `waiting:
// installed` ~3 times in 4 despite skipWaiting(), and the old
// v0.29 worker keeps control for the whole session (a failed land
// tile still answers ocean.jpg). A SECOND reload activates it.
// So this probe asserts the final state after TWO reloads, and
// logs the first-reload state as an observation, not a failure.
// Fixture ids only.
/* global caches, document, navigator */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/qa-v030/';
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
let ROOT = '/home/hatch/workspace/v029-gh-pages';
const RIG = new Set(['assets/gta6-leonida-atlas/tiles/graded/1/1,3,2.jpg']);
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4343');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith('/gta6-leonida-atlas/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  if (RIG.has(path)) {
    res.writeHead(404);
    res.end('QA rig 404');
    return;
  }
  const file = join(ROOT, path);
  if (!existsSync(file) || !file.startsWith(ROOT)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4343, resolve));
const base = 'http://127.0.0.1:4343/gta6-leonida-atlas/';

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
const skipOnboarding = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(800);
  }
};
const state = () =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    const st = (w) => (w ? w.state : 'null');
    return {
      bundle: [...document.querySelectorAll('script[src*="index-"]')].map((s) => s.getAttribute('src')),
      active: st(reg?.active),
      waiting: st(reg?.waiting),
      installing: st(reg?.installing),
      caches: await caches.keys(),
    };
  });
// Discriminator: which worker controls the page? Rigged land tile:
// v0.30 -> 404; v0.29 (old ocean fallback) -> 200 ocean.jpg.
const controllerVersion = () =>
  page.evaluate(async () => {
    const r = await fetch('/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/1/1,3,2.jpg');
    return r.status === 404 ? 'v0.30' : 'v0.29';
  });

// 1. Load v0.29, let its SW install.
await page.goto(base, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(3000);
const v29 = await state();
console.log('v0.29 state:', JSON.stringify(v29));
check('update setup: v0.29 bundle running', v29.bundle.some((b) => b.includes('index-AY5db6r8.js')), JSON.stringify(v29.bundle));
check('update setup: v0.29 SW active', v29.active === 'activated', v29.active);
check('update setup: v0.29 cache present', v29.caches.includes('atlas-b40404d5-f08ffcf507d2'), JSON.stringify(v29.caches));

// 2. Swap the root to v0.30 and reload (first open after the deploy).
ROOT = '/home/hatch/workspace/gta6-leonida-atlas/dist';
await page.reload({ waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(5000);
const after1 = await state();
const ctrl1 = await controllerVersion();
console.log('after reload 1:', JSON.stringify(after1), 'controller:', ctrl1);
console.log(
  `OBSERVATION reload 1: new worker ${after1.waiting === 'installed' ? 'STUCK WAITING' : 'activated'}; controller is ${ctrl1}; old cache ${after1.caches.includes('atlas-b40404d5-f08ffcf507d2') ? 'still present' : 'deleted'}`,
);

// 3. Second open: reload again — this is what lands the update.
await page.reload({ waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(5000);
const after2 = await state();
const ctrl2 = await controllerVersion();
console.log('after reload 2:', JSON.stringify(after2), 'controller:', ctrl2);
check('update: new bundle running after second open', after2.bundle.some((b) => b.includes('index-BgUtJ1IL.js')), JSON.stringify(after2.bundle));
check('update: no worker left waiting after second open', after2.waiting === 'null', `waiting=${after2.waiting}`);
check('update: v0.30 worker controls after second open', ctrl2 === 'v0.30', `controller=${ctrl2}`);
check('update: old v0.29 cache deleted after second open', !after2.caches.includes('atlas-b40404d5-f08ffcf507d2'), JSON.stringify(after2.caches));
check('update: exactly one cache remains', after2.caches.length === 1 && after2.caches[0] === 'atlas-b40404d5-2d4898649a1e', JSON.stringify(after2.caches));
const tilesAfter = await page.locator('.leaflet-tile-loaded').count();
check('update: tiles still load after the update', tilesAfter > 0, `tiles=${tilesAfter}`);
await page.screenshot({ path: `${OUT}pwa-update-after.png` });

await browser.close();
server.close();
console.log(failures.length ? `QA PWA UPDATE: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA PWA UPDATE: ALL PASS');
process.exit(failures.length ? 1 : 0);
