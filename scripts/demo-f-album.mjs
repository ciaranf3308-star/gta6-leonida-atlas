/* global document */
// Demo F probe (v0.32 step 9, Demo F lane): Album view + screenshot-match
// UI at 390px / DPR 2, against the production build served from vite
// preview on port 4338 with ATLAS_BASE_PATH=/gta6-leonida-atlas/.
//
// Steps: Collections -> Album toggle -> Delights Dancers set -> collect
// Vicki via the album checkbox (real write, same completion log) ->
// flip/sold state -> "Add from screenshot" sheet -> no-key honest state
// -> upload a real PNG -> preview + "Save photo only" (Match stays off
// with no key; nothing is faked).
// No OpenAI key exists in this sandbox, so the match itself is
// key-blocked by design — the probe proves the honest no-key state,
// not a match.
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BASE = 'http://127.0.0.1:4338/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-f-album';
mkdirSync(SHOTS, { recursive: true });
mkdirSync(PROFILE, { recursive: true });

// Minimal valid 120x120 PNG (solid teal) — same builder as demo-f-upload.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const W = 120, H = 120;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const o = y * (1 + W * 3) + 1 + x * 3;
    raw[o] = 0x2e; raw[o + 1] = 0x7d; raw[o + 2] = 0x5b;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
const pngPath = `${PROFILE}/test-photo.png`;
writeFileSync(pngPath, png);
console.log('test png bytes:', png.length);

async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: p });
  console.log('shot:', p);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[F] console.error:', m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('[F] pageerror:', String(e).slice(0, 300)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await shot(page, 'f10-home');

// Collections tab -> Album toggle.
await page.getByRole('button', { name: 'Collections', exact: true }).first().click();
await page.waitForTimeout(1200);
const albumBtn = page.getByRole('button', { name: 'Album', exact: true }).first();
console.log('Album toggle present:', await albumBtn.count());
await albumBtn.click();
await page.waitForTimeout(1000);
await shot(page, 'f11-album');
const albumText = await page.evaluate(() => document.body.innerText);
console.log('Album header present:', albumText.includes('All 480 cards'));
console.log('Album filters present:', ['All · 480', 'Found · 0', 'Sold · 0'].every((s) => albumText.includes(s)));

// Open the Delights Dancers set.
const delights = page.locator('details.album-set summary', { hasText: 'Delights Dancers' }).first();
console.log('Delights set present:', await delights.count());
await delights.click();
await page.waitForTimeout(800);
await shot(page, 'f12-album-delights');
const delightsText = await page.evaluate(() => document.body.innerText);
console.log('Delights cover 0/18:', delightsText.includes('0 / 18 found'));

// Collect Vicki via the album checkbox (real write, same log as the journal).
const vickiBox = page.getByRole('checkbox', { name: /Mark Vicki \(Standard\) as collected/i }).first();
console.log('Vicki checkbox present:', await vickiBox.count());
await vickiBox.click();
await page.waitForTimeout(1500);
await shot(page, 'f13-album-vicki-collected');
const afterText = await page.evaluate(() => document.body.innerText);
console.log('Album now 1 found:', afterText.includes('1 found'));
console.log('Vicki Collected line:', afterText.includes('Collected ✓'));
console.log('Flip card affordance:', afterText.includes('Flip card'));
console.log('Honest empty art slot:', afterText.includes('No licensed artwork yet'));

// Flip Vicki to the back — sold controls live there.
const flipBtn = page.getByRole('button', { name: 'Flip card' }).first();
console.log('Flip button present:', await flipBtn.count());
await flipBtn.click();
await page.waitForTimeout(700);
await shot(page, 'f14-album-vicki-flipped');
const flippedText = await page.evaluate(() => document.body.innerText);
console.log('Mark as sold present:', flippedText.includes('Mark as sold'));

// Screenshot-match sheet: no-key honest state.
const addShot = page.getByRole('button', { name: 'Add from screenshot' }).first();
await addShot.click();
await page.waitForTimeout(800);
await shot(page, 'f15-screenshot-sheet-nokey');
const sheetText = await page.evaluate(() => document.body.innerText);
console.log('No-key honest note:', sheetText.includes('Matching needs your OpenAI key'));
console.log('Match button disabled (no key):', await page.getByRole('button', { name: 'Match this screenshot' }).isDisabled().catch(() => 'no-button-yet'));

// Upload a real photo -> preview + Save photo only (Match stays off).
const fileInput = page.locator('input.screenshot-match-file');
await fileInput.setInputFiles(pngPath);
await page.waitForTimeout(1200);
await shot(page, 'f16-screenshot-uploaded');
const uploadedText = await page.evaluate(() => document.body.innerText);
console.log('Preview rendered:', (await page.locator('img.screenshot-match-preview').count()) === 1);
console.log('Save photo only offered:', uploadedText.includes('Save photo only'));
const matchBtn = page.getByRole('button', { name: 'Match this screenshot' });
console.log('Match button present after upload:', await matchBtn.count());
console.log('Match button disabled after upload (no key):', await matchBtn.isDisabled());

// Save the photo on-device (no key needed for that).
await page.getByRole('button', { name: 'Save photo only' }).click();
await page.waitForTimeout(1000);
const savedText = await page.evaluate(() => document.body.innerText);
console.log('Photo saved note:', savedText.includes('Saved on this device') || savedText.includes('Saved as your photo'));
await shot(page, 'f17-screenshot-saved');

// Close the sheet; the album still shows Vicki collected (same log).
await page.getByRole('button', { name: 'Close' }).first().click();
await page.waitForTimeout(700);
const finalText = await page.evaluate(() => document.body.innerText);
console.log('Still 1 found after sheet close:', finalText.includes('1 found'));
await ctx.close();
console.log('PROBE DONE');
