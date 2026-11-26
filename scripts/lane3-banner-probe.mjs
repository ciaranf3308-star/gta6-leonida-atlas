/* global document, window */
// Lane 3 — "NOTHING SHOWING HERE" banner vs gang-op regions (v0.32 Finding 3).
// 390px, DPR 2, Playwright Chromium, fresh profile `demo-gangop-lane3` (wiped).
// Served from `vite preview` (final build, ATLAS_BASE_PATH set) on
// $LANE3_PORT (default 4330). Modelled on scripts/demo-gangop-regions.mjs
// (measure/ensureGangOpOn) + scripts/probe-gangop-pillstate.mjs (P2 path).
//   - L3-0 all layers off: banner absent, first-open hint present (designed
//     all-off state — the banner is the layers-on-but-nothing-matches case).
//   - L3-1 R2e: only the gang-op layer on, 17 grouped rects drawn -> banner ABSENT.
//   - L3-2b pill state (Ambrosia isolation, lane 2): regions KEPT (17/17),
//     banner ABSENT — the old L3-2 premise (regions gone under isolation)
//     is dead since lane 2; this check proves it.
//   - L3-2 no regions drawn (gang-op on + "Saved only", zero saved places
//     on a fresh profile): banner PRESENT and clickable. This is the
//     CORRECTED acceptance (lane 3, coordinator-accepted): "gang-op on +
//     no regions drawn -> banner present". The no-regions state is
//     reached through the narrow filter now, because isolation no
//     longer removes regions (lane 2) and filters.query has no UI
//     writer — "Saved only" is the live UI route that drops every
//     gang-op place from the region feed (filterPlaces favoritesOnly)
//     while a public layer stays visible.
//   - L3-3 banner "Clear filters" -> narrow filter cleared, 17 grouped
//     rects back, banner gone (action preserved).
//   - L3-4 banner "Show everything" from the same no-regions state ->
//     layers on AND the narrow filter cleared (v0.32.1 Finding 4 fix:
//     turnOnLayers now also runs the "Clear filters" reset), so
//     places show and the banner goes away; if it stays, that is a
//     REAL regression of the fix, not a probe bug — report it as such.
//   - L3-5 all layers off again -> banner absent, no regions (the
//     first-open hint stays dismissed — persisted once any layer was
//     turned on, by design; L3-0 proves it on a fresh profile).
// Shots: l3-* under shots/. Usage: LANE3_PORT=4330 node lane3-banner-probe.mjs
// UPDATE NOTE (lane 5, 2026-11-26): counts 14 -> 17 (lanes 4/4b);
// L3-2's route changed (see above) because lane 2's isolation fix
// removed the old no-regions state; the old wording ("all layers off
// -> banner present") had it backwards and is NOT asserted anywhere.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.LANE3_PORT || '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop-lane3';
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
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) =>
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
    );
    const masks = panePaths.filter(
      (el) => el.getAttribute('fill') === '#0b1018' && el.getAttribute('fill-opacity') === '0.55',
    );
    const banner = document.querySelector('.empty-map-prompt');
    const bannerVisible = !!banner && (() => {
      const r = banner.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    })();
    return {
      labelCount: labels.length,
      regionRectCount: regionRects.length,
      maskCount: masks.length,
      markerCount: document.querySelectorAll('.atlas-map-marker').length,
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 60),
      nothingBanner: /NOTHING SHOWING HERE/.test(document.body.innerText),
      bannerVisible,
      bannerText: (banner?.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
      firstOpenHint: !!document.querySelector('.first-open-hint'),
    };
  });
}

async function ensureGangOpOn(page) {
  await page.getByRole('button', { name: 'Open map filters' }).first().click();
  await page.waitForTimeout(1000);
  const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
  await page.getByRole('button', { name: 'Close map filters' }).first().click();
  await page.waitForTimeout(1200);
}

async function closePlaceSheet(page) {
  const closePlace = page.getByRole('button', { name: /Close place details/i }).first();
  if (await closePlace.count()) { await closePlace.click(); await page.waitForTimeout(1200); }
}

/** Turn the "Saved only" narrow filter on (favoritesOnly). On a fresh
 * profile there are zero saved places, so every place — and every
 * gang-op region — drops out of the feeds while the gang-op layer
 * stays visible: the live UI route to "gang-op on + no regions
 * drawn". Leaves the filter sheet closed. */
