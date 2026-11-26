/* global document, getComputedStyle */
// Lane-1 verification — likely-area label width + placement
// (v0.32 regions fix, Finding 1: R3b / R7a / R7b).
// 390px, DPR 2, Playwright Chromium, fresh profile `lane1-verify`
// (wiped). Served from `vite preview` on port 4330 (ATLAS_BASE_PATH
// set). Usage: node probe-lane1-verify.mjs [port]
//   - Island zoom, layer on: every VISIBLE likely-area label is a
//     readable wrapped block (200px wide, no one-word column);
//     label-vs-geo-pill 0px²; label-vs-label 0px². Suppressed
//     labels are reported BY NAME (first-wins placement) — a
//     suppressed label is a named trade-off, never a silent drop.
//   - The Kelly-county-extent label is visible and readable, and
//     names the ops that still fall back to the county rect.
//   - Zoomed Starlet view: region still a region, labels still
//     clear of geo pills (R9/R9b/R9c). Ambrosia close-up (R10/R10b).
//   - A geo pill tap still opens its area page.
//   - Layer off draws nothing (R12).
// The group composition is NOT hardcoded here: lanes 4/4b are
// still merging town extents, so the probe reads the live labels
// and asserts structure (counts equal, Kelly label present and
// readable, Port Gellhorn town label present when the merge is
// in the tree), not a frozen op list. The op lists are pinned by
// the unit tests (gang-op-likely-area.test.ts).
// Shots: lane1-v-*.png under shots/.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/lane1-verify';
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
async function waitForText(page, re, timeout = 30000) {
  await page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), re.source, { timeout });
}

const OP_NAMES = [
  'Sunrise RV Park', 'Parlor Apartments', 'Hog Stars Garage', 'Irons Building Supply',
  'Sound4Sond Studio', 'La Perle Trap House', 'Illegal Sneaker Trade', "JanJak's Garage",
  'Leonida Carrier Warehouse', 'Cigar Import Front', 'Ocean Beach Lab', 'Southside Trap House',
  'Kamar Devon Community Center', 'Saber Shipping Yard', 'Casa Guardia',
  'Saber Shipping Facility', 'Exotic Animals Front', 'Slator Towing Inc',
  'Manatee Motel', 'Kingpin Bowling', 'June Warehouse', 'La Cascara Motel',
  'Brooks Boatworks', 'Stash House', 'Backroom Weed Front', 'M7 Compound',
  'Weed Grow', 'Palmer Fishing Warehouse', 'Watson Bay Safehouse',
  'Mill Station Radar Base', 'Farm Fix Meth Lab', 'Biker Hideout',
  'Industrial Weed Grow', 'Gas Station Meth Front', 'Walker Farm',
  'Carter Mining Boathouse', 'Fishing Shacks', 'Chatfield Storage & Logistics',
  'Vespucci Mansion',
];

/** Census: regions + labels + pills + pins, same shape as demo-gangop-regions.mjs. */
async function measure(page) {
  return page.evaluate((opNames) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const overlap = (a, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? Math.round(w * h) : 0;
    };
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      rect: rect(el),
      visible: getComputedStyle(el).display !== 'none' && rect(el).w > 0,
    }));
    const panePaths = [...document.querySelectorAll('.leaflet-overlay-pane path')];
    const dashedRects = panePaths.filter((el) => el.getAttribute('stroke') === '#ff8f8f')
      .map((el) => ({ dash: el.getAttribute('stroke-dasharray'), rect: rect(el) }));
    const geoPills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({ name: (el.textContent || '').trim(), rect: rect(el) }));
    const markers = [...document.querySelectorAll('.atlas-map-marker')].map((el) => ({
      label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 60),
    }));
    const gangOpPins = markers.filter((m) => opNames.some((n) => m.label.includes(n)));
    let maxLabelGeo = 0; let worstLabelGeo = null;
    for (const l of labels) for (const g of geoPills) {
      const o = overlap(l.rect, g.rect);
      if (o > maxLabelGeo) { maxLabelGeo = o; worstLabelGeo = { label: l.text.slice(0, 50), pill: g.name, px2: o }; }
    }
    let maxLabelLabel = 0; let worstLabelLabel = null;
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const o = overlap(labels[i].rect, labels[j].rect);
      if (o > maxLabelLabel) { maxLabelLabel = o; worstLabelLabel = { a: labels[i].text.slice(0, 40), b: labels[j].text.slice(0, 40), px2: o }; }
    }
    return {
      labelCount: labels.length, labels,
      visibleLabels: labels.filter((l) => l.visible),
      suppressedLabels: labels.filter((l) => !l.visible),
      dashedRectCount: dashedRects.length, dashedRects: dashedRects.slice(0, 20),
      geoPillCount: geoPills.length, geoPills: geoPills.map((g) => g.name),
      markerCount: markers.length, gangOpPins,
      maxLabelGeo, worstLabelGeo, maxLabelLabel, worstLabelLabel,
      areaSheetOpen: !!document.querySelector('section.area-page'),
    };
  }, OP_NAMES);
}

