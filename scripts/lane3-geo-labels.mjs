// Lane 3 probe — geo-label pills vs selected pin / vs each other.
// 390px, DPR 2, Playwright Chromium, fresh profile `lane3-geo`.
// Served from `vite preview` on port 4340 with ATLAS_BASE_PATH set.
// Measures live DOM rects + elementFromPoint (same method as step-9 s11):
//   - pill-vs-selected-pin overlap (px²), pill-vs-highlight-pin, pill-vs-pill
//   - pill widths (to calibrate the estimator in label-placement.ts)
//   - pill counts per zoom band, and pill tap -> area page opens.
// Shots: l3* under shots/. Usage: node lane3-geo-labels.mjs
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:4340/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/lane3-geo';
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

/** Live rect census: geo pills, selected + highlighted pin faces, all pin faces. */
async function measure(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    };
    const overlap = (a, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? Math.round(w * h) : 0;
    };
    const pills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({
      name: (el.textContent || '').trim(),
      rect: rect(el),
      centreHit: (() => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit ? `${hit.tagName}.${String(hit.className).slice(0, 60)}` : 'null';
      })(),
    }));
    const faces = (sel) => [...document.querySelectorAll(sel)].map((el) => ({ cls: String(el.className).slice(0, 80), rect: rect(el) }));
    const selected = faces('.atlas-map-marker.is-selected .atlas-pin-face');
    const highlighted = faces('.atlas-map-marker.is-highlighted .atlas-pin-face');
    const allPins = faces('.atlas-map-marker .atlas-pin-face, .atlas-map-marker .atlas-cluster-face');
    let maxPillSelected = 0, maxPillHighlight = 0, maxPillAnyPin = 0, maxPillPill = 0;
    let worst = null;
    for (const p of pills) {
      for (const s of selected) {
        const o = overlap(p.rect, s.rect);
        if (o > maxPillSelected) { maxPillSelected = o; worst = { pill: p.name, vs: 'selected-pin', px2: o }; }
      }
      for (const h of highlighted) {
        const o = overlap(p.rect, h.rect);
        if (o > maxPillHighlight) maxPillHighlight = o;
      }
      for (const a of allPins) {
        const o = overlap(p.rect, a.rect);
        if (o > maxPillAnyPin) maxPillAnyPin = o;
      }
    }
    for (let i = 0; i < pills.length; i++) {
      for (let j = i + 1; j < pills.length; j++) {
        const o = overlap(pills[i].rect, pills[j].rect);
        if (o > maxPillPill) { maxPillPill = o; worst = { pill: pills[i].name, vs: `pill:${pills[j].name}`, px2: o }; }
      }
    }
    return {
      pillCount: pills.length,
      pillNames: pills.map((p) => p.name),
      pillWidths: pills.map((p) => ({ name: p.name, w: p.rect.w, h: p.rect.h })),
      selectedPin: selected[0] ?? null,
      highlightedCount: highlighted.length,
      allPinCount: allPins.length,
      maxPillSelected, maxPillHighlight, maxPillAnyPin, maxPillPill, worst,
      centreHits: pills.map((p) => `${p.name} -> ${p.centreHit}`),
    };
  });
}

