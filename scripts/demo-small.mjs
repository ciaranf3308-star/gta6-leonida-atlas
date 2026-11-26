/* global document, MouseEvent */
// Step-9 small items, part 1 (runs on :4330 unless noted):
//  F-persistence re-check (demo-f-album profile, :4338): the album
//    still shows Vicki collected after the screenshot sheet closed.
//  Recent activity list with dates + Undo from the list (fresh
//    demo-small profile, seed restored, L1614 looted once).
//  "Bigger hint" button present in Ask + click -> honest refusal.
//  D3 personal-progress question refused honestly without a key.
//  Hero breadcrumb + "Search for an area" clickable with the area
//    sheet open (elementFromPoint).
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

async function restoreFile(page, path) {
  await openBackupDialog(page);
  await page.locator('#backup-file').setInputFiles(path);
  await page.waitForTimeout(1500);
  const merge = page.getByRole('button', { name: /Merge backup/i });
  if (await merge.count()) {
    await merge.click();
    await waitForText(page, /Backup merged/, 30000);
  }
  await closeDialog(page);
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
  return { full, last: idx >= 0 ? full.slice(idx) : full };
}

async function openPlace(page, id, shotName) {
  await page.goto(`http://127.0.0.1:4330/gta6-leonida-atlas/?place=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await waitForText(page, /YOUR PROGRESS HERE|LEONIDA · PLACE/);
  if (shotName) await shot(page, shotName);
}

// ---------- Part 1: F persistence (demo-f-album profile, port 4338) ----------
{
  const { chromium } = await import('node:module').then(async (m) => {
    const require = m.createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
    return require('playwright');
  });
  const ctx = await chromium.launchPersistentContext('/home/hatch/.v032-profiles/demo-f-album', {
    headless: true,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('http://127.0.0.1:4338/gta6-leonida-atlas/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await clickTab(page, 'Collections');
  await page.getByRole('button', { name: 'Album', exact: true }).first().click();
  await page.waitForTimeout(1000);
  const delights = page.locator('details.album-set summary', { hasText: 'Delights Dancers' }).first();
  await delights.click();
  await page.waitForTimeout(900);
  await shot(page, 'f18-album-delights-reopened');
  const t = await bodyText(page);
  // NOTE (lane 5): the detail below used to be a hardcoded label
  // ("Delights set re-opened: 1 found, Vicki Collected ✓") that
  // printed PASS-looking evidence even when the check FAILED — the
  // regexes are the measurement, so the detail now reports what
  // they actually found.
  check('F-persist album still shows Vicki collected after sheet close', /1 found/.test(t) && /Collected ✓/.test(t), `"1 found"=${/1 found/.test(t)} "Collected ✓"=${/Collected ✓/.test(t)} (Delights set re-opened)`);
  await ctx.close();
}

// ---------- Part 2: demo-small fresh profile, seed restored ----------
let { ctx, page } = await launch('demo-small', 'S');
await shot(page, 's01-fresh-home');
await restoreFile(page, SEED);

// Loot L1614 once, then check Recent activity on Progress.
await openPlace(page, 'L1614');
await page.getByRole('button', { name: /Mark as looted/i }).first().click();
await waitForText(page, /Looted ×1/);
await page.waitForTimeout(800);
await clickTab(page, 'Progress');
await waitForText(page, /100% completion/);
await page.evaluate(() => {
  document.querySelector('.record-list, [aria-label="Recent activity"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(900);
await shot(page, 's02-recent-activity');
const progText = await page.evaluate(() => document.body.innerText);
// innerText reflects the CSS uppercase transform: the heading reads
// "RECENT ACTIVITY".
const recIdx = progText.indexOf('RECENT ACTIVITY');
console.log('--- Recent activity section ---');
console.log(progText.slice(recIdx, recIdx + 1200));
check(
  'S1 Recent activity list renders with the looted record + a date',
  recIdx >= 0 && /Looted/i.test(progText.slice(recIdx, recIdx + 1200)) && /Nov 26, 2026|2026/.test(progText.slice(recIdx, recIdx + 1200)),
  'list present, newest loot row shown with a date',
);
const recUndo = page.locator('.record-list button', { hasText: /^Undo$/ }).first();
console.log('Undo buttons in Recent activity:', await page.locator('.record-list button', { hasText: /^Undo$/ }).count());
check('S2 Recent activity row carries an Undo button', (await recUndo.count()) > 0, 'Undo present on the newest row');
if ((await recUndo.count()) > 0) {
  await recUndo.click();
  await page.waitForTimeout(1500);
  await shot(page, 's03-recent-after-undo');
  const afterUndo = await bodyText(page);
  const logLine = afterUndo.split('\n').find((l) => /records in the log/.test(l));
  console.log('log after list-undo:', logLine);
  check('S2 Undo from Recent activity appends the compensating record', /14 records in the log/.test(logLine ?? ''), `log: ${logLine ?? '?'}`);
  await openPlace(page, 'L1614', 's04-card-after-list-undo');
  const cardAfterUndo = await bodyText(page);
  check('S2 card back to 0 loots after list Undo', !/Looted ×/.test(cardAfterUndo), 'card no longer shows Looted ×N');
}

// ---------- Bigger hint button ----------
const hint = await askLast(page, 'give me a hint for the Harley card');
await shot(page, 's05-ask-hint-harley');
console.log('--- hint answer (last) ---');
console.log(hint.last.slice(0, 1500));
const biggerBtn = page.locator('section.ask-panel button.ask-bigger-hint').first();
console.log('"Bigger hint" buttons in Ask panel:', await page.locator('section.ask-panel button.ask-bigger-hint').count());
check('"Bigger hint" button present in Ask after a hint question', (await biggerBtn.count()) > 0, 'button renders on the hint answer');
if ((await biggerBtn.count()) > 0) {
  await biggerBtn.click();
  await page.waitForTimeout(2000);
  await shot(page, 's06-bigger-hint-clicked');
  const panelText = await page.locator('section.ask-panel').innerText();
  const lastIdx = panelText.lastIndexOf('A bigger hint for Harley');
  const refusal = lastIdx >= 0 ? panelText.slice(lastIdx) : panelText.slice(-600);
  console.log('--- after Bigger hint click ---');
  console.log(refusal.slice(0, 800));
  check(
    'S3 Bigger hint click refuses honestly without a key (no faked level)',
    /needs your OpenAI key/i.test(refusal) && !/Hint \d of 4/.test(refusal),
    'honest refusal, no invented hint level',
  );
}

// ---------- D3 refusal, re-checked on this profile ----------
const d3 = await askLast(page, 'where have I explored in Lummox County?');
await shot(page, 's07-ask-explored-lummox');
console.log('--- D3 answer (last) ---');
console.log(d3.last.slice(0, 1200));
check(
  'S4 D3 refused honestly without a key (no proximity verdict, no cards)',
  /can't check that without your OpenAI key/i.test(d3.last) && !/nearest|map units away/i.test(d3.last),
  'honest refusal; Redshaw answer on-device-owed',
);

// ---------- Hero breadcrumb + Area search with the area sheet open ----------
// Clear the Ask highlights first: the S3/S4 Ask steps leave ringed
// highlight pins on the map, and lane 3's placement rule suppresses any
// county pill whose rect touches one — with highlights on, the Mariana
// pill may never render (the gang-op re-run hit exactly that: the Area
// click landed on Leonard County because Kelly's pill was suppressed,
// and Mariana never appeared). Clearing restores all 5 county pills.
await clickTab(page, 'Ask');
await page.waitForTimeout(900);
const clearHi = page.getByText(/Clear highlights/).first();
if (await clearHi.count()) {
  await clearHi.click();
  await page.waitForTimeout(1200);
}
await clickTab(page, 'Map');
await page.waitForTimeout(1200);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    document.querySelectorAll('[aria-label="Zoom out"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(600);
}
await page.getByRole('button', { name: 'Area', exact: false }).first().click();
await page.waitForTimeout(1200);
const sheetOpen = await page.locator('section.area-page').count();
console.log('area sheet open:', sheetOpen);
await shot(page, 's08-area-sheet-open');
// Select Capri so the hero breadcrumb has a clickable "Go to Leonida" crumb.
const sheetCrumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
if (await sheetCrumb.count()) {
  await sheetCrumb.click();
  await page.waitForTimeout(1000);
  // The crumb exits the page but the camera STAYS flown into that
  // county — zoom back out to island fit or the Mariana pill (another
  // part of the island) is off-viewport and never renders.
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('[aria-label="Zoom out"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(600);
  }
  const mariana = page.getByRole('button', { name: /Mariana County/ }).first();
  await mariana.click();
  await page.waitForTimeout(1000);
  const capri = page.locator('section.area-page button', { hasText: /^Capri/ }).first();
  await capri.scrollIntoViewIfNeeded();
  await capri.click();
  await page.waitForTimeout(2500);
}
await shot(page, 's09-capri-page-sheet');
const hitTest = await page.evaluate(() => {
  const out = {};
  const heroCrumb = document.querySelector('.map-hero button.area-crumb[aria-label="Go to Leonida"]');
  const standaloneCrumb = document.querySelector('.area-selector-standalone button.area-crumb[aria-label="Go to Leonida"]');
  const searchBtn =
    document.querySelector('.map-hero button[aria-label="Search for an area in Leonida"]') ??
    document.querySelector('.area-selector-standalone button[aria-label="Search for an area in Leonida"]');
  function probe(el) {
    if (!el) return 'MISSING';
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return `${el.className} -> hit: ${hit ? `${hit.tagName}.${hit.className}`.slice(0, 120) : 'null'} (same=${hit === el || el.contains(hit)})`;
  }
  out.heroCrumb = probe(heroCrumb);
  out.standaloneCrumb = probe(standaloneCrumb);
  out.searchBtn = probe(searchBtn);
  out.sheetOpen = !!document.querySelector('section.area-page');
  return out;
});
console.log('--- elementFromPoint with area sheet open ---');
console.log(JSON.stringify(hitTest, null, 2));
check(
  'S5 hero "Go to Leonida" crumb clickable with the area sheet open',
  /same=true/.test(hitTest.heroCrumb ?? '') || /same=true/.test(hitTest.standaloneCrumb ?? ''),
  JSON.stringify(hitTest),
);
check(
  'S5 "Search for an area" button clickable with the area sheet open',
  /same=true/.test(hitTest.searchBtn ?? ''),
  hitTest.searchBtn ?? 'missing',
);
await ctx.close();

console.log('\n=== SMALL-1 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
