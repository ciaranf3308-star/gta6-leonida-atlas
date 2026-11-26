/* global document, getComputedStyle */
// Lane B (v0.32.1) — LIVE GEOMETRY CAPTURE for the offline placement sim.
// Captures, at island zoom and district zoom (+2), everything the
// pure placement function needs as input: per-label live height at
// the 200px CSS width, per-region screen box (the dashed SVG rect),
// geo-pill rects, chrome rects, and the map container rect — all in
// container points (viewport coords minus the container origin).
// The sim (scripts/sim-laneB-placement.mjs) replays the CURRENT
// placement rule on this geometry first: if it reproduces the live
// visible counts (7/17 island, 10/17 district), the harness is
// trustworthy for the chrome-preference and narrowing variants.
// 390px, DPR 2, Playwright Chromium, fresh profile
// `demo-laneB-geometry`. Served from `vite preview` on $PORT
// (default 4336). Output: scripts/laneB-geometry.json.
// Usage: PORT=4336 node capture-laneB-geometry.mjs
import { createRequire } from 'node:module';
import { rmSync, writeFileSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4336';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const PROFILE = '/home/hatch/.v032-profiles/demo-laneB-geometry';
rmSync(PROFILE, { recursive: true, force: true });
const OUT = new URL('./laneB-geometry.json', import.meta.url);

async function census(page) {
  return page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      // Floats, unrounded: the placement grid is anchored on the
      // region box's float edges, so rounding to integers shifts
      // the grid and flips borderline gap checks.
      const f = (n) => Math.round(n * 100) / 100;
      return { x: f(b.x), y: f(b.y), w: f(b.width), h: f(b.height) };
    };
    const container = document.querySelector('.atlas-map-canvas') ?? document.querySelector('.leaflet-container');
    const cr = container.getBoundingClientRect();
    const toContainer = (rect) => ({
      left: rect.x - cr.left,
      right: rect.x + rect.w - cr.left,
      top: rect.y - cr.top,
      bottom: rect.y + rect.h - cr.top,
    });
    // Region screen boxes: the dashed SVG rects (stroke-dasharray
    // '6 4', colour #ff8f8f) in creation (= group) order.
    const regionPaths = [...document.querySelectorAll('.leaflet-overlay-pane path')].filter(
      (el) => el.getAttribute('stroke-dasharray') === '6 4',
    );
    const regions = regionPaths.map((el) => toContainer(r(el)));
    // Labels: measure the live height at the 200px CSS width. A
    // suppressed label is display:none (0x0), so un-hide it just
    // long enough to read offsetHeight, then restore.
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) => {
      const cs = getComputedStyle(el);
      const rect = r(el);
      const wasHidden = cs.display === 'none';
      let height = rect.h;
      let width = rect.w;
      if (wasHidden) {
        el.style.display = '';
        width = el.offsetWidth;
        height = el.offsetHeight;
        el.style.display = 'none';
      }
      return {
        text: (el.textContent || '').trim().replace(/\s+/g, ' '),
        rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
        visible: !wasHidden && rect.w > 0 && rect.h > 0,
        width,
        height,
      };
    });
    const chromeDefs = [
      ['hero', '.map-hero'],
      ['edge-stack', '.atlas-edge-stack'],
      ['zoom-controls', '.atlas-edge-zoom'],
      ['map-navigation', '.atlas-map-navigation'],
      ['attribution', '.atlas-map-attribution'],
      ['bottom-nav', '.bottom-nav'],
    ];
    const chrome = [];
    for (const [name, sel] of chromeDefs) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = r(el);
      if (rect.w > 0 && rect.h > 0) chrome.push({ name, rect: toContainer(rect) });
    }
    const pills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({
      name: (el.textContent || '').trim(),
      rect: toContainer(r(el)),
    }));
    return {
      container: { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
      labels,
      regions,
      pills,
      chrome,
    };
  });
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[laneB] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[laneB] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);

const island = await census(page);
console.log(`ISLAND: labels=${island.labels.length} regions=${island.regions.length} pills=${island.pills.length} visible=${island.labels.filter((l) => l.visible).length}`);
console.log(`container ${island.container.w}x${island.container.h}@(${island.container.x},${island.container.y})`);
for (let i = 0; i < island.labels.length; i++) {
  const l = island.labels[i];
  const reg = island.regions[i];
  console.log(`  ${l.visible ? 'VIS ' : 'HID '} ${l.width}x${l.height} region=${reg ? `${Math.round(reg.right - reg.left)}x${Math.round(reg.bottom - reg.top)}@(${Math.round(reg.left)},${Math.round(reg.top)})` : 'MISSING'} :: ${l.text.slice(0, 60)}`);
}

for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const district = await census(page);
console.log(`DISTRICT: labels=${district.labels.length} regions=${district.regions.length} pills=${district.pills.length} visible=${district.labels.filter((l) => l.visible).length}`);
for (let i = 0; i < district.labels.length; i++) {
  const l = district.labels[i];
  const reg = district.regions[i];
  console.log(`  ${l.visible ? 'VIS ' : 'HID '} ${l.width}x${l.height} region=${reg ? `${Math.round(reg.right - reg.left)}x${Math.round(reg.bottom - reg.top)}@(${Math.round(reg.left)},${Math.round(reg.top)})` : 'MISSING'} :: ${l.text.slice(0, 60)}`);
}

writeFileSync(OUT, JSON.stringify({ island, district }, null, 2));
console.log('wrote', OUT.pathname);
await ctx.close();
