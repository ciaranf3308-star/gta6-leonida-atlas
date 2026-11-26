// Demo G follow-up probe: re-ask the hint sequence on the demo-g
// profile (seed restored, Vicki already collected) and read ONLY the
// newest answer after each question, so the panel's accumulated
// history can't masquerade as a later level.
import { launch, shot, clickTab } from './harness.mjs';
const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}
async function askLast(page, question) {
  await clickTab(page, 'Ask');
  const input = page.locator('#ask-nylah-input');
  await input.waitFor({ timeout: 15000 });
  await input.click();
  await input.fill(question);
  await page.getByLabel('Send', { exact: true }).click();
  await page.waitForTimeout(3500);
  const panel = page.locator('section.ask-panel');
  await panel.waitFor({ timeout: 15000 });
  // Newest answer = last message block in the panel. Messages render
  // as article/div blocks; take the panel text after the last
  // occurrence of the question echo.
  const full = await panel.innerText();
  const idx = full.lastIndexOf(question);
  const last = idx >= 0 ? full.slice(idx) : full;
  return last;
}
const { ctx, page } = await launch('demo-g', 'G2');
const a1 = await askLast(page, 'give me a hint for the Harley card');
await shot(page, 'g10-hint-harley-last');
console.log('--- G1 last answer ---');
console.log(a1.slice(0, 1500));
check('G1 level-1: set name only, no area/host/street', !/Port Gellhorn|Delights|Historic Route|booth/i.test(a1) && /Delights Dancers/.test(a1), 'see g10');
const a2 = await askLast(page, 'Bigger hint');
await shot(page, 'g11-bigger-2-last');
console.log('--- G2 last answer ---');
console.log(a2.slice(0, 1500));
check('G2 level-2: names the area, no host/street', /Port Gellhorn/.test(a2) && !/Delights|booth/i.test(a2), 'see g11');
const a3 = await askLast(page, 'Bigger hint');
await shot(page, 'g12-bigger-3-last');
console.log('--- G3 last answer ---');
console.log(a3.slice(0, 1500));
check('G3 level-3: names Delights, focuses map, no spot description', /Delights/.test(a3) && !/booth/i.test(a3), 'see g12');
const a4 = await askLast(page, 'Bigger hint');
await shot(page, 'g13-bigger-4-last');
console.log('--- G4 last answer ---');
console.log(a4.slice(0, 1500));
check('G4 level-4: booth detail', /booth/i.test(a4), 'see g13');
const a5 = await askLast(page, 'give me a hint for the Amber card');
await shot(page, 'g14-hint-amber-last');
console.log('--- G5 last answer ---');
console.log(a5.slice(0, 1500));
check('G5 unpinned Amber: honest no-location, no invented location', /Nobody's published a spot/i.test(a5), 'see g14');
const a6 = await askLast(page, 'give me a hint for the Vicki card');
await shot(page, 'g15-hint-vicki-last');
console.log('--- G6 last answer ---');
console.log(a6.slice(0, 1500));
check('G6 hint for collected Vicki refused', /already got that one/i.test(a6), 'see g15');
await ctx.close();
console.log('\n=== DEMO G (last-answer) SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
