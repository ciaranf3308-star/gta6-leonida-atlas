// Lane 5 (v0.32 regions-fix) — VISIBLE-LABEL COUNT + CHROME OCCLUSION.
// NEW in this lane; judges lane 1's label suppression and measures the
// open chrome-occlusion finding. No app code is touched.
// 390px, DPR 2, Playwright Chromium, fresh profile `demo-visible-labels`.
// Served from `vite preview` (final build, ATLAS_BASE_PATH set) on
// $PORT (default 4330).
//   - (e) At island zoom with the gang-op layer on, count how many of
//     the 17 likely-area labels are actually VISIBLE (computed display
//     !== 'none' and a non-zero rect) and NAME the suppressed ones.
//     Same at district zoom (+2 zoom-in clicks). Lane 1 measured 7/17
//     island, 10/17 district, all 0px² overlap. The verdict (acceptable
//     vs over-aggressive) is written in DEMOS-REGIONS.md from these
//     numbers — this script only measures.
//   - (f) CHROME OCCLUSION (open finding, NOT a gate item): for each
//     visible label, measure the overlap px² with every on-screen
//     chrome rect (hero incl. filter-chip row, edge stack, zoom
//     controls, bottom nav, attribution, county title, illustration
//     note). The screenshots are the ground truth for whether the
//     text is actually hidden behind the chrome — the rect overlap
//     says where, the screenshot says whether it reads. A label is
//     flagged occluded when chrome covers any of it; "unreadable"
//     is judged in the report from the screenshots, not asserted here.
// Shots: v01-island-labels.png, v02-district-labels.png (+ v03/v04
// close crops are taken by the report step, not here).
// Usage: PORT=4330 node probe-visible-labels.mjs
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-visible-labels';
mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}
async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: p });
  console.log('shot:', p);
}

/** Full census: every likely-area label (incl. display:none ones),
 * geo pills, and every chrome rect on screen. Occlusion is measured
 * as rect overlap with chrome; the screenshots are the ground truth
 * for whether the text is actually hidden. */
async function measure(page) {
  return page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const overlap = (a, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? Math.round(w * h) : 0;
    };
    // Chrome: every overlay that can sit over map content. Selectors
    // from chrome-geometry.ts (measureChromeGeometry) + the workspace.
    const chromeDefs = [
      ['hero', '.map-hero'],
      ['first-open-hint', '.first-open-hint'],
      ['empty-prompt', '.empty-map-prompt'],
      ['edge-stack', '.atlas-edge-stack'],
      ['zoom-controls', '.atlas-edge-zoom'],
      ['map-navigation', '.atlas-map-navigation'],
      ['attribution', '.atlas-map-attribution'],
      ['county-title', '.county-map-title'],
      ['illustration-note', '.atlas-map-illustration-note'],
      ['bottom-nav', '.bottom-nav'],
      ['isolation-pill', '.isolation-pill'],
    ];
    const chrome = [];
    for (const [name, sel] of chromeDefs) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = r(el);
      if (rect.w > 0 && rect.h > 0) chrome.push({ name, rect });
    }
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) => {
      const cs = getComputedStyle(el);
      const rect = r(el);
      const visible = cs.display !== 'none' && rect.w > 0 && rect.h > 0;
      // Rect overlap with each chrome piece. (Do NOT use
      // elementFromPoint here: Leaflet tooltips are
      // pointer-events:none, so elementFromPoint skips the label
      // and returns the map canvas underneath — every label would
      // read as "occluded". The rect overlap + the screenshots
      // are the measurement; the screenshots are the ground truth
      // for whether the text is actually hidden.)
      const chromeHits = [];
      for (const c of chrome) {
        const o = overlap(rect, c.rect);
        if (o > 0) chromeHits.push({ chrome: c.name, px2: o });
      }
      return {
        text: (el.textContent || '').trim().replace(/\s+/g, ' '),
        rect,
        display: cs.display,
        visible,
        chromeHits,
      };
    });
    const geoPills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({ name: (el.textContent || '').trim(), rect: r(el) }));
    let maxLabelGeo = 0; let worstLabelGeo = null;
    for (const l of labels) {
      if (!l.visible) continue;
      for (const g of geoPills) {
        const o = overlap(l.rect, g.rect);
        if (o > maxLabelGeo) { maxLabelGeo = o; worstLabelGeo = { label: l.text.slice(0, 50), pill: g.name, px2: o }; }
      }
    }
    let maxLabelLabel = 0; let worstLabelLabel = null;
    const vis = labels.filter((l) => l.visible);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const o = overlap(vis[i].rect, vis[j].rect);
      if (o > maxLabelLabel) { maxLabelLabel = o; worstLabelLabel = { a: vis[i].text.slice(0, 40), b: vis[j].text.slice(0, 40), px2: o }; }
    }
    return {
      labelCount: labels.length,
      visibleCount: vis.length,
      labels,
      suppressed: labels.filter((l) => !l.visible).map((l) => l.text),
      chrome,
      geoPillCount: geoPills.length,
      maxLabelGeo, worstLabelGeo, maxLabelLabel, worstLabelLabel,
    };
  });
}

