// Diagnostic for demo-small S5: what does the "Area" button actually open
// on the final build, and does the Leonida crumb navigate to a county list?
// Fresh profile `demo-s5-diag`. Port 4330.
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const PROFILE = '/home/hatch/.v032-profiles/demo-s5-diag';
rmSync(PROFILE, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

async function dump(label) {
  const s = await page.evaluate(() => ({
    areaPage: !!document.querySelector('section.area-page'),
    areaPageLabel: document.querySelector('section.area-page')?.getAttribute('aria-label') ?? null,
    geoSearch: !!document.querySelector('.area-search, [aria-label="Close area search"]'),
    breadcrumb: (document.querySelector('.map-hero')?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
    sheetHeadings: [...document.querySelectorAll('section.area-page h2, section.area-page h3')].map((h) => h.textContent?.trim()).slice(0, 6),
  }));
  console.log(label, JSON.stringify(s));
}

// 1. The exact demo-small selector.
const btn = page.getByRole('button', { name: 'Area', exact: false }).first();
const info = await btn.evaluate((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), label: el.getAttribute('aria-label'), text: (el.textContent || '').trim().slice(0, 60) }));
console.log('demo-small .first() resolves to:', JSON.stringify(info));
await btn.click();
await page.waitForTimeout(1500);
await dump('after demo-small Area click:');
await page.screenshot({ path: '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots/s5diag-after-area-click.png' });

// 2. If an area page is open on a county, click its Leonida crumb.
const crumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
console.log('Leonida crumb count:', await crumb.count());
if (await crumb.count()) {
  await crumb.click();
  await page.waitForTimeout(1500);
  await dump('after Leonida crumb click:');
  await page.screenshot({ path: '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots/s5diag-after-crumb.png' });
  const mariana = page.getByRole('button', { name: /Mariana County/ }).first();
  console.log('Mariana County button count:', await mariana.count());
}
await ctx.close();
