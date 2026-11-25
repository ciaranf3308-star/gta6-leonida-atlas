// v0.25.0 app-design round 2 walk (390px, DPR 2). Covers the v0.24
// re-review items: chrome-safe pins/labels, the unnamed-place
// headline (area, never "?"), region-card copy ("this area", not
// "this building"), bolder clouds, the slimmer sheet (60dvh) with
// Read more and category chips, and the All Leonida island-outline
// card. Keeps the v0.23 regression checks (slim prompt, chips fit,
// edge stack + zoom pill, place card, tag/explored reload, region
// card, street-zoom "?" pills, turn everything off). Served from
// dist/ on port 4331 like the v0.21/v0.23 walks.
/* global document, getComputedStyle, window */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v025-walk/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const BASE_PATH = '/gta6-leonida-atlas/';
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4331');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice(BASE_PATH.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4331, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.url()} ${res.status()}`);
});

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const nav = (label) => page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
const markerCount = () =>
  page.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);

await page.goto('http://localhost:4331/gta6-leonida-atlas/', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

// The forced indexing onboarding (v0.11) covers the screen on first
// launch — skip it, the way a returning user would.
const skipOnboarding = page.getByRole('button', { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}

// (a) Header + hero: slim banner, full-width search, all 5 chips.
const brand = await page.locator('.map-hero-brand').boundingBox();
check('wordmark on screen', !!brand && brand.y + brand.height <= 64, JSON.stringify(brand));
const mark = await page.locator('.map-hero-mark').boundingBox();
check('V mark is 32px (was 42px)', !!mark && mark.width <= 36, JSON.stringify(mark));
const subtitle = await page.locator('.map-hero-sub').boundingBox();
check('subtitle visible on phones', !!subtitle && subtitle.height > 0, JSON.stringify(subtitle));
const search = await page.locator('.map-search-pill').boundingBox();
check('search pill is full width', !!search && search.width >= 360, JSON.stringify(search));
check(
  'search has the expand glyph',
  (await page.locator('.map-search-expand').count()) === 1,
);
const chipBoxes = await page.locator('.map-chip').evaluateAll((els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    return { label: el.textContent?.trim(), left: r.left, right: r.right };
  }),
);
check(
  'all five chips fit on screen (no cut-off)',
  chipBoxes.length === 5 && chipBoxes.every((c) => c.left >= 0 && c.right <= 390),
  JSON.stringify(chipBoxes),
);
await shot('a-map-hero');

// (b) Edge stack + zoom pill on phones; clouds at island zoom.
check('edge stack (layers + recenter) visible', (await page.locator('.atlas-edge-stack').isVisible()) && (await page.locator('.atlas-edge-stack button').count()) === 2);
check('zoom pill visible', await page.locator('.atlas-edge-zoom').isVisible());
check(
  'island zoom class on (clouds + hero pins active)',
  await page.evaluate(() => document.querySelector('.atlas-map-view')?.classList.contains('is-hero-zoom')),
);
const cloudOpacity = await page.evaluate(
  () => getComputedStyle(document.querySelector('.atlas-clouds')).opacity,
);
check('clouds visible at island zoom', Number(cloudOpacity) > 0.5, `opacity ${cloudOpacity}`);
const clouds = await page.evaluate(() =>
  [...document.querySelectorAll('.atlas-clouds span')].map((el) => ({
    w: el.getBoundingClientRect().width,
    h: el.getBoundingClientRect().height,
  })),
);
check(
  'clouds are five bold clusters, not three faint ellipses',
  clouds.length === 5 && clouds.every((c) => c.w >= 239 && c.h >= 90),
  JSON.stringify(clouds),
);

// (c) Tighter fit: the loaded tiles must cover the map canvas.
const fit = await page.evaluate(() => {
  const canvas = document.querySelector('.atlas-map-canvas').getBoundingClientRect();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  document.querySelectorAll('.leaflet-tile-loaded').forEach((img) => {
    const r = img.getBoundingClientRect();
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
  });
  return {
    canvas: { w: canvas.width, h: canvas.height },
    coverW: (maxX - minX) / canvas.width,
    coverH: (maxY - minY) / canvas.height,
  };
});
check('tiles cover the full map canvas', fit.coverW >= 0.95 && fit.coverH >= 0.9, JSON.stringify(fit));

// (d) Empty prompt is one compact bar; attribution hidden behind it
// is gone (it returns once layers are on).
const promptBox = await page.locator('.empty-map-prompt').boundingBox();
check('empty prompt is a slim bar (was ~25% of screen)', !!promptBox && promptBox.height <= 120, JSON.stringify(promptBox));
check(
  'attribution hidden while the empty prompt is up',
  (await page.locator('.atlas-map-attribution').count()) === 0,
);
const note = await page.locator('.atlas-map-illustration-note').boundingBox();
check('illustration note visible below the hero', !!note && note.y >= 190, JSON.stringify(note));
check('no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= 390));

// (e) Layers: 9 groups, no Business, dot badge (no number).
await nav('Layers').click();
await page.waitForTimeout(800);
const layersText = await page.locator('.layer-manager').innerText();
check('no Business group in Layers', !/\bBusiness\b/.test(layersText));
// All Leonida county card: the traced island outline, not an empty
// dark tile. The geo loads lazily, so wait for the SVG.
await page.waitForSelector('.county-card.is-all svg.county-outline', { timeout: 10000 });
const allLeonida = await page.evaluate(() => {
  const card = document.querySelector('.county-card.is-all');
  const svg = card?.querySelector('svg.county-outline');
  const path = svg?.querySelector('path');
  return {
    hasSvg: !!svg,
    hasPath: !!path && (path.getAttribute('d') ?? '').length > 50,
    noAiTag: !card?.querySelector('.county-art-tag'),
  };
});
check(
  'All Leonida card carries the traced island outline',
  allLeonida.hasSvg && allLeonida.hasPath,
  JSON.stringify(allLeonida),
);
check('All Leonida outline is traced geometry, not AI art', allLeonida.noAiTag);
await shot('b-layers-nine-groups');
await nav('Map').click();
await page.waitForTimeout(800);

// (f) Place card: lootable place from Find.
await page.getByRole('button', { name: /show lootable/i }).click();
await page.waitForSelector('.atlas-map-marker', { timeout: 10000 });
await page.waitForTimeout(1500);
check('lootable pins appear', (await markerCount()) > 0);
// The Layers badge only exists while layers are on — it must be a
// dot (no number), not an unread-notification count.
const badge = page.locator('.bottom-nav-badge');
check(
  'Layers tab badge is a dot, not a number',
  (await badge.count()) === 1 && ((await badge.textContent()) ?? '').trim() === '',
);
check(
  'attribution back once layers are on',
  (await page.locator('.atlas-map-attribution').count()) === 1,
);
const attrTruncated = await page.evaluate(() => {
  const el = document.querySelector('.atlas-map-attribution');
  return el ? el.scrollWidth > el.clientWidth + 1 : true;
});
check('attribution fits (not truncated)', !attrTruncated);
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('.place-result').first().click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const sheet = page.locator('.place-sheet');
const sheetText = (await sheet.textContent()) ?? '';
const placeTitle = (await sheet.locator('h2').textContent()) ?? '';
const cropBox = await page.locator('.place-map-crop').boundingBox();
const cropTiles = await page.locator('.place-map-crop .leaflet-tile-loaded').count();
check('card photo crop renders (was 0px tall)', !!cropBox && cropBox.height >= 90 && cropTiles > 0, `h=${cropBox?.height} tiles=${cropTiles}`);
check('card shows county line', ((await page.locator('.place-card-county').textContent()) ?? '').trim().length > 0);
check('card shows description', ((await page.locator('.place-card-desc').textContent()) ?? '').trim().length > 0);
check(
  'card headline never shows "?" as the title',
  !placeTitle.trim().startsWith('?'),
  placeTitle,
);
const chips = await page.locator('.place-card-chips span').evaluateAll((els) =>
  els.map((el) => el.textContent?.trim() ?? ''),
);
check('card shows category chips (reference sheet)', chips.length >= 1, JSON.stringify(chips));
check('card has Set Route / View Area / Add to List', ['Set Route', 'View Area', 'Add to List'].every((t) => sheetText.includes(t)));
const fileInput = await page.locator('.place-sheet input[type="file"]').boundingBox();
check('no raw Choose File control visible', !fileInput || fileInput.width <= 2, JSON.stringify(fileInput));
check('card shows Available loot', sheetText.includes('Available loot'));
check('card shows Hidden collectables', sheetText.includes('Hidden collectables'));
check('card shows Mark as explored', sheetText.includes('Mark as explored'));
check('card shows Your tags', sheetText.includes('Your tags'));
check('card has no raw game coordinates', !/Game coordinates/.test(sheetText));
const sheetBox = await sheet.boundingBox();
check('sheet is compact (60dvh, was 72dvh)', !!sheetBox && sheetBox.height <= 510, JSON.stringify(sheetBox));
// This card's description is only ~105 characters, but three lines
// at this column width hold ~90 — it clamps mid-sentence, so the
// Read more toggle must appear on overflow, not on length.
const cardReadMore = page.locator('.place-card-desc-more');
check('clamped card description has a Read more toggle', (await cardReadMore.count()) === 1);
await cardReadMore.click();
await page.waitForTimeout(400);
check(
  'card Read more expands the description',
  await page.evaluate(() => document.querySelector('.place-card-desc')?.classList.contains('is-expanded')),
);
check(
  'card Read more flips to Show less',
  ((await cardReadMore.textContent()) ?? '').trim() === 'Show less',
);
await shot('c-place-card');

// (g) Tags + explored, then a reload to prove they stick.
await sheet.getByLabel(/Add your own tag/i).fill('sells t-shirts');
await sheet.getByRole('button', { name: 'Add tag', exact: true }).click();
await page.waitForTimeout(800);
check('tag appears as Your tag', ((await sheet.textContent()) ?? '').includes('Your tag: sells t-shirts'));
await sheet.getByRole('button', { name: /Mark as explored/ }).click();
await page.waitForTimeout(800);
check('explored button flips to Explored', ((await sheet.textContent()) ?? '').includes('Explored ✓'));
await shot('d-tag-and-explored');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1200);
const restore = page.getByRole('button', { name: /Restore my last layers/ });
if ((await restore.count()) > 0) {
  await restore.first().click();
  await page.waitForTimeout(1200);
}
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill(placeTitle);
await page.waitForTimeout(1000);
await page
  .locator('.sidebar')
  .getByRole('button', { name: new RegExp(placeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  .first()
  .click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(800);
const sheet2Text = (await page.locator('.place-sheet').textContent()) ?? '';
check('tag survives reload', sheet2Text.includes('Your tag: sells t-shirts'));
check('explored survives reload', sheet2Text.includes('Explored ✓'));
await shot('e-reload-sticks');

// (h) Region card: the real Vice City region — not a shop whose
// name happens to contain "Vice City". Close the card from (g) first
// (the hero chips only render when no place is selected), then the
// Locations chip turns the regions layer on, then the result whose
// title is exactly "Vice City" is the region (id region:vice-city).
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);
await nav('Map').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Locations', exact: true }).click();
await page.waitForTimeout(1200);
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill('Vice City');
await page.waitForTimeout(1000);
await page
  .locator('.place-result', { has: page.locator('strong', { hasText: /^Vice City$/ }) })
  .first()
  .click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
const regionSheet = page.locator('.place-sheet');
const regionText = (await regionSheet.textContent()) ?? '';
const regionTitle = (await regionSheet.locator('h2').textContent()) ?? '';
check('region card is Vice City itself', regionTitle.trim() === 'Vice City', regionTitle);
check('region card has a photo/crop', (await page.locator('.place-map-crop').count()) >= 1 || (await page.locator('.place-photo img').count()) >= 1);
check('region card shows county', ((await page.locator('.place-card-county').textContent()) ?? '').trim().length > 0);
check('region card shows description', ((await page.locator('.place-card-desc').textContent()) ?? '').trim().length > 0);
check('region card description is the real one', /Ocean Beach/i.test(regionText), regionText.slice(0, 120));
check('region card never says "this building"', !/this building/i.test(regionText));
check(
  'region card says "this area" for its photo',
  /No photo of this area yet/.test(regionText),
  regionText.slice(0, 200),
);
const regionChips = await page.locator('.place-card-chips span').evaluateAll((els) =>
  els.map((el) => el.textContent?.trim() ?? ''),
);
check('region card shows kind + nearby category chips', regionChips.length >= 2, JSON.stringify(regionChips));
// Read more: the region description is long — it clamps to three
// lines and the toggle expands it in full instead of ending
// mid-sentence.
const readMore = page.locator('.place-card-desc-more');
check('long region description has a Read more toggle', (await readMore.count()) === 1);
await readMore.click();
await page.waitForTimeout(400);
check(
  'Read more expands the description',
  await page.evaluate(() => document.querySelector('.place-card-desc')?.classList.contains('is-expanded')),
);
check('Read more flips to Show less', ((await readMore.textContent()) ?? '').trim() === 'Show less');
await shot('f-region-card');
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);

// (i) No label peeks under the hero at island zoom.
const labelsUnderHero = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.atlas-place-label').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < 200 && r.bottom > 0) bad.push(el.textContent);
  });
  return bad;
});
check('no map label peeks under the hero', labelsUnderHero.length === 0, JSON.stringify(labelsUnderHero));

