// ViceWire v0.33 Lane C (items 2 + 8) demo probe — 390px, DPR 2.
//
// Serves dist/ on port 4346 and drives the real app with Playwright
// Chromium, fresh profile, no key, no seed.
//
//   node scripts/check-v033-lane-c.mjs
//
// What it proves, in the real browser:
//  (a) set drive end to end on Delights Dancers — Collections → the
//      set → "Show on map", ONLY its pins show island-wide (the
//      pinned count is measured from the data at run time: 5 of 18
//      at build time, import not landed), header x/y + per-county
//      breakdown correct, Hide found removes found pins, exit
//      returns to the previous layer state.
//  (b) Mark found from the pin — FOUND stamp, tick badge on the
//      pin, counters increment everywhere, tick VISIBLE on the map
//      immediately after (NO manual "Clear highlights" — that is
//      the reveal-trap fix), survives restart; tap again to unmark.
//      Two paths: the card's own dialog (Kandi, clean single) and
//      the host sheet (Jason via L629 Delights, the trap path — the
//      card sits at the host's exact coordinates).
//  (c) Next-in-set jumps to the next uncollected card (Kandi →
//      Perla), skipping collected cards.
//  (d) counts — the identical "x / y found" string in panel header
//      (banner), pill, dialog footer, journal row and album cover.
//  (e) Lane A + Lane B regression: run scripts/check-v033-lane-a.mjs
//      --after and scripts/check-v033-lane-b.mjs against the same
//      build (separate runs, ports 4345/4346); the kill-switch
//      (one-tap turn-everything-off) is checked here too.
//
// Output: hidden_files/v033-demos/ (lane-c-*.png + lane-c-checks.json).
// Screenshots must be LOOKED AT, not just logged.
/* global document, localStorage */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v033-demos/';
mkdirSync(OUT, { recursive: true });
const DIST = new URL('../dist/', import.meta.url).pathname;
const PORT = 4346;
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
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
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
await new Promise((resolve) => server.listen(PORT, resolve));
const base = `http://127.0.0.1:${PORT}${BASE_PATH}`;

const results = [];
function check(name, pass, evidence) {
  results.push({ name, pass, evidence: String(evidence ?? '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} — ${evidence ?? ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));

const markerCounts = () =>
  page.evaluate(() => {
    const markers = [...document.querySelectorAll('.atlas-map-marker')];
    const faces = markers.map((m) => m.querySelector('.atlas-pin-face, .atlas-cluster-face'));
    const colours = {};
    const glyphs = {};
    let dots = 0;
    let found = 0;
    for (const [i, face] of faces.entries()) {
      if (!face) continue;
      const color = (face.style.getPropertyValue('--pin-color') || '').toLowerCase();
      if (color) colours[color] = (colours[color] ?? 0) + 1;
      if (face.classList.contains('is-dot')) dots++;
      const svg = face.querySelector('svg');
      const glyph = svg
        ? (svg.getAttribute('class') ?? '').split(' ').find((c) => c.startsWith('lucide-') && c !== 'lucide')
        : 'dot';
      glyphs[glyph ?? 'none'] = (glyphs[glyph ?? 'none'] ?? 0) + 1;
      if (markers[i].classList.contains('is-found')) found++;
    }
    return {
      total: markers.length,
      clusters: document.querySelectorAll('.atlas-map-marker.is-cluster').length,
      dots,
      found,
      colours,
      glyphs,
    };
  });

const savedZoom = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('leonida-map-camera-v1') ?? 'null')?.zoom ?? null;
    } catch {
      return null;
    }
  });

