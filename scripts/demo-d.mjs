// Demo D — a discovery (DESIGN §9).
// Fresh profile -> restore seed v3 -> Map to Mount Kalaga -> explore the
// nearest explorable location (L1676 Redshaw's Gas & General Store,
// enterable interior, ~660 atlas units from the summit) -> assert pin
// fades, Progress layer explored count +1, overall % UNCHANGED, Ask,
// restart, export -> wipe -> restore.
// NOTE: no location actually inside Mount Kalaga National Park offers
// "Mark as explored" (the 7 GTADB rows there have no enterable/leisure
// tags; the meditations are collectibles; the summit-trail card is
// unpinned) — L1676 is the nearest explorable Lummox County location
// to the summit. Recorded as a data-gap finding, not a bug.
import { launch, shot, bodyText, clickTab, closeDialog, waitForText } from './harness.mjs';
import { readFileSync } from 'node:fs';

const SEED =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/seed-v3-backup.json';
const EXPORT_PATH = '/tmp/demo-d-export.json';
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
  const input = page.locator('#backup-file');
  await input.setInputFiles(path);
  await page.waitForTimeout(1500);
  await shot(page, shotName + '-preview');
  const merge = page.getByRole('button', { name: /Merge backup/i });
  if (await merge.count()) {
    await merge.click();
    // Wait for the merge to actually finish (not a fixed sleep — the
    // merge does IndexedDB writes + store refreshes).
    await waitForText(page, /Backup merged/, 30000);
    await shot(page, shotName + '-merged');
    console.log('--- after merge ---');
    console.log((await bodyText(page)).slice(0, 800));
  } else {
    console.log('NO Merge backup button');
  }
  await closeDialog(page);
}

