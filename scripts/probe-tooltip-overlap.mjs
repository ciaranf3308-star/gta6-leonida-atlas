/* global document */
// Demo lane 5 — selected-pin tooltip overlap (step-9 (5) fix, re-checked).
// Fresh profile (showLabels defaults true). Opens Starlet Motel (L304)
// and measures the .atlas-place-label tooltip rect against the selected
// pin face + ring: must be 0px² (step-9 measured 0px²; lane 3 did not
// touch the tooltip). Port 4330. Shot: s11-tooltip-final.png.
import { createRequire } from 'node:module';
import { rmSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
const PROFILE = '/home/hatch/.v032-profiles/demo-tooltip';
mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('[tooltip] pageerror:', String(e).slice(0, 300)));
await page.goto(`${BASE}?place=L304`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${SHOTS}/s11-tooltip-final.png` });
const m = await page.evaluate(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? Math.round(w * h) : 0;
  };
  const tips = [...document.querySelectorAll('.atlas-place-label')].map((el) => ({
    text: (el.textContent || '').trim().slice(0, 60), rect: rect(el),
  }));
  const faces = [...document.querySelectorAll('.atlas-map-marker.is-selected .atlas-pin-face')].map((el) => rect(el));
  const rings = [...document.querySelectorAll('.atlas-map-marker.is-selected')].map((el) => rect(el));
  let maxTipFace = 0;
  for (const t of tips) for (const f of faces) maxTipFace = Math.max(maxTipFace, overlap(t.rect, f));
  return { tips, faces, rings, maxTipFace };
});
console.log('tooltip:', JSON.stringify(m.tips), 'pin face:', JSON.stringify(m.faces), 'max overlap:', m.maxTipFace, 'px²');
console.log(`${m.tips.length > 0 && m.maxTipFace === 0 ? 'PASS' : 'FAIL'} — selected-pin tooltip has 0px² overlap with the pin face`);
await ctx.close();
process.exitCode = m.tips.length > 0 && m.maxTipFace === 0 ? 0 : 1;
