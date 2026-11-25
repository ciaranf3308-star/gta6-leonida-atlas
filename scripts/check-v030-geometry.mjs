// v0.30.0 measured-geometry probe (390px, DPR 2). Proves the chrome
// clamp reads LIVE interface geometry instead of the old hardcoded
// offsets: change a chrome rect in the harness and the reported
// geometry — and the marker clamp and the fit framing — follow it.
//
//  Phase 1 — hero +60px: ResizeObserver fires on the hero resize,
//    the marker render re-measures, heroBottom/topBand move +60 and
//    no marker is left under the taller hero (count never rises).
//  Phase 2 — fit follows: recenter after the hero change frames the
//    island ~30px lower — fitBounds centres in the padded box, so
//    the pane moves by half the +60 top-padding change.
//  Phase 3 — zoom pill moved (bottom 76px -> 200px): a position
//    change is not a resize, so it lands on the next render (the
//    drag out-and-back forces one); zoomControls.bottom moves -124.
//  Phase 4 — hero restored: the geometry follows back down.
//
// Served from dist/ on port 4331 like the other walks. Run against
// the current dist/ build.
//
// Run: node scripts/check-v030-geometry.mjs
/* global document, getComputedStyle, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v030-walk-map/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4331');
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
await new Promise((resolve) => server.listen(4331, resolve));

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
const geometry = () => page.evaluate(() => window.__vicewireChromeGeometry ?? null);
const markerCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);
// Map pane translateY: the fitted island's screen position. A taller
// hero pushes the fit down by the same amount.
const paneTranslateY = () =>
  page.evaluate(() => {
    const el = document.querySelector('.leaflet-map-pane');
    if (!el) return null;
    const m = /translate3d\([^,]+,\s*([-\d.]+)px/.exec(el.style.transform ?? '');
    return m ? Number(m[1]) : null;
  });
const recenter = async () => {
  await page.getByRole('button', { name: /Show all of Leonida/ }).first().click();
  await page.waitForTimeout(1800);
};

await page.goto('http://localhost:4331/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

// Forced indexing onboarding on first launch — skip it.
const skipOnboarding = page.getByRole('button', { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.getByRole('button', { name: /Show interiors/i }).click();
await page.waitForFunction(() => document.querySelectorAll('.atlas-map-marker').length > 0, null, {
  timeout: 10000,
});
await recenter();
const g0 = await geometry();
const m0 = await markerCount();
const t0 = await paneTranslateY();
check('baseline geometry is measured (not the fallback)', !!g0 && g0.width === 390, JSON.stringify(g0));
check('baseline has markers on screen', m0 > 0 && m0 <= 120, `markers=${m0}`);
// Regression guard (v0.30.0): the stack and pill are siblings of
// the Leaflet canvas, not children of it — the first cut of
// measureChromeGeometry queried them from the canvas and they all
// came back null, so the clamp silently stopped avoiding the pill.
// The probe asserts they are measured, at the rects the
// calibration probe recorded. The attribution is NOT in this guard
// any more: v0.31.2 removed the on-map footer (the user asked for a
// clean map), so attributionTop is null by design and the 40px
// bottom strip guards pins instead.
check(
  'edge stack is measured (not null)',
  !!g0?.edgeStack && Math.abs(g0.edgeStack.left - 330) <= 2 && Math.abs(g0.edgeStack.top - 196) <= 2,
  JSON.stringify(g0?.edgeStack),
);
check(
  'zoom pill is measured (not null)',
  !!g0?.zoomControls && Math.abs(g0.zoomControls.left - 328) <= 2 && Math.abs(g0.zoomControls.top - 596) <= 2,
  JSON.stringify(g0?.zoomControls),
);
check(
  'attribution is gone by design (null) — the 40px bottom strip guards pins',
  g0?.attributionTop === null,
  `attributionTop=${g0?.attributionTop}`,
);
await shot('a-geometry-baseline');
console.log(`  baseline: heroBottom=${g0?.heroBottom} topBand=${g0?.topBand} markers=${m0} paneY=${t0}`);

// Phase 1 — grow the hero by 60px. The observer must fire on the
// resize alone: no map move, no click.
const heroDelta = await page.evaluate(() => {
  const hero = document.querySelector('.map-hero');
  if (!hero) return null;
  const h = hero.getBoundingClientRect().height;
  hero.style.height = `${h + 60}px`;
  return 60;
});
check('hero element found and grown', heroDelta === 60);
await page.waitForFunction(
  (expected) => (window.__vicewireChromeGeometry?.heroBottom ?? 0) >= expected,
  (g0?.heroBottom ?? 0) + 55,
  { timeout: 5000 },
);
const g1 = await geometry();
const m1 = await markerCount();
const dHero = (g1?.heroBottom ?? 0) - (g0?.heroBottom ?? 0);
check('heroBottom follows the +60px hero', Math.abs(dHero - 60) <= 5, `Δ=${dHero}`);
// topBand is topChromeBottom + 12, and topChromeBottom is the MAX
// of hero/note/title — v0.31.2 removed the illustration note, so
// at baseline the hero already binds and topBand = heroBottom + 12.
// What must hold is that the grown hero still dominates the band:
// topBand = heroBottom + 12, and it moves down by the full 60.
check(
  'topBand follows the grown hero (hero now dominates)',
  Math.abs((g1?.topBand ?? 0) - ((g1?.heroBottom ?? 0) + 12)) <= 1,
  `topBand=${g1?.topBand} heroBottom=${g1?.heroBottom}`,
);
check('topBand moved down with the taller hero', (g1?.topBand ?? 0) > (g0?.topBand ?? 0), `Δ=${(g1?.topBand ?? 0) - (g0?.topBand ?? 0)}`);
check('no marker appears under the taller hero', m1 <= m0 && m1 > 0, `markers ${m0} → ${m1}`);
await shot('b-geometry-hero-tall');
console.log(`  after hero +60: heroBottom=${g1?.heroBottom} topBand=${g1?.topBand} markers=${m1}`);

// Phase 2 — the fit framing follows the measured hero: recenter
// with the taller hero frames the island lower. fitBounds centres
// the island in the padded box, so a +60 top padding moves the
// centre (and the pane) by HALF the padding change — +30, not +60.
await recenter();
const t1 = await paneTranslateY();
const dPane = (t1 ?? 0) - (t0 ?? 0);
check('fit framing follows the taller hero', Math.abs(dPane - 30) <= 10, `paneY ${t0} → ${t1} (Δ=${dPane})`);

// Phase 3 — move the zoom pill: bottom 76px -> 200px. A position
// change is not a resize, so the observer does not fire for it; it
// lands on the next render, which the drag out-and-back forces (a
// recenter would be a no-op here — the camera is already fitted —
// so it would not re-render at all).
const pillDelta = await page.evaluate(() => {
  const pill = document.querySelector('.atlas-edge-zoom');
  if (!pill) return null;
  const before = Number.parseFloat(getComputedStyle(pill).bottom);
  pill.style.bottom = '200px';
  return 200 - before;
});
check('zoom pill element found and moved', pillDelta !== null && pillDelta > 100, `Δbottom=${pillDelta}`);
await page.mouse.move(195, 400);
await page.mouse.down();
await page.mouse.move(215, 400, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
await page.mouse.move(215, 400);
await page.mouse.down();
await page.mouse.move(195, 400, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
const g2 = await geometry();
const m2 = await markerCount();
const dPill = (g2?.zoomControls?.bottom ?? 0) - (g0?.zoomControls?.bottom ?? 0);
check(
  'zoomControls.bottom follows the moved pill',
  Math.abs(dPill + (pillDelta ?? 0)) <= 10,
  `Δ=${dPill} expected=${-(pillDelta ?? 0)}`,
);
check('marker count stable after the pill move', m2 <= m0 + 2 && m2 > 0, `markers ${m0} → ${m2}`);

// Phase 4 — restore the hero: the geometry follows back down.
await page.evaluate(() => {
  const hero = document.querySelector('.map-hero');
  if (hero) hero.style.height = '';
});
await page.waitForFunction(
  (expected) => (window.__vicewireChromeGeometry?.heroBottom ?? 999) <= expected,
  (g0?.heroBottom ?? 0) + 5,
  { timeout: 5000 },
);
const g3 = await geometry();
const m3 = await markerCount();
const dRestore = (g3?.heroBottom ?? 0) - (g0?.heroBottom ?? 0);
check('heroBottom follows the hero back down', Math.abs(dRestore) <= 5, `Δ=${dRestore}`);
check('marker count stable after restore', m3 <= m0 + 2 && m3 > 0, `markers ${m0} → ${m3}`);
await shot('c-geometry-restored');

await browser.close();
server.close();

if (consoleErrors.length > 0) {
  console.error('page errors:', consoleErrors);
  process.exit(1);
}
if (failures.length > 0) {
  console.error(`geometry probe: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('geometry probe: all checks passed');