function logMeasure(label, m) {
  console.log(`--- ${label} ---`);
  console.log(`pills=${m.pillCount} selectedPin=${JSON.stringify(m.selectedPin)} highlighted=${m.highlightedCount} allPins=${m.allPinCount}`);
  console.log(`max pill-vs-selected=${m.maxPillSelected}px² pill-vs-highlight=${m.maxPillHighlight}px² pill-vs-any-pin=${m.maxPillAnyPin}px² pill-vs-pill=${m.maxPillPill}px² worst=${JSON.stringify(m.worst)}`);
  console.log('pill widths:', JSON.stringify(m.pillWidths.slice(0, 12)));
  console.log('centre hits:', JSON.stringify(m.centreHits.slice(0, 12)));
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[lane3] pageerror:', String(e).slice(0, 300)));

// ---------- Case A: Starlet Motel selected (district zoom, town pills) ----------
await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await waitForText(page, /LEONIDA · PLACE/);
await page.waitForTimeout(1500);
await shot(page, 'l3a-starlet-selected');
const mA = await measure(page);
logMeasure('A: Starlet selected', mA);
check('A1 selected pin face has 0px² overlap from geo pills', mA.maxPillSelected === 0, `max=${mA.maxPillSelected}px² worst=${JSON.stringify(mA.worst)}`);
check('A2 geo pills do not overlap each other', mA.maxPillPill === 0, `max=${mA.maxPillPill}px²`);
check('A3 Starlet view still shows geo pills (not all suppressed)', mA.pillCount > 0, `pills=${mA.pillCount}: ${mA.pillNames.slice(0, 8).join(', ')}`);

// ---------- Case B: island zoom + Ask highlights (county pill vs ringed diamonds) ----------
// Fresh load (no selection) at island zoom, then ask for the Harley hint —
// the finder path sets highlight pins even keyless (cf. demo-g g11).
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForTimeout(900);
const askInput = page.locator('#ask-nylah-input');
await askInput.waitFor({ timeout: 15000 });
await askInput.click();
await askInput.fill('give me a hint for the Harley card');
await page.getByLabel('Send', { exact: true }).click();
await page.waitForTimeout(4000);
const clearHi = await page.getByText(/Clear highlights/).count();
console.log('Clear highlights button count:', clearHi);
await page.getByRole('button', { name: 'Map', exact: true }).click();
await page.waitForTimeout(2500);
// Zoom all the way out to the island fit (the Ask hint may have flown
// the camera in; at min zoom every county centroid is in view, so a
// missing county pill is suppression, not viewport).
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    document.querySelectorAll('[aria-label="Zoom out"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(700);
}
await shot(page, 'l3b-island-highlights');
const mB = await measure(page);
logMeasure('B: island zoom + highlights', mB);
// Same-state repeat: nothing touched between the two measures, so an
// identical result anchors the highlights-on state against camera drift
// when the highlights-off measure (B4) is compared with it.
const mBrepeat = await measure(page);
console.log('B repeat identical:', JSON.stringify(mBrepeat.pillNames) === JSON.stringify(mB.pillNames) && mBrepeat.maxPillHighlight === mB.maxPillHighlight);
check('B1 county pills present at island zoom', mB.pillNames.some((n) => /County/.test(n)), `pills=${mB.pillCount}: ${mB.pillNames.join(', ')}`);
check('B2 geo pills have 0px² overlap with highlighted (ringed) pins', mB.maxPillHighlight === 0, `max=${mB.maxPillHighlight}px² highlighted=${mB.highlightedCount}`);
check('B3 geo pills do not overlap each other at island zoom', mB.maxPillPill === 0, `max=${mB.maxPillPill}px²`);
// Round trip: clearing the highlights brings the suppressed county
// pills back — proving the suppression is highlight-caused and
// reversible, not a zoom-band or viewport artefact.
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForTimeout(900);
const clearBtn = page.getByText(/Clear highlights/).first();
if (await clearBtn.count()) {
  await clearBtn.click();
  await page.waitForTimeout(1500);
}
await page.getByRole('button', { name: 'Map', exact: true }).click();
await page.waitForTimeout(2000);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    document.querySelectorAll('[aria-label="Zoom out"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(700);
}
const mB2 = await measure(page);
logMeasure('B4: island zoom, highlights cleared', mB2);
check('B4 clearing highlights restores all 5 county pills', mB2.pillCount === 5 && mB2.pillNames.every((n) => /County/.test(n)), `pills=${mB2.pillNames.join(', ')} (were ${mB.pillCount} with highlights: ${mB.pillNames.join(', ')})`);

// ---------- Case C: pill tap opens its area ----------
// Fresh load, zoom into the district band the same way case D does
// (zooming into the island centre; Port Gellhorn itself sits off that
// viewport, so tap the first pill actually in view — the assertion is
// generic: a rendered pill opens its area page).
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
const mC0 = await measure(page);
console.log('C pre-tap pills:', JSON.stringify(mC0.pillNames));
await shot(page, 'l3c-district-before-tap');
const firstPillName = mC0.pillNames[0];
check('C1 a geo pill renders at district zoom', mC0.pillCount > 0, `pills=${mC0.pillNames.join(', ')}`);
if (firstPillName) {
  await page.getByRole('button', { name: `Show ${firstPillName} area`, exact: true }).first().click();
  await page.waitForTimeout(2000);
  await shot(page, 'l3c-after-pill-tap');
  const areaOpen = await page.evaluate(() => ({
    sheet: !!document.querySelector('section.area-page'),
    text: document.body.innerText.slice(0, 500),
  }));
  console.log('after pill tap, area sheet:', areaOpen.sheet);
  check('C2 tapping a geo pill opens its area page', areaOpen.sheet && areaOpen.text.includes(firstPillName), `sheet=${areaOpen.sheet} pill=${firstPillName}`);
}

// ---------- Case D: zoom bands still hold ----------
// Island: counties only. District: towns, no counties. (Street band: spot-check
// a neighbourhood pill exists after zooming further in.)
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const mD0 = await measure(page);
check('D1 island zoom shows county pills, no town pills', mD0.pillNames.length === 5 && mD0.pillNames.every((n) => /County/.test(n)), `pills=${mD0.pillNames.join(', ')}`);
for (let i = 0; i < 6; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
const mD1 = await measure(page);
console.log('D district pills:', JSON.stringify(mD1.pillNames.slice(0, 10)), `count=${mD1.pillCount}`);
check('D2 district zoom shows town/city pills, no county pills', mD1.pillCount > 0 && mD1.pillNames.every((n) => !/County/.test(n)), `count=${mD1.pillCount}`);

await ctx.close();
console.log('\n=== LANE3 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
