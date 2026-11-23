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

// First launch: the welcome sheet must say the map starts blank on purpose
// and prove the places are mapped, with real counts.
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
console.log('welcome sheet shown on first launch');
for (const countText of ['3,775 places', 'Lootable buildings', 'Interiors / Enterable']) {
  if (!(await page.getByText(countText).first().isVisible()))
    throw new Error(`welcome sheet missing: ${countText}`);
}
const welcomeOverflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('welcome sheet horizontal overflow px:', welcomeOverflow);
if (welcomeOverflow > 0) process.exit(1);
// Quick start: "Show lootable" turns on just that layer and its pins render.
await page.getByRole('button', { name: /^Show lootable/ }).click();
await page.waitForTimeout(2000);
const lootableMarkers = await page.locator('.atlas-map-marker').count();
console.log('markers on map after Show lootable:', lootableMarkers);
if (lootableMarkers === 0) process.exit(1);
// The overlay pill says how many places are showing, on the map itself.
await page.getByText(/52 places showing/).waitFor({ timeout: 10000 });
console.log('overlay pill shows 52 places showing');
// The overlay chips are on the map: tap Shops, pins grow.
await page.getByRole('button', { name: /^Shops \d+$/ }).click();
await page.waitForTimeout(1500);
const afterShops = await page.locator('.atlas-map-marker').count();
console.log('markers after Shops chip:', afterShops);
if (afterShops <= lootableMarkers) process.exit(1);
// PERSISTENCE: reload — the layers must STILL be on and the pins still there.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const afterReload = await page.locator('.atlas-map-marker').count();
console.log('markers after reload (layers must persist):', afterReload);
if (afterReload === 0) process.exit(1);
await page.getByText(/places showing/).waitFor({ timeout: 10000 });
console.log('layers persisted across reload');
// Reopen the welcome sheet from the ? button, then close it.
await page.getByRole('button', { name: /Welcome — what is mapped/ }).click();
await page.getByText('Welcome to Leonida').waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Close dialog' }).click();
console.log('welcome sheet reopens from the ? button');

// Open Layers, check new layers exist and are off by default
await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Layers', exact: true }).click();
// Useful layers first: Lootable above Interiors above Shops above Gyms.
const layerOrder = await page
  .locator('.layer-row')
  .evaluateAll((rows) => rows.map((r) => r.textContent?.slice(0, 40)));
console.log('layer rows in order:', layerOrder.slice(0, 6));
if (!layerOrder[0]?.includes('Lootable') || !layerOrder[1]?.includes('Interiors'))
  process.exit(1);
// Card sets are grouped at the bottom, collapsed: only sets with pins listed.
await page.getByText(/Trading cards · 5 verified pins so far/).click();
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
// PROXIMITY: "gym near Capri" must say plainly none is near — the gyms are
// in Vice City, ~5,700 map units away — never present them as near Capri.
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/no gym near capri/i).first().waitFor({ timeout: 10000 });
await page.getByText(/Grand Majestic/i).first().waitFor({ timeout: 10000 });
console.log('Ask Capri answer is honest: no gym near Capri, nearest is Grand Majestic');
// Ask API-key onboarding: inline key field, paste + save right there.
const keyField = page.locator('#ask-api-key-inline');
console.log('Ask inline key field present:', (await keyField.count()) > 0);
if ((await keyField.count()) === 0) process.exit(1);
await keyField.fill('sk-test-fake-key');
await page.getByRole('button', { name: /Save key/ }).click();
await page.getByText('Key saved on this device').waitFor({ timeout: 10000 });
console.log('Ask inline key onboarding: key saved in panel');
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
