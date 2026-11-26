// Demo lane 5 follow-up — regions vs area isolation, root-caused.
// The main probe found labels=0 under Ambrosia isolation and could not
// tell whether the gang-op layer was switched off by area navigation or
// the regions are suppressed under isolation. This probe answers that
// directly: it reads the Layers-sheet checkbox state at each step and,
// if the layer was switched off, turns it back on under isolation and
// re-measures. Fixed selectors: Leaflet non-interactive vector layers
// carry NO .leaflet-interactive class, so rects/masks are matched by
// stroke/fill attributes on ANY path in the overlay pane.
// Fresh profile `demo-gangop2`. Port 4330. Shots: g10* / g11*.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-gangop2';
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
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const panePaths = [...document.querySelectorAll('.leaflet-overlay-pane path')];
    const regionRects = panePaths.filter((el) => el.getAttribute('stroke') === '#ff8f8f');
    const masks = panePaths.filter((el) => el.getAttribute('fill') === '#0b1018');
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      rect: rect(el),
    }));
    const markers = [...document.querySelectorAll('.atlas-map-marker')].length;
    const paneOrder = panePaths.map((el) => ({ s: el.getAttribute('stroke'), f: el.getAttribute('fill'), d: el.getAttribute('stroke-dasharray') }));
    return {
      labelCount: labels.length,
      labels: labels.map((l) => `${l.text.slice(0, 60)} [${l.rect.w}x${l.rect.h}]`),
      regionRectCount: regionRects.length,
      regionDashes: [...new Set(regionRects.map((el) => el.getAttribute('stroke-dasharray')))],
      maskCount: masks.length,
      markerCount: markers,
      geoPillCount: document.querySelectorAll('.atlas-geo-label').length,
      areaSheetOpen: !!document.querySelector('section.area-page'),
      isolationPill: (document.querySelector('.isolation-pill')?.textContent || '').trim().slice(0, 60),
      breadcrumb: (document.querySelector('.map-hero')?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      nothingBanner: /NOTHING SHOWING HERE/.test(document.body.innerText),
      paneOrder,
    };
  });
}

async function gangOpChecked(page) {
  await page.getByRole('button', { name: 'Open map filters' }).first().click();
  await page.waitForTimeout(1000);
  const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
  const n = await box.count();
  const checked = n ? await box.isChecked() : null;
  return { n, checked, close: async () => {
    await page.getByRole('button', { name: 'Close map filters' }).first().click();
    await page.waitForTimeout(900);
  } };
}

async function setGangOp(page, want) {
  const s = await gangOpChecked(page);
  if (s.n && s.checked !== want) {
    const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
    await box.click();
    await page.waitForTimeout(1200);
  }
  await s.close();
}

async function openAreaPage(page, nameRe) {
  // Same as demo-small: name 'Area' substring, .first() = the hero button
  // (the button's accessible name is "Search for an area in Leonida";
  // geo pills are "Show <X> area" and come later in DOM order).
  await page.getByRole('button', { name: 'Area', exact: false }).first().click();
  await page.waitForTimeout(1200);
  const crumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
  if (await crumb.count()) { await crumb.click(); await page.waitForTimeout(1000); }
  await page.getByRole('button', { name: nameRe }).first().click();
  await page.waitForTimeout(3000);
}

