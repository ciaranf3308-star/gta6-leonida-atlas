/* global document */
// Demo lane 5 — journal header reconciliation (lane 4 fix 42252b468).
// Reads the Collections journal header live on the final build and checks
// the numbers reconcile: "18 sets, 480 card slots in total" + "All lists
// 614 rows: the 480 slots, 117 extra game-text tiers, and 17 other
// collectibles" (614 = 480 + 62 + 55 + 17). Profile `demo-small` (seed
// restored by demo-small.mjs). Port 4330.
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';

const ctx = await chromium.launchPersistentContext('/home/hatch/.v032-profiles/demo-small', {
  headless: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[journal] pageerror:', String(e).slice(0, 300)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Collections', exact: true }).click();
await page.waitForTimeout(1500);
// The journal lives on the Collections tab (Journal section).
const text = await page.evaluate(() => document.body.innerText);
const header = (text.match(/18 sets[^\n]*/)?.[0] ?? 'MISSING header');
const allLists = (text.match(/All lists[^\n]*/)?.[0] ?? 'MISSING All-lists line');
const allFilter = (text.match(/All · \d+[^\n]*/)?.[0] ?? 'MISSING All filter');
console.log('header:', header);
console.log('all-lists:', allLists);
console.log('filter row:', allFilter);
await page.screenshot({ path: `${SHOTS}/j01-journal-header.png` });
const ok =
  /18 sets, 480 card slots in total/.test(text) &&
  /All lists 614 rows: the 480 slots, 117 extra game-text tiers, and 17 other collectibles/.test(text) &&
  /All · 614/.test(text);
console.log(`${ok ? 'PASS' : 'FAIL'} — journal header reconciles (480 slots / 614 rows + explanation present)`);
await ctx.close();
process.exitCode = ok ? 0 : 1;
