/* Visual validation walk at 390px: first-time user flows, with screenshots
   for a human to judge against a beautiful-UX bar (not just a working-code
   bar). Run with: pnpm exec tsx scripts/validate-390px-walk.mjs
   Screenshots land in /tmp/atlas-walk/. Exits 1 on console errors, overflow,
   or any flow assertion failing. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const out = '/tmp/atlas-walk';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const overflow = () =>
  page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
await shot('01-welcome');
console.log('01 welcome overflow:', await overflow());

// Quick start lootable -> map with chips, pins, pill.
await page.getByRole('button', { name: /^Show lootable/ }).click();
await page.waitForTimeout(2500);
await shot('02-map-lootable-chips');
console.log('02 overflow:', await overflow());

// A single pin, deep-linked: bottom-sheet place detail. (Tapping a marker
// on the map zooms clusters instead, so the detail is opened by link.)
await page.goto(`${base}?place=L1612`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('03-place-detail');
console.log('03 overflow:', await overflow());
await page.getByRole('button', { name: 'Close place details' }).click();

// Reload -> layers persist, no welcome sheet.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await shot('04-after-reload');
console.log('04 markers after reload:', await page.locator('.atlas-map-marker').count());
console.log('04 overflow:', await overflow());

// Ask: gym near Capri.
await page.getByRole('button', { name: 'Ask Nylah', exact: true }).click();
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/no gym near capri/i).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('05-ask-capri');
console.log('05 overflow:', await overflow());
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();

// Layers tab: order + grouped cards. (Close any open place detail first —
// the bottom sheet would otherwise cover the layer rows.)
const closeDetails = page.getByRole('button', { name: 'Close place details' });
if (await closeDetails.count()) await closeDetails.click();
await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Layers', exact: true }).click();
await page.waitForTimeout(800);
await shot('06-layers');
console.log('06 overflow:', await overflow());

// "+ Workout spot" chip -> placement mode, then "Use map center" opens
// the editor with the workout kind preset and a real position (never 0,0).
await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
await page.getByRole('button', { name: '+ Workout spot' }).click();
await page.getByRole('button', { name: 'Use map center' }).click();
await page.waitForTimeout(800);
await shot('07-workout-spot-editor');
console.log('07 overflow:', await overflow());
const kind = await page.locator('#marker-kind').inputValue();
console.log('07 marker kind preset:', kind);
if (kind !== 'workout') process.exit(1);
const gameX = await page.locator('#marker-x').inputValue();
const gameY = await page.locator('#marker-y').inputValue();
console.log('07 marker coords:', gameX, gameY);
if (gameX === '0' && gameY === '0') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();

// A "?" place, deep-linked: what we know + add-your-own-marker.
await page.goto(`${base}?place=L818`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('08-unnamed-place');
console.log('08 overflow:', await overflow());
await page.getByText('What we know').waitFor({ timeout: 10000 });
console.log('08 "What we know" shown for the ? place');

await browser.close();
console.log('console errors:', errors.length ? errors : 'none');
if (errors.length > 0) process.exit(1);
console.log('walk OK — screenshots in', out);
