/* global document, getComputedStyle */
// Lane-1 district-zoom check — suppression must be reversible:
// zooming in from island zoom frees labels (they return as soon as
// the geometry has room). Island + 2 zoom-ins, centred on the
// island, then the same census as probe-lane1-verify.mjs.
// Usage: node probe-lane1-district.mjs [port]
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] ?? '4330';
const BASE = `http://127.0.0.1:${PORT}/gta6-leonida-atlas/`;
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/lane1-district';
mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const OP_NAMES = [
  'Sunrise RV Park', 'Parlor Apartments', 'Hog Stars Garage', 'Irons Building Supply',
  'Sound4Sond Studio', 'La Perle Trap House', 'Illegal Sneaker Trade', "JanJak's Garage",
  'Leonida Carrier Warehouse', 'Cigar Import Front', 'Ocean Beach Lab', 'Southside Trap House',
  'Kamar Devon Community Center', 'Saber Shipping Yard', 'Casa Guardia',
  'Saber Shipping Facility', 'Exotic Animals Front', 'Slator Towing Inc',
  'Manatee Motel', 'Kingpin Bowling', 'June Warehouse', 'La Cascara Motel',
  'Brooks Boatworks', 'Stash House', 'Backroom Weed Front', 'M7 Compound',
  'Weed Grow', 'Palmer Fishing Warehouse', 'Watson Bay Safehouse',
  'Mill Station Radar Base', 'Farm Fix Meth Lab', 'Biker Hideout',
  'Industrial Weed Grow', 'Gas Station Meth Front', 'Walker Farm',
  'Carter Mining Boathouse', 'Fishing Shacks', 'Chatfield Storage & Logistics',
  'Vespucci Mansion',
];

async function measure(page) {
  return page.evaluate((opNames) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const overlap = (a, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? Math.round(w * h) : 0;
    };
    const labels = [...document.querySelectorAll('.leaflet-tooltip.likely-area-label')].map((el) => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      rect: rect(el),
      visible: getComputedStyle(el).display !== 'none' && rect(el).w > 0,
    }));
    const geoPills = [...document.querySelectorAll('.atlas-geo-label')].map((el) => ({ name: (el.textContent || '').trim(), rect: rect(el) }));
    const markers = [...document.querySelectorAll('.atlas-map-marker')].map((el) => ({ label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 60) }));
    const gangOpPins = markers.filter((m) => opNames.some((n) => m.label.includes(n)));
    let maxLabelGeo = 0; let worstLabelGeo = null;
    for (const l of labels) for (const g of geoPills) {
      const o = overlap(l.rect, g.rect);
      if (o > maxLabelGeo) { maxLabelGeo = o; worstLabelGeo = { label: l.text.slice(0, 50), pill: g.name, px2: o }; }
    }
    let maxLabelLabel = 0; let worstLabelLabel = null;
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const o = overlap(labels[i].rect, labels[j].rect);
      if (o > maxLabelLabel) { maxLabelLabel = o; worstLabelLabel = { a: labels[i].text.slice(0, 40), b: labels[j].text.slice(0, 40), px2: o }; }
    }
    return {
      labels, visibleLabels: labels.filter((l) => l.visible),
      geoPillCount: geoPills.length, gangOpPins,
      maxLabelGeo, worstLabelGeo, maxLabelLabel, worstLabelLabel,
    };
  }, OP_NAMES);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
// Turn the gang-op layer on.
await page.getByRole('button', { name: 'Open map filters' }).first().click();
await page.waitForTimeout(1000);
const box = page.locator('.map-filter-sheet label', { hasText: 'Gang operations' }).first().locator('input[type="checkbox"]').first();
if (!(await box.isChecked())) { await box.click(); await page.waitForTimeout(1200); }
await page.getByRole('button', { name: 'Close map filters' }).first().click();
await page.waitForTimeout(1200);

const m0 = await measure(page);
console.log(`island: visible=${m0.visibleLabels.length}/17 labelGeo=${m0.maxLabelGeo}px² labelLabel=${m0.maxLabelLabel}px²`);
// Two zoom-ins from island zoom, centred on the island.
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const m = await measure(page);
console.log(`district (+2 zoom): visible=${m.visibleLabels.length}/17 labelGeo=${m.maxLabelGeo}px² labelLabel=${m.maxLabelLabel}px² gangOpPins=${m.gangOpPins.length} geoPills=${m.geoPillCount}`);
for (const l of m.labels) console.log(`  ${l.visible ? 'SHOW' : 'HIDE'} ${l.rect.w}x${l.rect.h} @(${l.rect.x},${l.rect.y}): ${l.text.slice(0, 100)}`);
console.log('worstLabelGeo:', JSON.stringify(m.worstLabelGeo), 'worstLabelLabel:', JSON.stringify(m.worstLabelLabel));
await page.screenshot({ path: `${SHOTS}/lane1-v-district.png` });
console.log('shot:', `${SHOTS}/lane1-v-district.png`);
await ctx.close();
