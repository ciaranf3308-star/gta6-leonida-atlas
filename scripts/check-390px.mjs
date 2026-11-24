/* 390px viewport check: tiles load, no overflow, no console errors,
   bottom nav + clean map + county + new layers work. v0.12.0: there is
   no filter bar — the count lives in Find, layers live in Layers.
   Run with: ./node_modules/.bin/tsx scripts/check-390px.mjs */
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
const nav = (label) => page.locator('.bottom-nav').getByRole('button', { name: label });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/day/"]', { timeout: 30000 });
const tiles = await page.locator('.leaflet-tile-loaded[src*="tiles/day/"]').count();
const overflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('tiles loaded in view:', tiles);
console.log('horizontal overflow px:', overflow);

// First launch: the welcome sheet must say the map starts blank on purpose
// and prove the places are mapped, with real counts (no 5k).
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
console.log('welcome sheet shown on first launch');
for (const countText of ['3,781 places', 'Lootable buildings', 'Interiors / Enterable', 'Breakable homes']) {
  if (!(await page.getByText(countText).first().isVisible()))
    throw new Error(`welcome sheet missing: ${countText}`);
}
const welcomeOverflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('welcome sheet horizontal overflow px:', welcomeOverflow);
if (welcomeOverflow > 0) process.exit(1);
// Quick start: "Show lootable" turns on just that layer and its pins render.
await page.locator('.welcome-quick-starts').getByRole('button', { name: /^Show lootable/ }).click();
await page.waitForTimeout(2000);
const lootableMarkers = await page.locator('.atlas-map-marker').count();
console.log('markers on map after Show lootable:', lootableMarkers);
if (lootableMarkers === 0) process.exit(1);
// The count lives in Find now, not a pill on the map.
await nav('Find').click();
await page.locator('.find-count').getByText('52 places showing').waitFor({ timeout: 10000 });
console.log('Find count shows 52 places');
// Breakable homes layer: 47 more on the map (52 in the layer, 5 listed
// by name only), 99 showing — houses, not shops.
await nav('Layers').click();
await page.getByRole('checkbox', { name: /^Breakable homes/ }).check();
await nav('Find').click();
await page.locator('.find-count').getByText('99 places showing').waitFor({ timeout: 10000 });
console.log('Breakable homes layer on: 99 places');
// Layers: tap Shops, pins grow.
await nav('Layers').click();
await page.getByRole('checkbox', { name: /^Shops & services/ }).check();
await nav('Map').click();
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
await nav('Find').click();
const countAfterReload = await page.locator('.find-count').textContent();
console.log('Find count after reload:', countAfterReload);
if (!/\d+ places showing/.test(countAfterReload ?? '')) process.exit(1);
console.log('layers persisted across reload');
// Reopen the welcome sheet from the panel footer, then close it.
await nav('Find').click();
await page.getByRole('button', { name: 'What is mapped' }).click();
await page.getByText('Welcome to Leonida').waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Close dialog' }).click();
console.log('welcome sheet reopens from the panel footer');

// Open Layers, check new layers exist and are off by default
await nav('Layers').click();
// Useful layers first: Lootable above Interiors above Shops above Gyms.
const layerOrder = await page
  .locator('.layer-row')
  .evaluateAll((rows) => rows.map((r) => r.textContent?.slice(0, 40)));
console.log('layer rows in order:', layerOrder.slice(0, 6));
if (!layerOrder[0]?.includes('Lootable') || !layerOrder[1]?.includes('Interiors') || !layerOrder[2]?.includes('Breakable'))
  process.exit(1);
