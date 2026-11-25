// QA v0.30.0 — WebKit attempt (acceptance matrix wants Chromium AND
// WebKit; sandbox WebKit e2e is known-broken — record the outcome
// honestly, never as a pass). Tries webkit.launch() + a plain load
// of the app at 390px DPR 2; reports what happens.
/* global document */
import { webkit } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4357');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith('/gta6-leonida-atlas/')) { res.writeHead(404); res.end(); return; }
  path = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4357, resolve));
try {
  // The repo's Playwright wants webkit-2336; the cache holds 2370.
  // Try the cached build directly before declaring it untestable.
  const browser = await webkit.launch({
    timeout: 30000,
    executablePath: '/home/hatch/.cache/ms-playwright/webkit-2370/pw_run.sh',
  });
  console.log('webkit.launch() succeeded, version:', browser.version());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4357/gta6-leonida-atlas/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  const markers = await page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);
  console.log(`WebKit load: tiles=${tiles}, markers=${markers}, pageerrors=${errors.length}`);
  await page.screenshot({ path: '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/qa-v030/webkit-island.png' });
  console.log(errors.length ? `WebKit: LOADED WITH ${errors.length} PAGE ERRORS` : 'WebKit: LOADED CLEAN');
  await browser.close();
} catch (e) {
  console.log('WebKit UNTESTABLE in this sandbox:', String(e).slice(0, 300));
}
server.close();
