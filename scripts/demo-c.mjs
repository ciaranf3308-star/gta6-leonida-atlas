// Demo C — vehicle loot (DESIGN §9, v0.32 step-9 Demo C lane).
// Production build on :4336 (ATLAS_BASE_PATH=/gta6-leonida-atlas/).
// A: imported Brooks Boatworks — card shows gang-op + vehicle-loot
//    opportunities and Safe code 6823; mark the gang-op looted ->
//    Looted x1, Gang Operations 0->1; attach the safe-code note with
//    NO OpenAI key; restart persists; export -> wipe -> restore
//    persists with the original `at`.
// B: player-jotted vehicle-loot spot (Sidebar button) — the jot
//    becomes a real opportunity, mark looted, note, restart persists.
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
import { readFileSync } from 'node:fs';
import { shot, bodyText, clickTab, closeDialog, waitForText, dumpButtons } from './harness.mjs';

const PORT = 4336;
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const EXPORT_PATH =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/demo-c-export.json';
const EXPORT_PATH2 =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/demo-c-export2.json';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

async function launch(profile, label) {
  const ctx = await chromium.launchPersistentContext(`/home/hatch/.v032-profiles/${profile}`, {
    headless: true,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${label}] console.error:`, m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => console.log(`[${label}] pageerror:`, String(e).slice(0, 300)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function openPlace(page, id, shotName) {
  await page.goto(`${BASE}?place=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await waitForText(page, /YOUR PROGRESS HERE|LEONIDA · PLACE/);
  if (shotName) await shot(page, shotName);
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

async function progressGangOps(page) {
  await clickTab(page, 'Progress');
  await waitForText(page, /Gang Operations/);
  const full = await bodyText(page);
  const lines = full.split('\n').map((s) => s.trim()).filter(Boolean);
  // The row renders "Gang Operations" then "N / 39" (required == total
  // 39, so no "of 39 in the game" suffix) — the count is its own line.
  const m = full.match(/Gang Operations[\s\S]{0,400}?(\d+) \/ 39/);
  const gangCount = m ? Number(m[1]) : null;
  const logLine = lines.find((l) => /records in the log/.test(l)) ?? '?';
  return { full, gangCount, logLine };
}

// ================= A: imported Brooks Boatworks =================
let { ctx, page } = await launch('demo-c', 'C');
await shot(page, 'c10-fresh-home');

await openPlace(page, 'gang-op:brooks-boatworks', 'c11-brooks-card');
const card = await bodyText(page);
console.log('--- Brooks card text ---');
console.log(card.slice(0, 2500));
check(
  'C-A1 Brooks card shows both opportunities + code 6823',
  /Brooks Boatworks/.test(card) &&
    /Kolts & Associates/.test(card) &&
    /Safe code 6823/.test(card) &&
    (card.match(/Mark as looted/g) ?? []).length >= 2,
  `looted buttons: ${(card.match(/Mark as looted/g) ?? []).length}`,
);

const p0 = await progressGangOps(page);
console.log('Progress BEFORE loot: Gang Operations', p0.gangCount, '/ 39 |', p0.logLine);
check(
  'C-A2 Progress before: Gang Operations 0, log 0 records',
  p0.gangCount === 0 && /0 records in the log/.test(p0.logLine),
  `Gang Operations ${p0.gangCount} / 39 | ${p0.logLine}`,
);
await shot(page, 'c13-progress-before');

// Mark the GANG-OP looted (the row whose detail is the gang name).
await openPlace(page, 'gang-op:brooks-boatworks');
const gangRow = page.locator('li.completion-action', { hasText: 'Kolts & Associates' }).first();
await gangRow.getByRole('button', { name: /Mark as looted/i }).click();
await waitForText(page, /Looted ×1/);
await page.waitForTimeout(800);
await shot(page, 'c12-brooks-looted');
const afterLoot = await bodyText(page);
check(
  'C-A3 gang-op marked looted -> Looted x1, button stays live',
  /Looted ×1/.test(afterLoot) && /Mark as looted/.test(afterLoot),
  'card shows Looted ×1 and still offers Mark as looted (repeatable)',
);

const p1 = await progressGangOps(page);
console.log('Progress AFTER loot: Gang Operations', p1.gangCount, '/ 39 |', p1.logLine);
check(
  'C-A4 Progress after: Gang Operations 0->1, log 1 record',
  p1.gangCount === 1 && /1 records in the log/.test(p1.logLine),
  `Gang Operations ${p1.gangCount} / 39 | ${p1.logLine}`,
);
await shot(page, 'c13-progress-after');

// Attach the safe-code note — no key anywhere in this flow.
await openPlace(page, 'gang-op:brooks-boatworks');
const noteRow = page.locator('li.completion-action', { hasText: 'Kolts & Associates' }).first();
await page.getByRole('button', { name: 'Add a note', exact: true }).first().click();
await page.waitForTimeout(700);
const noteInput = page.locator('li.completion-note input[type="text"]').first();
await noteInput.waitFor({ timeout: 15000 });
const prefilled = await noteInput.inputValue();
console.log('note input prefilled with:', JSON.stringify(prefilled));
check('C-A5 note editor prefilled with the safe code', prefilled === 'used code 6823', prefilled);
await page.getByRole('button', { name: 'Save note', exact: true }).first().click();
await waitForText(page, /Note: used code 6823/);
await shot(page, 'c14-note-saved');
const afterNote = await bodyText(page);
check(
  'C-A6 note saved on the card, no key needed',
  /Note: used code 6823/.test(afterNote),
  'card shows "Note: used code 6823"',
);

// Restart — kill + reopen on the same profile.
await ctx.close();
({ ctx, page } = await launch('demo-c', 'C-restart'));
await openPlace(page, 'gang-op:brooks-boatworks', 'c15-restart-card');
const restarted = await bodyText(page);
check(
  'C-A7 restart: Looted x1 + note persist',
  /Looted ×1/.test(restarted) && /Note: used code 6823/.test(restarted),
  'card still Looted ×1 with the note after restart',
);

// Export -> wipe -> restore, original `at` preserved.
await openBackupDialog(page);
const dl = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
await (await dl).saveAs(EXPORT_PATH);
await page.waitForTimeout(800);
const exported = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
const expRec = (exported.completionRecords ?? []).find(
  (r) => r.verb === 'looted' && r.target?.id === 'opp:gang-op:brooks-boatworks:gang-op:1',
);
console.log('exported Brooks looted record:', JSON.stringify(expRec));
check(
  'C-A8 export contains the looted record WITH the note',
  !!expRec && expRec.note === 'used code 6823',
  expRec ? `at=${expRec.at} note=${expRec.note}` : 'missing',
);
const lootedAt = expRec?.at ?? null;
await ctx.close();

({ ctx, page } = await launch('demo-c-wipe', 'C-wipe'));
await shot(page, 'c16-wipe-home');
await restoreFile(page, EXPORT_PATH, 'c17-restore-export');
await openPlace(page, 'gang-op:brooks-boatworks', 'c18-restored-card');
const restored = await bodyText(page);
check(
  'C-A9 wipe+restore: Looted x1 + note persist',
  /Looted ×1/.test(restored) && /Note: used code 6823/.test(restored),
  'card still Looted ×1 with the note after wipe+restore',
);
const p3 = await progressGangOps(page);
check(
  'C-A10 wipe+restore: Gang Operations still 1, log 1 record',
  p3.gangCount === 1 && /1 records in the log/.test(p3.logLine),
  `Gang Operations ${p3.gangCount} / 39 | ${p3.logLine}`,
);
await openBackupDialog(page);
const dl2 = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: /Export backup/i }).first().click();
await (await dl2).saveAs(EXPORT_PATH2);
const exported2 = JSON.parse(readFileSync(EXPORT_PATH2, 'utf8'));
const expRec2 = (exported2.completionRecords ?? []).find(
  (r) => r.verb === 'looted' && r.target?.id === 'opp:gang-op:brooks-boatworks:gang-op:1',
);
check(
  'C-A11 restored record keeps its original `at` on re-export',
  !!expRec2 && expRec2.at === lootedAt,
  `original at=${lootedAt} after-restore at=${expRec2?.at ?? 'missing'}`,
);
await ctx.close();

