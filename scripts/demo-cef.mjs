// Demos C + E + F probes (DESIGN §9 + ADDENDUM demos E–G).
// C: vehicle loot — §8.1 gang-op import has NOT landed; the design's
// fallback is a PLAYER-JOTTED vehicle-loot opportunity. Establish
// whether any jot/marker/tag path exists in the UI, and ask the
// finder about Brooks Boatworks.
// E: enrichment — establish what renders (RegionalResearch section?)
// vs the missing "Research this building" UI / call counter /
// Conflicts row.
// F: album screenshot-match — establish whether the album uploads any
// photo at all vs the missing match_screenshot proposal UI.
import { launch, shot, bodyText, clickTab, closeDialog, waitForText, dumpButtons } from './harness.mjs';

const SEED =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/seed-v3-backup.json';

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

const { ctx, page } = await launch('demo-cef', 'CEF');
await shot(page, 'c01-fresh-home');
await restoreFile(page, SEED);
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
console.log('seed restored (Delights 0/18):', /0 \/ 18/.test(await bodyText(page)));

// ---- C1: Ask about vehicle loot at Brooks Boatworks ----
const c1 = await ask(page, 'what vehicle loot is at Brooks Boatworks?');
await shot(page, 'c02-ask-brooks-boatworks');
console.log('--- C1 ask Brooks Boatworks ---');
console.log(c1.slice(0, 1800));

// ---- C2: marker kinds — open the marker editor via a seeded marker ----
// The seeded markers are in Saved (Collections). Open the marker list.
await clickTab(page, 'Collections');
await waitForText(page, /Delights Dancers/);
await page.getByText(/Capri gym|Breakable house/).first().click().catch(() => {});
await page.waitForTimeout(1200);
await shot(page, 'c03-saved-markers');
await dumpButtons(page, 'saved');
// Try the map long-press / add-marker flow: Find the "Add marker" entry.
// The Map tab has a long-press on empty map; instead check the marker
// editor kinds via the seeded marker's card (open it from Saved).
const capriGym = page.getByRole('button', { name: /Capri gym/i }).first();
console.log('Capri gym button in Saved:', await capriGym.count());
if (await capriGym.count()) {
  await capriGym.click();
  await page.waitForTimeout(1500);
  await shot(page, 'c04-capri-gym-marker');
  console.log('--- marker card text ---');
  console.log((await bodyText(page)).slice(0, 2000));
  await dumpButtons(page, 'marker-card');
}

// ---- C3: tag a place "vehicle-loot" and see if an opportunity appears ----
// ("Add tag" is disabled until the input is non-empty — fill first.)
await openPlace(page, 'L304', 'c05-starlet-card');
const tagInput = page.getByLabel('Add your own tag for this place').first();
console.log('tag input count:', await tagInput.count());
if (await tagInput.count()) {
  await tagInput.click();
  await tagInput.fill('vehicle-loot');
  await page.waitForTimeout(600);
  await shot(page, 'c07-tag-typed');
  const addTag = page.getByRole('button', { name: 'Add tag', exact: true }).first();
  console.log('"Add tag" enabled after typing:', await addTag.isEnabled());
  await addTag.click();
  await page.waitForTimeout(1500);
  await shot(page, 'c08-tag-added');
  const t = await bodyText(page);
  console.log('--- card after tagging vehicle-loot ---');
  console.log(t.slice(0, 2500));
  console.log('tag shown on card?', /vehicle-loot/i.test(t));
  console.log('vehicle-loot opportunity on card?', /Vehicle loot|vehicle-loot opportunity/i.test(t));
}

// ---- E1: enrichment — RegionalResearch section on a place card ----
await openPlace(page, 'L530', 'e01-kalaga-card');
const eText = await bodyText(page);
console.log('--- E1 L530 card: enrichment rows? ---');
console.log('has "Research this building":', /Research this building/i.test(eText));
console.log('has call counter / "calls":', /calls (used|made|remaining)|API calls/i.test(eText));
console.log('has "Conflicts":', /Conflicts/i.test(eText));
console.log('has "DISCOVER LEONIDA"/Regional context:', /DISCOVER LEONIDA|Regional context/i.test(eText));
console.log('has freshness ("Updated"/"checked"):', /Updated|Last checked|fresh/i.test(eText));
await shot(page, 'e02-kalaga-research-section');
// Scroll the card to the research section if present.
const research = page.getByText(/DISCOVER LEONIDA/i).first();
if (await research.count()) {
  await research.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, 'e03-research-scrolled');
}

// ---- F1: album — does any photo upload exist? ----
await openPlace(page, 'L304', 'f01-starlet-card');
const addPhoto = page.getByRole('button', { name: /Add your photo/i }).first();
console.log('"Add your photo" button:', await addPhoto.count());
if (await addPhoto.count()) {
  await addPhoto.click();
  await page.waitForTimeout(1200);
  await shot(page, 'f02-add-photo');
  console.log('--- after Add your photo ---');
  console.log((await bodyText(page)).slice(0, 1500));
  await dumpButtons(page, 'add-photo');
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log('file inputs on page:', fileInputs);
}
// Album view: Collections -> look for an album/photos section.
await clickTab(page, 'Collections');
await page.waitForTimeout(1200);
const collText = await bodyText(page);
console.log('Collections has "album"/"photos":', /album|photos/i.test(collText));
console.log('Collections has "match"/"screenshot":', /match|screenshot/i.test(collText));
await shot(page, 'f03-collections-album');
await ctx.close();
console.log('C/E/F probe done');
