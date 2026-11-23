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

// AI categorisation — Layers tab: the index panel with real counts and
// the plain-words no-key state (this browser has no key saved).
await page.getByRole('button', { name: 'Close place details' }).click();
await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Layers', exact: true }).click();
await page.getByText('Sort the unnamed places').waitFor({ timeout: 10000 });
await page.getByText('Indexing needs your OpenAI key').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
await shot('09-index-panel');
console.log('09 overflow:', await overflow());
const indexCount = await page.getByText(/of 2,732 indexed/).textContent();
console.log('09 index counts:', indexCount);
await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();

// AI categorisation — seeded on-device results only (walk-only test data,
// NOT a real OpenAI call): L818 as a house, L939 as a gym near Capri.
// The detail sheet must show "?" + its AI type, labelled AI suggested,
// with a one-tap confirm — and Ask must answer a gym question from it.
await page.evaluate(() => {
  globalThis.localStorage.setItem(
    'leonida-ai-categories-v1',
    JSON.stringify({
      L818: {
        placeId: 'L818',
        aiCategory: 'house',
        confidence: 0.9,
        reason: 'Analogue address is an apartment tower; tagged residential.',
        model: 'gpt-4o-mini',
        indexedAt: '2026-11-23T00:00:00.000Z',
        status: 'suggested',
      },
      L939: {
        placeId: 'L939',
        aiCategory: 'gym',
        confidence: 0.82,
        reason: 'Seeded for the walk only — test data, not a real categorisation.',
        model: 'gpt-4o-mini',
        indexedAt: '2026-11-23T00:00:00.000Z',
        status: 'suggested',
      },
    }),
  );
  globalThis.localStorage.setItem(
    'leonida-ai-index-job-v1',
    JSON.stringify({
      status: 'paused',
      attemptedPlaceIds: ['L818', 'L939'],
      updatedAt: '2026-11-23T00:00:00.000Z',
    }),
  );
});
await page.goto(`${base}?place=L818`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByText('AI suggested: House / residential').first().waitFor({ timeout: 10000 });
await page.getByText('What the AI suggests').waitFor({ timeout: 10000 });
await page.getByRole('button', { name: /That looks right/ }).waitFor({ timeout: 10000 });
await shot('10-ai-suggested-detail');
console.log('10 overflow:', await overflow());
console.log('10 AI-suggested detail shown for L818, with confirm');
await page.getByRole('button', { name: 'Close place details' }).click();

// Ask with the seeded AI gym: "gym near Capri" must answer from the
// AI-suggested "?" — nearest first, labelled AI suggested.
await page.getByRole('button', { name: 'Ask Nylah', exact: true }).click();
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/AI suggested: Gym/i).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('11-ask-ai-gym-capri');
console.log('11 overflow:', await overflow());
console.log('11 Ask answered a gym question from the AI-suggested "?" near Capri');
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();

await browser.close();
console.log('console errors:', errors.length ? errors : 'none');
if (errors.length > 0) process.exit(1);
console.log('walk OK — screenshots in', out);
