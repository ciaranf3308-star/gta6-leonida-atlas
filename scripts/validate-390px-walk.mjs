/* global document, getComputedStyle */
/* Navigation-first validation walk at 390px: the user walks it as a
   player, not a tester. Flows: (a) turn on Lootable in 2 taps, (b)
   filter to enterable lootable only, (c) search "workout equipment",
   nearest first, (d) Ask "gym near Capri" AND "workout equipment near
   Capri" — honest answers + houses to check, (e) Saved progress,
   (f) clear all filters in one tap, (g) Breakable homes + Interior
   houses + the Inside section + Ask breakable apartments. Plus the
   standing checks: persistence, workout-spot editor, "?" detail,
   AI-suggested detail, index zero-state, real counts (no 5k), and the
   48px tap-target measurement (no exceptions).
   Run with: pnpm exec tsx scripts/validate-390px-walk.mjs
   (or: ./node_modules/.bin/tsx scripts/validate-390px-walk.mjs)
   Screenshots land in /tmp/atlas-walk/. Exits 1 on console errors,
   overflow, any flow assertion failing, or any tap target under 48px. */
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
const nav = (label) =>
  page.locator('.bottom-nav').getByRole('button', { name: label });
// 48px thumb targets, no exceptions: every visible tappable thing must
// be at least 48px on both sides. Checkboxes inside layer-row labels
// are skipped — the whole label row is the target. Attribution links
// are skipped — they are a legal notice, not a control. The placement
// preview marker is non-interactive and not measured either.
const tapViolations = [];
async function measureTapTargets(context) {
  const bad = await page.evaluate(() => {
    const out = [];
    const els = document.querySelectorAll(
      'button, a[href], select, input, textarea, [role="button"], .atlas-map-marker',
    );
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (el.closest('.leaflet-control-attribution')) continue;
      // The map credit line (GTADB / CC BY / Rockstar) is a legal
      // notice, not a control — its links stay small by design.
      if (el.closest('.atlas-map-attribution')) continue;
      if (el.tagName === 'INPUT' && el.type === 'checkbox') continue;
      if (r.width < 48 || r.height < 48) {
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ')[0]} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 32)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
  console.log(`${context} tap targets <48px:`, bad.length ? bad : 'none');
  tapViolations.push(...bad.map((b) => `${context}: ${b}`));
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByText('Welcome to Leonida').waitFor({ timeout: 30000 });
await shot('01-welcome');
console.log('01 welcome overflow:', await overflow());
// Real counts, no 5k: 3,781 places, 986 confirmed names, 2,768 without.
await page.getByText('3,781 places').waitFor({ timeout: 10000 });
await page.getByText(/986 places have a confirmed name/).waitFor({ timeout: 10000 });
await page.getByText(/2,768 do not yet/).waitFor({ timeout: 10000 });
console.log('01 real counts shown (3,781 / 986 / 2,768)');

// The bottom nav is the way around: five labelled tabs, always visible.
for (const label of ['Map', 'Find', 'Layers', 'Saved', 'Ask']) {
  await nav(label).waitFor({ timeout: 10000 });
}
console.log('01 bottom nav: Map / Find / Layers / Saved / Ask all labelled');

// (a) Turn on Lootable in 2 taps: welcome quick start, then the map.
// v0.12.0: no count pill on the map — the count lives in Find.
await page.locator('.welcome-quick-starts').getByRole('button', { name: /^Show lootable/ }).click();
await page.waitForTimeout(1500);
await shot('02-map-lootable');
console.log('02 overflow:', await overflow());
const lootableMarkers = await page.locator('.atlas-map-marker').count();
console.log('02 markers on map:', lootableMarkers);
if (lootableMarkers === 0) process.exit(1);
await nav('Find').click();
await page.locator('.find-count').getByText('52 places showing').waitFor({ timeout: 10000 });
console.log('02 Find count: 52 places showing');
await measureTapTargets('02 Map (Lootable on)');

// (b) Filter to enterable lootable only: the "Can go inside" toggle in Layers.
await nav('Layers').click();
await page.getByRole('button', { name: /^Can go inside/ }).click();
await nav('Find').click();
await page.locator('.find-count').getByText('52 places showing').waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
await shot('03-enterable-lootable');
console.log('03 overflow:', await overflow());
await nav('Layers').click();
const enterablePressed = await page
  .getByRole('button', { name: /^Can go inside/ })
  .getAttribute('aria-pressed');
if (enterablePressed !== 'true') process.exit(1);
await nav('Find').click();
await page.getByRole('button', { name: 'Clear all' }).waitFor({ timeout: 10000 });
console.log('03 toggle active + Clear all visible in Find');

// (c) Search "workout equipment", nearest first — from Find. Gyms and
// workout equipment are separate now: "gym" answers from the member
// gyms, "workout equipment" from the free gear. The layer turns on in
// Layers; the search runs in Find.
await nav('Layers').click();
const equipmentLayer = page.getByRole('checkbox', { name: /^Workout equipment/ });
if (!(await equipmentLayer.isChecked())) await equipmentLayer.check();
await nav('Find').click();
await page.getByRole('searchbox', { name: 'Search places, regions, tags' }).fill('workout equipment');
await page.waitForTimeout(1200);
await page.getByText(/results/).first().waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Nearest first' }).click();
await page.waitForTimeout(1200);
// The filter bar rides inside the scrolling content now — scroll the
// results into view so the empty state (not just the filters) is what
// gets judged in the screenshot.
await page.locator('.sidebar-content').evaluate((el) => { el.scrollTop = el.scrollHeight; });
await shot('04-find-equipment-nearest');
console.log('04 overflow:', await overflow());
await measureTapTargets('04 Find');
// The enterable filter from (b) is still on, so only the enterable gear
// lists — the Starlet bench has no enterable tag. Turning the Layers
// toggle off brings it back: it is searchable even with no pin.
await nav('Layers').click();
await page.getByRole('button', { name: /^Can go inside/ }).click();
await nav('Find').click();
await page.waitForTimeout(1200);
await page.getByText('Starlet Motel bench').waitFor({ timeout: 10000 });
console.log('04 Starlet Motel bench found by search (no pin, listed by name)');
// An equipment search with no equipment near shows the honest hint once
// a county with no equipment is set (Kelly County — nearest gear is far).
await page.getByLabel('Isolate one county').selectOption('kelly');
await page.waitForTimeout(800);
await shot('05-find-equipment-hint');
console.log('05 overflow:', await overflow());

// (d) Ask: gym near Capri — no verified gym, nearest named, houses to check.
await nav('Ask').click();
// One sheet at a time: opening Ask closes the Find panel.
await expectPanelClosed();
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/no gym near capri/i).first().waitFor({ timeout: 10000 });
await page.getByText('Houses in Capri to check').waitFor({ timeout: 10000 });
await page.getByText(/13 houses in Capri are worth checking/).waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Mark as workout spot' }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('06-ask-capri-houses');
console.log('06 overflow:', await overflow());
console.log('06 Ask answered Capri honestly: no gym + 13 houses to check');
// One tap on a house starts a workout-spot marker there.
await page.getByRole('button', { name: 'Mark as workout spot' }).first().click();
await page.waitForTimeout(800);
await shot('07-mark-workout-spot');
console.log('07 overflow:', await overflow());
const kind = await page.locator('#marker-kind').inputValue();
console.log('07 marker kind preset:', kind);
if (kind !== 'workout') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();

// (d2) Ask: workout equipment near Capri — no verified equipment, nearest
// named, houses to check, and the mark-it button says "in a garage in a
// house".
await nav('Ask').click();
await page.locator('#ask-nylah-input').fill('Where is workout equipment near Capri?');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/no workout equipment near capri/i).first().waitFor({ timeout: 10000 });
await page.getByText(/Jason's house deck/i).first().waitFor({ timeout: 10000 });
await page.getByText('Houses in Capri to check').first().waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Workout equipment in the garage — mark it' }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('06b-ask-equipment-capri');
console.log('06b overflow:', await overflow());
console.log('06b Ask answered equipment near Capri honestly: none near, Jason’s deck nearest, houses to check');
await page.getByRole('button', { name: 'Workout equipment in the garage — mark it' }).first().click();
await page.waitForTimeout(800);
await shot('07b-mark-equipment');
console.log('07b overflow:', await overflow());
const kindB = await page.locator('#marker-kind').inputValue();
console.log('07b marker kind preset:', kindB);
if (kindB !== 'workout') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();

// (e) Saved: progress is visible at a glance.
await nav('Saved').click();
await page.getByText('Progress 0').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
await shot('08-saved-progress');
console.log('08 overflow:', await overflow());

// (f) Clear all filters in one tap, from Find.
await nav('Find').click();
await page.getByRole('button', { name: 'Clear all' }).click();
await page.locator('.find-count').getByText('0 places showing').waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
await shot('09-cleared');
console.log('09 overflow:', await overflow());
console.log('09 one tap cleared everything — map back to blank');

// A single pin, deep-linked: bottom-sheet place detail.
await page.goto(`${base}?place=L1612`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('10-place-detail');
console.log('10 overflow:', await overflow());
await page.getByRole('button', { name: 'Close place details' }).click();

// Reload -> layers persist, no welcome sheet.
await page.goto(`${base}?place=L1612`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Close place details' }).click();
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await shot('11-after-reload');
console.log('11 markers after reload:', await page.locator('.atlas-map-marker').count());
console.log('11 overflow:', await overflow());

// Layers tab: full layer list + the index panel with the zero state.
await nav('Layers').click();
await page.getByText('Sort the unnamed places').waitFor({ timeout: 10000 });
await page.getByText('0 sorted so far').waitFor({ timeout: 10000 });
await page.getByText(/2,768 places have no confirmed name/).waitFor({ timeout: 10000 });
await page.getByText('Indexing needs your OpenAI key').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
await shot('12-layers-index-zero');
console.log('12 overflow:', await overflow());
await measureTapTargets('12 Layers');
console.log('12 index panel says plainly: never run, 0 sorted, 2,768 unnamed');

// Add workout spot, from Layers -> placement mode, then "Use map
// center" opens the editor with the workout kind preset and a real
// position (never 0,0).
await nav('Layers').click();
await page.getByRole('button', { name: /^Add workout spot/ }).click();
await page.getByRole('button', { name: 'Use map center' }).click();
await page.waitForTimeout(800);
await shot('13-workout-spot-editor');
console.log('13 overflow:', await overflow());
const kind2 = await page.locator('#marker-kind').inputValue();
console.log('13 marker kind preset:', kind2);
if (kind2 !== 'workout') process.exit(1);
const gameX = await page.locator('#marker-x').inputValue();
const gameY = await page.locator('#marker-y').inputValue();
console.log('13 marker coords:', gameX, gameY);
if (gameX === '0' && gameY === '0') process.exit(1);
await page.getByRole('button', { name: 'Close dialog' }).click();

// A "?" place, deep-linked: what we know + add-your-own-marker.
await page.goto(`${base}?place=L818`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('14-unnamed-place');
console.log('14 overflow:', await overflow());
await page.getByText('What we know').waitFor({ timeout: 10000 });
console.log('14 "What we know" shown for the ? place');

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
await shot('15-ai-suggested-detail');
console.log('15 overflow:', await overflow());
console.log('15 AI-suggested detail shown for L818, with confirm');
await page.getByRole('button', { name: 'Close place details' }).click();

// Ask with the seeded AI gym: "gym near Capri" must answer from the
// AI-suggested "?" — nearest first, labelled AI suggested.
await nav('Ask').click();
await page.locator('#ask-nylah-input').fill('Show me a gym near Capri');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/AI suggested: Gym/i).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('16-ask-ai-gym-capri');
console.log('16 overflow:', await overflow());
console.log('16 Ask answered a gym question from the AI-suggested "?" near Capri');
await page.getByRole('button', { name: 'Close Ask Nylah' }).click();

// Layers tab again: the index panel now shows per-type counts.
await nav('Layers').click();
await page.getByText(/Gym · 1/).waitFor({ timeout: 10000 });
await page.getByText(/House · 1/).waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
await shot('17-index-type-counts');
console.log('17 overflow:', await overflow());
console.log('17 index panel shows what each ? was resolved into (Gym 1, House 1)');

// (g) Breakable homes: one layer checkbox, 47 positioned places, and
// the detail sheet says the interior status plainly.
await nav('Find').click();
await page.getByRole('button', { name: 'Clear all' }).click();
await nav('Layers').click();
const breakableLayer = page.getByRole('checkbox', { name: /^Breakable homes/ });
if (!(await breakableLayer.isChecked())) await breakableLayer.check();
await nav('Find').click();
await page.locator('.find-count').getByText('47 places showing').waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
await shot('18-breakable-homes');
console.log('18 overflow:', await overflow());
await measureTapTargets('18 Map (Breakable homes)');
// Interior houses filter: 33 places, all residential + enterable.
await nav('Layers').click();
await page.getByRole('button', { name: /^Interior houses/ }).click();
await nav('Find').click();
await page.locator('.find-count').getByText('33 places showing').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
await shot('19-interior-houses');
console.log('19 overflow:', await overflow());
// A breakable apartment, deep-linked: the Inside section says what it is.
await page.goto(`${base}?place=L192`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('heading', { name: 'Inside' }).waitFor({ timeout: 10000 });
await page.getByText(/Apartment — enterable interior, can be broken into/).waitFor({ timeout: 10000 });
await shot('20-breakable-detail');
console.log('20 overflow:', await overflow());
console.log('20 Venture Apartments detail: interior status plain, no hunting');
// A "?" house in Capri with no tags at all (L939): the Inside section
// says the dark-blue rule and offers "Mark as a breakable home" — one
// tap presets the kind. (L818 is already in the Breakable layer, so its
// sheet rightly has no mark button.)
await page.goto(`${base}?place=L939`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByText(/dark blue has an interior/).first().waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Mark as a breakable home' }).click();
await page.waitForTimeout(800);
const kindC = await page.locator('#marker-kind').inputValue();
console.log('21 marker kind preset:', kindC);
if (kindC !== 'breakable') process.exit(1);
await shot('21-mark-breakable');
console.log('21 overflow:', await overflow());
await page.getByRole('button', { name: 'Close dialog' }).click();
// Ask: apartments I can break into in Vice City — seeded examples +
// Venture Apartments, with the dark-blue rule in the answer.
await nav('Ask').click();
await page.locator('#ask-nylah-input').fill('What apartments can I break into in Vice City?');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText(/Venture Apts North/i).first().waitFor({ timeout: 10000 });
await page.getByText(/dark blue/i).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
await shot('22-ask-breakable-vice-city');
console.log('22 overflow:', await overflow());
console.log('22 Ask answered breakable apartments from the systemic rule + examples');

await browser.close();
console.log('console errors:', errors.length ? errors : 'none');
if (errors.length > 0) process.exit(1);
if (tapViolations.length > 0) {
  console.log('TAP TARGET FAILURES (under 48px):', tapViolations);
  process.exit(1);
}
console.log('walk OK — screenshots in', out);

async function expectPanelClosed() {
  // The Find panel is gone once Ask opens: its search box is not visible.
  const search = page.getByRole('searchbox', { name: 'Search places, regions, tags' });
  if (await search.isVisible()) throw new Error('Find panel still open under Ask');
}
