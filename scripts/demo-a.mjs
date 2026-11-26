// Demo A — one card collected (step-9 re-run).
// Fresh profile -> restore seed v3 -> collect Vicki via the journal ->
// journal/pin/Progress move, overall % UNCHANGED -> Ask (key-blocked,
// honest-refusal behaviour recorded) -> restart -> export -> wipe ->
// restore with original `at`.
import { launch, shot, bodyText, clickTab, closeDialog, waitForText } from './harness.mjs';
import { readFileSync } from 'node:fs';

const SEED =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/seed-v3-backup.json';
const EXPORT_PATH =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/demo-a-export.json';
const EXPORT_PATH2 =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/demo-a-export2.json';
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
  await shot(page, shotName + '-dialog');
  await page.locator('#backup-file').setInputFiles(path);
  await page.waitForTimeout(1500);
  await shot(page, shotName + '-preview');
  const merge = page.getByRole('button', { name: /Merge backup/i });
  if (await merge.count()) {
    await merge.click();
    await waitForText(page, /Backup merged/, 30000);
    await shot(page, shotName + '-merged');
  } else {
    console.log('NO Merge backup button');
  }
  await closeDialog(page);
}

async function progressSnapshot(page) {
  await clickTab(page, 'Progress');
  await waitForText(page, /100% completion/);
  await page.waitForTimeout(1500);
  const t = await bodyText(page);
  const lines = t.split('\n').map((s) => s.trim());
  return {
    header: lines.find((l) => l.startsWith('100% completion')) ?? '?',
    log: lines.find((l) => /records in the log/.test(l)) ?? '?',
    delights: t.match(/Delights Dancers[^0-9]*(\d+) \/ 18/)?.[0] ?? '?',
    sets: t.match(/(\d+) \/ 15 of 18 in the game/)?.[0] ?? '?',
    full: t,
  };
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
  const full = await panel.innerText();
  const idx = full.lastIndexOf(question);
  return idx >= 0 ? full.slice(idx) : full;
}

