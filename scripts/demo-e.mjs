/* global document, indexedDB */
// Demo E — enrichment is cached, never re-requested (DESIGN-ADDENDUM §2).
// Fresh profile -> open Starlet Motel (L304) -> tap "Research this
// building" with NO key -> assert the honest no-key state + a queued
// ResearchRequest (no fake result, no model call) -> seed a cached
// enrichment in IndexedDB -> reload -> assert the call counter (1),
// the freshness display ("Last checked … — still fresh"), tier-2
// gating, and the Conflicts row -> tap "Research again" keyless ->
// assert the counter is still 1.
// Served from `vite preview` on port 4336 with ATLAS_BASE_PATH set.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:4336/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-e';
mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: p });
  console.log('shot:', p);
}

/** The research section sits below the fold on the card — scroll it
 *  into view so the screenshot shows the feature, not the card top. */
async function scrollToResearch(page) {
  await page.evaluate(() => {
    document.querySelector('.place-research')?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(600);
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText)).slice(0, 8000);
}

async function waitForText(page, re, timeout = 30000) {
  await page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), re.source, { timeout });
}

/** Read a Dexie table's rows from the page (the app's own IndexedDB). */
async function readTable(page, store) {
  return page.evaluate(async (storeName) => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('leonida-atlas');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  }, store);
}

async function seedEnrichment(page, row) {
  await page.evaluate(async (seed) => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('leonida-atlas');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('enrichments', 'readwrite');
      tx.objectStore('enrichments').put(seed);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, row);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[demo-e] pageerror:', String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[demo-e] console.error:', m.text().slice(0, 300));
});