// ================= B: player-jotted vehicle-loot spot =================
({ ctx, page } = await launch('demo-c-jot', 'C-jot'));
await shot(page, 'c20-jot-home');
// AddToMapSection lives in the Collections panel (Sidebar.tsx:786),
// not on the Map tab: tap the button there, then go to the Map and
// tap to drop the pin.
await clickTab(page, 'Collections');
await page.waitForTimeout(1500);
const addBtn = page.getByRole('button', { name: /Add vehicle-loot spot/i }).first();
const addCount = await addBtn.count();
console.log('Add vehicle-loot spot button on Collections tab:', addCount);
check('C-B1 Sidebar offers "Add vehicle-loot spot"', addCount > 0, 'button present on the Collections tab');
if (addCount) {
  await addBtn.click();
  await page.waitForTimeout(900);
  console.log('--- after Add vehicle-loot spot ---');
  console.log((await bodyText(page)).slice(0, 1200));
  await clickTab(page, 'Map');
  await page.waitForTimeout(1500);
  // Tap the map to drop the pin (centre of the map area).
  await page.mouse.click(195, 420);
  await page.waitForTimeout(1500);
  await shot(page, 'c21-jot-editor');
  const editorText = await bodyText(page);
  console.log('--- editor text ---');
  console.log(editorText.slice(0, 1500));
  const kindSelect = page.locator('#marker-kind');
  const kindCount = await kindSelect.count();
  const kindValue = kindCount ? await kindSelect.inputValue() : 'n/a';
  console.log('marker-kind select count/value:', kindCount, kindValue);
  check(
    'C-B2 editor opens with kind preset to Vehicle loot',
    kindCount > 0 && kindValue === 'vehicle-loot',
    `kind=${kindValue}`,
  );
  if (kindCount) {
    await page.locator('#marker-title').fill('Garage with a safe');
    await page.locator('#marker-description').fill('Safe code 4444, standout car in the garage');
    await page.getByRole('button', { name: 'Save marker', exact: true }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'c22-jot-saved');
    // The card opens right after save (selected, no ?place= in the URL
    // yet) — work with it directly.
    const jotCard = await bodyText(page);
    console.log('--- jot card text ---');
    console.log(jotCard.slice(0, 2000));
    const progressSection = (jotCard.split('YOUR PROGRESS HERE')[1] ?? '').split('HIDDEN COLLECTABLES')[0] ?? '';
    check(
      'C-B3 jot card offers a vehicle-loot "Mark as looted" (no invented loot)',
      /Mark as looted/.test(progressSection) &&
        /Vehicle or safe the player marked/.test(progressSection) &&
        !/Safe code/.test(progressSection),
      'vehicle-loot opportunity, detail "Vehicle or safe the player marked", no code line',
    );
    const jotRow = page.locator('li.completion-action', { hasText: 'Vehicle or safe the player marked' }).first();
    await jotRow.getByRole('button', { name: /Mark as looted/i }).click();
    await waitForText(page, /Looted ×1/);
    await page.waitForTimeout(800);
    await shot(page, 'c24-jot-looted');
    await page.getByRole('button', { name: 'Add a note', exact: true }).first().click();
    await page.waitForTimeout(700);
    const jotNote = page.locator('li.completion-note input[type="text"]').first();
    await jotNote.waitFor({ timeout: 15000 });
    console.log('jot note prefill (no code on a jot):', JSON.stringify(await jotNote.inputValue()));
    await jotNote.fill('used code 4444');
    await page.getByRole('button', { name: 'Save note', exact: true }).first().click();
    await waitForText(page, /Note: used code 4444/);
    await shot(page, 'c25-jot-note');
    // The jot id is custom:<uuid> in Dexie (db leonida-atlas, table
    // markers) — read it from the app's own store for the restart link.
    const jotId = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('leonida-atlas');
          req.onsuccess = () => {
            const tx = req.result.transaction('markers', 'readonly');
            const all = tx.objectStore('markers').getAll();
            all.onsuccess = () => {
              const found = (all.result || []).find((m) => m.title === 'Garage with a safe');
              resolve(found ? found.id : null);
            };
            all.onerror = () => resolve(null);
          };
          req.onerror = () => resolve(null);
        }),
    );
    console.log('jot id from Dexie:', jotId);
    check('C-B4 jot id resolves for the restart deep link', typeof jotId === 'string' && jotId.length > 0, `id=${jotId}`);
    if (typeof jotId === 'string' && jotId) {
      // Restart — the jot, its loot and its note must all survive.
      await ctx.close();
      ({ ctx, page } = await launch('demo-c-jot', 'C-jot-restart'));
      await openPlace(page, jotId, 'c26-jot-restart');
      const jotRestarted = await bodyText(page);
      check(
        'C-B5 restart: jot still Looted x1 with its note',
        /Looted ×1/.test(jotRestarted) && /Note: used code 4444/.test(jotRestarted),
        'jotted spot survives restart with loot + note',
      );
    }
  }
}
await ctx.close();

console.log('\n=== DEMO C SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} FAILURES`);
  process.exitCode = 1;
}
