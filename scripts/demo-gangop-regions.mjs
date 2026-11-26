/* global document, window */
// Demo lane 5 — gang-op likely-area regions (v0.32 regions-fix, lane 5 re-run).
// 390px, DPR 2, Playwright Chromium, fresh profile `demo-gangop` (wiped).
// Served from `vite preview` on $PORT (default 4330; final build, ATLAS_BASE_PATH set).
//   - Gang operations row exists in the Layers sheet; turning it on draws
//     the regions (dashed rects + permanent labels, 17 grouped rects for
//     34 regions: split 27 own / 7 county / 3 no-extent, lanes 4/4b).
//   - Kelly rect carries Walker Farm ALONE (county-estimate label);
//     Port Gellhorn town rect carries the 6 Port Gellhorn ops;
//     Vice City rect (4 names), Ambrosia rect (2 names): label text +
//     wrap geometry at island zoom.
//   - Zoom in on a region: it must NEVER become a pin (no gang-op marker).
//   - No-extent ops (Fishing Shacks / Chatfield Storage / Vespucci Mansion)
//     draw no region and their cards say so honestly.
//   - Layer off draws nothing.
//   - (5a) likely-area labels vs geo-label pills: max overlap px² measured.
//   - (5b) regions + area isolation together: regions SURVIVE the Kelly
//     area page (lane 2 fix) and the pill state (see
//     probe-gangop-pillstate.mjs P1/P3, now PASS).
//   - UPDATE NOTE (lane 5, 2026-11-26): the gang-op baseline script
//     expected 13 rects / Kelly 8 ops and P1-as-defect — all stale
//     after lanes 1/2/4/4b. This version expects 17 rects / 17 labels,
//     Kelly = Walker Farm alone, Port Gellhorn town rect = 6 ops.
// Shots: g01* under shots/. Usage: PORT=4330 node demo-gangop-regions.mjs
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.env.PORT ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop';
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

// All 39 op short names (from the gang-op import; used to prove no pin
// ever renders for one of them).
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
// Kelly rect (lane 4b): Walker Farm ALONE — the other 7 ops that used to
// share it now draw their own town rects (Port Gellhorn 6, Emerald
// Springs 1). The 6-op Port Gellhorn town rect is R3c below.
const KELLY_1 = ['Walker Farm'];
const PORT_GELLHORN_6 = ['Kingpin Bowling', 'June Warehouse', 'La Cascara Motel', 'Brooks Boatworks', 'Stash House', 'Backroom Weed Front'];
const VICE_4 = ["JanJak's Garage", 'Leonida Carrier Warehouse', 'Cigar Import Front', 'Ocean Beach Lab'];
const AMBROSIA_2 = ['Hog Stars Garage', 'Irons Building Supply'];
const NO_EXTENT_3 = ['Fishing Shacks', 'Chatfield Storage & Logistics', 'Vespucci Mansion'];

/** Census of regions + labels + geo pills + gang-op pins + isolation mask. */
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
      visible: (() => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      })(),
    }));
    // Leaflet non-interactive vector layers carry NO .leaflet-interactive
    // class — match by stroke/fill attributes on ANY overlay-pane path.
    const panePaths = [...document.querySelectorAll('.leaflet-overlay-pane path')];
    const dashedRects = panePaths.filter((el) => el.getAttribute('stroke') === '#ff8f8f')
      .map((el) => ({ dash: el.getAttribute('stroke-dasharray'), rect: rect(el) }));
    // Isolation dim mask: polygon filled #0b1018 at 0.55 (isolation-layer.ts).
    const masks = panePaths.filter((el) =>
      el.getAttribute('fill') === '#0b1018' && el.getAttribute('fill-opacity') === '0.55',
    ).length;
    // Overlay-pane DOM order: later siblings paint on top within a pane.
    const paneOrder = panePaths.map((el) => ({
      stroke: el.getAttribute('stroke'), fill: el.getAttribute('fill'),
      dash: el.getAttribute('stroke-dasharray'),
    }));
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
      dashedRectCount: dashedRects.length, dashedRects: dashedRects.slice(0, 20),
      maskCount: masks, paneOrder,
      geoPillCount: geoPills.length, geoPills: geoPills.map((g) => g.name),
      markerCount: markers.length, gangOpPins,
      maxLabelGeo, worstLabelGeo, maxLabelLabel, worstLabelLabel,
      nothingBanner: /NOTHING SHOWING HERE/.test(document.body.innerText),
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 80),
    };
  }, OP_NAMES);
}

