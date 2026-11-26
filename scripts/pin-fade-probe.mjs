// Pin-fade probe (Demo D follow-up): on the demo-d profile (L1676
// explored), close the place card, turn the Locations layer on, and
// screenshot the map at Redshaw to judge whether the explored pin
// visibly fades vs neighbouring non-explored pins.
import { launch, shot, bodyText, dumpButtons } from './harness.mjs';
const { ctx, page } = await launch('demo-d', 'D-pinfade');
await dumpButtons(page, 'map-with-card');
// Close the place card via its X.
const closeCard = page.locator('button[aria-label*="lose"], button[aria-label*="Close place"]').first();
console.log('close buttons:', await page.locator('button[aria-label*="lose"]').count());
if (await closeCard.count()) {
  await closeCard.click();
  await page.waitForTimeout(1200);
}
await shot(page, 'd10-map-card-closed');
// Turn the Locations layer on (top chip).
const locChip = page.getByRole('button', { name: 'Locations', exact: true }).first();
if (await locChip.count()) {
  await locChip.click();
  await page.waitForTimeout(2500);
}
await shot(page, 'd11-map-locations-on');
console.log('--- map text ---');
console.log((await bodyText(page)).slice(0, 800));
// Where is the explored pin? Check the DOM marker for L1676 opacity.
const markerInfo = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.leaflet-marker-icon')];
  return els.slice(0, 12).map((el) => ({
    cls: el.className,
    opacity: getComputedStyle(el).opacity,
    title: el.getAttribute('title') || el.getAttribute('alt') || '',
  }));
});
console.log('markers:', JSON.stringify(markerInfo, null, 1));
await ctx.close();
console.log('pin-fade probe done');