async function ensureGangOpOn(page) {
  // A page.goto() RELOADS the app, and public layers always open OFF
  // (lane 4: layersForLaunch reads back only my-markers) — so every
  // deep-link navigation switches gang-op off again. Re-enable it.
  await page.getByRole('button', { name: 'Open map filters' }).first().click();
  await page.waitForTimeout(1000);
  const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
  await page.getByRole('button', { name: 'Close map filters' }).first().click();
  await page.waitForTimeout(1200);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[lane1] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[lane1] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// ---------- 1. Island zoom, layer on ----------
await ensureGangOpOn(page);
await shot(page, 'lane1-v-island');
const m1 = await measure(page);
console.log('--- island, layer on ---');
console.log(`labels=${m1.labelCount} visible=${m1.visibleLabels.length} suppressed=${m1.suppressedLabels.length} dashedRects=${m1.dashedRectCount} geoPills=${m1.geoPillCount} markers=${m1.markerCount} gangOpPins=${m1.gangOpPins.length}`);
for (const l of m1.labels) console.log(`  ${l.visible ? 'SHOW' : 'HIDE'} ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 110)}`);
console.log('suppressed (by name):', JSON.stringify(m1.suppressedLabels.map((l) => l.text.slice(0, 80))));
console.log('geo pills:', JSON.stringify(m1.geoPills));
check('L1 layer on draws as many labels as rects', m1.labelCount === m1.dashedRectCount && m1.labelCount > 0, `labels=${m1.labelCount} rects=${m1.dashedRectCount}`);
check('L1b regions are dashed (6 4), not pins', m1.dashedRects.length > 0 && m1.dashedRects.every((d) => d.dash === '6 4'), `dash=${m1.dashedRects[0]?.dash}`);
check('L1c no gang-op pin exists with the layer on', m1.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m1.gangOpPins)}`);

// Every VISIBLE label is a readable wrapped block: real width,
// no one-word column, bounded height.
const badBlocks = m1.visibleLabels.filter((l) => l.rect.w < 120 || l.rect.w > 220 || l.rect.h > 260);
check(
  'L2 every visible label is a readable wrapped block (120–220px wide, ≤260px tall)',
  badBlocks.length === 0,
  badBlocks.length ? JSON.stringify(badBlocks.map((l) => `${l.rect.w}x${l.rect.h}: ${l.text.slice(0, 60)}`)) : `all ${m1.visibleLabels.length} visible labels in bounds`,
);
const kelly = m1.labels.find((l) => /Kelly County extent \(estimate\)/.test(l.text));
console.log('Kelly label:', JSON.stringify(kelly));
check(
  'L3 Kelly-county-extent label is visible and readable (R3b)',
  !!kelly && kelly.visible && kelly.rect.w >= 120 && kelly.rect.h <= 260,
  kelly ? `${kelly.rect.w}x${kelly.rect.h} @(${kelly.rect.x},${kelly.rect.y}) visible=${kelly.visible}: ${kelly.text.slice(0, 160)}` : 'no Kelly label',
);
const portGellhorn = m1.labels.find((l) => l.text.includes('Brooks Boatworks'));
console.log('Port Gellhorn label:', JSON.stringify(portGellhorn));
check(
  'L3b Port Gellhorn town label names the six Port Gellhorn ops',
  !!portGellhorn && ['Kingpin Bowling', 'June Warehouse', 'La Cascara Motel', 'Brooks Boatworks', 'Stash House', 'Backroom Weed Front'].every((n) => portGellhorn.text.includes(n)),
  portGellhorn ? `${portGellhorn.text.slice(0, 200)} | ${portGellhorn.rect.w}x${portGellhorn.rect.h} visible=${portGellhorn.visible}` : 'no Port Gellhorn label (town merge not in tree?)',
);
check(
  'L4 label-vs-geo-pill 0px² at island zoom (R7a)',
  m1.maxLabelGeo === 0,
  `max=${m1.maxLabelGeo}px² worst=${JSON.stringify(m1.worstLabelGeo)}`,
);
check(
  'L5 label-vs-label 0px² at island zoom (R7b)',
  m1.maxLabelLabel === 0,
  `max=${m1.maxLabelLabel}px² worst=${JSON.stringify(m1.worstLabelLabel)}`,
);

// ---------- 2. A geo pill tap still opens its area page ----------
const kellyPill = page.getByRole('button', { name: 'Show Kelly County area' }).first();
if (await kellyPill.count()) {
  await kellyPill.click();
  await page.waitForTimeout(2000);
  const mPill = await measure(page);
  check('L6 tapping the Kelly County pill opens its area page', mPill.areaSheetOpen, `sheet=${mPill.areaSheetOpen}`);
  await shot(page, 'lane1-v-kelly-pill');
  // Close the sheet via its X: this exits isolation entirely.
  const x = page.locator('section.area-page button[aria-label="Close area page — show all of Leonida"]').first();
  if (await x.count()) { await x.click(); await page.waitForTimeout(1800); }
} else {
  check('L6 tapping the Kelly County pill opens its area page', false, 'no Kelly County pill in DOM (suppressed or off-screen?)');
}

// ---------- 3. Zoomed Starlet view (R9/R9b/R9c) ----------
await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await waitForText(page, /STARLET MOTEL/);
const closePlace = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlace.count()) { await closePlace.click(); await page.waitForTimeout(900); }
await ensureGangOpOn(page);
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
await shot(page, 'lane1-v-kelly-zoomed');
const m3 = await measure(page);
console.log('--- Kelly zoomed in (Starlet) ---');
console.log(`labels=${m3.labelCount} visible=${m3.visibleLabels.length} rects=${m3.dashedRectCount} gangOpPins=${m3.gangOpPins.length} labelGeo=${m3.maxLabelGeo}px² labelLabel=${m3.maxLabelLabel}px²`);
for (const l of m3.labels) console.log(`  ${l.visible ? 'SHOW' : 'HIDE'} ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 110)}`);
check('L7 zoomed-in region is still a region, never a pin (R9)', m3.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m3.gangOpPins)}`);
check('L8 zoomed-in Kelly rect still renders dashed (R9b)', m3.dashedRectCount >= 1 && m3.dashedRects.every((d) => d.dash === '6 4'), `rects=${m3.dashedRectCount}`);
check('L9 zoomed-in labels do not overlap geo pills (R9c)', m3.maxLabelGeo === 0, `max=${m3.maxLabelGeo}px² worst=${JSON.stringify(m3.worstLabelGeo)}`);
check('L9b zoomed-in labels do not overlap each other', m3.maxLabelLabel === 0, `max=${m3.maxLabelLabel}px² worst=${JSON.stringify(m3.worstLabelLabel)}`);

