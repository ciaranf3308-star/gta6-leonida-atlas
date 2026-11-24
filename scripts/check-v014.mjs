/* global localStorage */
/* v0.14.0 walk at 390px: the user walks it as a player, not a tester.
 * Fresh profile, first launch:
 *   (a) the empty map says so in plain words — screenshot it — then one
 *       tap on "Show interiors" and pins appear;
 *   (b) a Find card is minimal (blip, name, area, distance, badges —
 *       no essay, no "AI suggested" line on the card);
 *   (c) an Ask answer is a short verdict + clean cards;
 *   (d) the Index panel shows the not-sure places re-queued for
 *       re-scan with the new prompt (seeded v1 job);
 *   (e) Capri isolated on the map — the rest dimmed, Capri named, one
 *       big "Show all of Leonida" exit.
 * Screenshots land in /tmp/atlas-walk-v014/. Exits 1 on console errors,
 * overflow, or any flow assertion failing.
 * Run with: ./node_modules/.bin/tsx scripts/check-v014.mjs
 * (preview server must be running: ATLAS_BASE_PATH=/gta6-leonida-atlas/
 *  vite preview --host 127.0.0.1 --port 4330) */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const out = '/tmp/atlas-walk-v014';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const nav = (label) => page.locator('.bottom-nav').getByRole('button', { name: label });
const overflow = () =>
  page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);
function fail(message) {
  throw new Error(message);
}

// Seed a v1 index job BEFORE the app loads: one "not sure" place (L939)
// and one confident place (L4), both marked attempted under resolver
// v1. On load the v3 migration must re-queue L939 and say so.
await page.addInitScript(() => {
  const now = new Date().toISOString();
  localStorage.setItem(
    'leonida-ai-categories-v1',
    JSON.stringify({
      L939: {
        placeId: 'L939',
        aiCategory: 'house',
        confidence: 0.4,
        reason: 'Not sure.',
        model: 'test',
        indexedAt: now,
        status: 'unsure',
        source: 'ai',
      },
      L4: {
        placeId: 'L4',
        aiCategory: 'house',
        confidence: 0.95,
        reason: 'Tagged residential.',
        model: 'test',
        indexedAt: now,
        status: 'suggested',
        source: 'tag',
      },
    }),
  );
  localStorage.setItem(
    'leonida-ai-index-job-v1',
    JSON.stringify({
      status: 'done',
      attemptedPlaceIds: ['L939', 'L4'],
      resolverVersion: 1,
      updatedAt: now,
    }),
  );
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/day/"]', { timeout: 30000 });

// First launch: the forced onboarding. Skip it — the map must then
// explain itself instead of sitting empty.
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /Skip for now/ }).click();

// (a) Empty state: big plain-words prompt ON the map, with the four
// one-tap buttons — not a bare empty map.
await page.locator('.empty-map-prompt').waitFor({ timeout: 10000 });
const promptText = await page.locator('.empty-map-prompt').innerText();
console.log('empty-map prompt:', JSON.stringify(promptText.slice(0, 120)));
if (!/nothing showing yet/i.test(promptText)) fail('empty-map prompt missing its headline');
for (const label of ['Show interiors', 'Show lootable', 'Show shops', 'Show everything']) {
  if (!(await page.locator('.empty-map-prompt').getByRole('button', { name: label }).isVisible()))
    fail(`empty-map prompt missing button: ${label}`);
}
if ((await page.locator('.atlas-map-marker').count()) !== 0)
  fail('map should show 0 pins before any layer is turned on');
await shot('a-empty-map');
if ((await overflow()) > 0) fail('horizontal overflow on the empty map');

// One tap: pins appear immediately, and the map says how many.
await page.locator('.empty-map-prompt').getByRole('button', { name: 'Show interiors' }).click();
await page.waitForSelector('.atlas-map-marker', { timeout: 10000 });
await page.waitForTimeout(1500);
const markers = await page.locator('.atlas-map-marker').count();
console.log('markers after Show interiors:', markers);
if (markers === 0) fail('no pins appeared after Show interiors');
await page.locator('.map-showing-count').waitFor({ timeout: 10000 });
const showing = await page.locator('.map-showing-count').innerText();
console.log('map showing count:', JSON.stringify(showing));
if (!/places showing/.test(showing)) fail('map does not say how many places are showing');
await shot('a-pins-after-tap');

// (b) Find: a clean minimal card — no essay, no "AI suggested" line.
await nav('Find').click();
await page.locator('.place-result').first().waitFor({ timeout: 10000 });
const firstCard = page.locator('.place-result').first();
const cardText = await firstCard.innerText();
console.log('first Find card:', JSON.stringify(cardText));
if (/AI suggested|from its tags|Unverified|approximate/i.test(cardText))
  fail(`Find card still reads as an essay: ${JSON.stringify(cardText)}`);
