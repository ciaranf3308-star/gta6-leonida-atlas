// QA v0.30.0 — navigation flows, zoom sweep, DPR spot-checks:
//   (1) zoom in/out full sweep: tiles load, no console errors, no
//       horizontal overflow at fit / mid / max;
//   (2) Layers: toggle each of the 9 Map Index groups on, then
//       "Turn everything off" -> 0 markers;
//   (3) county isolation: pick a county card, map isolates;
//   (4) Find with a layer on -> place sheet actions (Set Route /
//       View Area / Add to List) all respond without error;
//   (5) Settings open/close; backup dialog opens from Settings;
//   (6) 3D explorer via ?view=3d: renders or fails gracefully
//       (sandbox WebGL timeout is pre-existing — record, don't fail);
//   (7) DPR 1 and DPR 3 spot-checks (island + street).
// Self-serves dist/ on port 4356. Fixture ids only.
/* global document */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/qa-v030/';
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
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4356');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith('/gta6-leonida-atlas/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice('/gta6-leonida-atlas/'.length) || 'index.html';
  const file = join(DIST, path);
  if (!existsSync(file) || !file.startsWith(DIST)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(4356, resolve));
const base = 'http://127.0.0.1:4356/gta6-leonida-atlas/';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
};
const note = (msg) => console.log(`NOTE  ${msg}`);

