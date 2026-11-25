// Diagnostic only — NOT a gate. Finds why a revealed-but-unselected
// place loses its pin: stale render (pan brings it back) or genuine
// exclusion (it never comes back)? Self-serves dist/ on port 4333.
/* global document, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v030-walk-lead/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const BASE_PATH = '/gta6-leonida-atlas/';
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4333');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) { res.writeHead(404); res.end(); return; }
  path = path.slice(BASE_PATH.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4333, resolve));
const base = 'http://127.0.0.1:4333/gta6-leonida-atlas/';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
const skipOnboarding = async () => {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(800); }
};

await page.goto(`${base}?place=L2227`, { waitUntil: 'networkidle' });
await skipOnboarding();
await page.waitForTimeout(1500);
console.log('sheet open: atlas markers =', await count('.atlas-map-marker'), '| leaflet markers =', await count('.leaflet-marker-icon'));

const close = page.getByRole('button', { name: 'Close place details' });
if ((await close.count()) > 0) { await close.first().click(); await page.waitForTimeout(1500); }
console.log('after close: atlas markers =', await count('.atlas-map-marker'), '| leaflet markers =', await count('.leaflet-marker-icon'));
console.log('chrome geometry after close:', JSON.stringify(await page.evaluate(() => window.__vicewireChromeGeometry ?? null)));
console.log('marker debug after close:', JSON.stringify(await page.evaluate(() => window.__vicewireMarkerDebug ?? null)));

// Pan 100px and back — forces a full marker re-render at the same camera.
await page.mouse.move(195, 500);
await page.mouse.down();
await page.mouse.move(295, 500, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('after pan +100: atlas markers =', await count('.atlas-map-marker'));
await page.mouse.move(195, 500);
await page.mouse.down();
await page.mouse.move(95, 500, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('after pan back: atlas markers =', await count('.atlas-map-marker'));

// Zoom in one level then out — another full re-render.
await page.getByRole('button', { name: 'Zoom in' }).click();
await page.waitForTimeout(1500);
console.log('after zoom in: atlas markers =', await count('.atlas-map-marker'));
await page.getByRole('button', { name: 'Zoom out' }).click();
await page.waitForTimeout(1500);
console.log('after zoom out: atlas markers =', await count('.atlas-map-marker'));
await page.screenshot({ path: `${OUT}reveal-diagnostic-end.png` });
await browser.close();
server.close();
