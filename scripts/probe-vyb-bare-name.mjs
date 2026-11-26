// Demo lane 5 — "VYB" bare-name Ask check (lane 2 fix f0dcdfd9f).
// The extended Ask probe covers Delight dancers / Delights / Jack of
// Hearts / flamingos live, but not VYB; VYB is covered in-suite by
// ask-nylah.test.ts ("a 3-letter bare name anchors too"). This probe
// confirms it live on the final build: bare "VYB" (layers off by
// default) must answer with the VYB place (L1453), not "Nothing in
// the map data". Fresh profile `demo-vyb`. Port 4330.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-vyb';
mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[vyb] pageerror:', String(e).slice(0, 300)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.waitForTimeout(900);
const input = page.locator('#ask-nylah-input');
await input.waitFor({ timeout: 15000 });
await input.click();
await input.fill('VYB');
await page.getByLabel('Send', { exact: true }).click();
await page.waitForTimeout(4000);
const panel = page.locator('section.ask-panel');
const full = await panel.innerText();
const idx = full.lastIndexOf('VYB');
const last = idx >= 0 ? full.slice(idx) : full;
console.log('--- VYB answer (last) ---');
console.log(last.slice(0, 1200));
await page.screenshot({ path: `${SHOTS}/vyb-bare-name.png` });
const ok =
  /VYB/.test(last) &&
  !/Nothing in the map data/i.test(last) &&
  !/turn a layer on/i.test(last);
console.log(`${ok ? 'PASS' : 'FAIL'} — bare "VYB" answers with the place, layers off — ${ok ? 'VYB place answered' : 'see above'}`);
await ctx.close();
process.exitCode = ok ? 0 : 1;
