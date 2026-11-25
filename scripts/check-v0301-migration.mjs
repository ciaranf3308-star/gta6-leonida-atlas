// v0.30.1 — IndexedDB migration, drift-tolerant (Finding #1).
// Asserts the FIXED behaviour:
//   (a) faithful v0.29 seed migrates cleanly (QA's 16/16 behaviour
//       must not regress);
//   (b) ONE record missing `model` no longer aborts the migration:
//       the other records land, the model-less one lands with
//       model 'unknown', migration meta records skipped=1, no error
//       banner, legacy keys removed after the verified write;
//   (c) other single-record shape drift (bad timestamp, over-long
//       reason, over-long shopType, out-of-range confidence) is
//       skipped-and-counted the same way instead of aborting.
// Self-serves dist/ on port 4340. Fixture ids only.
/* global window, indexedDB */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v0301-walk-fix/';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4340');
  let path = decodeURIComponent(url.pathname);
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
await new Promise((resolve) => server.listen(4340, resolve));
const base = 'http://127.0.0.1:4340/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};

const rec = (placeId, aiCategory, status, confidence, source, extra = {}) => ({
  placeId,
  aiCategory,
  status,
  confidence,
  reason: 'QA seed',
  model: 'gpt-4o-mini',
  indexedAt: '2026-11-24T10:00:00.000Z',
  source,
  ...extra,
});
const jobFor = (ids) => ({
  status: 'paused',
  attemptedPlaceIds: ids,
  resolverVersion: 3,
  updatedAt: '2026-11-20T00:00:00.000Z',
});

const readAiDb = (pg) =>
  pg.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('leonida-atlas-ai');
        open.onerror = () => reject(new Error(`open failed: ${open.error?.name ?? 'unknown'}`));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['aiCategories', 'aiIndexJob', 'aiMeta'], 'readonly');
          const out = {};
          const cats = tx.objectStore('aiCategories').getAll();
          const job = tx.objectStore('aiIndexJob').get('job');
          const meta = tx.objectStore('aiMeta').get('ai-migration-v1');
          cats.onsuccess = () => { out.categories = cats.result; };
          job.onsuccess = () => { out.job = job.result ?? null; };
          meta.onsuccess = () => { out.migration = meta.result?.value ?? null; };
          tx.oncomplete = () => { db.close(); resolve(out); };
          tx.onerror = () => reject(new Error('tx failed'));
        };
      }),
  );
const legacyKeys = (pg) =>
  pg.evaluate(() => ({
    categories: window.localStorage.getItem('leonida-ai-categories-v1'),
    job: window.localStorage.getItem('leonida-ai-index-job-v1'),
  }));
const skipOnboarding = async (pg) => {
  const skip = pg.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await pg.waitForTimeout(800);
  }
};
const openIndexPanel = async (pg) => {
  await pg.getByRole('button', { name: 'Layers', exact: true }).click();
  await pg.waitForTimeout(1200);
  const panel = pg.locator('#index-panel');
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  await pg.waitForTimeout(1200);
  return (await panel.textContent()) ?? '';
};

const browser = await chromium.launch();