async function turnSavedOnlyOn(page) {
  await page.getByRole('button', { name: 'Open map filters' }).first().click();
  await page.waitForTimeout(1000);
  const row = page.getByRole('button', { name: /Saved only/ }).first();
  const pressed = await row.getAttribute('aria-pressed');
  if (pressed !== 'true') { await row.click(); await page.waitForTimeout(1200); }
  await page.getByRole('button', { name: 'Close map filters' }).first().click();
  await page.waitForTimeout(1200);
}

/** Reach the Ambrosia pill state (isolation kept, sheet closed, no
 *  place selected): open Kelly County, then Ambrosia from its area
 *  list, pick the first place row (closes the sheet, keeps the
 *  isolation), then close the place sheet. Since lane 2 the regions
 *  SURVIVE here — this is now the regions-kept proof (L3-2b), not
 *  the no-regions route. */
async function reachAmbrosiaPillState(page) {
  await page.getByRole('button', { name: 'Area', exact: false }).first().click();
  await page.waitForTimeout(1200);
  const crumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
  if (await crumb.count()) { await crumb.click(); await page.waitForTimeout(1000); }
  await page.getByRole('button', { name: /Kelly County/ }).first().click();
  await page.waitForTimeout(2500);
  const ambRow = page.getByRole('button', { name: /^Ambrosia/ }).first();
  await ambRow.click();
  await page.waitForTimeout(3000);
  const placeRow = page.locator('.area-page-members ul li button').first();
  await placeRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await placeRow.click();
  await page.waitForTimeout(2000);
  await closePlaceSheet(page);
  await page.waitForTimeout(1200);
}

