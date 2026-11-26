/* global document, localStorage */
// Lane 4 item 1 — my-markers re-enable repro (runs on :4330).
// Fresh profile `lane4-mymarkers` so the demo profiles are untouched.
//  1. Open the Map filters sheet, switch every checked toggle off, verify 0.
//  2. Ask a bare-name question ("flamingos") + Find "Brooks Boatworks".
//  3. Re-read the sheet IN THE SAME PAGE (no reload).
//  4. Reload the page, re-read the sheet again.
//  5. Dump the saved view from localStorage at each step.
// The demo's re-read happened after a fresh launch (demo-gang.mjs is a
// separate script on the same persistent profile), so step 4 is the
// suspected cause: the mount effect resets layers to DEFAULT_LAYERS.
import { launch4, shot } from './lane4-harness.mjs';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

async function sheetChecked(page) {
  return page.evaluate(() => {
    const s = document.querySelector('.map-filter-sheet');
    if (!s) return null;
    return [...s.querySelectorAll('input[type="checkbox"]:checked')].map((el) => {
      const label = el.closest('label');
      return (label?.innerText || '').trim().split('\n')[0];
    });
  });
}

async function openSheet(page) {
  await page.getByRole('button', { name: 'Open map filters' }).first().click();
  await page.waitForTimeout(1000);
}
async function closeSheet(page) {
  await page.getByRole('button', { name: 'Close map filters' }).first().click();
  await page.waitForTimeout(700);
}
async function savedView(page) {
  return page.evaluate(() => localStorage.getItem('leonida-map-view-v1'));
}

let { ctx, page } = await launch4('lane4-mymarkers', 'L4-1');
await shot(page, 'l4-01-home');

// --- step 1: switch everything off ---
await openSheet(page);
const before = await sheetChecked(page);
console.log('checked before switch-off:', JSON.stringify(before));
const toggles = page.locator('.map-filter-sheet input[type="checkbox"]:checked');
let n = await toggles.count();
while (n > 0) {
  await toggles.nth(0).click();
  await page.waitForTimeout(200);
  n = await page.locator('.map-filter-sheet input[type="checkbox"]:checked').count();
}
const remaining = await sheetChecked(page);
console.log('checked after switch-off:', JSON.stringify(remaining));
check('switch-off leaves 0 checked toggles', remaining !== null && remaining.length === 0, `${remaining?.length ?? '?'} remaining`);
await closeSheet(page);
await page.waitForTimeout(500);
console.log('saved view after switch-off:', await savedView(page));

// --- step 2: Ask + Find (same page, no reload) ---
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForTimeout(900);
const input = page.locator('#ask-nylah-input');
await input.click();
await input.fill('flamingos');
await page.getByLabel('Send', { exact: true }).click();
await page.waitForTimeout(3500);
const askText = await page.locator('section.ask-panel').innerText();
console.log('Ask "flamingos" mentions flamingo:', /flamingo/i.test(askText));
await page.getByRole('button', { name: 'Map', exact: true }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /Search Leonida/i }).first().click();
await page.waitForTimeout(900);
await page.locator('#atlas-search').fill('Brooks Boatworks');
await page.waitForTimeout(1500);
const findText = await page.evaluate(() => document.body.innerText);
console.log('Find lists Brooks Boatworks:', /Brooks Boatworks/.test(findText));
// Escape leaves the Find overlay open over the map edge stack (noted in
// demo-gang.mjs) — close the panel properly before reaching for the
// map-filter button.
await page.getByRole('button', { name: 'Close panel' }).first().click();
await page.waitForTimeout(700);

// --- step 3: re-read in the same page ---
await openSheet(page);
const inSession = await sheetChecked(page);
console.log('checked in-session after Ask+Find:', JSON.stringify(inSession));
check(
  'in-session re-read: my-markers stays off after Ask+Find',
  inSession !== null && inSession.length === 0,
  `${inSession?.length ?? '?'} checked: ${JSON.stringify(inSession)}`,
);
await shot(page, 'l4-02-sheet-in-session');
await closeSheet(page);
console.log('saved view before reload:', await savedView(page));

// --- step 4: reload, re-read ---
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await openSheet(page);
const afterReload = await sheetChecked(page);
console.log('checked after reload:', JSON.stringify(afterReload));
check(
  'after reload: my-markers stays off (BUG if checked again)',
  afterReload !== null && afterReload.length === 0,
  `${afterReload?.length ?? '?'} checked: ${JSON.stringify(afterReload)}`,
);
await shot(page, 'l4-03-sheet-after-reload');
await closeSheet(page);
console.log('saved view after reload:', await savedView(page));

await ctx.close();
console.log('\n=== LANE4-1 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
