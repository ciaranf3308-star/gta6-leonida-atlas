// Demo B — a building: break-in + loot (step-9 re-run).
// Ruling 1 (amended): break-in looted records feed NO §4.2 category —
// Smash 'n' Grabs correctly stays 0; verify the amended expectation.
// Step-9 new: Undo button on the looted place card (B3 undo -> x1).
// Fresh profile -> restore seed -> L1614 break-in -> loot x1 -> Progress
// (amended) -> Ask (honest refusal) -> loot x2 -> Undo -> x1 -> restart
// -> export -> wipe -> restore -> x1 persists with the compensating
// record in the log.
import { launch, shot, bodyText, clickTab, closeDialog, waitForText } from './harness.mjs';
import { readFileSync } from 'node:fs';

const SEED =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/seed-v3-backup.json';
const EXPORT_PATH =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/demo-b-export.json';
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
  await page.locator('#backup-file').setInputFiles(path);
  await page.waitForTimeout(1500);
  const merge = page.getByRole('button', { name: /Merge backup/i });
  if (await merge.count()) {
    await merge.click();
    await waitForText(page, /Backup merged/, 30000);
  }
  await closeDialog(page);
  if (shotName) await shot(page, shotName);
}

async function progressSnapshot(page) {
  await clickTab(page, 'Progress');
  await waitForText(page, /100% completion/);
  await page.waitForTimeout(1500);
  const t = await bodyText(page);
  const lines = t.split('\n').map((s) => s.trim());
  const smash = t.match(/Smash 'n' Grabs[\s\S]{0,200}?(\d+) \/ 34/)?.[0] ?? '?';
  return {
    header: lines.find((l) => l.startsWith('100% completion')) ?? '?',
    log: lines.find((l) => /records in the log/.test(l)) ?? '?',
    smash,
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

let { ctx, page } = await launch('demo-b', 'B');
await shot(page, 'b01-fresh-home');
await restoreFile(page, SEED, 'b02-restore-seed');
const p0 = await progressSnapshot(page);
console.log('Progress BEFORE loot:', p0.header, '|', p0.log, '|', p0.smash);
check('B1 restore seed — 12 records, 4 of 1,325', /12 records in the log/.test(p0.log) && /4 of 1,325/.test(p0.header), `${p0.header} | ${p0.log}`);

// B1: L1614 breakable-house candidate offers "Mark as looted", count 0.
await openPlace(page, 'L1614', 'b08b-l1614-card');
const card0 = await bodyText(page);
console.log('--- L1614 card (before) ---');
console.log(card0.slice(0, 1500));
check(
  'B1 L1614 offers "Mark as looted" (count 0)',
  /Mark as looted/.test(card0) && !/Looted ×/.test(card0),
  'break-in opportunity on the card, nothing looted yet',
);

// B2: loot -> Looted x1, log 12->13.
const lootBtn = page.getByRole('button', { name: /Mark as looted/i }).first();
await lootBtn.click();
await waitForText(page, /Looted ×1/);
await page.waitForTimeout(800);
await shot(page, 'b09-looted-x1');
const card1 = await bodyText(page);
check('B2 loot -> Looted ×1, button stays live', /Looted ×1/.test(card1) && /Mark as looted/.test(card1), 'card shows Looted ×1, repeatable');
const p1 = await progressSnapshot(page);
console.log('Progress AFTER loot:', p1.header, '|', p1.log, '|', p1.smash);
check('B2 log 12 -> 13 records', /13 records in the log/.test(p1.log), p1.log);
check(
  "B2 AMENDED (Ruling 1): Smash 'n' Grabs correctly stays 0 — break-in feeds no category",
  /0 \/ 34/.test(p1.smash),
  `Smash 'n' Grabs row: ${p1.smash.replace(/\n/g, ' ')}`,
);
await shot(page, 'b10-progress-after-x1');

// B2 Ask: honest refusal, no proximity verdict.
const askLooted = await askLast(page, 'what break-in houses have I looted in Capri?');
await shot(page, 'b11-ask-looted-capri');
console.log('--- B2 ask: break-ins looted in Capri ---');
console.log(askLooted.slice(0, 1200));
check(
  'B2 Ask — honest no-key refusal (no proximity list, no fake looted state)',
  /can't check that without your OpenAI key/i.test(askLooted) && !/Looted ×1|you looted/i.test(askLooted),
  'refuses honestly; looted-list answer on-device-owed',
);

// B3: loot again -> x2, then Undo -> x1.
await openPlace(page, 'L1614');
await page.getByRole('button', { name: /Mark as looted/i }).first().click();
await waitForText(page, /Looted ×2/);
await page.waitForTimeout(800);
await shot(page, 'b12-looted-x2');
check('B3 loot again -> Looted ×2', /Looted ×2/.test(await bodyText(page)), 'repeatable loot, count 2');
const undoBtn = page.getByRole('button', { name: /Undo one looted/i }).first();
console.log('Undo button count on looted card:', await undoBtn.count());
await undoBtn.click();
await waitForText(page, /Looted ×1/);
await page.waitForTimeout(800);
await shot(page, 'b12b-looted-undo-x1');
const cardUndo = await bodyText(page);
check('B3 Undo -> back to Looted ×1', /Looted ×1/.test(cardUndo) && !/Looted ×2/.test(cardUndo), 'compensating -1 record; net count 1');
const pUndo = await progressSnapshot(page);
console.log('Progress AFTER undo:', pUndo.log);
check('B3 log shows 15 records (12 + 2 loots + 1 undo)', /15 records in the log/.test(pUndo.log), pUndo.log);

// B4: restart -> still x1.
await ctx.close();
({ ctx, page } = await launch('demo-b', 'B-restart'));
await openPlace(page, 'L1614', 'b13-restart-card');
const cardRestart = await bodyText(page);
check('B4 restart — still Looted ×1', /Looted ×1/.test(cardRestart) && !/Looted ×2/.test(cardRestart), 'net x1 survives restart');

// B4: export -> wipe -> restore -> x1 with the compensating record.
await openBackupDialog(page);
const dl = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
await (await dl).saveAs(EXPORT_PATH);
await page.waitForTimeout(800);
const exported = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
const lootedRecs = (exported.completionRecords ?? []).filter(
  (r) => r.target?.id === 'opp:L1614:break-in:1',
);
console.log('exported L1614 records:', JSON.stringify(lootedRecs));
const netCount = lootedRecs.reduce((n, r) => n + (r.count ?? 1), 0);
check(
  'B4 export has 2 loots + 1 undo, net ×1',
  lootedRecs.length === 3 && netCount === 1,
  `${lootedRecs.length} records, net ${netCount}`,
);
const firstAt = lootedRecs.find((r) => (r.count ?? 1) > 0)?.at ?? null;
await ctx.close();

({ ctx, page } = await launch('demo-b-wipe', 'B-wipe'));
await shot(page, 'b14-wipe-home');
await restoreFile(page, EXPORT_PATH, 'b14-restore-export');
await openPlace(page, 'L1614', 'b14-restored-card');
const cardRestored = await bodyText(page);
check('B4 wipe+restore — still Looted ×1', /Looted ×1/.test(cardRestored) && !/Looted ×2/.test(cardRestored), 'net x1 survives wipe+restore');
const pRestored = await progressSnapshot(page);
check('B4 wipe+restore — log still 15 records', /15 records in the log/.test(pRestored.log), pRestored.log);
await ctx.close();

console.log('\n=== DEMO B SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