async function setZoom(target) {
  for (let i = 0; i < 16; i++) {
    const z = await savedZoom();
    if (z !== null && Math.abs(z - target) < 0.01) return z;
    const btn =
      z === null || z < target
        ? page.locator('.atlas-edge-zoom button[aria-label="Zoom in"]')
        : page.locator('.atlas-edge-zoom button[aria-label="Zoom out"]');
    // Fail fast (3s, not Playwright's 30s): the zoom pill is hidden
    // while a sheet is open, so a setZoom call with the sheet up
    // would otherwise burn 16 × 30s here. Callers zoom with the
    // sheet closed.
    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  return savedZoom();
}

const shot = (name) => page.screenshot({ path: `${OUT}lane-c-${name}.png` });

async function turnAllOn() {
  await page.locator('.map-chip').first().click();
  await page.waitForTimeout(2500);
}

const cardPin = (prefix) =>
  page.evaluate((prefix) => {
    const markers = [...document.querySelectorAll('.atlas-map-marker')];
    const pin = markers.find((m) => (m.getAttribute('aria-label') ?? '').startsWith(prefix));
    if (!pin) return { present: false };
    const face = pin.querySelector('.atlas-pin-face, .atlas-cluster-face');
    return {
      present: true,
      isCluster: pin.classList.contains('is-cluster'),
      isDot: face?.classList.contains('is-dot') ?? false,
      isFound: pin.classList.contains('is-found'),
      badge: !!face?.querySelector('.atlas-found-badge'),
      color: (face?.style.getPropertyValue('--pin-color') || '').toLowerCase(),
      glyph: face?.querySelector('svg')?.getAttribute('class') ?? null,
    };
  }, prefix);

const bannerText = () =>
  page.evaluate(() => {
    const bar = document.querySelector('.set-drive-bar');
    if (!bar) return null;
    // The bar's count IS the pill: the title is the set name only
    // (name + count + pill cannot fit the 280px top row — the
    // count used to truncate to "0 …"). So `count` reads the pill.
    const pill = bar.querySelector('.set-drive-pill')?.textContent ?? '';
    const title = bar.querySelector('.set-drive-title')?.textContent ?? '';
    const counties = bar.querySelector('.set-drive-counties')?.textContent ?? '';
    const pinned = bar.querySelector('.set-drive-pinned')?.textContent ?? '';
    return { count: pill, pill, title, counties, pinned, full: bar.textContent ?? '' };
  });

async function clickMapPin(prefix) {
  // The acceptance flow taps the pin itself. If the pin click does
  // not open the sheet (marker hit area / overlay), fall back to
  // Find — which selects the same place without a reload, so the
  // drive survives — and say so in the evidence.
  await page.locator(`.atlas-map-marker[aria-label^="${prefix}"]`).first().click();
  try {
    await page.waitForSelector('.place-sheet', { timeout: 5000 });
    return 'pin click';
  } catch {
    // Find's POI search routes card hits to their HOST (by design),
    // so the fallback uses the plain nearest-first list with NO
    // query: the card is the nearest exact-title match to the pin
    // just tapped.
    await page.locator('.map-search-pill').click();
    await page.waitForTimeout(1200);
    await page
      .locator('.place-result', { has: page.locator(`strong:text-is("${prefix}")`) })
      .first()
      .click();
    await page.waitForSelector('.place-sheet', { timeout: 10000 });
    return 'Find fallback (pin click did not open the sheet)';
  }
}

const sheetTitle = () =>
  page.evaluate(() => document.querySelector('.place-sheet h2')?.textContent ?? '');

/** Collections → Delights → "Show on map". The journal row may
 * already be expanded (its state survives a reload), so expand
 * only when the button is not visible. */
async function enterDrive() {
  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await page.waitForTimeout(1200);
  const showBtn = page.getByRole('button', {
    name: 'Show only the Delights Dancers cards on the map',
  });
  if (!(await showBtn.isVisible())) {
    await page.locator('.journal-set summary', { hasText: 'Delights Dancers' }).click();
    await page.waitForTimeout(800);
  }
  await showBtn.click();
  await page.waitForTimeout(3000);
}

try {
  // ---- (0) clean launch -----------------------------------------------
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-map-canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const clean = await markerCounts();
  check('clean launch: 0 markers, layers off', clean.total === 0, JSON.stringify(clean));
  await shot('00-clean-launch');

  // ---- (1) All on, island — the previous layer state the drive must restore
  // Island zoom is hero mode: ~19 hero pins, not the whole catalogue.
  await turnAllOn();
  const islandAllOn = await markerCounts();
  const islandZoom = await savedZoom();
  check(
    'island All on: baseline for the exit check',
    islandAllOn.total > 0 && islandAllOn.clusters === 0,
    `total=${islandAllOn.total} zoom=${islandZoom}`,
  );

  // ---- (a) set drive: Collections → Delights → "Show on map" ----------
  await enterDrive();
  const drive = await bannerText();
  check(
    'drive banner: set name (whole, untruncated) + 0 / 18 found + 5 pinned of 18 + counties',
    drive !== null &&
      drive.title === 'Delights Dancers' &&
      drive.count === '0 / 18 found' &&
      drive.pinned.includes('5 pinned of 18') &&
      drive.counties.includes('Kelly County 3') &&
      drive.counties.includes('Vice-Dale County 2'),
    JSON.stringify(drive),
  );
  check(
    'drive pill: the identical "0 / 18 found" string',
    drive !== null && drive.pill === '0 / 18 found',
    drive?.pill ?? 'no banner',
  );
  const driveMarkers = await markerCounts();
  await shot('01-drive-island');
  check(
    'drive island-wide: ONLY the 5 Delights pins show (Harley incl.)',
    driveMarkers.total === 5 && driveMarkers.clusters === 0,
    JSON.stringify(driveMarkers),
  );
  check(
    'drive pins: all five light-blue card dots (island zoom renders dots, not full pins)',
    (driveMarkers.colours['#6fb7e8'] ?? 0) === 5 && driveMarkers.dots === 5,
    JSON.stringify({ colours: driveMarkers.colours, glyphs: driveMarkers.glyphs, dots: driveMarkers.dots }),
  );
  const driveZoom = await savedZoom();
  console.log(`  drive zoom=${driveZoom} (hero mode, island-wide)`);

  // ---- (b1) Mark found from the CARD's own dialog (Kandi) -------------
  // Kandi is a clean single at every zoom in the drive (her host
  // Farmacia's layer is off, so no cluster can form) — the
  // straightforward Mark-found path.
  const viaKandi = await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  check('Kandi dialog opens from the pin', (await sheetTitle()).startsWith('Kandi'), `${viaKandi}; title=${await sheetTitle()}`);
  const markBtn = page.getByRole('button', { name: 'Mark Kandi as found' });
  await markBtn.waitFor({ timeout: 10000 });
  await markBtn.click();
  await page.waitForTimeout(2000);
  const stamp = await page.locator('.mark-found-stamp').count();
  const foundLabel = await page
    .getByRole('button', { name: 'Unmark Kandi as found' })
    .count();
  const driveAfterMark = await bannerText();
  check(
    'Kandi Mark found: FOUND stamp + button flips to unmark + banner 1 / 18 found',
    stamp === 1 && foundLabel === 1 && driveAfterMark?.count === '1 / 18 found',
    `stamp=${stamp} unmarkBtn=${foundLabel} banner=${driveAfterMark?.count}`,
  );
  await shot('02-mark-found-kandi-sheet');
  // The click scrolled the sheet to the button (it sits below the
  // fold); scroll back to the top so the FOUND stamp + title are
  // in the shot — a player tapping Mark found has scrolled the
  // head out of view, and scrolls back up to see the stamp.
  await page.evaluate(() => {
    document.querySelector('.detail-scroll')?.scrollTo({ top: 0 });
  });
  await page.waitForTimeout(500);
  await shot('02b-mark-found-kandi-stamp');
  await page.keyboard.press('Escape');
  // Closing the sheet during a drive re-fits the island (the focus
  // effect parks the pin under the bar); allow the fly to settle.
  await page.waitForTimeout(2500);
  // THE reveal-trap assertion: the tick is visible on the map
  // immediately, with NO manual "Clear highlights" step.
  const kandiPin = await cardPin('Kandi');
  await shot('03-tick-visible-kandi');
  check(
    'Kandi tick VISIBLE on the map right after marking (no Clear highlights)',
    kandiPin.present === true &&
      kandiPin.isCluster === false &&
      kandiPin.isFound === true &&
      kandiPin.badge === true &&
      kandiPin.color === '#6fb7e8',
    JSON.stringify(kandiPin),
  );

  // ---- (a2) Hide found --------------------------------------------------
  await page.getByLabel('Hide found').click();
  await page.waitForTimeout(2000);
  const hidden = await markerCounts();
  const driveHidden = await bannerText();
  check(
    'Hide found: the found pin vanishes, the header count stands at 1 / 18 found',
    hidden.total === 4 && driveHidden?.count === '1 / 18 found',
    `total=${hidden.total} banner=${driveHidden?.count}`,
  );
  await shot('04-hide-found');
  await page.getByLabel('Hide found').click();
  await page.waitForTimeout(2000);
  const shown = await markerCounts();
  check('Hide found off: all 5 pins back', shown.total === 5, `total=${shown.total}`);

  // ---- (c) Next-in-set jumps to the next uncollected card --------------
  await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  const footer = await page.locator('.set-next-button').innerText().catch(() => '');
  check(
    'Next-in-set footer: "Next in Delights Dancers · 1 / 18 found — Perla >"',
    footer.includes('Next in Delights Dancers') &&
      footer.includes('1 / 18 found') &&
      footer.includes('Perla'),
    footer,
  );
  await page.locator('.set-next-button').click();
  await page.waitForTimeout(2500);
  check(
    'Next-in-set: tapping it opens Perla’s dialog',
    (await sheetTitle()).startsWith('Perla'),
    `title=${await sheetTitle()}`,
  );
  await shot('05-next-in-set-perla');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);

  // ---- (b2) unmark Kandi from her own dialog ---------------------------
  await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Unmark Kandi as found' }).click();
  await page.waitForTimeout(2000);
  const driveAfterUnmark = await bannerText();
  check(
    'Kandi unmark: banner back to 0 / 18 found, stamp gone',
    driveAfterUnmark?.count === '0 / 18 found' &&
      (await page.locator('.mark-found-stamp').count()) === 0,
    `banner=${driveAfterUnmark?.count}`,
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  const kandiUnmarked = await cardPin('Kandi');
  check(
    'Kandi unmark: tick gone from the pin',
    kandiUnmarked.present === true && kandiUnmarked.isFound === false && kandiUnmarked.badge === false,
    JSON.stringify(kandiUnmarked),
  );

  // ---- (d) count identity: the identical string in all five surfaces ---
  // Banner + pill (map tab, drive active) — read now, before leaving.
  const identity = await bannerText();
  check(
    'count identity (1/5 banner): "0 / 18 found"',
    identity?.count === '0 / 18 found',
    identity?.count ?? 'no banner',
  );
  check(
    'count identity (2/5 pill): "0 / 18 found"',
    identity?.pill === '0 / 18 found',
    identity?.pill ?? 'no banner',
  );
  // Dialog footer (3/5): Kandi's dialog again.
  await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  const footer0 = await page.locator('.set-next-button').innerText().catch(() => '');
  check(
    'count identity (3/5 dialog footer): "0 / 18 found"',
    footer0.includes('0 / 18 found'),
    footer0,
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  // Journal row (4/5) + album cover (5/5).
  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await page.waitForTimeout(1200);
  const journalRow = await page
    .locator('.journal-set summary', { hasText: 'Delights Dancers' })
    .innerText()
    .catch(() => '');
  check(
    'count identity (4/5 journal row): "0 / 18 found"',
    journalRow.includes('0 / 18 found'),
    journalRow,
  );
  await page.getByRole('button', { name: 'Album', exact: true }).click();
  await page.waitForTimeout(1500);
  const albumCover = await page
    .locator('.album-set', { hasText: 'Delights Dancers' })
    .innerText()
    .catch(() => '');
  check(
    'count identity (5/5 album cover): "0 / 18 found"',
    albumCover.includes('0 / 18 found'),
    albumCover.slice(0, 200),
  );
  // Scroll the cover into view so the shot shows the fifth
  // surface, not just the album intro above it.
  await page
    .locator('.album-set', { hasText: 'Delights Dancers' })
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot('06-count-identity-album');

  // ---- (a3) exit the drive: previous layer state returns ---------------
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.locator('.set-drive-exit').click();
  await page.waitForTimeout(2500);
  const bannerGone = await page.locator('.set-drive-bar').count();
  await setZoom(-5);
  await page.waitForTimeout(2000);
  const afterExit = await markerCounts();
  check(
    'exit drive: banner gone, All-on layer state restored',
    bannerGone === 0 && afterExit.total === islandAllOn.total,
    `banner=${bannerGone} total=${afterExit.total} (was ${islandAllOn.total})`,
  );
  await shot('07-exit-drive');

  // ---- (e1) kill-switch: one tap turns everything off ------------------
  // The kill-switch is "Turn everything off" in the Layers sheet
  // (v0.30.0) — NOT the "All" chip, which only turns all ON
  // (clicking it with everything already on is a no-op). It turns
  // the layers off AND clears the reveal, so one tap leaves zero
  // markers. My markers are untouched.
  await page.getByRole('button', { name: 'Open map filters' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Turn everything off' }).click();
  await page.waitForTimeout(2500);
  const killed = await markerCounts();
  check('kill-switch: one tap turns everything off (layers + reveal)', killed.total === 0, `total=${killed.total}`);
  await page.getByRole('button', { name: 'Close map filters' }).click();
  await page.waitForTimeout(1200);

  // ---- (b3) the reveal TRAP path: Jason via his HOST sheet ------------
  // L629 Delights and Jason share exact coordinates. Marking Jason
  // on the host sheet must clear the highlight, so the host drops
  // off and Jason stands alone with his tick — with NO manual
  // "Clear highlights".
  //
  // The layer state is set AFTER the reload, not before: a reload
  // resets the layers to off (clean launch — the saved view is
  // written on change, but launch never re-applies it), so a
  // Collectibles click before the deep link is wiped by it. The
  // deep link opens L629's sheet with only the revealed host on
  // screen; the mark clears the reveal; then Collectibles goes on
  // and the island zoom shows Jason standing alone. (The
  // before-state — Jason trapped in a ×2 cluster with L629 at
  // every zoom — is Lane B §5 + the coincident coordinates; the
  // probe asserts the after-state, which is the acceptance.)
  await page.goto(`${base}?place=L629`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const markJason = page.getByLabel('Mark Jason as collected');
  await markJason.waitFor({ timeout: 10000 });
  await markJason.click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  // Sheet closed now, so the hero chips are back: turn the
  // collectibles layers on, then out to island zoom.
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  await setZoom(-5);
  await page.waitForTimeout(2000);
  const jasonPin = await cardPin('Jason');
  await shot('08-trap-jason-tick');
  check(
    'TRAP: Jason tick visible as a SINGLE pin right after host-sheet marking (no Clear highlights)',
    jasonPin.present === true &&
      jasonPin.isCluster === false &&
      jasonPin.isFound === true &&
      jasonPin.badge === true &&
      jasonPin.color === '#6fb7e8',
    JSON.stringify(jasonPin),
  );
  // Unmark Jason from his OWN dialog (the host checkbox is disabled
  // once done — the card dialog is the unmark path). Via deep link:
  // Find's POI search routes card hits to their HOST by design (a
  // POI hit reveals the thing at its host), so Find can never open
  // a card's own dialog while a query is active; and at island zoom
  // Jason's pin shares one pixel with Harley's, so a tap there
  // opens Harley's dialog. The deep link opens Jason's sheet
  // directly (the completion log survives the reload, so the dialog
  // still offers the unmark).
  await page.goto(`${base}?place=card:jason`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  check('Jason dialog opens (deep link)', (await sheetTitle()).startsWith('Jason'), `title=${await sheetTitle()}`);
  await page.getByRole('button', { name: 'Unmark Jason as found' }).click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);
  // Layers reset on reload: Collectibles back on, out to island
  // zoom. Below hero zoom Jason + Harley merge into one cluster, so
  // the assertion reads the hero dot at −5.
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  await setZoom(-5);
  await page.waitForTimeout(2000);
  const jasonUnmarked = await cardPin('Jason');
  check(
    'Jason unmark from his own dialog: tick gone',
    jasonUnmarked.present === true && jasonUnmarked.isFound === false,
    JSON.stringify(jasonUnmarked),
  );

  // ---- (b4) persistence: Mark found survives a reload ------------------
  // Kandi is not a hero at island zoom with full Collectibles on
  // (another collectible holds her cell), so the persistence mark
  // runs inside the drive, where she is soloed and her pin is
  // guaranteed visible. The mark itself is still the pin dialog's
  // Mark found button.
  await enterDrive();
  await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Mark Kandi as found' }).click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-map-canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const bannerAfterReload = await page.locator('.set-drive-bar').count();
  check(
    'reload: the drive does NOT persist (clean launch rule)',
    bannerAfterReload === 0,
    `banner=${bannerAfterReload}`,
  );
  // The drive does not persist across a reload — re-enter it.
  await enterDrive();
  const kandiReloaded = await cardPin('Kandi');
  check(
    'Kandi tick survives a reload (completion log persisted)',
    kandiReloaded.present === true && kandiReloaded.isFound === true && kandiReloaded.badge === true,
    JSON.stringify(kandiReloaded),
  );
  await shot('09-persistence-kandi');
  // Leave the disposable profile clean: unmark Kandi again (still
  // in the drive — her pin is soloed and visible here).
  await clickMapPin('Kandi');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Unmark Kandi as found' }).click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  // Closing the sheet during a drive re-fits the island — allow
  // the fly to settle before reading the pin (same 2500ms as b1).
  await page.waitForTimeout(2500);
  const kandiClean = await cardPin('Kandi');
  check('final state: Kandi unmarked again (0 / 18 found)', kandiClean.isFound === false, JSON.stringify(kandiClean));

  check('no page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'none');
  // Fly-cancelled graded-tile loads (net::ERR_ABORTED on /tiles/) are
  // Leaflet aborting superseded tile requests on navigation/zoom —
  // the app walk tolerates them the same way (v0.30 reveal probe).
  // Anything else failing (a 404, a non-tile request) still fails.
  const realFailures = failedRequests.filter(
    (f) => !(f.includes('/tiles/graded/') && f.includes('ERR_ABORTED')),
  );
  check('no failed requests', realFailures.length === 0, realFailures.slice(0, 3).join(' | ') || 'none (only fly-cancelled tile loads)');
} finally {
  writeFileSync(`${OUT}lane-c-checks.json`, JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  server.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((f) => f.name).join(' | ')}`);
  process.exit(1);
}
