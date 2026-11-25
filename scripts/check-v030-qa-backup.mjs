// QA v0.30.0 — backup export → wipe → import round-trip, real UI.
//   (a) seed a faithful legacy AI index (migrates on load) + a fake
//       API key; create one marker through the real right-click flow;
//   (b) export via Settings → "Back up my ViceWire" → capture the
//       download; the file must hold the marker + the AI index and
//       must NOT contain the API key anywhere;
//   (c) wipe all storage, reload, prove the marker + index are gone;
//   (d) import the file back: preview counts, merge, prove the marker
//       + AI index are restored;
//   (e) a corrupt file must error and preserve existing data.
// Self-serves dist/ on port 4341. Fixture ids only.
/* global document, window, indexedDB */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/qa-v030/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4341');
  let path = decodeURIComponent(url.pathname);
  if (path === '/qa-blank.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>qa blank</title><body>blank</body>');
    return;
  }
  if (!path.startsWith('/gta6-leonida-atlas/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4341, resolve));
const base = 'http://127.0.0.1:4341/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};

const readAiCount = (pg) =>
  pg.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('leonida-atlas-ai');
        open.onerror = () => reject(new Error('open failed'));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['aiCategories'], 'readonly');
          const req = tx.objectStore('aiCategories').count();
          req.onsuccess = () => {
            const n = req.result;
            db.close();
            resolve(n);
          };
          req.onerror = () => reject(new Error('count failed'));
        };
      }),
  );

const markerCount = (pg) =>
  pg.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);

const skipOnboarding = async (pg) => {
  const skip = pg.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await pg.waitForTimeout(800);
  }
};

