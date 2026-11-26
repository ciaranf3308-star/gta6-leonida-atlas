// Step-9 small items, part 2 (runs on :4330):
//  S6 selected pin label clear of the pin face/ring — the step-9
//    (5) fix is about the .atlas-place-label tooltip. NOTE: the seed
//    backup sets showLabels=false, so labels must be switched on in
//    Settings first or the tooltip legitimately never renders.
//    The .atlas-geo-label pills ("Gellhorn" / "Starlet Motel") are a
//    separate system and are measured separately.
//  S7 THE GANG-OP LAYER QUESTION: is there a Layers toggle for gang
//    ops? (DEFAULT_LAYERS has no 'gang-op'.) The sheet opens via the
//    "Open map filters" icon button. Also: is Brooks Boatworks
//    searchable via Find?
//  S8 Bare-name Ask regression with layers off: "Delight dancers",
//    "Delights", "Jack of Hearts", "flamingos".
import { launch, shot, bodyText, clickTab, waitForText, dumpButtons } from './harness.mjs';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

async function askLast(page, question) {
  await clickTab(page, 'Ask');
  const input = page.locator('#ask-nylah-input');
  await input.waitFor({ timeout: 15000 });
  await input.click();
  await input.fill(question);
  await page.getByLabel('Send', { exact: true }).click();
  await page.waitForTimeout(3500);
  const panel = page.locator('section.ask-panel');
  await panel.waitFor({ timeout: 15000 });
  const full = await panel.innerText();
  const idx = full.lastIndexOf(question);
  return idx >= 0 ? full.slice(idx) : full;
}

let { ctx, page } = await launch('demo-small', 'S-layers');
await shot(page, 's10-map-home');

// ---------- S6a: turn map labels on (seed has showLabels=false) ----------
await clickTab(page, 'Collections');
await page.getByRole('button', { name: 'SETTINGS', exact: false }).first().click();
await page.waitForTimeout(900);
const labelsToggle = page.locator('label.setting-row', { hasText: 'Map labels' }).locator('input[type="checkbox"]').first();
console.log('Map labels toggle present:', await labelsToggle.count(), 'checked:', (await labelsToggle.count()) ? await labelsToggle.isChecked() : 'n/a');
if ((await labelsToggle.count()) && !(await labelsToggle.isChecked())) {
  await labelsToggle.click();
  await page.waitForTimeout(900);
  console.log('Map labels now checked:', await labelsToggle.isChecked());
}
await page.keyboard.press('Escape');
await page.waitForTimeout(700);

// ---------- S6b: selected pin tooltip label geometry ----------
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/?place=L304', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await waitForText(page, /YOUR PROGRESS HERE|LEONIDA · PLACE/);
await clickTab(page, 'Map');
await page.waitForTimeout(2000);
await shot(page, 's11-map-starlet-selected');
const geo = await page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const sel = document.querySelector('.atlas-map-marker.is-selected');
  const face = sel?.querySelector('.atlas-pin-face');
  const faceR = r(face);
  const markerR = r(sel);
  function overlap(a, b) {
    if (!a || !b) return null;
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ox * oy;
  }
  const placeLabels = [...document.querySelectorAll('.atlas-place-label')].map((el) => ({
    text: (el.textContent || '').trim().slice(0, 60),
    cls: el.className.toString().slice(0, 100),
    rect: r(el),
    overlapWithFace: overlap(r(el), faceR),
    overlapWithMarker: overlap(r(el), markerR),
  }));
  const geoLabels = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({
    text: (el.textContent || '').trim().slice(0, 60),
    rect: r(el),
    overlapWithFace: overlap(r(el), faceR),
    overlapWithMarker: overlap(r(el), markerR),
  }));
  return { marker: markerR, face: faceR, placeLabels, geoLabels };
});
console.log('--- selected pin label geometry (labels ON) ---');
console.log(JSON.stringify(geo, null, 2));
const selLabel = geo.placeLabels.find((l) => /is-selected/.test(l.cls));
check(
  'S6 selected pin tooltip label renders (labels on, pin centred)',
  !!selLabel,
  selLabel ? `"${selLabel.text}" ${JSON.stringify(selLabel.rect)}` : '0 .atlas-place-label.is-selected in the DOM',
);
if (selLabel) {
  check(
    'S6 selected pin tooltip label clear of the pin face/ring',
    selLabel.overlapWithFace === 0 && selLabel.overlapWithMarker === 0,
    `overlap with face ${selLabel.overlapWithFace}px², with marker ${selLabel.overlapWithMarker}px²`,
  );
}
const geoOverlap = geo.geoLabels.filter((g) => (g.overlapWithFace ?? 0) > 0);
check(
  'S6b geo-label pills do NOT sit under the pin face (separate system)',
  geoOverlap.length === 0,
  geoOverlap.length
    ? geoOverlap.map((g) => `"${g.text}" overlaps face by ${g.overlapWithFace}px²`).join('; ')
    : 'no geo label overlaps the pin face',
);