async function openPlace(page, id, shotName) {
  await page.goto(`http://127.0.0.1:4330/gta6-leonida-atlas/?place=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await waitForText(page, /YOUR PROGRESS HERE|LEONIDA · PLACE/);
  if (shotName) await shot(page, shotName);
}

let { ctx, page } = await launch('demo-a', 'A');
await shot(page, 'a01-fresh-home');
await restoreFile(page, SEED, 'a02-restore-seed');
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
const journalBefore = await bodyText(page);
console.log('journal row before:', journalBefore.match(/Delights Dancers · [^\n]*/)?.[0]);
check('A1 restore seed -> Delights 0/18', /Delights Dancers · 0 \/ 18/.test(journalBefore), 'journal shows 0/18');
const p0 = await progressSnapshot(page);
console.log('Progress BEFORE:', p0.header, '|', p0.log);
check('A1 Progress 12 records, 4 of 1,325', /12 records in the log/.test(p0.log) && /4 of 1,325/.test(p0.header), `${p0.header} | ${p0.log}`);
await shot(page, 'a03-progress-before');

// A2: collect Vicki via the journal checkbox (the set is a collapsed
// <details> — expand it first, then the checkbox is visible).
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
const delightsSet = page.locator('details.journal-set summary', { hasText: 'Delights Dancers' }).first();
await delightsSet.click();
await page.waitForTimeout(900);
await shot(page, 'a04-delights-set');
const vickiBox = page.getByRole('checkbox', { name: /Mark Vicki \(Standard\) as collected/i }).first();
console.log('Vicki checkbox count:', await vickiBox.count());
await vickiBox.click();
await page.waitForTimeout(1500);
await shot(page, 'a05-vicki-collected');
const journalAfter = await bodyText(page);
console.log('journal row after:', journalAfter.match(/Delights Dancers · [^\n]*/)?.[0]);
check('A2/A3 journal 1/18 after collecting Vicki', /Delights Dancers · 1 \/ 18/.test(journalAfter), 'journal shows 1/18');

// A3: Starlet Motel pin/card shows Vicki collected; Progress moves, overall % unchanged.
await openPlace(page, 'L304', 'a08-starlet-card');
const starlet = await bodyText(page);
check(
  'A3 Starlet card shows Vicki Collected',
  /Vicki\s*Collected ✓/.test(starlet),
  'card shows "VickiCollected ✓" (name + badge adjacent, no space in innerText)',
);
const p1 = await progressSnapshot(page);
console.log('Progress AFTER:', p1.header, '|', p1.log, '|', p1.delights, '|', p1.sets);
check('A3 Progress Card Sets 1/18, overall % UNCHANGED', /Delights Dancers[\s\S]{0,20}?1 \/ 18/.test(p1.delights) && p0.header === p1.header, `before "${p0.header}" after "${p1.header}" | ${p1.delights.replace(/\n/g, ' ')}`);
await shot(page, 'a06-progress-after');

// A4: Ask — key-blocked; record the no-key behaviour honestly.
const askLeft = await askLast(page, "what's left in the Delights Dancers set?");
await shot(page, 'a09-ask-left');
console.log('--- A4 ask: what is left ---');
console.log(askLeft.slice(0, 1800));
check(
  'A4 Ask "what is left" — honest no-key refusal (no invented 17-list)',
  /can't check that without your OpenAI key/i.test(askLeft) && !/Harley/.test(askLeft),
  'refuses honestly instead of a proximity list; full answer on-device-owed',
);
const askVicki = await askLast(page, 'have I found Vicki?');
await shot(page, 'a10-ask-vicki');
console.log('--- A4 ask: have I found Vicki ---');
console.log(askVicki.slice(0, 1200));
check(
  'A4 Ask "have I found Vicki?" — honest no-key refusal (no proximity verdict)',
  /can't check that without your OpenAI key/i.test(askVicki),
  'refuses honestly; yes+date answer on-device-owed',
);

// A5: restart.
await ctx.close();
({ ctx, page } = await launch('demo-a', 'A-restart'));
await shot(page, 'a11-restart-home');
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
const journalRestart = await bodyText(page);
check('A5 restart — still 1/18', /Delights Dancers · 1 \/ 18/.test(journalRestart), 'journal still 1/18 after restart');

// A6: export -> wipe -> restore, original `at` preserved.
await openBackupDialog(page);
const dl = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
await (await dl).saveAs(EXPORT_PATH);
await page.waitForTimeout(800);
const exported = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
const expRec = (exported.completionRecords ?? []).find(
  (r) => r.verb === 'collected' && JSON.stringify(r.target ?? {}).includes('vicki'),
);
console.log('exported Vicki record:', JSON.stringify(expRec));
check('A6 export contains the Vicki collected record', !!expRec, expRec ? `at=${expRec.at}` : 'missing');
const vickiAt = expRec?.at ?? null;
await ctx.close();

({ ctx, page } = await launch('demo-a-wipe', 'A-wipe'));
await shot(page, 'a13-wipe-home');
await restoreFile(page, EXPORT_PATH, 'a14-restore-export');
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
const journalRestored = await bodyText(page);
check('A6 wipe+restore — still 1/18', /Delights Dancers · 1 \/ 18/.test(journalRestored), 'journal still 1/18 after wipe+restore');
await openBackupDialog(page);
const dl2 = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
await (await dl2).saveAs(EXPORT_PATH2);
const exported2 = JSON.parse(readFileSync(EXPORT_PATH2, 'utf8'));
const expRec2 = (exported2.completionRecords ?? []).find(
  (r) => r.verb === 'collected' && JSON.stringify(r.target ?? {}).includes('vicki'),
);
check(
  'A6 restored record keeps its original `at` on re-export',
  !!expRec2 && expRec2.at === vickiAt,
  `original at=${vickiAt} after-restore at=${expRec2?.at ?? 'missing'}`,
);
await ctx.close();

console.log('\n=== DEMO A SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
