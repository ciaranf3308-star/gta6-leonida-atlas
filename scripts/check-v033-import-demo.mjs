// Acceptance demo for the v0.33 fbrito card import (346 candidate pins).
// Runs against the production build on :4330 (ATLAS_BASE_PATH=/gta6-leonida-atlas/).
// 390px, DPR 2. Run with: node scripts/check-v033-import-demo.mjs
// Screenshots + the exported backups land in /tmp/v033-import-demo/.
// Exits 1 on any failed check. No OpenAI key is used anywhere.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const OUT = '/tmp/v033-import-demo';
mkdirSync(OUT, { recursive: true });

const failures = [];
const passes = [];
function check(name, cond, detail = '') {
  if (cond) {
    passes.push(name);
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const failedReqs = [];
page.on('response', (r) => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => failedReqs.push(`pageerror: ${String(e).slice(0, 200)}`));

const nav = (label) => page.locator('.bottom-nav').getByRole('button', { name: label });
async function markerLabels() {
  return page.locator('.atlas-map-marker').evaluateAll((els) =>
    els.map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim()),
  );
}
async function expandDelights() {
  await nav('Collections').click();
  await page.waitForTimeout(1200);
  // The expanded set may be another one (e.g. Flamingos from the gap
  // check) — only Delights counts, so require Amber visible.
  if ((await page.locator('.journal-row:visible', { hasText: 'Amber' }).count()) >= 1) return;
  await page.getByText('Delights Dancers · 0 / 18 found').click();
  await page.waitForTimeout(1200);
}


// ---------- A1: island view, Collectibles chip ----------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(2000);
check('A1 tiles load at island zoom', (await page.locator('.leaflet-tile-loaded').count()) > 0);
check('A1 real graded day tiles load (not just the ocean fill)', (await page.locator('.leaflet-tile-loaded[src*="tiles/graded/"]').count()) > 0, `${await page.locator('.leaflet-tile-loaded[src*="tiles/graded/"]').count()} graded tiles in view`);
check('A1 clean launch: no pins before any tap', (await page.locator('.atlas-map-marker').count()) === 0);
await page.getByRole('button', { name: 'Collectibles', exact: true }).first().click();
await page.waitForTimeout(3000);
const islandMarkers = await markerLabels();
check('A1 Collectibles chip shows pins at island zoom', islandMarkers.length > 0, `${islandMarkers.length} markers`);
const islandDelights = islandMarkers.filter((l) => l.includes('Delights Dancers'));
console.log(`A1 Delights pins visible at island zoom (hero cap applies): ${islandDelights.length} — ${JSON.stringify(islandDelights)}`);
await page.screenshot({ path: `${OUT}/a1-island-collectibles.png` });

// ---------- A2: all 18 Delights pins, one by one ----------
await expandDelights();
const delightsRows = await page.locator('.journal-row:visible').count();
check('A2 Delights lists 18 rows', delightsRows === 18, `${delightsRows} rows`);
const pinnedNames = [];
for (let i = 0; i < 18; i++) {
  await expandDelights();
  const row = page.locator('.journal-row:visible').nth(i);
  const name = (await row.locator('.journal-row-name').innerText()).replace(/\s+/g, ' ').trim();
  await row.locator('.journal-hint-toggle').click();
  await page.waitForTimeout(900);
  const showOnMap = row.getByRole('button', { name: 'Show on map' });
  const hasPin = (await showOnMap.count()) > 0;
  if (!hasPin) {
    check(`A2 ${name} has a pin (Show on map)`, false, 'no Show on map button — slot unpinned');
    continue;
  }
  pinnedNames.push(name);
  await showOnMap.click();
  await page.waitForTimeout(2500);
  // Assert while the sheet is open: the selected pin renders with a
  // gold ring and its label (", selected"). Host pins sit exactly on
  // their GTADB host, so "Show on map" selects the host LOCATION
  // instead — accept the host name for those five. (After the sheet
  // closes the pin joins its neighbours in an "Explore N places"
  // cluster, so the sheet-open state is the direct proof it renders.)
  const hostLabel = { Jason: 'Interstate 404', Harley: 'Interstate 404', Vicki: 'Starlet Motel', Kandi: 'Farmacia', Perla: 'Railyard' }[name.split(' · ')[0]];
  const openLabels = await markerLabels();
  const mineOpen = openLabels.filter(
    (l) => l.toLowerCase().includes(name.split(' · ')[0].toLowerCase()) || (hostLabel && l.includes(hostLabel)),
  );
  check(`A2 ${name} renders its pin`, openLabels.length >= 1 && mineOpen.length >= 1, `${openLabels.length} marker(s): ${JSON.stringify(openLabels)}`);
  // Sheet checks first (Amber: fbrito link; Jason: host GTADB, no fbrito).
  if (name.startsWith('Amber')) {
    await page.screenshot({ path: `${OUT}/a2-amber-map.png` });
    // Sheet is open: Read more -> the fbrito source link must be reachable.
    const readMore = page.getByRole('button', { name: 'Read more' });
    if (await readMore.count()) { await readMore.click(); await page.waitForTimeout(800); }
    const links = await page.locator('a[href*="fbritoferreira"]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    check('A2 Amber sheet links the fbrito record', links.includes('https://fbritoferreira.github.io/gta6/?id=collectible-card-036'), JSON.stringify(links));
    const sheetText = await page.locator('body').innerText();
    check('A2 Amber sheet says candidate pin, not verified', sheetText.includes('candidate position from the Open GTA 6 Map'), 'attribution line present');
    check('A2 Amber sheet says NOT a verified building position', sheetText.includes('not a verified building position'), '');
    check('A2 Amber sheet never claims a verified GTADB host', !sheetText.includes('verified GTADB position'), '');
    await page.screenshot({ path: `${OUT}/a2-amber-sheet.png` });
  }
  if (name.startsWith('Jason')) {
    // Jason's pin sits exactly on its GTADB host (L629), so "Show on
    // map" selects the host LOCATION sheet, not the card pin — the
    // cluster badge "2" is the pin + the location together. The host
    // wins: the sheet is the Delights location, with no fbrito content.
    const sheetText = await page.locator('body').innerText();
    check('A2 Jason opens the Delights host-location sheet (L629)', sheetText.includes('DELIGHTS') && sheetText.includes('PORT GELLHORN'), '');
    check('A2 Jason sheet has no fbrito candidate text', !sheetText.includes('candidate position from the Open GTA 6 Map'), '');
    const links = await page.locator('a[href*="fbritoferreira"]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    check('A2 Jason sheet has no fbrito link', links.length === 0, JSON.stringify(links));
    await page.screenshot({ path: `${OUT}/a2-jason-sheet.png` });
  }
  // Close the sheet and return to the map for the next card.
  const closeSheet = page.locator('aside.place-sheet').getByRole('button', { name: /Close/i }).first();
  if (await closeSheet.count()) { await closeSheet.click(); await page.waitForTimeout(800); }
  await nav('Map').click();
  await page.waitForTimeout(800);
}
check('A2 all 18 Delights cards are pinned', pinnedNames.length === 18, `${pinnedNames.length}/18: ${pinnedNames.join(', ')}`);

// ---------- B: street zoom — imported Julia (bronze) + host Luke X ----------
// The Delights pair (Kandi/Tracy, 372u) cannot show both pins at once:
// Kandi's pin coincides with its Farmacia host location (within ~1u),
// so it renders as the shared spot marker at every zoom — pre-existing
// host behaviour, not an import effect. Julia (bronze, imported) and
// Luke X (host, Backyard Wrestling) sit near each other at Wild Hog
// Airfield and both render as individual pins at street zoom.
await nav('Collections').click();
await page.waitForTimeout(1200);
await page.getByText('Nine1Nine Dancers · 0 / 36 found').click();
await page.waitForTimeout(1200);
const juliaRow = page.locator('.journal-row:visible').filter({ hasText: 'Julia' }).filter({ hasText: 'bronze' }).first();
await juliaRow.locator('.journal-hint-toggle').click();
await page.waitForTimeout(900);
await juliaRow.getByRole('button', { name: 'Show on map' }).click();
await page.waitForTimeout(2500);
const bLabels = await markerLabels();
check('B Julia (bronze, imported) renders', bLabels.some((l) => l.includes('Julia (bronze)')), JSON.stringify(bLabels));
check('B Luke X (host) renders beside it', bLabels.some((l) => l.includes('Luke X')), JSON.stringify(bLabels));
await page.screenshot({ path: `${OUT}/b-julia-lukex.png` });
await nav('Map').click();
await page.waitForTimeout(800);

// ---------- C: per-set coverage in Collections ----------
await nav('Collections').click();
await page.waitForTimeout(1500);
const collText = await page.locator('body').innerText();
check('C matcher pool is 94 unmatched', collText.includes('94 still unmatched'), '');
check('C unpositioned is 211', collText.includes('Unpositioned · 211'), '');
check('C 614 rows across all lists', collText.includes('614 rows'), '');
check('C 18 sets listed', collText.includes('18 sets, 480 card slots'), '');
// Gap card: Jude Flores (Flamingos) must show a hint but no pin.
await page.getByText('Vice City Flamingos · 0 / 24 found').click();
await page.waitForTimeout(1200);
const judeRow = page.locator('.journal-row:visible', { hasText: 'Jude Flores' }).first();
check('C Jude Flores row exists (gap slot, gtatown shows him)', (await judeRow.count()) === 1, '');
await judeRow.locator('.journal-hint-toggle').click();
await page.waitForTimeout(900);
check('C Jude Flores has NO Show on map (unmapped, stays unmapped)', (await judeRow.getByRole('button', { name: 'Show on map' }).count()) === 0, '');
await page.screenshot({ path: `${OUT}/c-jude-flores-gap.png` });

// ---------- D: backup / restore ----------
// D1: mark Amber collected via her pin sheet ("Mark as discovered"),
// export a backup, verify the fbrito record is in it.
await expandDelights();
const amberRow = page.locator('.journal-row:visible', { hasText: 'Amber' }).first();
await amberRow.locator('.journal-hint-toggle').click();
await page.waitForTimeout(900);
await amberRow.getByRole('button', { name: 'Show on map' }).click();
await page.waitForTimeout(2500);
// The sheet's "Mark as discovered" button marks the PLACE; the CARD
// is the "Mark Amber as collected" checkbox in the same sheet. (The
// list-row checkbox double-toggles through its wrapping label, so the
// sheet checkbox is the reliable control — one DOM click, verified.)
const amberBox = page.locator('aside.place-sheet input[aria-label="Mark Amber as collected"]');
await amberBox.evaluate((el) => el.click());
await page.waitForTimeout(1200);
check('D1 Amber checkbox ticks in the sheet', await amberBox.isChecked(), '');
await nav('Collections').click();
await page.waitForTimeout(1200);
const delightsHeader = await page.getByText(/Delights Dancers · \d+ \/ 18 found/).innerText();
check('D1 Amber marks collected (Delights 1/18 found)', delightsHeader.includes('1 / 18 found'), delightsHeader);
await page.locator('.sidebar-settings-link').click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Back up my/i }).click();
await page.waitForTimeout(1200);
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.getByRole('button', { name: 'Export backup' }).click();
const download = await downloadPromise;
const exportPath = `${OUT}/d1-backup-new.json`;
await download.saveAs(exportPath);
const exported = readFileSync(exportPath, 'utf8');
check('D1 exported backup contains Amber\'s slot record', exported.includes('card-checklist:delights-dancers:amber:standard'), '');
check('D1 exported backup is a v4 file', JSON.parse(exported).version === 4, '');
console.log(`D1 export bytes: ${exported.length}`);

// D2: fresh profile — import the new backup, Amber must come back found.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page2 = await ctx2.newPage();
await page2.goto(BASE, { waitUntil: 'networkidle' });
await page2.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
await page2.locator('.bottom-nav').getByRole('button', { name: 'Collections' }).click();
await page2.waitForTimeout(1200);
await page2.locator('.sidebar-settings-link').click();
await page2.waitForTimeout(1200);
await page2.getByRole('button', { name: /Back up my/i }).click();
await page2.waitForTimeout(1200);
await page2.locator('#backup-file').setInputFiles(exportPath);
await page2.getByRole('heading', { name: 'Ready to merge' }).waitFor({ timeout: 15000 });
const previewText = await page2.locator('.backup-preview').innerText();
console.log('D2 merge preview:', previewText.slice(0, 300).replace(/\n/g, ' | '));
await page2.getByRole('button', { name: 'Merge backup' }).click();
const mergeMsg = await page2.locator('.atlas-dialog .success-message').first().innerText({ timeout: 15000 });
console.log('D2 merge message:', mergeMsg.slice(0, 300).replace(/\n/g, ' | '));
// The dialog stays open over the bottom nav after a merge — close it first.
await page2.locator('.atlas-dialog').getByRole('button', { name: /Close/i }).first().click();
await page2.waitForTimeout(800);
await page2.locator('.bottom-nav').getByRole('button', { name: 'Collections' }).click();
await page2.waitForTimeout(1500);
const coll2 = await page2.locator('body').innerText();
check('D2 restored backup: Delights 1/18 found survives', coll2.includes('Delights Dancers · 1 / 18 found'), '');
check('D2 restored backup: matcher pool still 94', coll2.includes('94 still unmatched'), '');
await page2.locator('.bottom-nav').getByRole('button', { name: 'Map' }).click();
await page2.waitForTimeout(1000);
await page2.getByRole('button', { name: 'Collectibles', exact: true }).first().click();
await page2.waitForTimeout(2500);
check('D2 restored backup: fbrito pins still render', (await page2.locator('.atlas-map-marker').count()) > 0, `${await page2.locator('.atlas-map-marker').count()} markers`);
await ctx2.close();

// D3: v0.32.1-shaped backup (host-card data only, zero fbrito ids) must load.
const parsed = JSON.parse(exported);
const asText = JSON.stringify(parsed);
check('D3 sanity: the new export is a v4 backup', parsed.version === 4 || asText.includes('"version":4'), `version=${parsed.version}`);
// Strip every fbrito reference to simulate a v0.32.1 file, keep one host-card found entry.
const stripped = JSON.parse(JSON.stringify(parsed, (k, v) => (typeof v === 'string' && v.includes('fbrito') ? undefined : v)));
const strippedText = JSON.stringify(stripped);
const v032Path = `${OUT}/d3-backup-v0321-shaped.json`;
writeFileSync(v032Path, strippedText);
check('D3 synthesized v0.32.1 file has zero fbrito ids', !strippedText.includes('fbrito'), '');
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page3 = await ctx3.newPage();
await page3.goto(BASE, { waitUntil: 'networkidle' });
await page3.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
await page3.locator('.bottom-nav').getByRole('button', { name: 'Collections' }).click();
await page3.waitForTimeout(1200);
await page3.locator('.sidebar-settings-link').click();
await page3.waitForTimeout(1200);
await page3.getByRole('button', { name: /Back up my/i }).click();
await page3.waitForTimeout(1200);
await page3.locator('#backup-file').setInputFiles(v032Path);
await page3.getByRole('heading', { name: 'Ready to merge' }).waitFor({ timeout: 15000 });
await page3.getByRole('button', { name: 'Merge backup' }).click();
const merge3 = await page3.locator('.atlas-dialog .success-message').first().innerText({ timeout: 15000 });
console.log('D3 merge message:', merge3.slice(0, 200).replace(/\n/g, ' | '));
check('D3 v0.32.1-shaped backup merges without error', merge3.length > 0, '');
await page3.locator('.atlas-dialog').getByRole('button', { name: /Close/i }).first().click();
await page3.waitForTimeout(800);
await page3.locator('.bottom-nav').getByRole('button', { name: 'Map' }).click();
await page3.waitForTimeout(1000);
await page3.getByRole('button', { name: 'Collectibles', exact: true }).first().click();
await page3.waitForTimeout(2500);
check('D3 after old backup: fbrito pins still render', (await page3.locator('.atlas-map-marker').count()) > 0, '');
await ctx3.close();

check('No failed requests / page errors during the demo', failedReqs.length === 0, JSON.stringify(failedReqs.slice(0, 5)));
console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
await browser.close();