async function exitIsolation(page) {
  const pillX = page.locator('.isolation-pill button').first();
  if (await pillX.count()) { await pillX.click(); await page.waitForTimeout(1800); }
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[lane3] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[lane3] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// ---------- L3-0. All layers off (fresh profile): banner absent, hint present ----------
let m = await measure(page);
console.log('fresh load:', JSON.stringify(m));
check(
  'L3-0 all layers off: banner absent, first-open hint present (designed all-off state)',
  m.nothingBanner === false && m.firstOpenHint === true,
  `banner=${m.nothingBanner} hint=${m.firstOpenHint}`,
);

// ---------- L3-1 (R2e). Only the gang-op layer on: 17 grouped rects (34 regions), banner ABSENT ----------
// (17, not the demo lane's 13 or lane 3's 14: lanes 4/4b split the Kelly
// and Mariana county rects into town rects — same 34 regions, 17 grouped rects.)
await ensureGangOpOn(page);
await shot(page, 'l3-01-gangop-only');
m = await measure(page);
console.log('gang-op only:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, banner: m.nothingBanner, bannerVisible: m.bannerVisible }));
check(
  'L3-1 R2e: only gang-op on, 17 grouped rects drawn -> banner absent',
  m.labelCount === 17 && m.regionRectCount === 17 && m.nothingBanner === false,
  `labels=${m.labelCount} rects=${m.regionRectCount} banner=${m.nothingBanner}`,
);

// ---------- L3-2b. Pill state (Ambrosia isolation): regions KEPT, banner ABSENT ----------
// The old L3-2 premise (regions gone under isolation) died with lane 2.
// This check proves the new behaviour: isolation keeps all 17 regions
// and the banner stays away.
await reachAmbrosiaPillState(page);
await shot(page, 'l3-02b-pill-regions-kept');
m = await measure(page);
console.log('Ambrosia pill state:', JSON.stringify(m));
check(
  'L3-2b pill-state isolation: all 17 regions kept, banner absent (lane 2 consequence)',
  m.labelCount === 17 && m.regionRectCount === 17 && m.nothingBanner === false,
  `labels=${m.labelCount} rects=${m.regionRectCount} banner=${m.nothingBanner} pill=${JSON.stringify(m.isolationPill)} masks=${m.maskCount}`,
);
await exitIsolation(page);
await page.waitForTimeout(1200);
m = await measure(page);
console.log('isolation exited:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount }));

// ---------- L3-2. No regions drawn (gang-op on + "Saved only"): banner PRESENT ----------
// Corrected acceptance: "gang-op on + no regions drawn -> banner present".
await turnSavedOnlyOn(page);
await shot(page, 'l3-02-saved-only-no-regions');
m = await measure(page);
console.log('Saved only, gang-op on:', JSON.stringify(m));
check(
  'L3-2 no regions drawn (gang-op on + Saved only, 0 saved): banner present and visible',
  m.labelCount === 0 && m.regionRectCount === 0 && m.nothingBanner === true && m.bannerVisible === true,
  `labels=${m.labelCount} rects=${m.regionRectCount} banner=${m.nothingBanner} visible=${m.bannerVisible} markers=${m.markerCount} bannerText=${JSON.stringify(m.bannerText)}`,
);

// ---------- L3-3. Banner "Clear filters": narrow filter cleared, regions back, banner gone ----------
await page.locator('.empty-map-prompt button', { hasText: 'Clear filters' }).first().click();
await page.waitForTimeout(2000);
await shot(page, 'l3-03-after-clear-filters');
m = await measure(page);
console.log('after Clear filters:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, banner: m.nothingBanner, masks: m.maskCount, pill: m.isolationPill }));
check(
  'L3-3 "Clear filters": Saved-only cleared, 17 grouped rects back, banner gone',
  m.labelCount === 17 && m.regionRectCount === 17 && m.nothingBanner === false && m.maskCount === 0,
  `labels=${m.labelCount} rects=${m.regionRectCount} banner=${m.nothingBanner} masks=${m.maskCount}`,
);

// ---------- L3-4. "Show everything" from the no-regions state ----------
// Back to the no-regions state (Saved only again), then Show everything.
await turnSavedOnlyOn(page);
m = await measure(page);
console.log('no-regions state again:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, banner: m.nothingBanner, bannerVisible: m.bannerVisible }));
check(
  'L3-4a no-regions state reached again: banner present',
  m.labelCount === 0 && m.regionRectCount === 0 && m.nothingBanner === true && m.bannerVisible === true,
  `labels=${m.labelCount} rects=${m.regionRectCount} banner=${m.nothingBanner}`,
);
await page.locator('.empty-map-prompt button', { hasText: 'Show everything' }).first().click();
await page.waitForTimeout(2000);
await shot(page, 'l3-04-after-show-everything');
m = await measure(page);
console.log('after Show everything:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, banner: m.nothingBanner, markers: m.markerCount }));
check(
  'L3-4b "Show everything": layers on, places showing, banner gone',
  m.nothingBanner === false && m.markerCount > 0,
  `banner=${m.nothingBanner} markers=${m.markerCount} labels=${m.labelCount} rects=${m.regionRectCount} — NOTE (v0.32.1 Finding 4 fix): turnOnLayers now clears the narrow filter too; if this FAILS it is a real regression of that fix (see DEMOS-REGIONS.md), not a probe bug`,
);

// ---------- L3-5. All layers off again: banner absent, no regions ----------
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const turnOff = page.locator('.map-filter-sheet button', { hasText: /Turn everything off/i }).first();
if (await turnOff.count()) {
  await turnOff.click();
  await page.waitForTimeout(1200);
} else {
  // Fallback: uncheck every checked layer box in the sheet.
  const boxes = page.locator('.map-filter-sheet input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) {
    if (await boxes.nth(i).isChecked()) { await boxes.nth(i).click(); await page.waitForTimeout(300); }
  }
  await page.waitForTimeout(1200);
}
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);
await shot(page, 'l3-05-all-off-again');
m = await measure(page);
console.log('all off again:', JSON.stringify({ banner: m.nothingBanner, hint: m.firstOpenHint, labels: m.labelCount, rects: m.regionRectCount }));
check(
  'L3-5 all layers off again: banner absent, no regions (hint stays dismissed — persisted, by design)',
  m.nothingBanner === false && m.labelCount === 0 && m.regionRectCount === 0,
  `banner=${m.nothingBanner} hint=${m.firstOpenHint} (dismissed for good once any layer was turned on — App.tsx first-open comment) labels=${m.labelCount} rects=${m.regionRectCount}`,
);

await ctx.close();
console.log('\n=== LANE3-BANNER SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
