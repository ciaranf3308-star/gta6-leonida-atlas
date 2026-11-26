/* global document */
// Lane-1 probe — island-zoom geometry dump for the likely-area labels.
// Turns the gang-op layer on and dumps every likely-area label rect +
// every geo-pill rect (names + boxes), so the post-fix placement can be
// predicted and checked without re-running the full regions demo.
// Usage: node probe-lane1-geometry.mjs [port]
// Writes probe-lane1-geometry.json next to this script.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/lane1-geometry';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('requestfailed', (r) => console.log('[lane1] requestfailed:', r.url().slice(0, 160), r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) console.log('[lane1] HTTP', r.status(), r.url().slice(0, 160)); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[lane1] console.error:', m.text().slice(0, 300)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
try {
  await page.getByRole('button', { name: 'Open map filters' }).first().waitFor({ timeout: 15000 });
} catch {
  console.log('FILTER BUTTON MISSING — body text head:');
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 800));
  await page.screenshot({ path: `${SHOTS}/lane1-load-fail.png` });
  throw new Error('app did not reach the map hero');
}

await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1500);

const dump = await page.evaluate(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? Math.round(w * h) : 0;
  };
  // Un-hide every label first: the placement pass hides colliding
  // ones (display:none → 0×0 rect), but the geometry question is
  // where each label WOULD sit at its centre anchor. Restore after.
  const labelEls = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')];
  const saved = labelEls.map((el) => el.style.display);
  for (const el of labelEls) el.style.display = '';
  const labels = labelEls.map((el, i) => ({
    text: (el.textContent || '').trim().replace(/\s+/g, ' '),
    rect: rect(el),
    // Whether the placement pass had hidden this label (its live
    // display before we un-hid it for measuring).
    hiddenByPlacement: saved[i] === 'none',
  }));
  // The region rects on screen (dashed #ff8f8f paths): each label's
  // honest anchor is its region's centre, so the region box is the
  // re-placement search area.
  const regions = [...document.querySelectorAll('.leaflet-overlay-pane path')]
    .filter((el) => el.getAttribute('stroke') === '#ff8f8f')
    .map((el) => ({ rect: rect(el) }));
  const pills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({
    name: (el.textContent || '').trim(),
    rect: rect(el),
  }));
  const pairs = [];
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const o = overlap(labels[i].rect, labels[j].rect);
    if (o > 0) pairs.push({ a: labels[i].text.slice(0, 40), b: labels[j].text.slice(0, 40), px2: o });
  }
  const pillHits = [];
  for (const l of labels) for (const g of pills) {
    const o = overlap(l.rect, g.rect);
    if (o > 0) pillHits.push({ label: l.text.slice(0, 40), pill: g.name, px2: o });
  }
  for (let i = 0; i < labelEls.length; i++) labelEls[i].style.display = saved[i];
  return { labels, pills, regions, pairs, pillHits };
});
console.log(JSON.stringify(dump, null, 2));
writeFileSync(
  new URL('./probe-lane1-geometry.json', import.meta.url),
  JSON.stringify(dump, null, 2),
);
await page.screenshot({ path: `${SHOTS}/lane1-island.png` });
await ctx.close();
console.log('wrote probe-lane1-geometry.json');