function findLabel(m, fragment) {
  return m.labels.find((l) => l.text.includes(fragment));
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
  // Real control (AreaPage.tsx:70): "Close area page — show all of Leonida".
  // NOTE: this button EXITS the isolation entirely — it is not a
  // sheet-dismiss. The pill state (isolation kept, sheet closed) is
  // reached by picking a place (see probe-gangop-pillstate.mjs).
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
page.on('pageerror', (e) => console.log('[gangop] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[gangop] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// ---------- 1. Layer off by default: no regions ----------
let m0 = await measure(page);
check('R0 gang-op layer off by default draws no regions', m0.labelCount === 0 && m0.dashedRectCount === 0, `labels=${m0.labelCount} rects=${m0.dashedRectCount}`);
await shot(page, 'g00-layer-off-default');

// ---------- 2. Turn the gang-op layer on via the Layers sheet ----------
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const gangRow = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first();
const gangRowCount = await gangRow.count();
console.log('Gang operations row in Layers sheet:', gangRowCount);
check('R1 Layers sheet lists a "Gang operations" row', gangRowCount > 0, gangRowCount ? (await gangRow.innerText()).replace(/\s+/g, ' ').slice(0, 160) : 'missing');
if (gangRowCount) {
  const box = gangRow.locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
}
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);
await shot(page, 'g01-island-regions');
const m1 = await measure(page);
console.log('--- island, layer on ---');
console.log(`labels=${m1.labelCount} dashedRects=${m1.dashedRectCount} geoPills=${m1.geoPillCount} markers=${m1.markerCount} gangOpPins=${m1.gangOpPins.length} nothingBanner=${m1.nothingBanner}`);
for (const l of m1.labels) console.log(`  label ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}) visible=${l.visible}: ${l.text.slice(0, 110)}`);
console.log('dashed rects:', JSON.stringify(m1.dashedRects.map((d) => d.dash)));
check('R2 layer on draws 17 grouped region rects', m1.dashedRectCount === 17, `rects=${m1.dashedRectCount}`);
check('R2b layer on draws 17 region labels', m1.labelCount === 17, `labels=${m1.labelCount}`);
check('R2c regions are dashed (6 4) not pins', m1.dashedRects.length > 0 && m1.dashedRects.every((d) => d.dash === '6 4'), `dash=${m1.dashedRects[0]?.dash}`);
check('R2d no gang-op pin exists with the layer on', m1.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m1.gangOpPins)} markers=${m1.markerCount}`);
check('R2e "NOTHING SHOWING HERE" banner does not fire while regions are drawn', m1.nothingBanner === false, `banner=${m1.nothingBanner}`);

// ---------- 3. Kelly / Vice City / Ambrosia labels ----------
const kelly = findLabel(m1, 'Kelly County extent (estimate)');
console.log('Kelly label:', JSON.stringify(kelly));
check(
  'R3 Kelly rect label names Walker Farm alone + county estimate',
  !!kelly && KELLY_1.every((n) => kelly.text.includes(n)) && /likely area/.test(kelly.text),
  kelly ? `${kelly.text.slice(0, 200)} | ${kelly.rect.w}x${kelly.rect.h}` : 'no Kelly label',
);
if (kelly) {
  check(
    'R3b Kelly label wraps sanely at island zoom (readable block, not a 1-word column)',
    kelly.rect.w >= 120 && kelly.rect.h <= 260,
    `rect ${kelly.rect.w}x${kelly.rect.h} @(${kelly.rect.x},${kelly.rect.y})`,
  );
}
// Lane 4: the 6 Port Gellhorn ops draw their own town extent, not the Kelly rect.
const portGellhorn = m1.labels.find((l) => PORT_GELLHORN_6.every((n) => l.text.includes(n)));
console.log('Port Gellhorn label:', JSON.stringify(portGellhorn));
check(
  'R3c Port Gellhorn town rect label names all 6 ops (own extent, no county suffix)',
  !!portGellhorn && !portGellhorn.text.includes('Kelly County extent'),
  portGellhorn ? `${portGellhorn.text.slice(0, 220)} | ${portGellhorn.rect.w}x${portGellhorn.rect.h}` : 'no Port Gellhorn label',
);
const vice = m1.labels.find((l) => VICE_4.every((n) => l.text.includes(n)));
console.log('Vice City label:', JSON.stringify(vice));
check(
  'R4 Vice City rect label names all 4 ops',
  !!vice && VICE_4.every((n) => vice.text.includes(n)),
  vice ? `${vice.text.slice(0, 200)} | ${vice.rect.w}x${vice.rect.h}` : 'no Vice City label',
);
const amb = m1.labels.find((l) => AMBROSIA_2.every((n) => l.text.includes(n)));
console.log('Ambrosia label:', JSON.stringify(amb));
check(
  'R5 Ambrosia rect label names both ops',
  !!amb,
  amb ? `${amb.text.slice(0, 160)} | ${amb.rect.w}x${amb.rect.h}` : 'no Ambrosia label',
);
const noExtentDrawn = m1.labels.filter((l) => NO_EXTENT_3.some((n) => l.text.includes(n)));
check(
  'R6 no-extent ops draw no region (Fishing Shacks / Chatfield / Vespucci absent from all labels)',
  noExtentDrawn.length === 0,
  noExtentDrawn.length ? JSON.stringify(noExtentDrawn.map((l) => l.text.slice(0, 80))) : 'none of the 3 in any label',
);

// ---------- 4. (5a) likely-area labels vs geo pills + vs each other, island zoom ----------
console.log(`label-vs-geo-pill max overlap (island): ${m1.maxLabelGeo}px² worst=${JSON.stringify(m1.worstLabelGeo)}; label-vs-label ${m1.maxLabelLabel}px² worst=${JSON.stringify(m1.worstLabelLabel)}`);
check(
  'R7a likely-area labels do not overlap geo pills at island zoom',
  m1.maxLabelGeo === 0,
  `max=${m1.maxLabelGeo}px² worst=${JSON.stringify(m1.worstLabelGeo)}`,
);
check(
  'R7b likely-area labels do not overlap each other at island zoom',
  m1.maxLabelLabel === 0,
  `max=${m1.maxLabelLabel}px² worst=${JSON.stringify(m1.worstLabelLabel)}`,
);

// ---------- 5. (5b) Regions + Kelly County isolation ----------
// Open the Kelly County area page (sheet open: pill hidden by design).
await openAreaPage(page, 'Kelly County');
await shot(page, 'g02-kelly-isolated');
const m2 = await measure(page);
console.log('--- Kelly area page OPEN (sheet covers map) ---');
console.log(`labels=${m2.labelCount} rects=${m2.dashedRectCount} masks=${m2.maskCount} markers=${m2.markerCount} geoPills=${m2.geoPillCount} sheet=${m2.areaSheetOpen} pill=${JSON.stringify(m2.isolationPill)}`);
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
  `labels=${m2.labelCount} rects=${m2.dashedRectCount} (layer still on: ${gangStillOn}) — see probe-gangop-pillstate.mjs P1/P3 for the pill state`,
);
// Close the sheet via its X: this EXITS the isolation entirely.
const closed = await closeAreaSheet(page);
await page.waitForTimeout(1500);
await shot(page, 'g02b-kelly-isolation-map');
const m2b = await measure(page);
console.log('--- Kelly sheet CLOSED via X (isolation exited) ---');
console.log(`labels=${m2b.labelCount} rects=${m2b.dashedRectCount} masks=${m2b.maskCount} markers=${m2b.markerCount} sheet=${m2b.areaSheetOpen} pill=${JSON.stringify(m2b.isolationPill)}`);
check('R8c closing the sheet via X exits isolation (mask gone)', closed && m2b.maskCount === 0 && m2b.areaSheetOpen === false, `closed=${closed} masks=${m2b.maskCount} sheet=${m2b.areaSheetOpen}`);
check('R8d regions return once isolation exits', m2b.labelCount === 17 && m2b.dashedRectCount === 17, `labels=${m2b.labelCount} rects=${m2b.dashedRectCount}`);

// Zoom right in on Kelly WITHOUT isolation: fly to Starlet Motel (L304,
// Kelly County) via deep link, then zoom in. A region must never pin.
await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await waitForText(page, /STARLET MOTEL/);
// Close the place sheet FIRST: while a place is open the map hero (and
// its filter button) is hidden, so the layer cannot be re-enabled yet.
const closePlace = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlace.count()) { await closePlace.click(); await page.waitForTimeout(900); }
await ensureGangOpOn(page);
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
await shot(page, 'g03-kelly-zoomed');
const m3 = await measure(page);
console.log('--- Kelly zoomed in (Starlet, no isolation) ---');
console.log(`labels=${m3.labelCount} rects=${m3.dashedRectCount} markers=${m3.markerCount} gangOpPins=${m3.gangOpPins.length} labelGeo=${m3.maxLabelGeo}px² labelLabel=${m3.maxLabelLabel}px²`);
for (const l of m3.labels) console.log(`  label ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 110)}`);
check('R9 zoomed-in region is still a region, never a pin', m3.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m3.gangOpPins)} markers=${m3.markerCount}`);
check('R9b zoomed-in Kelly rect still renders (dashed)', m3.dashedRectCount >= 1 && m3.dashedRects.every((d) => d.dash === '6 4'), `rects=${m3.dashedRectCount}`);
check('R9c zoomed-in labels do not overlap geo pills', m3.maxLabelGeo === 0, `max=${m3.maxLabelGeo}px² worst=${JSON.stringify(m3.worstLabelGeo)}`);