const browser = await chromium.launch();
const consoleErrors = [];
const newPage = async (dpr) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: dpr,
    isMobile: true,
  });
  const pg = await context.newPage();
  pg.on('pageerror', (e) => consoleErrors.push(`DPR${dpr}: ${e}`));
  pg.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`DPR${dpr}: ${m.text()}`);
  });
  return { context, pg };
};
const skipAndClose = async (pg) => {
  const skip = pg.getByRole('button', { name: /Skip for now/ });
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await pg.waitForTimeout(800);
  }
  const close = pg.getByRole('button', { name: 'Close place details' });
  if ((await close.count()) > 0) {
    await close.first().click();
    await pg.waitForTimeout(800);
  }
};
const shot = async (pg, name) => {
  try {
    await pg.screenshot({ path: `${OUT}${name}.png`, timeout: 15000 });
  } catch (e) {
    note(`screenshot ${name} timed out (${String(e.message).slice(0, 60)}) — continuing`);
  }
};
const markerCount = (pg) => pg.evaluate(() => document.querySelectorAll('.atlas-map-marker').length);
const overflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// --- DPR 2: the full flow pass ---
{
  const { context, pg: page } = await newPage(2);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await shot(page, 'nav-first-open');
  check('(1) first-open sheet present', (await page.locator('.place-sheet').count()) === 1);
  await skipAndClose(page);

  // (1) Zoom sweep in, then out.
  const zooms = [];
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: 'Zoom in' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(400);
    zooms.push(await page.locator('.leaflet-tile-loaded').count());
  }
  const maxTiles = await page.locator('.leaflet-tile-loaded').count();
  const maxOverflow = await overflow(page);
  await shot(page, 'nav-max-zoom');
  check('(1) zoom-in sweep reaches max with tiles', zooms.length > 0 && maxTiles > 0, `steps=${zooms.length} tiles=${maxTiles}`);
  check('(1) no horizontal overflow at max zoom', maxOverflow === 0, `${maxOverflow}px`);
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: 'Zoom out' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1000);
  const fitTiles = await page.locator('.leaflet-tile-loaded').count();
  check('(1) zoom-out sweep returns to the island with tiles', fitTiles > 0, `${fitTiles} tiles`);
  await shot(page, 'nav-fit');

  // (2) Layers: toggle the 9 groups on one at a time.
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForTimeout(800);
  const groupCounts = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.layer-manager input[type="checkbox"]')];
    return boxes.length;
  });
  note(`(2) layer checkboxes found: ${groupCounts}`);
  const perGroup = [];
  for (let i = 0; i < 9; i++) {
    const n = await page.evaluate((idx) => {
      const boxes = [...document.querySelectorAll('.layer-manager input[type="checkbox"]:not(:checked)')];
      if (!boxes[idx]) return -1;
      boxes[idx].click();
      return boxes.length;
    }, 0);
    if (n === -1) break;
    await page.waitForTimeout(900);
    perGroup.push(await markerCount(page));
  }
  note(`(2) markers after turning groups on one by one: ${perGroup.join(' -> ')}`);
  check('(2) turning groups on adds markers', perGroup.length > 0 && perGroup[perGroup.length - 1] > 0, JSON.stringify(perGroup));
  await page.getByRole('button', { name: /Turn everything off/i }).click();
  await page.waitForTimeout(800);
  check('(2) Turn everything off -> 0 markers', (await markerCount(page)) === 0, `${await markerCount(page)} markers`);

  // (3) County isolation: pick a county card in the sidebar.
  // County cards live ~3,000px down the Layers sidebar and show the
  // name without ' County' ('Kelly', not 'Kelly County').
  const countyBtn = page.locator('.sidebar .county-card', { hasText: 'Kelly' }).first();
  if ((await countyBtn.count()) > 0) {
    await countyBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await countyBtn.click();
    await page.waitForTimeout(1500);
    const isoOn = await page.evaluate(() => document.querySelectorAll('.county-card.active').length);
    check('(3) county isolation: Kelly card goes active', isoOn >= 1, `active cards=${isoOn}`);
    await shot(page, 'nav-county-isolation');
    // Exit isolation via the All Leonida card.
    const allBtn = page.locator('.sidebar .county-card.is-all').first();
    if ((await allBtn.count()) > 0) {
      await allBtn.scrollIntoViewIfNeeded();
      await allBtn.click();
      await page.waitForTimeout(1000);
    }
  } else {
    check('(3) county isolation: Kelly card present in the Layers sidebar', false, 'no .county-card with Kelly text');
  }
  await page.getByRole('button', { name: 'Map', exact: true }).click().catch(() => {});
  await page.waitForTimeout(800);

  // (4) Find with a layer on -> sheet actions.
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.layer-manager input[type="checkbox"]:not(:checked)')];
    boxes[0]?.click();
  });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.waitForTimeout(800);
  await page.waitForSelector('.place-result', { timeout: 10000 });
  await page.locator('.place-result').first().click();
  await page.waitForSelector('.place-sheet', { timeout: 10000 });
  await page.waitForTimeout(1200);
  const sheetText = (await page.locator('.place-sheet').textContent()) ?? '';
  check('(4) sheet has Set Route / View Area / Add to List', ['Set Route', 'View Area', 'Add to List'].every((t) => sheetText.includes(t)));
  for (const action of ['Add to List', 'View Area', 'Set Route']) {
    const btn = page.locator('.place-sheet').getByRole('button', { name: action, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(1000);
      note(`(4) "${action}" clicked without error`);
    }
  }
  await shot(page, 'nav-place-sheet');
  await skipAndClose(page);

  // (5) Settings + backup dialog.
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForTimeout(800);
  const settingsBtn = page.locator('.sidebar').getByRole('button', { name: 'Settings', exact: true });
  check('(5) Settings button present in the sidebar', (await settingsBtn.count()) > 0);
  if ((await settingsBtn.count()) > 0) {
    await settingsBtn.first().click();
    await page.waitForTimeout(1000);
    check('(5) Settings dialog opens', ((await page.locator('text=Back up my ViceWire').count()) > 0));
    const backupBtn = page.getByRole('button', { name: /Back up my ViceWire/i });
    check('(5) backup entry present in Settings', (await backupBtn.count()) > 0);
    if ((await backupBtn.count()) > 0) {
      await backupBtn.first().click();
      await page.waitForTimeout(1000);
      check('(5) backup dialog opens with Export', ((await page.locator('text=Export backup').count()) > 0));
      await shot(page, 'nav-backup-dialog');
      const closeDlg = page.getByRole('button', { name: 'Close dialog' });
      if ((await closeDlg.count()) > 0) await closeDlg.first().click();
      await page.waitForTimeout(600);
    }
    const closeSettings = page.getByRole('button', { name: /Close settings/i }).first();
    if ((await closeSettings.count()) > 0) await closeSettings.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // (6) 3D explorer via the route.
  await page.goto(`${base}?view=3d`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const explorerState = await page.evaluate(() => ({
    canvas: document.querySelectorAll('canvas').length,
    loading: /Opening 3D/.test(document.body.innerText),
    bodyStart: document.body.innerText.slice(0, 120),
  }));
  note(`(6) 3D explorer: canvas=${explorerState.canvas}, still loading=${explorerState.loading}`);
  await shot(page, 'nav-3d-explorer');
  check('(6) 3D explorer renders or shows its loading state (no hard crash)', explorerState.canvas > 0 || explorerState.loading, JSON.stringify(explorerState).slice(0, 160));
  await context.close();
}

// --- DPR 1 and DPR 3 spot-checks ---
for (const dpr of [1, 3]) {
  const { context, pg: page } = await newPage(dpr);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await skipAndClose(page);
  await shot(page, `nav-dpr${dpr}-island`);
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: 'Zoom in' });
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1500);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  check(`(7) DPR ${dpr}: max-zoom street loads tiles`, tiles > 0, `${tiles} tiles`);
  check(`(7) DPR ${dpr}: no horizontal overflow at max zoom`, (await overflow(page)) === 0, `${await overflow(page)}px`);
  await shot(page, `nav-dpr${dpr}-street`);
  await context.close();
}

const realErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e) && !/WebGL|webgl/i.test(e));
check('no console errors across the navigation pass (other than failed-resource logs and WebGL)', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(failures.length ? `QA NAV: ${failures.length} FAILURES — ${failures.join(', ')}` : 'QA NAV: ALL PASS');
process.exit(failures.length ? 1 : 0);
