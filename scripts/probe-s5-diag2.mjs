// Diagnostic for demo-small S5 (round 2): full flow with state dumps.
// Fresh profile `demo-s5-diag2`. Port 4330.
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
const PROFILE = '/home/hatch/.v032-profiles/demo-s5-diag2';
rmSync(PROFILE, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

async function dump(label) {
  const s = await page.evaluate(() => {
    const zoom = (() => {
      const el = document.querySelector('.leaflet-control-zoom-out');
      return el ? 'zoom-control-present' : 'no-zoom-control';
    })();
    return {
      areaPage: !!document.querySelector('section.area-page'),
      areaPageLabel: document.querySelector('section.area-page')?.getAttribute('aria-label') ?? null,
      geoPills: [...document.querySelectorAll('.atlas-geo-label')].map((el) => (el.textContent || '').trim()),
      pillButtons: [...document.querySelectorAll('.atlas-geo-label-wrap')].map((el) => el.getAttribute('aria-label')),
      zoomOutBtns: [...document.querySelectorAll('[aria-label="Zoom out"]')].length,
      zoom,
    };
  });
  console.log(label, JSON.stringify(s));
}
async function zoomOut(n) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('[aria-label="Zoom out"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(600);
  }
}
await dump('fresh load:');
await zoomOut(10);
await dump('after 10x zoom out:');
await page.getByRole('button', { name: 'Area', exact: false }).first().click();
await page.waitForTimeout(1500);
await dump('after Area click:');
const crumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
console.log('Leonida crumb count:', await crumb.count());
if (await crumb.count()) { await crumb.click(); await page.waitForTimeout(1500); }
await dump('after Leonida crumb click:');
await zoomOut(10);
await dump('after 2nd 10x zoom out:');
const mariana = page.getByRole('button', { name: /Mariana County/ });
console.log('Mariana County button count:', await mariana.count());
const names = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || (b.textContent || '').trim().slice(0, 40)).filter((t) => /County/i.test(t ?? '')),
);
console.log('buttons with County in name/label:', JSON.stringify(names));
await page.screenshot({ path: '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots/s5diag2-final.png' });
await ctx.close();
