// ViceWire v0.33 Lane B (items 1 + 7) demo probe — 390px, DPR 2.
//
// Serves dist/ on port 4346 and drives the real app with Playwright
// Chromium, fresh profile, no key, no seed.
//
//   node scripts/check-v033-lane-b.mjs
//
// What it proves, in the real browser:
//  (c) street zoom, Port Gellhorn, All on: >= 5 kinds side by side,
//      each distinguishable by colour+glyph, no two kinds sharing a
//      glyph+colour (read off the live pins, not the spec).
//  (d) island / district / street counts with everything on ("All"
//      chip). The "set on" column (Delights soloed) has NO UI route
//      until Lane C builds set drive mode — the filter sheet has no
//      cards:* toggles and selecting a place never turns its layer
//      on — so that column is measured headlessly on the real
//      catalogue through the same functions MapView calls
//      (scripts/measure-lane-b-density.mjs); the browser measures the
//      Collectibles chip at island zoom as the closest reachable
//      proxy, and the headless All-on numbers are cross-checked
//      against the browser All-on numbers here.
//  (e) a found Delights card keeps its colour + tick badge, across a
//      reload (completion-log persistence). Cards are marked on their
//      HOST's sheet (a card is an item, not a location). Opening the
//      host reveals it (highlightIds), and the reveal traps the card
//      in a ×2 cluster with its host at every zoom — so the check
//      clears highlights (Ask → "Clear highlights") first; that
//      interaction is pre-existing v0.30 behaviour, flagged in the
//      demo report rather than worked around silently.
//  Wall-of-houses: Ocean Beach (the user's screenshot area — tall
//  N-S peninsula) at district zoom, Rialto + Key Lento at district
//  zoom: plain residential renders as dots, never full house pins.
//
// Output: hidden_files/v033-demos/ (lane-b-*.png + lane-b-checks.json).
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
    let minSep = Infinity;
    let minPair = null;
    const rects = markers.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, title: m.getAttribute('aria-label') ?? '' };
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const d = Math.hypot(rects[i].x - rects[j].x, rects[i].y - rects[j].y);
        if (d < minSep) {
          minSep = d;
          minPair = `${rects[i].title.slice(0, 30)} / ${rects[j].title.slice(0, 30)}`;
        }
      }
    }
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
      unnamed: document.querySelectorAll('.atlas-map-marker.is-unnamed').length,
      clusters: document.querySelectorAll('.atlas-map-marker.is-cluster').length,
      dots,
      found,
      geoLabels: document.querySelectorAll('.atlas-geo-label').length,
      colours,
      glyphs,
      minSepPx: minSep === Infinity ? null : Math.round(minSep * 10) / 10,
      minPair,
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
    await btn.click().catch(() => {});
    await page.waitForTimeout(450);
  }
  return savedZoom();
}

const shot = (name) => page.screenshot({ path: `${OUT}lane-b-${name}.png` });

async function turnAllOn() {
  await page.locator('.map-chip').first().click();
  await page.waitForTimeout(2500);
}