function printCensus(tag, m) {
  console.log(`--- ${tag}: ${m.visibleCount}/${m.labelCount} labels visible ---`);
  console.log(`chrome on screen: ${m.chrome.map((c) => `${c.name} ${c.rect.w}x${c.rect.h}@(${c.rect.x},${c.rect.y})`).join(' | ')}`);
  for (const l of m.labels) {
    const occ = l.chromeHits.length ? ` CHROME ${l.chromeHits.map((h) => `${h.chrome}:${h.px2}px²`).join(',')}` : '';
    console.log(`  ${l.visible ? 'VIS ' : 'HID '} ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y})${occ} :: ${l.text.slice(0, 100)}`);
  }
  console.log(`suppressed (${m.labels.length - m.visibleCount}): ${JSON.stringify(m.suppressed.map((t) => t.slice(0, 45)))}`);
  console.log(`label-vs-geo-pill max ${m.maxLabelGeo}px² worst=${JSON.stringify(m.worstLabelGeo)}; label-vs-label max ${m.maxLabelLabel}px² worst=${JSON.stringify(m.worstLabelLabel)}`);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[vis] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[vis] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);

// ---------- Island zoom ----------
await shot(page, 'v01-island-labels');
const island = await measure(page);
printCensus('ISLAND', island);
check('V1 island zoom: 17 region labels exist in the DOM', island.labelCount === 17, `labels=${island.labelCount}`);
check('V2 island zoom: visible-label count recorded (lane 1 measured 7/17)', island.visibleCount >= 0, `visible=${island.visibleCount}/17 suppressed=${island.labels.length - island.visibleCount}`);
check('V3 island zoom: visible labels do not overlap geo pills', island.maxLabelGeo === 0, `max=${island.maxLabelGeo}px² worst=${JSON.stringify(island.worstLabelGeo)}`);
check('V4 island zoom: visible labels do not overlap each other', island.maxLabelLabel === 0, `max=${island.maxLabelLabel}px² worst=${JSON.stringify(island.worstLabelLabel)}`);

// ---------- District zoom (+2) ----------
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(1200);
}
await shot(page, 'v02-district-labels');
const district = await measure(page);
printCensus('DISTRICT (+2)', district);
check('V5 district zoom: 17 region labels exist in the DOM', district.labelCount === 17, `labels=${district.labelCount}`);
check('V6 district zoom: visible-label count recorded (lane 1 measured 10/17)', district.visibleCount >= 0, `visible=${district.visibleCount}/17 suppressed=${district.labels.length - district.visibleCount}`);
check('V7 district zoom: visible labels do not overlap geo pills', district.maxLabelGeo === 0, `max=${district.maxLabelGeo}px² worst=${JSON.stringify(district.worstLabelGeo)}`);
check('V8 district zoom: visible labels do not overlap each other', district.maxLabelLabel === 0, `max=${district.maxLabelLabel}px² worst=${JSON.stringify(district.worstLabelLabel)}`);

// Reversibility: zoom back out to island and confirm the island set returns.
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Zoom out', exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const back = await measure(page);
const islandVisible = new Set(island.labels.filter((l) => l.visible).map((l) => l.text));
const backVisible = new Set(back.labels.filter((l) => l.visible).map((l) => l.text));
const sameSet = islandVisible.size === backVisible.size && [...islandVisible].every((t) => backVisible.has(t));
check('V9 zoom back out: island visible-label set returns exactly (suppression is reversible)', sameSet, `island=${island.visibleCount} back=${back.visibleCount}`);

await ctx.close();
console.log('\n=== VISIBLE-LABELS SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
console.log(`ISLAND visible=${island.visibleCount}/17 suppressed=${JSON.stringify(island.suppressed.map((t) => t.slice(0, 45)))}`);
console.log(`DISTRICT visible=${district.visibleCount}/17 suppressed=${JSON.stringify(district.suppressed.map((t) => t.slice(0, 45)))}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
