// Lane 4 local harness: same 390px persistent-profile setup as
// harness.mjs, but against the lane's OWN isolated build on :4331
// (dist-lane4, built with ATLAS_BASE_PATH) so other lanes rebuilding
// the shared dist/ on :4330 can never race a probe mid-run.
import { createRequire } from 'node:module';

const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');

export const BASE4 = 'http://127.0.0.1:4331/gta6-leonida-atlas/';
export { shot, bodyText, clickTab, waitForText, clickText, clickButton } from './harness.mjs';

const PROFILE_BASE = '/home/hatch/.v032-profiles';

export async function launch4(profile, label) {
  const ctx = await chromium.launchPersistentContext(`${PROFILE_BASE}/${profile}`, {
    headless: true,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${label}] console.error:`, m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => console.log(`[${label}] pageerror:`, String(e).slice(0, 300)));
  await page.goto(BASE4, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}