async function progressSnapshot(page, minRecords = 0) {
  await clickTab(page, 'Progress');
  await waitForText(page, /100% completion/);
  const snap = async () => {
    const t = await bodyText(page);
    const lines = t.split('\n').map((s) => s.trim());
    return {
      header: lines.find((l) => l.startsWith('100% completion')) ?? '?',
      log: lines.find((l) => /records in the log/.test(l)) ?? '?',
      exploredLines: lines.filter((l) => /explored/.test(l) && /of \d+ found/.test(l)),
    };
  };
  if (minRecords > 0) {
    for (let i = 0; i < 30; i++) {
      const s = await snap();
      const n = Number((s.log.match(/(\d+) records in the log/) ?? [])[1] ?? 0);
      if (n >= minRecords) break;
      await page.waitForTimeout(2000);
    }
  }
  let stable = 0, prev = '';
  for (let i = 0; i < 15; i++) {
    const s = await snap();
    const key = `${s.header}|${s.log}|${s.exploredLines.join(';')}`;
    if (key === prev && s.header !== '?') { stable += 1; if (stable >= 2) break; } else stable = 0;
    prev = key;
    await page.waitForTimeout(2000);
  }
  const s = await snap();
  const full = await bodyText(page);
  return { ...s, full };
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

async function openPlace(page, id, shotName) {
  await page.goto(`http://127.0.0.1:4330/gta6-leonida-atlas/?place=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await waitForText(page, /YOUR PROGRESS HERE|LEONIDA · PLACE/);
  if (shotName) await shot(page, shotName);
}

// ---- Step 1: fresh profile, restore seed ----
let { ctx, page } = await launch('demo-d', 'D');
await shot(page, 'd01-fresh-home');
await restoreFile(page, SEED, 'd02-restore-seed');
const p0 = await progressSnapshot(page, 12);
console.log('Progress BEFORE explore:', JSON.stringify({ header: p0.header, log: p0.log, exploredLines: p0.exploredLines }));
check('D1 restore seed — 12 records, 4 of 1,325', /12 records in the log/.test(p0.log) && /4 of 1,325/.test(p0.header), `${p0.header} | ${p0.log}`);
await shot(page, 'd03-progress-before');

// ---- Step 2: Map -> Mount Kalaga (deep link to the mountain) ----
await openPlace(page, 'L530', 'd04-mount-kalaga-map');
const l530 = await bodyText(page);
console.log('--- L530 card text ---');
console.log(l530.slice(0, 1500));
check('D1 Mount Kalaga card opens (L530)', /Mount Kalaga/.test(l530), 'deep link ?place=L530; card shows the mountain');
console.log('L530 offers "Mark as explored"?', /Mark as explored/.test(l530));

// ---- Step 3: Redshaw's Gas & General Store (L1676) — the explore ----
await openPlace(page, 'L1676', 'd05-redshaw-card-before');
const before = await bodyText(page);
console.log('--- L1676 card text (before) ---');
console.log(before.slice(0, 2000));
check('D1 Redshaw card offers "Mark as explored"', /Mark as explored/.test(before), 'interior opportunity (enterable) on L1676');
const exploreBtn = page.getByRole('button', { name: /Mark as explored/i }).first();
await exploreBtn.click();
await page.waitForTimeout(1500);
await shot(page, 'd06-redshaw-explored');
const after = await bodyText(page);
console.log('--- L1676 card text (after) ---');
console.log(after.slice(0, 2000));
check('D2 card shows Explored state', /Explored/.test(after), 'card now shows Explored (see d06-redshaw-explored.png)');

// ---- Step 4: Progress — layer explored +1, overall % UNCHANGED, log 13 ----
const p1 = await progressSnapshot(page, 13);
console.log('Progress AFTER explore:', JSON.stringify({ header: p1.header, log: p1.log, exploredLines: p1.exploredLines }));
check('D2 Progress log 12 -> 13 records', /13 records in the log/.test(p1.log), p1.log);
check('D2 overall % UNCHANGED', p0.header === p1.header, `before: "${p0.header}" after: "${p1.header}"`);
const exploredBefore = p0.exploredLines.join(' | ');
const exploredAfter = p1.exploredLines.join(' | ');
check('D2 Progress layer explored count +1', exploredBefore !== exploredAfter, `before: [${exploredBefore}] after: [${exploredAfter}]`);
await shot(page, 'd07-progress-after');

// Journal / Recorded section: does the explored record appear?
const recIdx = p1.full.split('\n').findIndex((l) => l.trim() === 'Recorded');
console.log('--- Recorded section ---');
console.log(p1.full.split('\n').slice(recIdx, recIdx + 12).join('\n'));
check('D2 Journal/Recorded lists the explored record', /Redshaw|explored/i.test(p1.full.split('\n').slice(recIdx, recIdx + 12).join(' ')), 'Recorded section (see log)');

// ---- Step 5: pin fades — map centred on L1676 ----
await openPlace(page, 'L1676');
await clickTab(page, 'Map');
await page.waitForTimeout(2000);
await shot(page, 'd08-map-explored-pin');
console.log('(pin fade is judged from d08-map-explored-pin.png — read it)');

// ---- Step 6: Ask ----
const ask1 = await ask(page, 'where have I explored in Lummox County?');
await shot(page, 'd09-ask-explored');
console.log('--- ask: where explored in Lummox ---');
console.log(ask1.slice(0, 2500));
check('D3 Ask lists Redshaw as explored', /Redshaw/i.test(ask1), 'see d09-ask-explored.png');

// ---- Step 7: restart ----
await ctx.close();
({ ctx, page } = await launch('demo-d', 'D-restart'));
await openPlace(page, 'L1676', 'd10-restart-redshaw');
const r1 = await bodyText(page);
check('D4 restart — still explored', /Explored/.test(r1), 'card still shows Explored after restart');
const p2 = await progressSnapshot(page, 13);
check('D4 restart — overall % unchanged', p2.header === p1.header, `after restart: "${p2.header}"`);

// ---- Step 8: export -> wipe -> restore ----
await openBackupDialog(page);
const dl = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
const download = await dl;
await download.saveAs(EXPORT_PATH);
await page.waitForTimeout(1000);
const exported = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
const expRec = (exported.completionRecords ?? []).find((r) => r.verb === 'explored' && typeof r.target?.id === 'string' && r.target.id.includes('L1676'));
console.log('exported explored record for L1676:', JSON.stringify(expRec));
check('D5 export contains explored record for L1676', !!expRec, expRec ? `at=${expRec.at}` : 'missing');
const exploredAt = expRec?.at ?? null;
await ctx.close();

({ ctx, page } = await launch('demo-d-wipe', 'D-wipe'));
await shot(page, 'd11-wipe-home');
await restoreFile(page, EXPORT_PATH, 'd12-restore-export');
await openPlace(page, 'L1676', 'd13-restored-redshaw');
const r2 = await bodyText(page);
check('D5 restore — still explored', /Explored/.test(r2), 'card still shows Explored after wipe+restore');
const p3 = await progressSnapshot(page, 13);
check('D5 restore — overall % unchanged', p3.header === p1.header, `after restore: "${p3.header}"`);
// Re-export to confirm the `at` timestamp is preserved.
await openBackupDialog(page);
const dl2 = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
const download2 = await dl2;
await download2.saveAs('/tmp/demo-d-export2.json');
const exportedAfter = JSON.parse(readFileSync('/tmp/demo-d-export2.json', 'utf8'));
const expRecAfter = (exportedAfter.completionRecords ?? []).find((r) => r.verb === 'explored' && typeof r.target?.id === 'string' && r.target.id.includes('L1676'));
console.log('explored record after restore+re-export:', JSON.stringify(expRecAfter));
check('D5 explored record keeps original `at` after restore', !!expRecAfter && expRecAfter.at === exploredAt, `original at=${exploredAt} after-restore at=${expRecAfter?.at ?? 'missing'}`);
await ctx.close();

console.log('\n=== DEMO D SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