// ---------- (a) faithful seed — must not regress ----------
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await context.addInitScript((seed) => {
    window.localStorage.setItem('leonida-ai-categories-v1', JSON.stringify(seed.cats));
    window.localStorage.setItem('leonida-ai-index-job-v1', JSON.stringify(seed.job));
  }, {
    cats: {
      L1: rec('L1', 'house', 'suggested', 0.87, 'ai'),
      L2: rec('L2', 'shop', 'suggested', 0.92, 'coordinate'),
      L3: rec('L3', 'restaurant', 'suggested', 0.78, 'tag'),
      L4: rec('L4', 'other', 'suggested', 0.4, 'ai'),
      L5: rec('L5', 'gym', 'confirmed', 0.95, 'ai', { userCategory: 'house' }),
    },
    job: jobFor(['L1', 'L2', 'L3', 'L4', 'L5']),
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const db = await readAiDb(page);
  const ids = (db.categories ?? []).map((c) => c.placeId).sort();
  check('(a) faithful seed: 5 records land', JSON.stringify(ids) === '["L1","L2","L3","L4","L5"]', JSON.stringify(ids));
  check('(a) faithful seed: migration meta has no skips', db.migration?.categories === 5 && (db.migration?.skipped ?? 0) === 0, JSON.stringify(db.migration));
  const keys = await legacyKeys(page);
  check('(a) faithful seed: legacy keys removed', keys.categories === null && keys.job === null, 'keys remain');
  const panelText = await openIndexPanel(page);
  check('(a) faithful seed: no storage-error banner', !/could not be saved on this device/i.test(panelText), 'banner present');
  await context.close();
}

// ---------- (b) one record missing `model` — must NOT abort ----------
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await context.addInitScript((seed) => {
    window.localStorage.setItem('leonida-ai-categories-v1', JSON.stringify(seed.cats));
    window.localStorage.setItem('leonida-ai-index-job-v1', JSON.stringify(seed.job));
  }, {
    cats: {
      L1: rec('L1', 'house', 'suggested', 0.87, 'ai'),
      L2: rec('L2', 'shop', 'suggested', 0.92, 'coordinate'),
      L3: rec('L3', 'restaurant', 'suggested', 0.78, 'tag'),
      // L4 has no `model` — the shape any pre-model record, hand-edit
      // or future drift would have.
      L4: { placeId: 'L4', aiCategory: 'other', status: 'suggested', confidence: 0.4, reason: 'QA seed', indexedAt: '2026-11-24T10:00:00.000Z', source: 'ai' },
      L5: rec('L5', 'gym', 'confirmed', 0.95, 'ai', { userCategory: 'house' }),
    },
    job: jobFor(['L1', 'L2', 'L3', 'L4', 'L5']),
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const db = await readAiDb(page);
  const ids = (db.categories ?? []).map((c) => c.placeId).sort();
  check('(b) model-less record: all 5 land (L4 repaired, not dropped)', JSON.stringify(ids) === '["L1","L2","L3","L4","L5"]', JSON.stringify(ids));
  const l4 = (db.categories ?? []).find((c) => c.placeId === 'L4');
  check('(b) model-less record: L4 lands with model defaulted to unknown', l4?.model === 'unknown', JSON.stringify(l4));
  check('(b) model-less record: migration meta counts the repair (5 landed, 0 skipped)', db.migration?.categories === 5 && (db.migration?.skipped ?? 0) === 0, JSON.stringify(db.migration));
  const keys = await legacyKeys(page);
  check('(b) model-less record: legacy keys removed after verified write', keys.categories === null && keys.job === null, 'keys remain');
  const panelText = await openIndexPanel(page);
  check('(b) model-less record: no storage-error banner', !/could not be saved on this device/i.test(panelText), 'banner present');
  await page.screenshot({ path: `${OUT}migration-model-default.png` });
  await context.close();
}

// ---------- (c) other single-record drift — skipped and counted ----------
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await context.addInitScript((seed) => {
    window.localStorage.setItem('leonida-ai-categories-v1', JSON.stringify(seed.cats));
    window.localStorage.setItem('leonida-ai-index-job-v1', JSON.stringify(seed.job));
  }, {
    cats: {
      L1: rec('L1', 'house', 'suggested', 0.87, 'ai'),
      L2: rec('L2', 'shop', 'suggested', 0.92, 'coordinate', { indexedAt: 'not-a-date' }),
      L3: rec('L3', 'restaurant', 'suggested', 0.78, 'tag', { reason: 'x'.repeat(1001) }),
      L4: rec('L4', 'other', 'suggested', 0.4, 'ai', { shopType: 'y'.repeat(61) }),
      L5: rec('L5', 'gym', 'suggested', 1.5, 'ai'),
    },
    job: jobFor(['L1', 'L2', 'L3', 'L4', 'L5']),
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const db = await readAiDb(page);
  const ids = (db.categories ?? []).map((c) => c.placeId).sort();
  check('(c) drifted records: only the valid one lands', JSON.stringify(ids) === '["L1"]', JSON.stringify(ids));
  check('(c) drifted records: migration meta counts 4 skipped', db.migration?.categories === 1 && db.migration?.skipped === 4, JSON.stringify(db.migration));
  const keys = await legacyKeys(page);
  check('(c) drifted records: legacy keys removed after verified write', keys.categories === null && keys.job === null, 'keys remain');
  const panelText = await openIndexPanel(page);
  check('(c) drifted records: no storage-error banner', !/could not be saved on this device/i.test(panelText), 'banner present');
  await context.close();
}

await browser.close();
server.close();
console.log(failures.length ? `MIGRATION v0.30.1: ${failures.length} FAILURES — ${failures.join(', ')}` : 'MIGRATION v0.30.1: ALL PASS');
process.exit(failures.length ? 1 : 0);
