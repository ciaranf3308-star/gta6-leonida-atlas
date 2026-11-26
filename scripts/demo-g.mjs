// Demo G — progressive hints (DESIGN-ADDENDUM §5.2, demos E–G).
// UI-level attempt WITHOUT an OpenAI key: the hint ladder lives in
// the get_hint tool, which askWithTools only reaches with a key.
// Expect the no-key finder to answer every hint question with a
// proximity verdict, and record exactly that — nothing faked.
// Tool-level evidence is cited from tests/unit/ask-tools.test.ts.
import { launch, shot, bodyText, clickTab, closeDialog, waitForText } from './harness.mjs';

const SEED =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/seed-v3-backup.json';
const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

async function openBackupDialog(page) {
  await clickTab(page, 'Collections');
  await page.getByRole('button', { name: 'SETTINGS', exact: false }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Back up my ViceWire/i }).first().click();
  await page.waitForTimeout(900);
}

async function restoreFile(page, path, shotName) {
  await openBackupDialog(page);
  const input = page.locator('#backup-file');
  await input.setInputFiles(path);
  await page.waitForTimeout(1500);
  const merge = page.getByRole('button', { name: /Merge backup/i });
  if (await merge.count()) {
    await merge.click();
    await waitForText(page, /Backup merged/, 30000);
    await shot(page, shotName + '-merged');
  }
  await closeDialog(page);
}

async function ask(page, question) {
  await clickTab(page, 'Ask');
  const input = page.locator('#ask-nylah-input');
  await input.waitFor({ timeout: 15000 });
  await input.click();
  await input.fill(question);
  await page.getByLabel('Send', { exact: true }).click();
  await page.waitForTimeout(3000);
  const panel = page.locator('section.ask-panel');
  await panel.waitFor({ timeout: 15000 });
  return await panel.innerText();
}

let { ctx, page } = await launch('demo-g', 'G');
await shot(page, 'g01-fresh-home');
await restoreFile(page, SEED, 'g02-restore-seed');
// Delights Dancers 0/18 at seed (sanity via Collections).
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
console.log('journal row:', (await bodyText(page)).match(/Delights Dancers · [^\n]*/)?.[0]);

// G1: hint for the Harley card (level 1 expected: set name only).
const g1 = await ask(page, 'give me a hint for the Harley card');
await shot(page, 'g03-ask-hint-harley');
console.log('--- G1 hint Harley ---');
console.log(g1.slice(0, 2000));
check(
  'G1 level-1 hint: set name only, no area/host/street',
  !/Port Gellhorn|Delights|Historic Route|Booth|booth/i.test(g1),
  'see g03-ask-hint-harley.png',
);
// G2: "Bigger hint" (level 2 expected: area "Port Gellhorn, Kelly County").
const g2 = await ask(page, 'Bigger hint');
await shot(page, 'g04-ask-bigger-hint-2');
console.log('--- G2 bigger hint ---');
console.log(g2.slice(0, 2000));
check(
  'G2 level-2 hint: names the area, no host/street',
  /Port Gellhorn/.test(g2) && !/Delights|booth/i.test(g2),
  'see g04-ask-bigger-hint-2.png',
);
// G3: "Bigger hint" (level 3: names Delights, focuses map, no spot desc).
const g3 = await ask(page, 'Bigger hint');
await shot(page, 'g05-ask-bigger-hint-3');
console.log('--- G3 bigger hint ---');
console.log(g3.slice(0, 2000));
check(
  'G3 level-3 hint: names Delights, focuses map, no spot description',
  /Delights/.test(g3) && !/booth/i.test(g3),
  'see g05-ask-bigger-hint-3.png',
);
// G4: "Bigger hint" (level 4: booth detail).
const g4 = await ask(page, 'Bigger hint');
await shot(page, 'g06-ask-bigger-hint-4');
console.log('--- G4 bigger hint ---');
console.log(g4.slice(0, 2000));
check('G4 level-4 hint: booth detail', /booth/i.test(g4), 'see g06-ask-bigger-hint-4.png');

// G5: hint for an UNPINNED Delights card (Amber) — levels 1–2 work;
// past level 2 the honest no-location message, no invented location.
const g5 = await ask(page, 'give me a hint for the Amber card');
await shot(page, 'g07-ask-hint-amber');
console.log('--- G5 hint Amber ---');
console.log(g5.slice(0, 2000));
check(
  'G5 unpinned Amber: honest no-location past level 2, no invented location',
  /Nobody's published a spot/i.test(g5),
  'see g07-ask-hint-amber.png',
);

// G6: collect Vicki, then hint for Vicki must be refused.
await clickTab(page, 'Collections');
await page.getByText(/Delights Dancers/).first().click();
await page.waitForTimeout(1000);
const vickiBox = page.getByRole('checkbox', { name: /Vicki/i }).first();
if (await vickiBox.count()) {
  await vickiBox.click();
  await page.waitForTimeout(1200);
}
await shot(page, 'g08-vicki-collected');
const g6 = await ask(page, 'give me a hint for the Vicki card');
await shot(page, 'g09-ask-hint-vicki');
console.log('--- G6 hint Vicki (collected) ---');
console.log(g6.slice(0, 2000));
check(
  'G6 hint for collected Vicki refused',
  /already got that one/i.test(g6),
  'see g09-ask-hint-vicki.png',
);

// G7: is there a "Bigger hint" button anywhere in the Ask UI?
const biggerBtn = page.getByRole('button', { name: /Bigger hint/i });
console.log('"Bigger hint" button count in Ask UI:', await biggerBtn.count());
check('G7 "Bigger hint" button exists in UI', (await biggerBtn.count()) > 0, 'escalation would be via follow-up questions to the LLM router');

await ctx.close();
console.log('\n=== DEMO G SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
