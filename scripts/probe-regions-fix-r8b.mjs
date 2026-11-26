// Lane 2 (v0.32 regions fix) — R8b / R8d re-probe, adapted from the demo
// lane's scripts/demo-gangop-regions.mjs (same measure(), same steps,
// same expectations — R8b and R8d only, nothing else).
//
// Defect (Finding 2): with the gang-op layer ON, opening any area page
// removed ALL regions (labels=0 rects=0) — sheet-open AND pill state —
// because gangOpLikelyAreas read MapView's `places` prop, which is the
// area-filtered `filtered` list, and unpositioned gang-op places are
// dropped by the area/county filter. The fix feeds the region
// computation places that are NOT area/county-filtered (App.tsx
// likelyAreaPlaces -> MapView likelyAreaPlaces prop).
//
// Acceptance: R8b green (regions survive opening the Kelly County area
// page, layer on) + R8d green (regions return when isolation exits).
// Counts are the CURRENT geography: lanes 4/4b's town-extent merges
// regrouped the 34 regions into 17 rects (was 13 at the v0.32 base),
// and the Kelly County rect now carries Walker Farm alone — Brooks
// Boatworks and the other Port Gellhorn ops draw the town extent.
// Served from `vite preview` (final build, ATLAS_BASE_PATH set) on
// $PORT (default 4330). Fresh profile `demo-gangop-r8b` (wiped).
// Shots: r8b* under shots/. Usage: PORT=4335 node probe-regions-fix-r8b.mjs
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop-r8b';
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

async function measure(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) =>
      (el.textContent || '').trim().replace(/\s+/g, ' '),
    );
    // Lane 1 (Finding 1) suppresses labels whose screen rect would
    // collide (display:none, still in the DOM): DOM count is the
    // regions-drawn evidence; visible count is logged, not gated.
    const visibleLabels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].filter((el) => {
      if (getComputedStyle(el).display === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length;
    const panePaths = [...document.querySelectorAll('.leaflet-overlay-pane path')];
    const dashedRects = panePaths.filter((el) => el.getAttribute('stroke') === '#ff8f8f');
    const masks = panePaths.filter((el) =>
      el.getAttribute('fill') === '#0b1018' && el.getAttribute('fill-opacity') === '0.55',
    ).length;
    return {
      labelCount: labels.length, labels, visibleLabels,
      dashedRectCount: dashedRects.length,
      maskCount: masks,
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 80),
    };
  });
}

async function openAreaPage(page, countyName) {
  await page.getByRole('button', { name: 'Area', exact: false }).first().click();
  await page.waitForTimeout(1200);
  const sheetCrumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
  if (await sheetCrumb.count()) { await sheetCrumb.click(); await page.waitForTimeout(1000); }
  const btn = page.getByRole('button', { name: new RegExp(countyName) }).first();
  await btn.click();
  await page.waitForTimeout(2500);
}

async function closeAreaSheet(page) {
  const x = page.locator('section.area-page button[aria-label="Close area page — show all of Leonida"]').first();
  if (await x.count()) { await x.click(); await page.waitForTimeout(1800); }
  return (await page.locator('section.area-page').count()) === 0;
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[r8b] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[r8b] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// ---------- Baseline: layer on draws 13 grouped regions ----------
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const gangRow = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first();
const box = gangRow.locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);
const m1 = await measure(page);
console.log(`--- island, layer on --- labels=${m1.labelCount} (visible ${m1.visibleLabels}) rects=${m1.dashedRectCount}`);
check('R2 layer on draws 17 grouped region rects + 17 labels', m1.dashedRectCount === 17 && m1.labelCount === 17, `labels=${m1.labelCount} rects=${m1.dashedRectCount}`);

// ---------- Open the Kelly County area page (sheet open) ----------
await openAreaPage(page, 'Kelly County');
await shot(page, 'r8b-kelly-sheet-open');
const m2 = await measure(page);
console.log('--- Kelly area page OPEN (sheet open) ---');
console.log(`labels=${m2.labelCount} (visible ${m2.visibleLabels}) rects=${m2.dashedRectCount} masks=${m2.maskCount} sheet=${m2.areaSheetOpen} pill=${JSON.stringify(m2.isolationPill)}`);
console.log('labels:', JSON.stringify(m2.labels.slice(0, 4)));
check(
  'R8a Kelly area page opens with the isolation mask live (sheet open)',
  m2.areaSheetOpen && m2.maskCount >= 1,
  `sheet=${m2.areaSheetOpen} masks=${m2.maskCount}`,
);
// The layer toggle is still ON while the sheet is open — read it back.
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const gangStillOn = await page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first().isChecked().catch(() => null);
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(900);
console.log('gang-op checkbox with Kelly sheet open:', gangStillOn);
check(
  'R8b regions survive opening the Kelly area page (layer on, sheet open)',
  m2.labelCount === 17 && m2.dashedRectCount === 17,
  `labels=${m2.labelCount} rects=${m2.dashedRectCount} (layer still on: ${gangStillOn})`,
);
// Post-lane-4b geography: the Kelly County rect carries Walker Farm
// alone; Brooks Boatworks draws the Port Gellhorn town extent.
const kelly = m2.labels.find((l) => l.includes('Kelly County extent (estimate)'));
check(
  'R8b2 the Kelly region itself is still drawn under the Kelly page',
  !!kelly && kelly.includes('Walker Farm'),
  kelly ? kelly.slice(0, 160) : 'no Kelly label',
);
const town = m2.labels.find((l) => l.includes('Brooks Boatworks'));
check(
  'R8b3 the Port Gellhorn town rect is still drawn under the Kelly page',
  !!town && !town.includes('Kelly County extent'),
  town ? town.slice(0, 160) : 'no Brooks Boatworks label',
);

// ---------- Close the sheet via X: exits isolation entirely ----------
const closed = await closeAreaSheet(page);
await page.waitForTimeout(1500);
await shot(page, 'r8b-kelly-isolation-exited');
const m2b = await measure(page);
console.log('--- Kelly sheet CLOSED via X (isolation exited) ---');
console.log(`labels=${m2b.labelCount} (visible ${m2b.visibleLabels}) rects=${m2b.dashedRectCount} masks=${m2b.maskCount} sheet=${m2b.areaSheetOpen} pill=${JSON.stringify(m2b.isolationPill)}`);
check('R8c closing the sheet via X exits isolation (mask gone)', closed && m2b.maskCount === 0 && m2b.areaSheetOpen === false, `closed=${closed} masks=${m2b.maskCount} sheet=${m2b.areaSheetOpen}`);
check('R8d regions return once isolation exits', m2b.labelCount === 17 && m2b.dashedRectCount === 17, `labels=${m2b.labelCount} rects=${m2b.dashedRectCount}`);

await ctx.close();
console.log('\n=== REGIONS-FIX R8b SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