// ---------- S7: Layers / filters sheet — gang-op toggle? ----------
// Close the place card so the map edge stack is reachable.
await page.getByLabel('Close place details').first().click().catch(() => {});
await page.waitForTimeout(800);
const filtersBtn = page.getByRole('button', { name: 'Open map filters' }).first();
console.log('"Open map filters" button count:', await filtersBtn.count());
if ((await filtersBtn.count()) > 0) {
  await filtersBtn.click();
  await page.waitForTimeout(1200);
  await shot(page, 's12-layers-sheet');
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.map-filter-sheet');
    return s ? s.innerText : '';
  });
  console.log('--- Map filters sheet text ---');
  console.log(sheet.slice(0, 3000));
  check(
    'S7 LAYERS: gang-op toggle present?',
    /gang/i.test(sheet),
    /gang/i.test(sheet) ? 'a gang-op toggle exists' : 'NO gang-op toggle in the Map filters sheet — FLAG as gap',
  );
  // Turn every layer off for the bare-name Ask regression.
  const toggles = page.locator('.map-filter-sheet input[type="checkbox"]:checked');
  let n = await toggles.count();
  console.log('checked layer toggles to switch off:', n);
  while (n > 0) {
    await toggles.nth(0).click();
    await page.waitForTimeout(200);
    n = await page.locator('.map-filter-sheet input[type="checkbox"]:checked').count();
  }
  const remaining = await page.locator('.map-filter-sheet input[type="checkbox"]:checked').count();
  console.log('checked layer toggles remaining:', remaining);
  await page.getByRole('button', { name: 'Close map filters' }).first().click();
  await page.waitForTimeout(800);
  check('S7 layers switched off for the Ask regression', remaining === 0, `${remaining} toggles still checked`);
} else {
  check('S7 LAYERS: gang-op toggle present?', false, 'no "Open map filters" button found');
}

// ---------- S7b: gang-op place searchable via Find? ----------
const searchPill = page.getByRole('button', { name: /Search Leonida/i }).first();
console.log('Search pill count:', await searchPill.count());
if ((await searchPill.count()) > 0) {
  await searchPill.click();
  await page.waitForTimeout(900);
  const searchInput = page.locator('#atlas-search');
  console.log('Find input present:', await searchInput.count());
  if ((await searchInput.count()) > 0) {
    await searchInput.fill('Brooks Boatworks');
    await page.waitForTimeout(1500);
    await shot(page, 's13-find-brooks');
    const findText = await bodyText(page);
    check(
      'S7 gang-op place searchable via Find',
      /Brooks Boatworks/.test(findText),
      'Brooks Boatworks appears in Find results',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
} else {
  check('S7 gang-op place searchable via Find', false, 'no Search pill (hero hidden?)');
}

// ---------- S8: bare-name Ask regression, layers off ----------
const bare = [
  { q: 'Delight dancers', want: /Delights Dancers/i, label: 'Delights Dancers set/cards' },
  { q: 'Delights', want: /Delights/i, label: 'Delights results' },
  { q: 'Jack of Hearts', want: /Jack of Hearts/i, label: 'Jack of Hearts card' },
  { q: 'flamingos', want: /flamingo/i, label: 'flamingo results' },
];
for (const { q, want, label } of bare) {
  const ans = await askLast(page, q);
  await shot(page, `s14-ask-${q.replace(/[^a-z]+/gi, '-').toLowerCase()}`);
  console.log(`--- Ask "${q}" ---`);
  console.log(ans.slice(0, 900));
  check(`S8 bare-name Ask "${q}" stays green`, want.test(ans) && !/can't check that without your OpenAI key/i.test(ans), label);
}

await ctx.close();

console.log('\n=== SMALL-2 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
