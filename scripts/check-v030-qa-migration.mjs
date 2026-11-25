// QA v0.30.0 — IndexedDB migration, adversarial (round 2).
// Round 1 found a REAL failure, but the seed was unfaithful: it
// omitted `model`, which every app-written record has carried since
// the first categorisation commit (b032389cf, 2026-11-23). This round:
//   (a) FAITHFUL v0.29 seed (model + reason + indexedAt, as
//       buildRecords writes them): migration must succeed end to end.
//   (b) FRAGILITY: the same seed with ONE record missing `model`
//       (shape drift / an old record): the migration feeds lenient-
//       parsed legacy data into the STRICT backup validator, so one
//       bad record must abort the WHOLE migration — prove it, because
//       that is the failure mode the user's real phone would hit on
//       any shape drift.
//   (c) IDB failure fails loud (poisoned DB v99): legacy keys kept,
//       error banner shown with retry.
// Self-serves dist/ on port 4340. Fixture ids only.
/* global window, indexedDB */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4340');
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
await new Promise((resolve) => server.listen(4340, resolve));
const base = 'http://127.0.0.1:4340/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};

/** Faithful v0.29 record, as buildRecords writes it. */
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
          cats.onsuccess = () => {
            out.categories = cats.result;
          };
          job.onsuccess = () => {
            out.job = job.result ?? null;
          };
          meta.onsuccess = () => {
            out.migration = meta.result?.value ?? null;
          };
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
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

// ---------- (a) faithful v0.29 seed ----------
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
      L4: rec('L4', 'other', 'unsure', 0.4, 'ai'),
      L5: rec('L5', 'gym', 'confirmed', 0.95, 'ai', { userCategory: 'house' }),
      L6: rec('L6', 'castle', 'suggested', 0.9, 'ai'), // invalid category — dropped by lenient parse
      L9: rec('L8', 'shop', 'suggested', 0.9, 'ai'), // key != placeId — dropped by lenient parse
    },
    job: {
      status: 'paused',
      attemptedPlaceIds: ['L1', 'L2', 'L3', 'L4', 'L5'],
      resolverVersion: 2,
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const db = await readAiDb(page);
  const ids = (db.categories ?? []).map((c) => c.placeId).sort();
  check('faithful seed: 5 valid records land in IDB (2 invalid dropped)', JSON.stringify(ids) === '["L1","L2","L3","L4","L5"]', JSON.stringify(ids));
  const l5 = (db.categories ?? []).find((c) => c.placeId === 'L5');
  check('faithful seed: user correction preserved (L5 userCategory house)', l5?.userCategory === 'house' && l5?.status === 'confirmed', JSON.stringify(l5));
  const attempted = [...(db.job?.attemptedPlaceIds ?? [])].sort();
  check('faithful seed: v2 unsure place re-queued (attempted loses L4)', JSON.stringify(attempted) === '["L1","L2","L3","L5"]', JSON.stringify(attempted));
  check('faithful seed: job version bumped to 3', db.job?.resolverVersion === 3, String(db.job?.resolverVersion));
  check(
    'faithful seed: migration meta written',
    db.migration?.categories === 5 && db.migration?.attempted === 5 && db.migration?.source === 'localStorage-v1',
    JSON.stringify(db.migration),
  );
  const keys = await legacyKeys(page);
  check('faithful seed: legacy keys removed after verified write', keys.categories === null && keys.job === null, 'keys remain');
  check('faithful seed: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  const panelText = await openIndexPanel(page);
  check('faithful seed: panel shows To go 2,728 (4 attempted)', /To go · 2,728/.test(panelText), (panelText.match(/To go · [0-9,]+/) ?? ['absent'])[0]);
  check('faithful seed: re-queue notice names 1 place', /1 not-sure place re-queued/i.test(panelText), 'notice absent');
  check('faithful seed: no storage-error banner', !/could not be saved on this device/i.test(panelText), 'banner present');
  await page.screenshot({ path: `${OUT}migration-faithful-panel.png` });
  await context.close();
}

// ---------- (b) fragility: one record missing `model` ----------
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
      // or future drift would have. The strict validator throws.
      L4: { placeId: 'L4', aiCategory: 'other', status: 'unsure', confidence: 0.4, reason: 'QA seed', indexedAt: '2026-11-24T10:00:00.000Z', source: 'ai' },
      L5: rec('L5', 'gym', 'confirmed', 0.95, 'ai', { userCategory: 'house' }),
    },
    job: {
      status: 'paused',
      attemptedPlaceIds: ['L1', 'L2', 'L3', 'L4', 'L5'],
      resolverVersion: 2,
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const db = await readAiDb(page);
  const count = (db.categories ?? []).length;
  console.log(`FRAGILITY  one record missing model -> IDB categories=${count}, migration=${JSON.stringify(db.migration)}, legacy keys remain=${(await legacyKeys(page)).categories !== null}`);
  check('fragility: one bad record aborts the WHOLE migration (0 land)', count === 0, `${count} landed`);
  const panelText = await openIndexPanel(page);
  check(
    'fragility: error banner names the cause',
    /could not be saved on this device: Invalid Atlas backup: aiCategory\.model must be text/i.test(panelText),
    panelText.slice(0, 400).replace(/\s+/g, ' '),
  );
  check('fragility: legacy keys preserved (data not lost, just stuck)', (await legacyKeys(page)).categories !== null, 'keys removed despite failure');
  await page.screenshot({ path: `${OUT}migration-fragility-panel.png` });
  await context.close();
}

