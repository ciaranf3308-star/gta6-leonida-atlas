/* global document */
// Gang-op reachability, round 2 — fresh profile (default layers):
//  1. Find "Brooks Boatworks" — dump every result row in the overlay.
//  2. Find "Tyson Brooks" (control — a catalogue person card).
//  3. Ask "where is Brooks Boatworks?" — match ONLY the answer text
//     after the question echo (the echo itself contains the name).
import { launch, shot, clickTab } from './harness.mjs';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

let { ctx, page } = await launch('demo-gang2', 'G2');
await clickTab(page, 'Map');
await page.waitForTimeout(1500);

async function findQuery(q) {
  const pill = page.getByRole('button', { name: /Search Leonida/i }).first();
  await pill.click();
  await page.waitForTimeout(900);
  const input = page.locator('#atlas-search');
  await input.fill(q);
  await page.waitForTimeout(1800);
  const rows = await page.evaluate(() => {
    const overlay = document.querySelector('aside.sidebar');
    if (!overlay) return { error: 'no sidebar' };
    // Result rows are the buttons/links below the "PLACES SHOWING" line.
    const text = overlay.innerText;
    const idx = text.indexOf('PLACES SHOWING');
    return { tail: text.slice(idx, idx + 1500) };
  });
  return rows;
}

const brooks = await findQuery('Brooks Boatworks');
console.log('--- Find "Brooks Boatworks" tail ---');
console.log(brooks.tail ?? brooks.error);
await shot(page, 's17-find-brooks-fresh');
check(
  'G1b Find (fresh profile) lists Brooks Boatworks',
  /Brooks Boatworks/.test(brooks.tail ?? ''),
  (brooks.tail ?? '').split('\n').slice(0, 8).join(' | '),
);
await page.keyboard.press('Escape');
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const tyson = await findQuery('Tyson Brooks');
console.log('--- Find "Tyson Brooks" tail (control) ---');
console.log(tyson.tail ?? tyson.error);
check(
  'G1c Find (control) lists Tyson Brooks',
  /Tyson Brooks/.test(tyson.tail ?? ''),
  (tyson.tail ?? '').split('\n').slice(0, 8).join(' | '),
);
await page.keyboard.press('Escape');
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// 3. Ask — answer only, echo stripped.
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
const echoIdx = askText.lastIndexOf('where is Brooks Boatworks?');
const answerOnly = echoIdx >= 0 ? askText.slice(echoIdx + 'where is Brooks Boatworks?'.length) : askText;
console.log('--- Ask answer ONLY (echo stripped) ---');
console.log(answerOnly.slice(0, 1500));
await shot(page, 's18-ask-brooks-fresh');
check(
  'G3b Ask (fresh profile) lists Brooks Boatworks in the ANSWER',
  /Brooks Boatworks/i.test(answerOnly),
  answerOnly.slice(0, 200).replace(/\n/g, ' | '),
);
await ctx.close();

console.log('\n=== GANG-OP ROUND 2 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
