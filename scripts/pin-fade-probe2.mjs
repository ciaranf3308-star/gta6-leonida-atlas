/* global document, getComputedStyle */
// Pin-fade probe v2: deep-link to L1676 (centres the map), close the
// card, turn Locations on, screenshot, and dump the marker DOM for
// the Redshaw pin's explored styling vs neighbours.
import { launch, shot, dumpButtons } from './harness.mjs';
const { ctx, page } = await launch('demo-d', 'D-pinfade2');
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/?place=L1676', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await dumpButtons(page, 'redshaw-card');
// Close the place card (the X at the card's top-right).
const closeBtns = page.locator('button[aria-label*="lose"]');
console.log('close-label buttons:', await closeBtns.count());
for (let i = 0; i < (await closeBtns.count()); i++) {
  console.log(' close candidate', i, await closeBtns.nth(i).getAttribute('aria-label'));
}
if (await closeBtns.count()) {
  await closeBtns.first().click();
  await page.waitForTimeout(1500);
}
await shot(page, 'd12-map-redshaw-closed');
const locChip = page.getByRole('button', { name: 'Locations', exact: true }).first();
if (await locChip.count()) {
  await locChip.click();
  await page.waitForTimeout(2500);
}
await shot(page, 'd13-map-redshaw-locations');
const markers = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.leaflet-marker-icon')];
  return els.map((el) => ({
    cls: String(el.className).replace('leaflet-marker-icon ', ''),
    opacity: getComputedStyle(el).opacity,
    title: el.getAttribute('title') || el.getAttribute('alt') || '',
    html: el.innerHTML.slice(0, 120),
  }));
});
console.log(`markers: ${markers.length}`);
for (const m of markers) console.log(JSON.stringify(m));
await ctx.close();
console.log('pin-fade probe 2 done');