// ---------- 4. Ambrosia close-up (R10/R10b) ----------
await page.goto(`${BASE}?place=L590`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await waitForText(page, /AMBROSIA RACEWAY PARK/);
const closePlace2 = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlace2.count()) { await closePlace2.click(); await page.waitForTimeout(900); }
await ensureGangOpOn(page);
await shot(page, 'lane1-v-ambrosia');
const m4 = await measure(page);
console.log('--- Ambrosia view (L590) ---');
console.log(`labels=${m4.labelCount} visible=${m4.visibleLabels.length} rects=${m4.dashedRectCount} gangOpPins=${m4.gangOpPins.length} labelGeo=${m4.maxLabelGeo}px²`);
for (const l of m4.labels) console.log(`  ${l.visible ? 'SHOW' : 'HIDE'} ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 110)}`);
const ambClose = m4.labels.find((l) => l.text.includes('Hog Stars Garage') && l.text.includes('Irons Building Supply'));
check('L10 Ambrosia rect visible close-up with both ops named (R10)', !!ambClose && ambClose.visible, ambClose ? `${ambClose.text.slice(0, 160)} | ${ambClose.rect.w}x${ambClose.rect.h} visible=${ambClose.visible}` : 'not in view');
check('L11 no gang-op pin at Ambrosia close-up (R10b)', m4.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m4.gangOpPins)}`);

// ---------- 5. Layer off again (R12) ----------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const gangBox2 = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (await gangBox2.isChecked()) { await gangBox2.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1200);
const m5 = await measure(page);
check('L12 turning the layer off removes all regions (R12)', m5.labelCount === 0 && m5.dashedRectCount === 0, `labels=${m5.labelCount} rects=${m5.dashedRectCount}`);

await ctx.close();
console.log('\n=== LANE1-VERIFY SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
