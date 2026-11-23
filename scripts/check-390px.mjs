/* 390px viewport check for v2: tiles load, no overflow, no console errors,
   county picker + new layers work. Run with: pnpm exec tsx scripts/check-390px.mjs */
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/day/"]', { timeout: 30000 });
const tiles = await page.locator('.leaflet-tile-loaded[src*="tiles/day/"]').count();
const overflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('tiles loaded in view:', tiles);
console.log('horizontal overflow px:', overflow);

// Open Layers, check new layers exist and are off by default
await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Layers', exact: true }).click();
for (const name of [
  'Interiors / Enterable',
  'Shops & services',
  'Lootable buildings',
  'Free outdoor equipment',
  'Cards · Delights Dancers',
]) {
  const cb = page.getByRole('checkbox', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
  console.log('layer', name, 'checked =', await cb.isChecked());
}
// County picker: tap Kelly County, list should filter to Kelly places only
await page.getByRole('button', { name: /^Kelly County/ }).click();
await page.getByRole('button', { name: 'Explore', exact: true }).click();
await page.waitForTimeout(1500);
const resultsText = await page.locator('.results-count').first().textContent();
console.log('Kelly results (layers off):', resultsText);
// Turn Interiors on, then county list should show Kelly interiors
await page.getByRole('button', { name: 'Layers', exact: true }).click();
await page.getByRole('checkbox', { name: /^Interiors \/ Enterable/ }).check();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Explore', exact: true }).click();
await page.waitForTimeout(1000);
console.log('Kelly + Interiors results:', await page.locator('.results-count').first().textContent());
console.log('first Kelly interior:', await page.locator('.place-result strong').first().textContent());
// Max zoom: zoom in to native z6 (Leaflet zoom 1) and check tiles load sharp.
await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
for (let i = 0; i < 16; i++) {
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  if (await zoomIn.isDisabled()) break;
  await zoomIn.click();
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1500);
const zoomedTiles = await page.locator('.leaflet-tile-loaded[src*="tiles/day/6/"]').count();
const tileWidth = zoomedTiles
  ? await page
      .locator('.leaflet-tile-loaded[src*="tiles/day/6/"]')
      .first()
      .evaluate((img) => img.naturalWidth)
  : 0;
console.log('z6 tiles loaded at max zoom:', zoomedTiles, 'naturalWidth:', tileWidth);
// Ask Nylah: fab opens the panel, no-key gym question lists matching
// places from the map (local fallback) and highlights them — gyms off.
await page.getByRole('button', { name: 'Ask Nylah', exact: true }).click();
await page.getByText('Answers only from this map').waitFor({ timeout: 10000 });
const askOverflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('Ask panel open, horizontal overflow px:', askOverflow);
await page.locator('#ask-nylah-input').fill('Where can I train?');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText('Dynamix Fitness').first().waitFor({ timeout: 10000 });
await page.waitForTimeout(2500); // answer pans the map to the highlights
const highlighted = await page.locator('.atlas-map-marker.is-highlighted').count();
console.log('Ask highlights on map:', highlighted);
console.log('Ask overflow px:', askOverflow);
if (askOverflow > 0 || highlighted === 0) process.exit(1);
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();
// Settings: API key field is masked (password type), never plain text.
await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Settings', exact: true }).click();
const keyType = await page.locator('#ask-api-key').getAttribute('type');
console.log('Ask API key field type:', keyType);
if (keyType !== 'password') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();
console.log('console errors:', errors.length ? errors : 'none');
await page.screenshot({ path: '/tmp/atlas-390px.png', fullPage: false });
await browser.close();
if (overflow > 0 || errors.length > 0) process.exit(1);
console.log('390px check OK');