async function closeAreaSheet(page) {
  // Real control (AreaPage.tsx:70): "Close area page — show all of Leonida".
  // Escape does NOT reliably close the sheet — the earlier probe's
  // aria-label="Close" selector matched nothing and the sheet stayed open.
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
page.on('pageerror', (e) => console.log('[g2] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[g2] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await setGangOp(page, true);
await shot(page, 'g10-island-regions');
let m = await measure(page);
console.log('island, gang-op ON:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, dashes: m.regionDashes, markers: m.markerCount, pills: m.geoPillCount }));
check('I1 island: 13 labels + 13 dashed rects with the layer on', m.labelCount === 13 && m.regionRectCount === 13, `labels=${m.labelCount} rects=${m.regionRectCount} dashes=${JSON.stringify(m.regionDashes)}`);

// --- Kelly County sheet open ---
await openAreaPage(page, /Kelly County/);
await shot(page, 'g11-kelly-sheet-open');
m = await measure(page);
console.log('Kelly sheet OPEN:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, pills: m.geoPillCount, sheet: m.areaSheetOpen, pill: m.isolationPill }));
check('I2 Kelly sheet open: regions still in the DOM', m.labelCount === 13 && m.regionRectCount === 13, `labels=${m.labelCount} rects=${m.regionRectCount}`);
check('I2b Kelly sheet open: isolation mask live', m.maskCount >= 1, `masks=${m.maskCount}`);
let s = await gangOpChecked(page);
console.log('gang-op checkbox with Kelly sheet open:', JSON.stringify({ n: s.n, checked: s.checked }));
check('I2c gang-op layer still ON with Kelly sheet open', s.checked === true, `checked=${s.checked}`);
await s.close();

// --- Close the Kelly sheet: does isolation survive? ---
const closedKelly = await closeAreaSheet(page);
await shot(page, 'g12-kelly-sheet-closed');
m = await measure(page);
console.log('Kelly sheet CLOSED:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, sheet: m.areaSheetOpen, pill: m.isolationPill, crumb: m.breadcrumb }));
check('I3 closing the Kelly sheet exits isolation (pill gone, mask gone)', m.maskCount === 0 && m.isolationPill === '', `masks=${m.maskCount} pill=${JSON.stringify(m.isolationPill)}`);
check('I3b regions back to 13 after the sheet closes', m.labelCount === 13 && m.regionRectCount === 13, `labels=${m.labelCount} rects=${m.regionRectCount}`);

// --- Ambrosia: open its page, then close the sheet (pill state) ---
await openAreaPage(page, /Kelly County/);
await page.waitForTimeout(500);
const ambRow = page.getByRole('button', { name: /^Ambrosia/ }).first();
if (await ambRow.count()) { await ambRow.click(); await page.waitForTimeout(3000); }
await shot(page, 'g13-ambrosia-sheet-open');
m = await measure(page);
console.log('Ambrosia sheet OPEN:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, sheet: m.areaSheetOpen, pill: m.isolationPill }));
check('I4 Ambrosia sheet open: regions still in the DOM', m.labelCount >= 1, `labels=${m.labelCount} rects=${m.regionRectCount}`);
const closedAmb = await closeAreaSheet(page);
await shot(page, 'g14-ambrosia-pill');
m = await measure(page);
console.log('Ambrosia sheet CLOSED (pill state):', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, masks: m.maskCount, markers: m.markerCount, sheet: m.areaSheetOpen, pill: m.isolationPill, banner: m.nothingBanner }));
console.log('Ambrosia labels:', JSON.stringify(m.labels));
s = await gangOpChecked(page);
console.log('gang-op checkbox under Ambrosia isolation:', JSON.stringify({ n: s.n, checked: s.checked }));
await s.close();
check('I5 Ambrosia isolation (pill state): gang-op layer still ON', s.checked === true, `checked=${s.checked}`);
check('I5b Ambrosia isolation: the Ambrosia region still renders', m.labels.some((t) => t.includes('Hog Stars Garage')), `labels=${JSON.stringify(m.labels)}`);
// Z-order under Ambrosia isolation: mask vs region rect in the overlay pane.
const maskIdx = m.paneOrder.findIndex((p) => p.f === '#0b1018');
const regionIdxs = m.paneOrder.map((p, i) => (p.s === '#ff8f8f' ? i : -1)).filter((i) => i >= 0);
console.log(`pane order: mask@${maskIdx} regions@${JSON.stringify(regionIdxs)} (total paths ${m.paneOrder.length})`);
check('I5c region rects paint after (on top of) the isolation mask', maskIdx >= 0 && regionIdxs.length > 0 && regionIdxs.every((i) => i > maskIdx), `mask@${maskIdx} regions@${JSON.stringify(regionIdxs)}`);
// Zoom in on Ambrosia with the pill state active: still a region, never a pin.
for (let i = 0; i < 4; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(900);
}
await shot(page, 'g15-ambrosia-zoomed');
m = await measure(page);
console.log('Ambrosia zoomed:', JSON.stringify({ labels: m.labelCount, rects: m.regionRectCount, markers: m.markerCount }));
console.log('Ambrosia zoomed labels:', JSON.stringify(m.labels));
check('I6 zoomed Ambrosia region still renders, no pin', m.labels.some((t) => t.includes('Hog Stars Garage')) && m.regionRectCount >= 1, `labels=${JSON.stringify(m.labels)} rects=${m.regionRectCount}`);

await ctx.close();
console.log('\n=== ISOLATION FOLLOW-UP SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