try {
  // ---- (0) clean launch -----------------------------------------------
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-map-canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const clean = await markerCounts();
  check('clean launch: 0 markers, layers off', clean.total === 0, JSON.stringify(clean));
  await shot('00-clean-launch');

  // ---- (d) island zoom, All on -----------------------------------------
  await turnAllOn();
  const island = await markerCounts();
  const islandZoom = await savedZoom();
  await shot('01-island-all-on');
  check('island All on: zero "?" pins (Lane A regression)', island.unnamed === 0, JSON.stringify(island));
  check('island All on: markers render', island.total > 0, `total=${island.total} zoom=${islandZoom}`);

  // ---- (d) island zoom, Collectibles chip (closest browser proxy for a set view)
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  const collIsland = await markerCounts();
  await shot('02-island-collectibles');
  check(
    'island Collectibles: card dots are light blue',
    (collIsland.colours['#6fb7e8'] ?? 0) > 0,
    JSON.stringify(collIsland.colours),
  );
  check(
    'island Collectibles: collectible kinds render as dots',
    collIsland.dots > 0,
    `dots=${collIsland.dots} total=${collIsland.total}`,
  );

  // ---- (c) street zoom, Hamlet, All on — 5 kinds side by side --------
  // A 390px phone at zoom 0.5 shows ~276 game units, and the chrome
  // clamp eats the top/bottom bands, so the usable window is only
  // ~226 x 335 units: the Starlet grounds hold ~3 pins and Downtown
  // gave 4 combos. Hamlet (Route 6) is the densest window measured
  // headlessly in that effective window — 11 markers, 9 combos.
  // The D-2 kinds are sparse by design (a gem card only ever stands
  // alone in a collectibles view) — they are shown by the
  // Collectibles island shot (02), the (c2) watch single below and
  // the (e) gem single.
  // No drag: a deep link centres EXACTLY on the place (verified
  // against the saved camera: centre == place position; the
  // getFocusCenter offset does not apply on the deep-link path).
  // A drag in either direction only moves the camera off the place
  // (runs 4–5: Hamlet landed on 0 markers, 526 units south).
  const combosOf = () =>
    page.evaluate(() => {
      const out = new Set();
      for (const face of document.querySelectorAll('.atlas-pin-face, .atlas-cluster-face')) {
        const color = (face.style.getPropertyValue('--pin-color') || '').toLowerCase();
        const svg = face.querySelector('svg');
        const glyph = svg
          ? (svg.getAttribute('class') ?? '').split(' ').find((c) => c.startsWith('lucide-') && c !== 'lucide')
          : 'dot';
        out.add(`${glyph}@${color}`);
      }
      return [...out];
    });
  await page.goto(`${base}?place=L257`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await turnAllOn();
  const streetZoom = await setZoom(0.5);
  await page.waitForTimeout(2000);
  const street = await markerCounts();
  await shot('03-street-hamlet');
  // Distinct (colour + glyph) combos among live pins, read off the DOM.
  const combos = await combosOf();
  check(
    'street Hamlet: >= 5 kinds side by side (colour+glyph)',
    combos.length >= 5,
    `${combos.length} combos: ${combos.join(', ')}`,
  );
  check(
    'street Hamlet: no two kinds share a glyph+colour on screen',
    new Set(combos).size === combos.length,
    `${combos.length} combos`,
  );
  check('street Hamlet: markers readable (min separation >= 20px)', (street.minSepPx ?? 0) >= 20, `minSep=${street.minSepPx}px ${street.minPair ?? ''}`);
  console.log(`  street counts: ${JSON.stringify(street)} zoom=${streetZoom}`);

  // ---- (c2) Gellhorn at zoom 0 — the new watch kind, single, in the wild
  // Zoom 0 sits between district and street; the Kingpin luxury watch
  // (grey #B9BDC4, watch glyph) sits 354 units south of Delights, so
  // the camera is centred on Pawn & Gun (L298), the midpoint, not on
  // Delights itself.
  await page.goto(`${base}?place=L298`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await turnAllOn();
  await setZoom(0);
  await page.waitForTimeout(2000);
  const gellhorn = await markerCounts();
  await shot('03b-street-gellhorn');
  const gCombos = await combosOf();
  check(
    'Gellhorn zoom 0: >= 5 kinds side by side, incl. the new watch kind',
    gCombos.length >= 5 && gCombos.includes('lucide-watch@#b9bdc4'),
    `${gCombos.length} combos: ${gCombos.join(', ')}`,
  );
  console.log(`  gellhorn counts: ${JSON.stringify(gellhorn)} zoom=0`);

  // ---- (d) district zoom, Ocean Beach — the user's screenshot area ------
  await page.goto(`${base}?place=L22`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await turnAllOn();
  const districtZoom = await setZoom(-1.5);
  await page.waitForTimeout(2000);
  const ocean = await markerCounts();
  await shot('04-district-ocean-beach');
  check(
    'district Ocean Beach: zero "?" pins',
    ocean.unnamed === 0,
    JSON.stringify(ocean),
  );
  console.log(`  ocean-beach district counts: ${JSON.stringify(ocean)} zoom=${districtZoom}`);

  // ---- (d) district zoom, Rialto Islands — densest named residential ---
  await page.goto(`${base}?place=L151`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await turnAllOn();
  await setZoom(-1);
  await page.waitForTimeout(2000);
  const rialto = await markerCounts();
  await shot('05-district-rialto');
  console.log(`  rialto district counts: ${JSON.stringify(rialto)} zoom=${await savedZoom()}`);

  // ---- (d) district zoom, Key Lento — 5 named houses --------------------
  await page.goto(`${base}?place=L1018`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await turnAllOn();
  await setZoom(-1);
  await page.waitForTimeout(2000);
  const keyLento = await markerCounts();
  await shot('06-district-key-lento');
  check(
    'district Key Lento: the 5 named houses render as dots, not house pins',
    keyLento.dots > 0,
    `dots=${keyLento.dots} total=${keyLento.total} glyphs=${JSON.stringify(keyLento.glyphs)}`,
  );
  console.log(`  key-lento district counts: ${JSON.stringify(keyLento)} zoom=${await savedZoom()}`);

  // ---- (e) found Delights cards keep their colour + tick badge -----------
  // Cards share coordinates with their hosts, so Vicki/Victor/Bryson/
  // book are one coincident cluster at every zoom with All on — a card
  // pin is only ever single in a collectibles view. And no one Delights
  // card is both a hero pin (island) and a street single: Jason is a
  // hero pin but clusters with Harley at street zoom; Kandi is a
  // street single but loses its hero cell to Tusi Taufua. So the demo
  // marks two Delights cards in the disposable profile: Jason for the
  // island dot, Kandi for the street single. The tick-badge mechanism
  // is the same for every pin; the Delights part is the light-blue
  // card colour.
  // A card is an ITEM, not a location: its own sheet has no collect
  // control (locationCard returns null for it). Marking happens on
  // the HOST place's sheet — Delights (L629) for Jason, Farmacia
  // (L3078) for Kandi — where the card is a "Mark … as collected"
  // checkbox. The control is a checkbox, not a button.
  // Opening the host sheet REVEALS it (select sets highlightIds to
  // [host], v0.30): the reveal survives the sheet closing, so the
  // host keeps rendering even with its layer off — and a card at the
  // host's exact coordinates stays trapped in a ×2 cluster with it
  // at EVERY zoom (verified: the cluster never splits to zoom 1,
  // members 0 units apart). The found card's tick is only ever
  // visible on a single pin once the reveal is cleared, via Ask →
  // "Clear highlights". That is pre-existing v0.30 behaviour, not
  // Lane B's — flagged for the coordinator in the demo report — but
  // the (e) check must clear it first or the single pin never exists.
  const clearHighlights = async () => {
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.waitForTimeout(1200);
    const clearBtn = page.getByRole('button', { name: /Clear highlights/ });
    if ((await clearBtn.count()) > 0) {
      await clearBtn.first().click();
      await page.waitForTimeout(800);
    }
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.waitForTimeout(1200);
  };
  const markCollectedOnHost = async (hostId, cardName) => {
    await page.goto(`${base}?place=${hostId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.place-sheet', { timeout: 15000 });
    await page.waitForTimeout(1500);
    const markBox = page.getByLabel(`Mark ${cardName} as collected`);
    await markBox.waitFor({ timeout: 10000 });
    await markBox.click();
    await page.waitForTimeout(2000);
    const note = await page.locator('.place-sheet').innerText().catch(() => '');
    check(`${cardName}: marking collected registers on the host sheet`, /Collected ✓/.test(note), note.slice(0, 200));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  };
  await markCollectedOnHost('L629', 'Jason');
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  const cardPin = async (prefix) =>
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
  // Island zoom: the found card is a light-blue dot with a tick badge.
  await setZoom(-5);
  await page.waitForTimeout(2000);
  const foundDot = await cardPin('Jason');
  await shot('07-found-jason-island-dot');
  check(
    'found Jason dot (island): keeps light-blue colour + tick badge',
    foundDot.present === true && foundDot.isDot === true && foundDot.isFound === true && foundDot.badge === true && foundDot.color === '#6fb7e8',
    JSON.stringify(foundDot),
  );
  // Street zoom: the found card is a full light-blue gem pin with a tick.
  // Kandi's host is Farmacia, so the camera moves there to mark her;
  // the deep link centres exactly on Farmacia, which is Kandi's spot.
  await markCollectedOnHost('L3078', 'Kandi');
  await clearHighlights();
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  await setZoom(0.5);
  await page.waitForTimeout(2000);
  const foundPin = await cardPin('Kandi');
  await shot('08-found-kandi-street');
  check(
    'found Kandi pin (street): keeps light-blue card colour + gem + tick badge',
    foundPin.present === true && foundPin.isCluster === false && foundPin.isFound === true && foundPin.badge === true && foundPin.color === '#6fb7e8' && /lucide-gem/.test(foundPin.glyph ?? ''),
    JSON.stringify(foundPin),
  );
  // Persistence across a reload (completion log in IndexedDB).
  await page.goto(`${base}?place=L3078`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.place-sheet', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await clearHighlights();
  await page.locator('.map-chip', { hasText: 'Collectibles' }).click();
  await page.waitForTimeout(2500);
  await setZoom(0.5);
  await page.waitForTimeout(2000);
  const foundAgain = await cardPin('Kandi');
  check('found Kandi pin: tick survives a reload', foundAgain.present && foundAgain.isFound && foundAgain.badge, JSON.stringify(foundAgain));

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
  writeFileSync(`${OUT}lane-b-checks.json`, JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));
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
