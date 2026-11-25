// v0.30.1 — onboarding "What is mapped" counts (Finding #4).
// Asserts the fixed rendering: the layer name and its count no
// longer jam together ("Named regions6 on the map"). Reads the
// rendered text of the .welcome-counts list on first open at 390px
// DPR 2 and screenshots it. Self-serves dist/ on port 4353.
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0301-walk-fix/';
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
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4353');
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
await new Promise((resolve) => server.listen(4353, resolve));
const base = 'http://127.0.0.1:4353/gta6-leonida-atlas/';

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
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.welcome-counts', { timeout: 20000 });
await page.waitForTimeout(1200);
// The jam is VISUAL: with display:block the count sits on its own
// line under the name. textContent() concatenates the two with no
// whitespace regardless of layout, so it can never see the fix —
// measure what the user sees with innerText(), which is
// layout-aware and puts block boxes on separate lines.
const countsText = (await page.locator('.welcome-counts').innerText()) ?? '';
console.log('counts text:', JSON.stringify(countsText.replace(/\s+/g, ' ').slice(0, 300)));
// The jam: a letter immediately followed by digits then " on the
// map", e.g. "Named regions6 on the map" / "Community places646".
const jammed = /[A-Za-z]\d[\d,]* on the map/.test(countsText);
check('welcome counts: no name/number jam', !jammed, countsText.replace(/\s+/g, ' ').slice(0, 200));
// The rows must still read their real numbers.
check('welcome counts: "Named regions" row present with a count', /Named regions/.test(countsText) && /\d+ on the map/.test(countsText), countsText.slice(0, 200));
await page.locator('.welcome-counts').screenshot({ path: `${OUT}welcome-counts.png` });
await page.screenshot({ path: `${OUT}welcome-sheet.png` });

await browser.close();
server.close();
console.log(failures.length ? `WELCOME v0.30.1: ${failures.length} FAILURES — ${failures.join(', ')}` : 'WELCOME v0.30.1: ALL PASS');
process.exit(failures.length ? 1 : 0);
