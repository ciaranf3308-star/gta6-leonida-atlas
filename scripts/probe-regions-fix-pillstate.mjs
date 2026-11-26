// Lane 2 (v0.32 regions fix) — pill-state re-probe, adapted from the demo
// lane's scripts/probe-gangop-pillstate.mjs (same measure(), same steps).
//
// Defect (Finding 2): with the gang-op layer ON, opening any area page
// removed ALL regions — sheet-open AND pill state — because
// gangOpLikelyAreas read the area-filtered `places` prop and unpositioned
// gang-op places are dropped by the area/county filter. The fix feeds the
// region computation places that are NOT area/county-filtered (App.tsx
// likelyAreaPlaces -> MapView likelyAreaPlaces prop).
//
// P1 FLIPS vs the demo probe: the demo probe asserted regions GONE with
// the Ambrosia sheet open (PASS-as-defect). After the fix the sheet-open
// state KEEPS the regions — P1 now expects the Ambrosia region present.
// P3 (pill state) is the acceptance check: the Ambrosia region still
// renders with the isolation pill up and the mask live. P4 (mask vs
// region paint order) is the demo lane's z-order question and is NOT
// asserted here — it is moot for this lane: the fix changes which places
// feed the computation, not paint order.
// Counts are the CURRENT geography: lanes 4/4b's town-extent merges
// regrouped the 34 regions into 17 rects (was 13 at the v0.32 base).
// Served from `vite preview` (final build, ATLAS_BASE_PATH set) on
// $PORT (default 4330). Fresh profile `demo-gangop-r8b-pill` (wiped).
// Shots: r8b-pill* under shots/. Usage: PORT=4335 node probe-regions-fix-pillstate.mjs
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop-r8b-pill';
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
    const panePaths = [...document.querySelectorAll('.leaflet-overlay-pane path')];
    const regionRects = panePaths.filter((el) => el.getAttribute('stroke') === '#ff8f8f');
    const masks = panePaths.filter((el) => el.getAttribute('fill') === '#0b1018');
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) =>
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    );
    return {
      labelCount: labels.length, labels,
      regionRectCount: regionRects.length,
      maskCount: masks.length,
      markerCount: document.querySelectorAll('.atlas-map-marker').length,
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 60),
      nothingBanner: /NOTHING SHOWING HERE/.test(document.body.innerText),
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
page.on('pageerror', (e) => console.log('[pill] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[pill] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
// Turn the gang-op layer on.
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1200);
let m = await measure(page);
check('P0 island baseline: 17 labels + 17 rects', m.labelCount === 17 && m.regionRectCount === 17, `labels=${m.labelCount} rects=${m.regionRectCount}`);

// Open Kelly County, then Ambrosia from its area list.
await page.getByRole('button', { name: 'Area', exact: false }).first().click();
await page.waitForTimeout(1200);
const crumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
if (await crumb.count()) { await crumb.click(); await page.waitForTimeout(1000); }
await page.getByRole('button', { name: /Kelly County/ }).first().click();
await page.waitForTimeout(2500);
const ambRow = page.getByRole('button', { name: /^Ambrosia/ }).first();
await ambRow.click();
await page.waitForTimeout(3000);
m = await measure(page);
console.log('Ambrosia sheet OPEN:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, sheet: m.areaSheetOpen }));
console.log('sheet-open labels:', JSON.stringify(m.labels.slice(0, 4)));
// P1 FLIPPED (was: regions gone, PASS-as-defect): after the fix the
// sheet-open state keeps every region, Ambrosia included.
check('P1 Ambrosia sheet open: regions KEPT (fix — was 0/0 as the defect)', m.labelCount === 17 && m.regionRectCount === 17 && m.labels.some((t) => t.includes('Hog Stars Garage')), `labels=${m.labelCount} rects=${m.regionRectCount}`);

// Picking a PLACE closes the area page but KEEPS the isolation (App.tsx
// select(): "The area itself (and its isolation) stay put; only the page
// closes") — that is the pill state.
const placeRow = page.locator('.area-page-members ul li button').first();
await placeRow.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await placeRow.click();
await page.waitForTimeout(2000);
await shot(page, 'r8b-pill-ambrosia-pill-state');
m = await measure(page);
console.log('Ambrosia PILL state:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, sheet: m.areaSheetOpen, pill: m.isolationPill, banner: m.nothingBanner }));
console.log('pill-state labels:', JSON.stringify(m.labels));
check('P2 pill state keeps Ambrosia isolation (pill visible, mask live)', m.areaSheetOpen === false && /Ambrosia/.test(m.isolationPill) && m.maskCount >= 1, `sheet=${m.areaSheetOpen} pill=${JSON.stringify(m.isolationPill)} masks=${m.maskCount}`);
check('P3 pill-state isolation: the Ambrosia region still renders', m.labels.some((t) => t.includes('Hog Stars Garage')) && m.regionRectCount >= 1, `labels=${m.labelCount} rects=${m.regionRectCount}`);
check('P3b pill-state isolation: ALL 17 regions still render', m.labelCount === 17 && m.regionRectCount === 17, `labels=${m.labelCount} rects=${m.regionRectCount}`);

// Exit isolation via the pill's X, then confirm the regions come back.
// The place pick opened its sheet, which covers the pill's X — close
// it first (closing a place sheet does NOT exit the isolation).
const closePlace = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlace.count()) { await closePlace.click(); await page.waitForTimeout(900); }
const pillX = page.locator('.isolation-pill button').first();
if (await pillX.count()) { await pillX.click(); await page.waitForTimeout(1800); }
await shot(page, 'r8b-pill-isolation-exited');
m = await measure(page);
console.log('Isolation exited:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, pill: m.isolationPill }));
check('P6 exiting isolation restores all 17 regions', m.labelCount === 17 && m.regionRectCount === 17 && m.maskCount === 0, `labels=${m.labelCount} rects=${m.regionRectCount} masks=${m.maskCount}`);

await ctx.close();
console.log('\n=== REGIONS-FIX PILL-STATE SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
