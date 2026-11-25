// v0.30.1 — PWA update, first-reload activation tally (Finding #2).
// Reproduces the two-open behaviour QA measured (3/9 first-reload
// activations): serve the deployed v0.29 artifact on port 4343, let
// its SW install, swap the server root to the current dist/ and
// reload ONCE. Then poll the registration every 500 ms for 20 s and
// record the full lifecycle timeline — this distinguishes the three
// candidate mechanisms:
//   (a) worker stuck in `waiting` (install-time skipWaiting never
//       took effect),
//   (b) worker activates but never takes control (clients.claim()
//       never runs — the generated worker chains .then() onto
//       event.waitUntil(), which returns undefined),
//   (c) install/activation just slow (timeline shows it landing late).
// Tally over 9 fresh contexts: `landed` = new worker controls the
// page AND the new bundle runs after ONE reload (allowing the app's
// own controllerchange reload to fire). Fixture ids only.
/* global document, navigator, caches */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0301-walk-fix/';
mkdirSync(OUT, { recursive: true });
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
// Read the CURRENT dist's identity (bundle + cache) instead of
// hardcoding it: the fix rebuild changes both.
const DIST = '/home/hatch/workspace/gta6-leonida-atlas/dist';
const distHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const NEW_BUNDLE = (distHtml.match(/assets\/index-[A-Za-z0-9_-]+\.js/) ?? ['index-UNKNOWN.js'])[0];
const distSw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const NEW_CACHE = (distSw.match(/const CACHE="([^"]+)"/) ?? [null, 'UNKNOWN'])[1];
const OLD_CACHE = 'atlas-b40404d5-f08ffcf507d2';
console.log(`probe target: bundle=${NEW_BUNDLE} cache=${NEW_CACHE}`);

const browser = await chromium.launch();
const runs = [];
const RUNS = Number(process.env.RUNS ?? 9);

for (let run = 1; run <= RUNS; run++) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  const skipOnboarding = async () => {
    try {
      const skip = page.getByRole('button', { name: /Skip for now/ });
      if ((await skip.count()) > 0) {
        await skip.first().click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch { /* page mid-reload; retry next poll */ }
  };
  const sample = async () => {
    try {
      return await page.evaluate(async ({ newCache, oldCache }) => {
        const reg = await navigator.serviceWorker?.getRegistration();
        const st = (w) => (w ? w.state : 'null');
        const ctrl = navigator.serviceWorker.controller;
        // Controller version via the rigged land tile: v0.30 worker
        // answers 404, v0.29 (old ocean fallback) answers 200.
        let controller;
        try {
          const r = await fetch('/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/1/1,3,2.jpg');
          controller = r.status === 404 ? 'v0.30' : 'v0.29';
        } catch { controller = 'fetch-failed'; }
        return {
          active: st(reg?.active),
          waiting: st(reg?.waiting),
          installing: st(reg?.installing),
          controller,
          hasController: Boolean(ctrl),
          bundle: [...document.querySelectorAll('script[src*="index-"]')].map((s) => s.getAttribute('src')),
          caches: await caches.keys(),
          hasNewCache: (await caches.keys()).includes(newCache),
          hasOldCache: (await caches.keys()).includes(oldCache),
        };
      }, { newCache: NEW_CACHE, oldCache: OLD_CACHE });
    } catch (e) {
      if (!sample._logged) {
        sample._logged = true;
        console.log(`  sample error: ${String(e?.message ?? e).slice(0, 300)}`);
      }
      return null; // page navigating (controllerchange reload)
    }
  };

  // 1. Load v0.29, let its SW install.
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding();
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // 2. Swap root to the current dist and reload ONCE.
  ROOT = '/home/hatch/workspace/gta6-leonida-atlas/dist';
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const timeline = [];
  let landed = false;
  let landedAtMs = null;
  let sawWaiting = false;
  let sawActivating = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    await skipOnboarding();
    const s = await sample();
    if (!s) continue;
    const elapsed = Date.now() - t0;
    if (s.waiting !== 'null') sawWaiting = true;
    if (s.active === 'activating') sawActivating = true;
    timeline.push({ t: elapsed, active: s.active, waiting: s.waiting, installing: s.installing, ctrl: s.controller });
    if (!landed && s.controller === 'v0.30' && s.bundle.some((b) => b.includes(NEW_BUNDLE))) {
      landed = true;
      landedAtMs = elapsed;
    }
  }
  const last = timeline[timeline.length - 1];
  runs.push({ run, landed, landedAtMs, sawWaiting, sawActivating, last });
  console.log(
    `run ${run}: landedAfterOneReload=${landed}${landedAtMs !== null ? ` @${landedAtMs}ms` : ''} sawWaiting=${sawWaiting} sawActivating=${sawActivating} final=${JSON.stringify(last)}`,
  );
  // Compact timeline: only state changes.
  const changes = timeline.filter((e, i) => i === 0 || JSON.stringify([e.active, e.waiting, e.installing, e.ctrl]) !== JSON.stringify([timeline[i - 1].active, timeline[i - 1].waiting, timeline[i - 1].installing, timeline[i - 1].ctrl]));
  console.log(`  timeline: ${changes.map((e) => `${e.t}ms a=${e.active} w=${e.waiting} i=${e.installing} ctrl=${e.ctrl}`).join(' | ')}`);
  await context.close();
  // Next run starts from v0.29 again.
  ROOT = '/home/hatch/workspace/v029-gh-pages';
}

await browser.close();
server.close();
const landedCount = runs.filter((r) => r.landed).length;
console.log(`PWA UPDATE v0.30.1: ${landedCount}/${RUNS} first-reload activations`);
process.exit(landedCount === RUNS ? 0 : 1);