try {
  // E1 — the button renders on the place card (explicit action only).
  await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, /Starlet Motel/);
  await waitForText(page, /Research this building/);
  let text = await bodyText(page);
  check(
    'E1 button renders on the place card',
    /Research this building/.test(text) && /uses your key, results are suggestions, not facts/.test(text),
    'button + honest label present before any tap; nothing auto-researched',
  );
  await scrollToResearch(page);
  await shot(page, 'e01-starlet-research-button');

  // E2 — no key: honest state, request queued, NO fake result.
  await page.getByRole('button', { name: 'Research this building', exact: true }).click();
  await waitForText(page, /needs your OpenAI key/);
  text = await bodyText(page);
  check(
    'E2 no-key honest state',
    /needs your OpenAI key/.test(text) && /queued for research/.test(text),
    'key message shown; no enrichment fields rendered',
  );
  check(
    'E2 no fake result',
    !/AI suggested/.test(text) && !/Last checked/.test(text),
    'no invented fields, no freshness line without a row',
  );
  const queued = await readTable(page, 'researchRequests');
  check(
    'E2 research request queued',
    queued.length === 1 && queued[0].targetType === 'location' && queued[0].targetId === 'L304' && queued[0].status === 'queued',
    `researchRequests rows: ${queued.length} (target ${queued[0]?.targetId ?? '—'})`,
  );
  await scrollToResearch(page);
  await shot(page, 'e02-no-key-queued');

  // Read the winning record's source title off the card, so the
  // seeded conflict names the real verified record.
  const sourceTitle = await page.evaluate(() => {
    const link = document.querySelector('.source-link');
    return link ? link.textContent.trim() : null;
  });
  console.log('winning source title:', sourceTitle);

  // E3 — seed a cached enrichment: 10 days old (fresh), 1 paid call,
  // tier-1 identity, a low-confidence purpose, a corroborated tier-2
  // loot field, and a conflicted tier-2 field naming the winner.
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  await seedEnrichment(page, {
    id: 'enr:L304:1',
    locationId: 'L304',
    schemaVersion: 1,
    researchedAt: tenDaysAgo,
    researchedBy: 'gpt-4o-mini',
    researchCalls: 1,
    question: null,
    imagery: [],
    fields: [
      {
        kind: 'identity',
        text: 'The Starlet Motel — a roadside motel on Historic Route 628.',
        confidence: 0.85,
        sources: [
          {
            title: 'GTADB collectibles guide',
            url: 'https://gtadb.net/guide/cards',
            quote: 'The Starlet Motel sits on Historic Route 628.',
          },
        ],
        status: 'ai-suggested',
      },
      {
        kind: 'purpose',
        text: 'Probably a motel with a pool.',
        confidence: 0.4,
        sources: [
          {
            title: 'GTADB collectibles guide',
            url: 'https://gtadb.net/guide/cards',
            quote: 'Starlet Motel, Kelly County.',
          },
        ],
        status: 'ai-suggested',
      },
      {
        kind: 'loot',
        text: 'A trading card on a reception table in Chapter 2.',
        confidence: 0.9,
        sources: [
          {
            title: 'GTADB collectibles guide',
            url: 'https://gtadb.net/guide/cards',
            quote: 'Reception table, Chapter 2.',
          },
          {
            title: 'PowerPyx guide',
            url: 'https://www.powerpyx.com/gta-6-guide/',
            quote: 'Starlet Motel card, reception.',
          },
        ],
        status: 'corroborated',
        corroboratedBy: 'PowerPyx guide',
      },
      {
        kind: 'vehicle-loot',
        text: 'The motel safe holds $50,000.',
        confidence: 0.85,
        sources: [
          {
            title: 'A guide',
            url: 'https://example.com/guide',
            quote: 'Safe behind the counter.',
          },
        ],
        status: 'conflicted',
        conflictWith: sourceTitle,
      },
    ],
  });
  await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, /Last checked/);
  text = await bodyText(page);
  check(
    'E3 freshness display renders from the cached row',
    /Last checked/.test(text) && /still fresh/.test(text),
    'researched 10 days ago (< 90) reads fresh',
  );
  check(
    'E3 call counter renders and reads 1',
    /Research calls for this building: 1/.test(text),
    'cached row served without spending a call',
  );
  check(
    'E3 tier-1 AI field renders labelled, low-confidence field is "wasn\'t sure"',
    /AI suggested · 0\.85/.test(text) && /AI wasn't sure about this/.test(text),
    'identity shown with label + confidence; 0.4 purpose shows no claim text',
  );
  check(
    'E3 tier-2 loot stays hidden until "Show gameplay details"',
    !/trading card on a reception table/.test(text),
    'loot not visible before the second explicit tap',
  );
  check(
    'E3 Conflicts row renders with both sides cited',
    /Conflicts/.test(text) &&
      /AI suggested “The motel safe holds \$50,000\.”/.test(text) &&
      (sourceTitle ? text.includes(sourceTitle) : false),
    `conflicted field quarantined; winner named: ${sourceTitle ?? '—'}`,
  );
  await scrollToResearch(page);
  await shot(page, 'e03-cached-fresh-conflicts');
  await page.getByRole('button', { name: 'Show gameplay details' }).click();
  await waitForText(page, /trading card on a reception table/);
  text = await bodyText(page);
  check(
    'E3b tier-2 reveals only after the explicit tap',
    /trading card on a reception table/.test(text) && /Corroborated · 0\.90/.test(text),
    'loot + corroborated label visible after tap',
  );
  await scrollToResearch(page);
  await shot(page, 'e04-tier2-revealed');
  await page.evaluate(() => {
    document.querySelector('.place-research-conflicts')?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(600);
  await shot(page, 'e04b-conflicts-row');

  // E4 — "Research again" with no key spends nothing: the counter
  // must still read 1 after the tap.
  await page.getByRole('button', { name: 'Research again', exact: true }).click();
  await waitForText(page, /needs your OpenAI key/);
  text = await bodyText(page);
  check(
    'E4 re-research without a key does not move the counter',
    /Research calls for this building: 1/.test(text),
    'still 1 after the keyless "Research again" tap',
  );
  const rows = await readTable(page, 'enrichments');
  check(
    'E4 cached row untouched in the store',
    rows.length === 1 && rows[0].researchCalls === 1,
    `enrichments rows: ${rows.length}, researchCalls: ${rows[0]?.researchCalls ?? '—'}`,
  );
  await scrollToResearch(page);
  await shot(page, 'e05-research-again-nokey');
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nDemo E: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
