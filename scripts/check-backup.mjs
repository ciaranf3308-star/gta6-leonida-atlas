/* global localStorage */
/* Backup walk at 390px: Settings → "Back up my Atlas" → export →
 * restore, with the AI index in the file.
 * Phase 1 seeds one AI-sorted place and exports it; phase 2 seeds
 * three (one of them a user correction of the same place) and imports
 * the phase-1 file — the correction must win, and the success message
 * must say so in plain numbers. Exits 1 on console errors, overflow,
 * or any flow assertion failing.
 * Run with: ./node_modules/.bin/tsx scripts/check-backup.mjs
 * (preview server must be running: ATLAS_BASE_PATH=/gta6-leonida-atlas/
 *  vite preview --host 127.0.0.1 --port 4330) */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const out = '/tmp/atlas-walk-backup';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const nav = (label) => page.locator('.bottom-nav').getByRole('button', { name: label });
const overflow = () =>
  page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);
function fail(message) {
  throw new Error(message);
}

async function dismissOnboardingIfShown() {
  const skip = page.getByRole('button', { name: /Skip for now/ });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function openBackupDialog() {
  await nav('Layers').click();
  await page.locator('.sidebar-settings-link').click();
  await page.getByRole('heading', { name: 'Back up my Atlas' }).waitFor({ timeout: 10000 });
}

// Phase 1: one AI-sorted place, export it.
await page.addInitScript(() => {
  localStorage.setItem(
    'leonida-ai-categories-v1',
    JSON.stringify({
      L1: {
        placeId: 'L1',
        aiCategory: 'house',
        confidence: 0.9,
        reason: 'Walk seed.',
        model: 'test',
        indexedAt: '2026-11-24T12:00:00.000Z',
        status: 'suggested',
        source: 'ai',
      },
    }),
  );
  localStorage.setItem(
    'leonida-ai-index-job-v1',
    JSON.stringify({
      status: 'done',
      attemptedPlaceIds: ['L1'],
      resolverVersion: 3,
      updatedAt: '2026-11-24T12:00:00.000Z',
    }),
  );
});
await page.goto(base, { waitUntil: 'networkidle' });
await page.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
await dismissOnboardingIfShown();
await openBackupDialog();
const whereText = await page.locator('.detail-section', { hasText: 'Where my stuff lives' }).innerText();
console.log('where-my-stuff-lives:', JSON.stringify(whereText.slice(0, 200)));
if (!/wipe|new phone/i.test(whereText)) fail('"Where my stuff lives" does not say what is lost');
await shot('a-settings-backup');
await page.getByRole('button', { name: 'Back up my Atlas' }).click();
await page.getByRole('heading', { name: 'Your local backup' }).waitFor({ timeout: 10000 });
const intro = await page.locator('.atlas-dialog .panel-intro').first().innerText();
console.log('backup intro:', JSON.stringify(intro.slice(0, 200)));
if (!/AI index/i.test(intro)) fail('backup dialog does not mention the AI index');
if (!/key is never/i.test(intro)) fail('backup dialog does not say the key is never included');
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.getByRole('button', { name: 'Export backup' }).click();
const download = await downloadPromise;
const downloadPath = `${out}/exported-backup.json`;
await download.saveAs(downloadPath);
const exported = JSON.parse(readFileSync(downloadPath, 'utf8'));
console.log('exported file:', download.suggestedFilename(), 'version', exported.version);
if (exported.version !== 3) fail(`exported backup is version ${exported.version}, expected 3`);
if (exported.aiCategories.length !== 1) fail(`exported ${exported.aiCategories.length} AI categories, expected 1`);
if (exported.aiIndexJob.attemptedPlaceIds.length !== 1) fail('exported job has no attempted place');
if (JSON.stringify(exported).includes('sk-')) fail('exported backup contains a key-like string');
const exportMessage = await page.locator('.atlas-dialog .success-message').first().innerText();
console.log('export message:', JSON.stringify(exportMessage));
if (!/1 AI-sorted place/.test(exportMessage)) fail('export message does not report the AI count');
await shot('b-backup-exported');
await page.keyboard.press('Escape');

// Phase 2: three sorted places on the phone, one a correction of L1.
// Import the phase-1 file: the correction must win.
await page.addInitScript(() => {
  const rec = (placeId, overrides = {}) => ({
    placeId,
    aiCategory: 'house',
    confidence: 0.9,
    reason: 'Walk seed.',
    model: 'test',
    indexedAt: '2026-11-24T12:00:00.000Z',
    status: 'suggested',
    source: 'ai',
    ...overrides,
  });
  localStorage.setItem(
    'leonida-ai-categories-v1',
    JSON.stringify({
      L1: rec('L1', { status: 'corrected', userCategory: 'petrol' }),
      L2: rec('L2'),
      L3: rec('L3'),
    }),
  );
  localStorage.setItem(
    'leonida-ai-index-job-v1',
    JSON.stringify({
      status: 'done',
      attemptedPlaceIds: ['L1', 'L2', 'L3'],
      resolverVersion: 3,
      updatedAt: '2026-11-24T12:00:00.000Z',
    }),
  );
});
await page.goto(base, { waitUntil: 'networkidle' });
await page.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
await dismissOnboardingIfShown();
await openBackupDialog();
await page.getByRole('button', { name: 'Back up my Atlas' }).click();
await page.getByRole('heading', { name: 'Your local backup' }).waitFor({ timeout: 10000 });
await page.locator('#backup-file').setInputFiles(downloadPath);
await page.getByRole('heading', { name: 'Ready to merge' }).waitFor({ timeout: 10000 });
const previewText = await page.locator('.backup-preview').innerText();
console.log('restore preview:', JSON.stringify(previewText));
if (!/1 AI-sorted place/.test(previewText)) fail('restore preview does not show the 1 AI-sorted place');
await shot('c-restore-preview');
await page.getByRole('button', { name: 'Merge backup' }).click();
const mergeMessage = await page.locator('.atlas-dialog .success-message').first().innerText({ timeout: 15000 });
console.log('merge message:', JSON.stringify(mergeMessage));
if (!/AI index: 0 new, 0 updated, 1 kept as yours/.test(mergeMessage))
  fail(`merge message does not report the correction winning: ${JSON.stringify(mergeMessage)}`);
const kept = await page.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem('leonida-ai-categories-v1') ?? '{}');
  return stored.L1?.status;
});
console.log('L1 status after restore:', kept);
if (kept !== 'corrected') fail(`restore overwrote the user correction — L1 is ${kept}`);
await shot('d-restore-done');

if ((await overflow()) > 0) fail('horizontal overflow at the end of the walk');
if (errors.length > 0) fail(`console/page errors: ${errors.join(' | ')}`);
console.log('backup walk passed — 4 screenshots in', out);
await browser.close();