// ---------- (c) IDB failure fails loud ----------
// The v99-poison idea does NOT fail Dexie: Dexie 4.4.7 recovers from
// a higher-version DB with missing stores by auto-patching it
// (schemaPatchMode, native version +1) — verified in the Dexie
// source and by the migration succeeding despite the poison. That
// resilience is a plus, not a failure. The real "IDB unavailable"
// test is to stub indexedDB so every open throws (private-mode /
// corrupted-IDB shape): the app must still render, show the storage
// error with retry, and leave the legacy keys untouched.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'leonida-ai-categories-v1',
      JSON.stringify({
        L1: { placeId: 'L1', aiCategory: 'house', status: 'suggested', confidence: 0.87, reason: 'QA seed', model: 'gpt-4o-mini', indexedAt: '2026-11-24T10:00:00.000Z', source: 'ai' },
      }),
    );
    window.localStorage.setItem(
      'leonida-ai-index-job-v1',
      JSON.stringify({ status: 'paused', attemptedPlaceIds: ['L1'], resolverVersion: 3, updatedAt: '2026-11-20T00:00:00.000Z' }),
    );
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('QA: IndexedDB unavailable');
      },
      configurable: true,
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await skipOnboarding(page);
  await page.waitForSelector('.place-sheet', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2500);
  check('IDB unavailable: app still renders the map sheet', (await page.locator('.place-sheet').count()) > 0, 'no place sheet — app may have white-screened');
  check('IDB unavailable: legacy keys left untouched', (await legacyKeys(page)).categories !== null, 'keys removed');
  const panelText = await openIndexPanel(page);
  check(
    'IDB unavailable: storage-error banner shown with retry',
    /could not be saved on this device/i.test(panelText) && /Try saving again/i.test(panelText),
    panelText.slice(0, 400).replace(/\s+/g, ' '),
  );
  console.log('IDB unavailable: page errors seen:', errors.slice(0, 2).join(' | ') || 'none');
  await page.screenshot({ path: `${OUT}migration-idb-failure.png` });
  await context.close();
}

await browser.close();
server.close();
console.log(failures.length ? `QA MIGRATION R2: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA MIGRATION R2: ALL PASS');
process.exit(failures.length ? 1 : 0);