// ---------- 6. Ambrosia close-up (no isolation: deep link to L590) ----------
await page.goto(`${BASE}?place=L590`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await waitForText(page, /AMBROSIA RACEWAY PARK/);
// Close the place sheet first (hero hidden while a place is open).
const closePlace2 = page.getByRole('button', { name: /Close place details/i }).first();
if (await closePlace2.count()) { await closePlace2.click(); await page.waitForTimeout(900); }
await ensureGangOpOn(page);
await shot(page, 'g04b-ambrosia-map');
const m4 = await measure(page);
console.log('--- Ambrosia view (L590 deep link, no isolation) ---');
console.log(`labels=${m4.labelCount} rects=${m4.dashedRectCount} gangOpPins=${m4.gangOpPins.length} labelGeo=${m4.maxLabelGeo}px²`);
for (const l of m4.labels) console.log(`  label ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 110)}`);
const ambClose = m4.labels.find((l) => AMBROSIA_2.every((n) => l.text.includes(n)));
check('R10 Ambrosia rect visible close-up with both ops named', !!ambClose, ambClose ? `${ambClose.text.slice(0, 160)} | ${ambClose.rect.w}x${ambClose.rect.h}` : 'not in view — see g04b');
check('R10b no gang-op pin at Ambrosia close-up', m4.gangOpPins.length === 0, `gangOpPins=${JSON.stringify(m4.gangOpPins)}`);

// ---------- 7. No-extent op card: honest empty state ----------
await page.goto(`${BASE}?place=gang-op:fishing-shacks`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await waitForText(page, /Fishing Shacks/);
await shot(page, 'g05-fishing-shacks');
const fishText = await page.evaluate(() => document.body.innerText);
console.log('--- Fishing Shacks card (first 1200 chars) ---');
console.log(fishText.slice(0, 1200));
check(
  'R11 no-extent op card is honest (area only, no invented extent/pin)',
  /Fishing Shacks/.test(fishText) && /no verified position/i.test(fishText),
  'card names the op and says no verified position',
);

// ---------- 8. Layer off again: regions vanish ----------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const gangBox2 = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (await gangBox2.isChecked()) { await gangBox2.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1200);
await shot(page, 'g06-layer-off-again');
const m5 = await measure(page);
check('R12 turning the layer off removes all regions', m5.labelCount === 0 && m5.dashedRectCount === 0, `labels=${m5.labelCount} rects=${m5.dashedRectCount}`);

await ctx.close();
console.log('\n=== GANGOP-REGIONS SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