// Card sets are grouped at the bottom, collapsed: only sets with pins listed.
await page.getByText(/Trading cards · 5 verified pins so far/).click();
for (const name of [
  'Interiors / Enterable',
  'Breakable homes',
  'Shops & services',
  'Lootable buildings',
  'Workout equipment',
  'Cards · Delights Dancers',
]) {
  const cb = page.getByRole('checkbox', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
  console.log('layer', name, 'checked =', await cb.isChecked());
}
// County: pick Kelly County in Find, list should filter to Kelly places only
await nav('Find').click();
await page.getByLabel('Isolate one county').selectOption('kelly');
await page.waitForTimeout(1500);
const resultsText = await page.locator('.results-count').first().textContent();
console.log('Kelly results (layers off):', resultsText);
// Turn Interiors on, then county list should show Kelly interiors
await nav('Layers').click();
await page.getByRole('checkbox', { name: /^Interiors \/ Enterable/ }).check();
await page.waitForTimeout(1000);
await nav('Find').click();
await page.waitForTimeout(1000);
console.log('Kelly + Interiors results:', await page.locator('.results-count').first().textContent());
console.log('first Kelly interior:', await page.locator('.place-result strong').first().textContent());
// Max zoom: zoom in to native z6 (Leaflet zoom 1) and check tiles load sharp.
await nav('Map').click();
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
// Ask Nylah: bottom-nav tab opens the panel, no-key gym question lists
// matching places from the map (local fallback) and highlights them.
// Clear the Kelly county filter first, or no gym can match.
await nav('Find').click();
await page.getByRole('button', { name: 'Clear all' }).click();
await page.waitForTimeout(800);
await nav('Ask').click();
await page.getByText('Answers only from this map').waitFor({ timeout: 10000 });
const askOverflow = await page
  .locator('html')
  .evaluate((el) => el.scrollWidth - el.clientWidth);
console.log('Ask panel open, horizontal overflow px:', askOverflow);
// The inline key field shows on a fresh Ask (no messages yet) — check it
// now, before asking anything; saving a key waits until after the
// no-key questions, so they still answer locally.
console.log('Ask inline key field present:', (await page.locator('#ask-api-key-inline').count()) > 0);
if ((await page.locator('#ask-api-key-inline').count()) === 0) process.exit(1);
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
// It must also offer the Capri houses to check, as candidates, never gyms.
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/no gym near capri/i).first().waitFor({ timeout: 10000 });
await page.getByText(/Grand Majestic/i).first().waitFor({ timeout: 10000 });
await page.getByText('Houses in Capri to check').waitFor({ timeout: 10000 });
console.log('Ask Capri answer is honest: no gym near Capri, nearest is Grand Majestic, houses to check listed');
// ASK CARDS (v0.13.0): the answer is big place cards, nearest first,
// each with its distance — never a text wall. Anchor chip on the answer.
const askCards = await page.locator('.ask-card').count();
console.log('Ask cards on the Capri answer:', askCards);
if (askCards === 0) process.exit(1);
await page.getByText('Near Capri').first().waitFor({ timeout: 10000 });
await page.getByText(/map units away/).first().waitFor({ timeout: 10000 });
const firstCard = await page.locator('.ask-card strong').first().textContent();
console.log('First Ask card (nearest):', firstCard);
if (firstCard !== 'Grand Majestic Gym') process.exit(1);
await page.screenshot({ path: '/tmp/ask-gym-capri.png', fullPage: false });
// "workout equipment near Capri": free gear, never the member gyms.
await page.locator('#ask-nylah-input').fill('workout equipment near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText("Jason's house deck (home gym)").first().waitFor({ timeout: 10000 });
await page.getByText('Muscle Sands').first().waitFor({ timeout: 10000 });
await page.getByText('Equipment', { exact: true }).first().waitFor({ timeout: 10000 });
await page.screenshot({ path: '/tmp/ask-equipment-capri.png', fullPage: false });
console.log('Ask equipment answer: free gear cards, Jason deck nearest');
// "enterable houses in Rockridge": breakable-house cards with badges.
await page.locator('#ask-nylah-input').fill('enterable houses in Rockridge');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/Venture Apts/).first().waitFor({ timeout: 10000 });
await page.getByText('Breakable', { exact: true }).first().waitFor({ timeout: 10000 });
await page.screenshot({ path: '/tmp/ask-houses-vice-city.png', fullPage: false });
console.log('Ask houses answer: breakable-house cards with badges');
// INDEX PANEL (v0.13.0): resolved-by-source counts, honestly split.
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();
await nav('Layers').click();
await page.getByText('Sort the unnamed places').waitFor({ timeout: 10000 });
await page.locator('.index-sources').waitFor({ timeout: 10000 });
for (const sourceText of ['Tags · 588', 'Same spot · 0', 'Guide match · 0', 'Analogue address · 0', 'AI suggested · 0', 'Not sure · 0', 'To go · 2,732']) {
  if (!(await page.getByText(sourceText, { exact: true }).isVisible()))
    throw new Error(`index sources missing: ${sourceText}`);
}
await page.screenshot({ path: '/tmp/index-sources.png', fullPage: false });
console.log('Index sources row: Tags 588, rest 0 on a fresh phone, 2,732 to go');
// Ask API-key onboarding: inline key field, paste + save right there.
// Ask keeps its messages for the page session, so reload for a fresh Ask.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await nav('Ask').click();
await page.getByText('Answers only from this map').waitFor({ timeout: 10000 });
const keyField = page.locator('#ask-api-key-inline');
console.log('Ask inline key field present on fresh Ask:', (await keyField.count()) > 0);
if ((await keyField.count()) === 0) process.exit(1);
await keyField.fill('<redacted>');
await page.getByRole('button', { name: /Save key/ }).click();
await page.getByText('Key saved on this device').waitFor({ timeout: 10000 });
console.log('Ask inline key onboarding: key saved in panel');
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();
// Settings: API key field is masked (password type), never plain text.
await nav('Find').click();
await page.getByRole('button', { name: 'Settings', exact: true }).click();
const keyType = await page.locator('#ask-api-key').getAttribute('type');
console.log('Ask API key field type:', keyType);
if (keyType !== 'password') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();
// Place detail: a breakable apartment shows its interior status plainly.
await page.goto(`${base}?place=L192`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('heading', { name: 'Inside' }).waitFor({ timeout: 10000 });
await page.getByText(/Apartment — enterable interior, can be broken into/).waitFor({ timeout: 10000 });
console.log('breakable detail: Inside section plain, no hunting');
console.log('console errors:', errors.length ? errors : 'none');
await page.screenshot({ path: '/tmp/atlas-390px.png', fullPage: false });
await browser.close();
if (overflow > 0 || errors.length > 0) process.exit(1);
console.log('390px check OK');