// (j) Street zoom: reload, turn EVERYTHING on (the lootable layer
// alone has no unnamed places), fly to Vice City for the cluster
// badges, then fly downtown and zoom in to labels — the region
// centre itself is a park, too sparse to prove the street view.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1200);
const skip2 = page.getByRole('button', { name: /Skip for now/ });
if ((await skip2.count()) > 0) {
  await skip2.first().click();
  await page.waitForTimeout(800);
}
await page.getByRole('button', { name: /Show everything/i }).click();
await page.waitForTimeout(1500);
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill('Vice City');
await page.waitForTimeout(1000);
await page.locator('.place-result').first().click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(1200);
// At the region-fly zoom the full layers are back, clustered — this
// is where the count badge is actually visible, so this is where
// its restyle is checked. (At island zoom there is no clustering
// by design — hero pins only; at max street zoom the markers are
// spread out and there are no clusters either.)
const flyBadges = await page.evaluate(() =>
  [...document.querySelectorAll('.atlas-cluster-count')].map((el) =>
    getComputedStyle(el).backgroundColor,
  ),
);
check(
  'count badges are dark, not coral',
  flyBadges.length > 0 && flyBadges.every((b) => b.includes('11, 16, 24')),
  JSON.stringify(flyBadges.slice(0, 5)),
);
// The region centre is a park: at max zoom it holds two unnamed
// pins and no labels, which proves nothing about the street view.
// Fly downtown instead — "Parking Lot, Downtown, Vice City" sits
// in the densest named part of the city. Order matters: zoom to
// max FIRST, then select the place — the place fly keeps the
// current zoom, so selecting first and zooming after would zoom
// about the screen centre and push the place off the top of the
// screen. Zooming first, the fly holds max zoom and centres the
// place in the band above the sheet.
const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
for (let i = 0; i < 9; i++) {
  if (!(await zoomIn.isEnabled())) break;
  await zoomIn.click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill('Parking Lot');
await page.waitForTimeout(1000);
await page
  .locator('.place-result', {
    has: page.locator('strong', { hasText: /^Parking Lot, Downtown, Vice City$/ }),
  })
  .first()
  .click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(1200);
// The map only renders the Find-filtered list: with "Parking Lot"
// still in the search box the map would show parking lots only.
// Clear it so the street view shows everything in the window.
// (Closing the sheet drops back to the Map tab, so switch to Find
// first — the search box only exists there.)
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill('');
await page.waitForTimeout(1200);
// At this camera the named places sit under the chrome — the Metro
// pin is at the very right edge behind the edge stack, the second
// lot behind the zoom pill — which is exactly what the filter is
// for, but it leaves nothing to label. Switch back to the Map tab
// (the Find panel covers the map and would swallow the drag), then
// drag the map down-left so they land in the open band, the way a
// player would. Down-left, not straight down: straight down leaves
// the Metro pin half-cut at the right edge, and the filter (rightly)
// hides a half-cut pin. Slowly, in steps: a fast flick triggers
// Leaflet's drag inertia and the camera glides ~360px further
// north-east, into the bay — the street shot ends up mostly water.
// Then wait for the new tiles to arrive — the shot right after a
// pan is the bare tile background, not the street.
await nav('Map').click();
await page.waitForTimeout(800);
await page.mouse.move(195, 600);
await page.mouse.down();
for (const [x, y] of [
  [183, 624],
  [171, 648],
  [159, 672],
  [147, 696],
  [135, 720],
]) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(120);
}
await page.mouse.up();
// Let drag inertia settle before the shot: marker positions must
// stop moving, or the screenshot catches pins mid-glide at the
// screen edge while the checks (run a moment later) see them
// already in the band.
await page
  .waitForFunction(
    () => {
      const pos = [...document.querySelectorAll('.atlas-map-marker')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.left)},${Math.round(r.top)}`;
        })
        .join('|');
      const prev = window.__markerSettle;
      if (!prev || prev.pos !== pos) {
        window.__markerSettle = { pos, t: Date.now() };
        return false;
      }
      return Date.now() - prev.t > 500;
    },
    { timeout: 8000 },
  )
  .catch(() => {});
await page.waitForTimeout(2500);
await shot('g-street-zoom');
const street = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.atlas-place-label')].map((el) => el.textContent ?? '');
  const unnamed = document.querySelectorAll('.atlas-map-marker.is-unnamed').length;
  const badges = [...document.querySelectorAll('.atlas-cluster-count')].map((el) =>
    getComputedStyle(el).backgroundColor,
  );
  const markers = document.querySelectorAll('.atlas-map-marker').length;
  return { labels, unnamed, badges: badges.slice(0, 5), markers };
});
check('street zoom shows real places (not a vacuous pass)', street.markers >= 3, `${street.markers} markers`);
check('street zoom shows labels', street.labels.length > 0, `${street.labels.length} labels`);
check('no "?" name pill at street zoom', street.labels.every((t) => !t.startsWith('?')), JSON.stringify(street.labels.slice(0, 6)));
check('unnamed pins wear the small is-unnamed class', street.unnamed > 0, `${street.unnamed} unnamed pins`);

// (j2) Chrome-safe pins and labels (v0.25.0): no marker centre sits
// under the top chrome (200px + 12px margin), the right-edge stack
// (x > 318, y 200–316), the zoom pill (x > 318, y 671–768, no
// prompt up) or the bottom strip (y > 804); no label runs past the
// right edge or into the real chrome rects (top < 200).
const chrome = await page.evaluate(() => {
  const bad = [];
  const inRightChrome = (x, y) =>
    (x > 318 && y >= 200 && y <= 316) || (x > 318 && y >= 671 && y <= 768);
  document.querySelectorAll('.atlas-map-marker').forEach((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cy < 212 || cy > 804 || cx < 24 || cx > 366 || inRightChrome(cx, cy))
      bad.push(`marker ${el.getAttribute('aria-label') ?? ''} @ ${Math.round(cx)},${Math.round(cy)}`);
  });
  document.querySelectorAll('.atlas-place-label').forEach((el) => {
    const r = el.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    if (r.right > 390) bad.push(`label ${el.textContent} past right edge (${Math.round(r.right)})`);
    if (r.top < 200) bad.push(`label ${el.textContent} under top chrome (${Math.round(r.top)})`);
    if (inRightChrome(r.left, cy) || inRightChrome(r.right, cy))
      bad.push(`label ${el.textContent} under right-edge chrome`);
    if (r.bottom > 804) bad.push(`label ${el.textContent} under bottom strip`);
  });
  return bad;
});
check('no pin or label hides under the chrome', chrome.length === 0, JSON.stringify(chrome.slice(0, 5)));
// Labels must not pile on each other either — three 200px labels
// from pins 30px apart read as one smudge.
const overlappingLabels = await page.evaluate(() => {
  const rects = [...document.querySelectorAll('.atlas-place-label')].map((el) => ({
    text: el.textContent ?? '',
    r: el.getBoundingClientRect(),
  }));
  const bad = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r;
      const b = rects[j].r;
      if (a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2)
        bad.push(`${rects[i].text} / ${rects[j].text}`);
    }
  }
  return bad;
});
check('no two labels overlap', overlappingLabels.length === 0, JSON.stringify(overlappingLabels));

// (j3) Unnamed place headline: Find "Washington Beach" and open an
// unresolved "?" — the sheet headlines the area, never "?".
await nav('Find').click();
await page.waitForTimeout(800);
await page.locator('#atlas-search').fill('Washington Beach');
await page.waitForTimeout(1000);
await page
  .locator('.place-result', {
    has: page.locator('strong', { hasText: /^Washington Beach, Vice Beach$/ }),
  })
  .first()
  .click();
await page.waitForSelector('.place-sheet', { timeout: 10000 });
await page.waitForTimeout(1200);
const unnamedTitle = (await page.locator('.place-sheet h2').textContent()) ?? '';
const unnamedEyebrow = (await page.locator('.place-sheet .eyebrow').textContent()) ?? '';
check(
  'unnamed place headlined by its area',
  unnamedTitle.trim() === 'Washington Beach, Vice Beach',
  unnamedTitle,
);
check(
  'unnamed place eyebrow says UNVERIFIED PLACE',
  unnamedEyebrow.trim() === 'UNVERIFIED PLACE',
  unnamedEyebrow,
);
await shot('h-unnamed-place-card');
await page.getByRole('button', { name: /Close place details/i }).click();
await page.waitForTimeout(800);

// (k) Turn everything off.
await nav('Layers').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check('Turn everything off → 0 markers', (await markerCount()) === 0);

// The vicewire pyramid (v0.24 v1, basemap lane's v2 since) still
// has no ocean rows at z1–z3: a tile one row north of the island
// (tileY=0) 404s and the ocean.jpg errorTileUrl covers it by design
// ("Missing tiles are ocean the source never drew"). Those 404s are
// tolerated and counted; anything else is a real failure. Flagged to
// the lead as a basemap follow-up (ship ocean tiles for those rows
// to silence the 404s).
const vicewire404s = failedRequests.filter((r) =>
  /\/tiles\/vicewire-v\d+\/\d+\/\d+,0,\d+\.jpg 404/.test(r),
);
// Tile loads cancelled mid-flight abort instead of 404ing — the
// camera flies away before they arrive, so the load is no longer
// needed. ERR_ABORTED on a tile URL is the fly cancelling, not a
// failure; the tile re-requests if the camera comes back.
const abortedTiles = failedRequests.filter(
  (r) => /\/tiles\/vicewire-v\d+\//.test(r) && /ERR_ABORTED/.test(r),
);
const otherFailures = failedRequests.filter(
  (r) =>
    !/\/tiles\/vicewire-v\d+\/\d+\/\d+,0,\d+\.jpg 404/.test(r) &&
    !(/\/tiles\/vicewire-v\d+\//.test(r) && /ERR_ABORTED/.test(r)),
);
check(
  'zero failed requests except by-design vicewire ocean-row 404s and fly-cancelled tile loads',
  otherFailures.length === 0,
  otherFailures.slice(0, 3).join(' | '),
);
console.log(`tolerated vicewire ocean-row 404s: ${vicewire404s.length}`);
console.log(`tolerated fly-cancelled tile loads: ${abortedTiles.length}`);
const tile404ConsoleErrors = consoleErrors.filter((e) => /404/.test(e));
check(
  'zero console errors except the same tile 404s',
  consoleErrors.length === tile404ConsoleErrors.length &&
    tile404ConsoleErrors.length === vicewire404s.length,
  consoleErrors.slice(0, 3).join(' | '),
);

await browser.close();
server.close();
console.log(failures.length === 0 ? '\nWALK PASSED' : `\nWALK FAILED: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
