/* global document */
// Gang-op reachability follow-up (runs on :4330, demo-small profile
// — layers already off from the demo-layers run):
//  1. Find "Brooks Boatworks" — read the FULL overlay text and name
//     the 2 matching places.
//  2. Filters sheet — list EVERY layer row (name + checked) to prove
//     no gang-op toggle exists anywhere in the sheet.
//  3. Ask "where is Brooks Boatworks?" — is a gang-op place reachable
//     via Ask at all?
//  4. Map DOM — is any gang-op marker rendered as a pin?
import { launch, shot, clickTab } from './harness.mjs';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

let { ctx, page } = await launch('demo-small', 'S-gang');
await clickTab(page, 'Map');
await page.waitForTimeout(1500);

// 1. Find
const searchPill = page.getByRole('button', { name: /Search Leonida/i }).first();
await searchPill.click();
await page.waitForTimeout(900);
const searchInput = page.locator('#atlas-search');
await searchInput.fill('Brooks Boatworks');
await page.waitForTimeout(1500);
const findFull = await page.evaluate(() => {
  const overlay = document.querySelector('[class*="find"], [class*="search-overlay"], .atlas-find');
  return (overlay ? overlay.innerText : document.body.innerText).slice(0, 4000);
});
console.log('--- Find "Brooks Boatworks" (full overlay text) ---');
console.log(findFull);
await shot(page, 's15-find-brooks-full');
check(
  'G1 Find lists Brooks Boatworks itself',
  /Brooks Boatworks/.test(findFull),
  'see s15-find-brooks-full.png',
);
// The Find overlay stays open after Escape and covers the map edge
// stack — reload the plain map (same profile, layers stay off).
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// 2. Filters sheet — every layer row
const filtersBtn = page.getByRole('button', { name: 'Open map filters' }).first();
await filtersBtn.click();
await page.waitForTimeout(1200);
const layers = await page.evaluate(() => {
  const s = document.querySelector('.map-filter-sheet');
  if (!s) return { error: 'no sheet' };
  return [...s.querySelectorAll('.layer-row')].map((row) => {
    const box = row.querySelector('input[type="checkbox"]');
    const name = (row.innerText || '').split('\n')[0]?.trim();
    return { name, checked: box ? box.checked : null };
  });
});
console.log('--- all layer rows in the filters sheet ---');
console.log(JSON.stringify(layers, null, 2));
check(
  'G2 no gang-op row anywhere in the filters sheet',
  !layers.some((l) => /gang/i.test(l.name ?? '')),
  `${layers.length} layer rows, none gang-op`,
);
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(800);

// 3. Ask
await clickTab(page, 'Ask');
const input = page.locator('#ask-nylah-input');
await input.waitFor({ timeout: 15000 });
await input.click();
await input.fill('where is Brooks Boatworks?');
await page.getByLabel('Send', { exact: true }).click();
await page.waitForTimeout(3500);
const panel = page.locator('section.ask-panel');
await panel.waitFor({ timeout: 15000 });
const askText = await panel.innerText();
const idx = askText.lastIndexOf('where is Brooks Boatworks?');
const last = idx >= 0 ? askText.slice(idx) : askText;
console.log('--- Ask "where is Brooks Boatworks?" ---');
console.log(last.slice(0, 1500));
await shot(page, 's16-ask-brooks');
check(
  'G3 Ask finds Brooks Boatworks',
  /Brooks Boatworks/i.test(last),
  'finder lists the gang-op place',
);

// 4. Map DOM — any gang-op pin?
await clickTab(page, 'Map');
await page.waitForTimeout(1500);
const pins = await page.evaluate(() => {
  const markers = [...document.querySelectorAll('.atlas-map-marker')];
  return {
    markerCount: markers.length,
    // Marker tooltips / titles that mention Brooks or gang-op.
    brooks: markers.filter((m) => /brooks|gang/i.test(m.textContent || '')).length,
    sampleTitles: markers.slice(0, 8).map((m) => (m.getAttribute('title') || m.textContent || '').trim().slice(0, 50)),
  };
});
console.log('--- map markers ---');
console.log(JSON.stringify(pins, null, 2));
check(
  'G4 gang-op pin rendered on the map (no toggle exists)',
  pins.brooks > 0,
  pins.brooks > 0 ? `${pins.brooks} gang-op/Brooks markers` : `${pins.markerCount} markers, none gang-op/Brooks`,
);
await ctx.close();

console.log('\n=== GANG-OP SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