const openBackupDialog = async (pg) => {
  // Settings lives in the Sidebar footer — open Layers first.
  await pg.getByRole('button', { name: 'Layers', exact: true }).click();
  await pg.waitForTimeout(800);
  await pg.getByRole('button', { name: 'Settings', exact: true }).click();
  await pg.waitForTimeout(800);
  const backupBtn = pg.getByRole('button', { name: /Back up my ViceWire/ });
  await backupBtn.first().click();
  await pg.waitForSelector('text=Your local backup', { timeout: 10000 });
  await pg.waitForTimeout(800);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
// Page-scoped seed (NOT context-scoped): a context init script would
// re-seed the legacy keys on EVERY navigation, including the wiped
// page2 — which silently re-migrated the index after the wipe.
await page.addInitScript(() => {
  const rec = (placeId, aiCategory, status, confidence, source) => ({
    placeId,
    aiCategory,
    status,
    confidence,
    reason: 'QA seed',
    model: 'gpt-4o-mini',
    indexedAt: '2026-11-24T10:00:00.000Z',
    source,
  });
  window.localStorage.setItem(
    'leonida-ai-categories-v1',
    JSON.stringify({
      L1: rec('L1', 'house', 'suggested', 0.87, 'ai'),
      L2: rec('L2', 'shop', 'suggested', 0.92, 'coordinate'),
      L3: rec('L3', 'restaurant', 'suggested', 0.78, 'tag'),
    }),
  );
  window.localStorage.setItem(
    'leonida-ai-index-job-v1',
    JSON.stringify({ status: 'paused', attemptedPlaceIds: ['L1', 'L2', 'L3'], resolverVersion: 3, updatedAt: '2026-11-20T00:00:00.000Z' }),
  );
  window.localStorage.setItem('leonida-ask-api-key', 'sk-qa-fake-key-12345');
});
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto(base, { waitUntil: 'networkidle' });
await skipOnboarding(page);
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(2000);
check('backup setup: AI index migrated (3 in IDB)', (await readAiCount(page)) === 3, `count=${await readAiCount(page)}`);

// (a) Create a marker through the real right-click flow.
const closeSheet = page.getByRole('button', { name: 'Close place details' });
if ((await closeSheet.count()) > 0) {
  await closeSheet.first().click();
  await page.waitForTimeout(1200);
}
await page.mouse.click(195, 420, { button: 'right' });
await page.waitForSelector('#marker-title', { timeout: 10000 });
await page.locator('#marker-title').fill('QA marker');
const kind = page.locator('#marker-kind');
if ((await kind.count()) > 0) {
  const options = await kind.locator('option').allTextContents();
  if (options.length > 1) await kind.selectOption({ index: 1 });
}
await page.getByRole('button', { name: 'Save marker' }).click();
await page.waitForTimeout(2000);
const markersAfterCreate = await markerCount(page);
check('backup setup: marker created via right-click and visible', markersAfterCreate >= 1, `markers=${markersAfterCreate}`);
await page.screenshot({ path: `${OUT}backup-marker-created.png` });

// (b) Export and inspect the file.
await openBackupDialog(page);
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.getByRole('button', { name: 'Export backup' }).click();
const download = await downloadPromise;
const backupPath = `${OUT}qa-backup-download.json`;
await download.saveAs(backupPath);
const raw = readFileSync(backupPath, 'utf8');
const backup = JSON.parse(raw);
check('export: file is a versioned leonida-atlas backup', backup.format === 'leonida-atlas' && backup.version === 3, `format=${backup.format} version=${backup.version}`);
check('export: marker in file', (backup.markers ?? []).some((m) => m.title === 'QA marker' || JSON.stringify(m).includes('QA marker')), `${(backup.markers ?? []).length} markers`);
check('export: AI index in file (3 categories)', (backup.aiCategories ?? []).length === 3, `${(backup.aiCategories ?? []).length}`);
check('export: job progress in file', (backup.aiIndexJob?.attemptedPlaceIds ?? []).length === 3, JSON.stringify(backup.aiIndexJob?.attemptedPlaceIds));
check('export: API key NOWHERE in the file', !raw.includes('sk-qa-fake-key-12345'), 'key leaked into backup!');
check('export: success message shown', (await page.locator('.success-message').count()) > 0, 'no success message');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.waitForTimeout(500);

// (c) Wipe everything RELIABLY: deleteDatabase while the app holds
// connections open only fires `blocked` and never deletes (the first
// cut of this probe "wiped" nothing — the AI index read back 3).
// Close the page first to release every connection, wipe from a
// blank page on the same origin with awaited success, then load the
// app fresh — the new-phone shape of the test.
await page.close();
const blank = await context.newPage();
await blank.goto('http://127.0.0.1:4341/qa-blank.html', { waitUntil: 'domcontentloaded' });
const wiped = await blank.evaluate(async () => {
  window.localStorage.clear();
  const dbs = await indexedDB.databases();
  const deleted = [];
  for (const d of dbs) {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(d.name);
      req.onsuccess = () => {
        deleted.push(d.name);
        resolve();
      };
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  return { before: dbs.map((d) => d.name), deleted, after: (await indexedDB.databases()).map((d) => d.name) };
});
console.log('wipe result:', JSON.stringify(wiped));
await blank.close();
const page2 = await context.newPage();
page2.on('pageerror', (err) => errors.push(String(err)));
await page2.goto(base, { waitUntil: 'networkidle' });
await skipOnboarding(page2);
await page2.waitForSelector('.place-sheet', { timeout: 10000 });
await page2.waitForTimeout(2000);
const closeSheet2 = page2.getByRole('button', { name: 'Close place details' });
if ((await closeSheet2.count()) > 0) {
  await closeSheet2.first().click();
  await page2.waitForTimeout(1200);
}
check('wipe: all databases actually deleted', wiped.after.length === 0, JSON.stringify(wiped.after));
check('wipe: marker gone after storage wipe', (await markerCount(page2)) === 0, `markers=${await markerCount(page2)}`);
check('wipe: AI index gone after storage wipe', (await readAiCount(page2)) === 0, `count=${await readAiCount(page2)}`);

// (d) Import the file back.
await openBackupDialog(page2);
await page2.locator('#backup-file').setInputFiles(backupPath);
await page2.waitForSelector('.backup-preview', { timeout: 10000 });
const previewText = (await page2.locator('.backup-preview').textContent()) ?? '';
check('import: preview shows 3 AI-sorted places + 1 marker', /3 AI-sorted place/.test(previewText) && /1 marker/.test(previewText), previewText.slice(0, 200).replace(/\s+/g, ' '));
await page2.getByRole('button', { name: 'Merge backup' }).click();
await page2.waitForSelector('.success-message', { timeout: 15000 });
const importMsg = (await page2.locator('.success-message').first().textContent()) ?? '';
console.log('import success message:', importMsg.slice(0, 160));
await page2.waitForTimeout(2000);
await page2.getByRole('button', { name: 'Close dialog' }).click();
await page2.waitForTimeout(800);
const closeSheet3 = page2.getByRole('button', { name: 'Close place details' });
if ((await closeSheet3.count()) > 0) {
  await closeSheet3.first().click();
  await page2.waitForTimeout(1200);
}
check('import: marker restored and visible', (await markerCount(page2)) >= 1, `markers=${await markerCount(page2)}`);
check('import: AI index restored (3 in IDB)', (await readAiCount(page2)) === 3, `count=${await readAiCount(page2)}`);
await page2.screenshot({ path: `${OUT}backup-restored.png` });

// (e) Corrupt file must error and preserve data.
await openBackupDialog(page2);
const corruptPath = `${OUT}qa-backup-corrupt.json`;
writeFileSync(corruptPath, '{"format":"leonida-atlas","version":3,"markers": [BROKEN');
await page2.locator('#backup-file').setInputFiles(corruptPath);
await page2.waitForTimeout(1500);
const alertText = (await page2.locator('.atlas-dialog [role="alert"]').first().textContent().catch(() => '')) ?? '';
check('corrupt import: error shown', /import failed|invalid|corrupt|not valid JSON/i.test(alertText), alertText.slice(0, 160) || 'no alert');
await page2.getByRole('button', { name: 'Close dialog' }).click();
await page2.waitForTimeout(800);
const closeSheet4 = page2.getByRole('button', { name: 'Close place details' });
if ((await closeSheet4.count()) > 0) {
  await closeSheet4.first().click();
  await page2.waitForTimeout(1200);
}
check('corrupt import: marker still there', (await markerCount(page2)) >= 1, `markers=${await markerCount(page2)}`);
check('corrupt import: AI index still 3', (await readAiCount(page2)) === 3, `count=${await readAiCount(page2)}`);
check('backup probe: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(failures.length ? `QA BACKUP: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA BACKUP: ALL PASS');
process.exit(failures.length ? 1 : 0);
