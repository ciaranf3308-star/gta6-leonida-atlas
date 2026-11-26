// Demo lane 5 — definitive pill-state check (regions + isolation).
// Escape dismisses the area sheet but KEEPS the isolation (pill state);
// the X button exits isolation entirely. The earlier probes conflated
// the two. This one: open Ambrosia -> Escape -> pill state -> measure
// labels / rects / mask / pane order -> zoom in -> measure again.
// Fresh profile `demo-gangop3`. $PORT (default 4330). Shots: g20*.
// UPDATE NOTE (lane 5, 2026-11-26): P1 FLIPPED by lane 2's fix —
// regions now SURVIVE the sheet-open state (17/17 kept), so P1 is a
// PASS when regions are present, not a PASS-as-defect when they are
// gone. P3 is likewise a PASS. Counts are 17 rects (lanes 4/4b),
// not the 13 this script asserted at the gang-op baseline.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop3';
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
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
    );
    const paneOrder = panePaths.map((el) => ({ s: el.getAttribute('stroke'), f: el.getAttribute('fill') }));
    return {
      labelCount: labels.length, labels,
      regionRectCount: regionRects.length,
      maskCount: masks.length,
      markerCount: document.querySelectorAll('.atlas-map-marker').length,
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 60),
      nothingBanner: /NOTHING SHOWING HERE/.test(document.body.innerText),
      paneOrder,
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
page.on('pageerror', (e) => console.log('[g3] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[g3] console.error:', m.text().slice(0, 300)); });

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
check('P1 Ambrosia sheet open: regions KEPT (lane 2 fix — was 0/0 as the defect)', m.labelCount === 17 && m.regionRectCount === 17 && m.labels.some((t) => t.includes('Hog Stars Garage')), `labels=${m.labelCount} rects=${m.regionRectCount}`);

// Picking a PLACE closes the area page but KEEPS the isolation (App.tsx
// select(): "The area itself (and its isolation) stay put; only the page
// closes"). Escape does NOT dismiss the sheet. So: tap the first place
// row in the Ambrosia sheet ("Places in Ambrosia") to reach pill state.
const placeRow = page.locator('.area-page-members ul li button').first();
await placeRow.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await placeRow.click();
await page.waitForTimeout(2000);
await shot(page, 'g20-ambrosia-pill-state');
m = await measure(page);
console.log('Ambrosia PILL state (Escape):', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, sheet: m.areaSheetOpen, pill: m.isolationPill, banner: m.nothingBanner }));
console.log('pill-state labels:', JSON.stringify(m.labels));
console.log('pane order:', JSON.stringify(m.paneOrder));
check('P2 place pick keeps Ambrosia isolation (pill visible, mask live)', m.areaSheetOpen === false && /Ambrosia/.test(m.isolationPill) && m.maskCount >= 1, `sheet=${m.areaSheetOpen} pill=${JSON.stringify(m.isolationPill)} masks=${m.maskCount}`);
check('P3 pill-state isolation: the Ambrosia region still renders', m.labels.some((t) => t.includes('Hog Stars Garage')) && m.regionRectCount >= 1, `labels=${m.labelCount} rects=${m.regionRectCount}`);
const maskIdx = m.paneOrder.findIndex((p) => p.f === '#0b1018');
const regionIdxs = m.paneOrder.map((p, i) => (p.s === '#ff8f8f' ? i : -1)).filter((i) => i >= 0);
check('P4 region rects paint on top of the isolation mask', maskIdx >= 0 && regionIdxs.length > 0 && regionIdxs.every((i) => i > maskIdx), `mask@${maskIdx} regions@${JSON.stringify(regionIdxs)}`);

// Zoom in on Ambrosia in pill state. PROBE CORRECTION (lane 5): the
// place pick opened its place sheet, which covers the zoom controls
// (the baseline run hit exactly this — P5/P6 "did not run as
// scripted"). Close the place sheet first; closing a place sheet
// does NOT exit the isolation (the pill stays).
const closePlaceZoom = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlaceZoom.count()) { await closePlaceZoom.click(); await page.waitForTimeout(900); }
for (let i = 0; i < 4; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
await shot(page, 'g21-ambrosia-pill-zoomed');
m = await measure(page);
console.log('Ambrosia pill state ZOOMED:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, markers: m.markerCount, pill: m.isolationPill }));
console.log('zoomed labels:', JSON.stringify(m.labels));
check('P5 zoomed pill-state: Ambrosia region still renders, never a pin', m.labels.some((t) => t.includes('Hog Stars Garage')) && m.regionRectCount >= 1, `labels=${m.labelCount} rects=${m.regionRectCount}`);

// Exit isolation via the pill's X, then confirm the regions come back.
const pillX = page.locator('.isolation-pill button').first();
if (await pillX.count()) { await pillX.click(); await page.waitForTimeout(1800); }
await shot(page, 'g22-isolation-exited');
m = await measure(page);
console.log('Isolation exited:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, pill: m.isolationPill }));
check('P6 exiting isolation restores all 17 regions', m.labelCount === 17 && m.regionRectCount === 17 && m.maskCount === 0, `labels=${m.labelCount} rects=${m.regionRectCount} masks=${m.maskCount}`);

await ctx.close();
console.log('\n=== PILL-STATE SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
