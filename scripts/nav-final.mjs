// Final-build Capri navigation proof (Demo B path): Area -> Leonida
// (sheet's own breadcrumb) -> Mariana County -> Capri area page.
// Runs against the final build atlas-b40404d5-61c6fb76f9b4.
import { launch, shot, bodyText, clickTab } from './harness.mjs';
const { ctx, page } = await launch('demo-b-nav-final', 'B-nav-final');
await clickTab(page, 'Map');
await page.getByRole('button', { name: 'Area', exact: false }).first().click();
await page.waitForTimeout(1000);
const sheetCrumb = page.locator('section.area-page button.area-crumb', { hasText: 'Leonida' }).first();
console.log('sheet crumb (Leonida) count:', await sheetCrumb.count());
await sheetCrumb.click();
await page.waitForTimeout(1200);
await shot(page, 'b40-leonida-page-final');
const mariana = page.getByRole('button', { name: /Mariana County/ }).first();
console.log('Mariana button count:', await mariana.count());
await mariana.click();
await page.waitForTimeout(1200);
await shot(page, 'b41-mariana-page-final');
const capri = page.locator('section.area-page button', { hasText: /^Capri/ }).first();
console.log('Capri button count:', await capri.count());
await capri.scrollIntoViewIfNeeded();
await capri.click();
await page.waitForTimeout(3000);
const t = await bodyText(page);
console.log('Capri page loaded:', /CAPRI, MARIANA COUNTY/.test(t));
console.log(t.slice(0, 600));
await shot(page, 'b42-capri-page-final');
await ctx.close();
console.log('final nav probe done');