if (cardText.split('\n').filter(Boolean).length > 4)
  fail(`Find card has too many lines: ${JSON.stringify(cardText)}`);
await firstCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot('b-find-card');

// (c) Ask: a short verdict, then clean cards.
await nav('Ask').click();
await page.locator('#ask-nylah-input').fill('Where is the nearest gym to Vice City?');
await page.locator('.ask-form button[type="submit"]').click();
await page.locator('.ask-card').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);
const askCardText = await page.locator('.ask-card').first().innerText();
console.log('first Ask card:', JSON.stringify(askCardText));
if (/AI suggested|AI ·/i.test(askCardText)) fail(`Ask card carries an AI line: ${JSON.stringify(askCardText)}`);
const verdict = await page.locator('.ask-summary').last().innerText();
console.log('Ask verdict:', JSON.stringify(verdict));
if (verdict.split(/(?<=[.!])\s+/).filter(Boolean).length > 2)
  fail(`Ask verdict is more than two sentences: ${JSON.stringify(verdict)}`);
await shot('c-ask-cards');

// (d) Index panel: the not-sure place re-queued with the new prompt.
await nav('Layers').click();
await page.locator('.index-requeue').waitFor({ timeout: 10000 });
const requeueText = await page.locator('.index-requeue').innerText();
console.log('index requeue:', JSON.stringify(requeueText));
if (!/1 not-sure place re-queued for re-scan with the new prompt/.test(requeueText))
  fail(`re-queue banner wrong: ${JSON.stringify(requeueText)}`);
const toGo = await page.locator('.index-sources').innerText();
console.log('index sources:', JSON.stringify(toGo));
if (!/to go · 2,731/i.test(toGo)) fail(`index panel To go count wrong: ${JSON.stringify(toGo)}`);
await page.locator('#index-panel').scrollIntoViewIfNeeded();
await shot('d-index-requeue');

// (e) Capri isolated: pick the area in Find, back on the map the rest
// is dimmed, Capri is named, and the exit is one big button.
await nav('Find').click();
const areaSelect = page.locator('select[aria-label="Isolate one town, city or area"]');
await areaSelect.waitFor({ timeout: 10000 });
const capriValue = await areaSelect.evaluate((el) => {
  const option = [...el.options].find((o) => o.text.startsWith('Capri'));
  return option ? option.value : null;
});
if (!capriValue) fail('Area picker has no Capri option');
await areaSelect.selectOption(capriValue);
await nav('Map').click();
await page.locator('.isolation-banner').waitFor({ timeout: 10000 });
// Interiors has nothing in Capri, so the map honestly says so instead
// of pretending nothing is turned on — "Show everything" from that
// card, and Capri's own pins appear inside the lit area.
const nothingHere = page.locator('.empty-map-prompt');
if (await nothingHere.isVisible()) {
  const nothingText = await nothingHere.innerText();
  if (/nothing is turned on yet/i.test(nothingText))
    fail('Capri isolation shows the wrong empty prompt — layers are on');
  await nothingHere.getByRole('button', { name: 'Show everything' }).click();
  await page.waitForSelector('.atlas-map-marker', { timeout: 10000 });
}
await page.waitForTimeout(1500);
const bannerText = await page.locator('.isolation-banner').innerText();
console.log('isolation banner:', JSON.stringify(bannerText));
if (!/capri/i.test(bannerText)) fail('isolation banner does not name Capri');
if (!/show all of leonida/i.test(bannerText)) fail('isolation banner has no exit');
// The dim mask is a Leaflet polygon over the map (dark fill, hole cut out).
const maskPaths = await page.locator('.leaflet-overlay-pane path').count();
console.log('overlay paths (mask + outline):', maskPaths);
if (maskPaths < 2) fail('no dim mask on the map during isolation');
await page.waitForTimeout(1500);
await shot('e-capri-isolated');
// Exit: one tap, back to all of Leonida.
await page.locator('.isolation-banner').getByRole('button', { name: 'Show all of Leonida' }).click();
await page.waitForTimeout(1000);
if ((await page.locator('.isolation-banner').count()) !== 0)
  fail('isolation banner still there after Show all of Leonida');
await shot('e-show-all');

if ((await overflow()) > 0) fail('horizontal overflow at the end of the walk');
if (errors.length > 0) fail(`console/page errors: ${errors.join(' | ')}`);
console.log('v0.14.0 walk passed — 5 screenshots in', out);
await browser.close();
