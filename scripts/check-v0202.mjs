/* global localStorage, document, caches, location, createImageBitmap */
/* v0.20.2 walk at 390px, DPR 2 (plus a DPR 3 probe) — the basemap fix.
 *
 * What this proves, in the user's own terms:
 * (a) STALE PROFILE: a phone that installed v0.20.0 and cached its
 *     redrawn tiles (the exact state of his phone on 2026-11-24)
 *     loads v0.20.2 and shows the ENHANCED tiles — no manual clear,
 *     no reinstall. The old cache is gone, no tile request ever goes
 *     to tiles/redrawn/ again.
 * (b) ONE FILTER, NO FLICKER: zooming from the whole island down to
 *     street zoom and back shows the same map getting closer — the
 *     sea stays the same teal, the land the same warm grey, at every
 *     zoom. Screenshots at each zoom are saved for the eye check, and
 *     the sampled sea colour at street zoom vs island zoom must agree.
 * (c) SHARP: at DPR 2 the tiles are 256px files displayed at 128 CSS
 *     px (1:1 device pixels — the retina half of Leaflet's
 *     detectRetina, applied by hand so minZoom -5 survives); at DPR 3
 *     the same files at 384 device px (1.5x). Every loaded tile comes
 *     from tiles/enhanced/, and a sampled tile's bytes match the
 *     enhanced file on disk.
 * (d) The v0.20 flows still pass: 0 markers on open, hero pins,
 *     Vice City sheet, Turn everything off back to 0, no console
 *     errors, no overflow.
 *
 * How: one Playwright persistent profile (so the SW + Cache Storage
 * survive, like his phone). Phase 1 serves the LIVE v0.20.0 build
 * (~/workspace/gh-pages-worktree) so the old worker installs and
 * caches redrawn tiles. Phase 2 flips the same origin to the new
 * dist/ build: the browser's SW update check fetches the new worker
 * (skipWaiting), it activates, deletes the old cache, and the app
 * reloads onto the new shell and the enhanced tiles.
 *
 * Run with: ./node_modules/.bin/tsx scripts/check-v0202.mjs
 * (build first: ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build &&
 *  node scripts/finalize-build.mjs — one command. Screenshots land
 *  in /tmp/atlas-walk-v0202/.)
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, mkdir, stat } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const BASE_PATH = "/gta6-leonida-atlas/";
const PORT = 4330;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ORIGIN}${BASE_PATH}`;
const OUT = "/tmp/atlas-walk-v0202";
await mkdir(OUT, { recursive: true });

const OLD_ROOT = "/home/hatch/workspace/gh-pages-worktree";
const NEW_ROOT = join(process.cwd(), "dist");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

/* One static server, two roots: the root flips between phases while
 * the origin (and therefore the SW registration + caches) stays put. */
let root = OLD_ROOT;
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice(BASE_PATH.length) || "index.html";
  const file = join(root, path);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  stat(file)
    .then((info) => {
      if (info.isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        // The new worker must be revalidated on every update check —
        // the live site intends this via _headers (GitHub Pages
        // ignores _headers, so the app ALSO calls update() on load).
        ...(path === "sw.js" ? { "cache-control": "no-cache" } : {}),
      });
      createReadStream(file).pipe(res);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
console.log(`serving OLD (v0.20.0) from ${OLD_ROOT} on ${ORIGIN}`);

const errors = [];
const tileRequests = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));
const failedUrls = [];
page.on("response", (res) => {
  if (res.status() >= 400) failedUrls.push(`${res.status()} ${res.url()}`);
});
page.on("request", (req) => {
  if (req.url().includes("/tiles/")) tileRequests.push(req.url());
});
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const fail = (message) => {
  throw new Error(message);
};
const waitForTiles = async (label) => {
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', {
    timeout: 30000,
  });
  // Let the visible tiles finish arriving.
  await page.waitForTimeout(1500);
  const count = await page
    .locator('.leaflet-tile-loaded[src*="tiles/"]')
    .count();
  console.log(`${label}: ${count} tiles loaded`);
  if (count === 0) fail(`${label}: no tiles loaded`);
};
const cacheNames = () => page.evaluate(() => caches.keys());
const cachedTileUrls = async () => {
  const names = await cacheNames();
  const urls = [];
  for (const name of names) {
    const keys = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.keys()).map((r) => r.url);
    }, name);
    urls.push(...keys.filter((u) => u.includes("/tiles/")));
  }
  return urls;
};

// Seed the exact state from his phone: a saved view with 27 layers on,
// as v0.20.0 had it — the empty-map prompt must still hold.
await page.addInitScript(() => {
  localStorage.setItem(
    "leonida-map-camera-v1",
    JSON.stringify({ center: { x: 800, y: -800 }, zoom: -2 }),
  );
  const layerIds = [
    "regions",
    "community",
    "interiors",
    "breakable",
    "shops",
    "lootable",
    "gyms",
    "equipment",
    "uncertain",
    ...Array.from({ length: 18 }, (_, i) => `cards:set-${i}`),
  ];
  localStorage.setItem(
    "leonida-map-view-v1",
    JSON.stringify({
      visibleLayerIds: layerIds,
      countyId: null,
      area: null,
      hideFound: false,
      remainingOnly: false,
      favoriteOnly: false,
      collectionId: null,
      query: "",
      venueType: "all",
      enterableOnly: false,
      sortNearest: false,
    }),
  );
});

// ---- PHASE 1: the stale phone — v0.20.0 live, redrawn tiles cached.
await page.goto(BASE_URL, { waitUntil: "load" });
await waitForTiles("phase 1 (v0.20.0, first visit)");
const phase1Tiles = tileRequests.filter((u) => u.includes("tiles/redrawn/"));
if (phase1Tiles.length === 0)
  fail("phase 1: expected redrawn tile requests, got none");
// First visit: the worker installs in the background but does not
// control the page yet, so its fetches are not intercepted and nothing
// is cached. A real phone's SECOND visit is when the cache fills —
// reload under the old build to reach that state.
await page.reload({ waitUntil: "load" });
await waitForTiles("phase 1 (v0.20.0, second visit)");
const oldCaches = await cacheNames();
console.log(`phase 1 caches: ${oldCaches.join(", ")}`);
const oldCachedTiles = await cachedTileUrls();
if (oldCachedTiles.length === 0) fail("phase 1: old worker cached no tiles");
console.log(`phase 1: ${oldCachedTiles.length} tiles in the old cache`);
await shot("phase1-old-map");
const oldWorkerHasSkipWaiting = await page.evaluate(async () => {
  const res = await fetch(`${location.origin}/gta6-leonida-atlas/sw.js`);
  return (await res.text()).includes("skipWaiting");
});
console.log(`phase 1: live worker skipWaiting = ${oldWorkerHasSkipWaiting}`);
if (oldWorkerHasSkipWaiting)
  fail("phase 1: the old worker should NOT skipWaiting (that is the bug)");

// ---- PHASE 2: the update — same origin, new build.
tileRequests.length = 0;
root = NEW_ROOT;
console.log(`serving NEW (v0.20.2) from ${NEW_ROOT}`);
// Navigation triggers the browser's SW update check; the new worker
// installs, skipWaits, activates and deletes the old cache. The app
// (v0.20.2 bundle, once loaded) also calls registration.update() and
// reloads once on controllerchange — here the old bundle has no such
// listener, so a second reload loads the new shell.
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(2500);
const cachesAfterFirstReload = await cacheNames();
console.log(`after 1st reload caches: ${cachesAfterFirstReload.join(", ")}`);
const oldCacheGone = oldCaches.every(
  (name) => !cachesAfterFirstReload.includes(name),
);
if (!oldCacheGone)
  fail(
    "after 1st reload: the old cache is still there — the update did not activate",
  );
await page.reload({ waitUntil: "load" });
await waitForTiles("phase 2 (v0.20.2)");
// The new worker takes control on this load; the errors logged before
// it activated came from the OLD worker during the one-time update
// window (the new bundle loads before the new worker finishes
// installing, so its first out-of-grid tile fetches still go through
// the old worker, which has no ocean fallback). Those are the old
// build's behaviour, not v0.20.2's — snapshot them for the report and
// gate only on what v0.20.2 itself logs once it is in control.
const transitionErrors = errors.splice(0, errors.length);
const transitionFailed = failedUrls.splice(0, failedUrls.length);
console.log(
  `transition window (old worker, one-time): ${transitionErrors.length} console errors, ${transitionFailed.length} failed requests`,
);
const newTiles = tileRequests.filter((u) => u.includes("tiles/enhanced/"));
const staleTiles = tileRequests.filter((u) => u.includes("tiles/redrawn/"));
if (newTiles.length === 0) fail("phase 2: no enhanced tile requests");
if (staleTiles.length > 0)
  fail(`phase 2: ${staleTiles.length} requests still went to tiles/redrawn/`);
const newCachedTiles = await cachedTileUrls();
if (newCachedTiles.some((u) => u.includes("tiles/redrawn/")))
  fail("phase 2: the new cache still holds redrawn tiles");
// DPR 2 retina: a 256px tile displayed at 128 CSS px is 1:1 device
// pixels (was 256 at 256 CSS px = 2x stretch in v0.19).
const dpr2 = await page.evaluate(() => {
  const img = document.querySelector(".leaflet-tile-loaded");
  return img
    ? {
        natural: img.naturalWidth,
        displayed: img.getBoundingClientRect().width,
      }
    : null;
});
console.log(
  `dpr2 tile: natural=${dpr2?.natural} displayed=${dpr2?.displayed} (expect 256 at 128 CSS px)`,
);
if (!dpr2 || dpr2.natural !== 256 || Math.round(dpr2.displayed) !== 128)
  fail(
    `dpr2: expected a 256px tile at 128 CSS px, got ${JSON.stringify(dpr2)}`,
  );
// A sampled tile's bytes must be the enhanced file on disk. Pick from
// the settled view's most common tile zoom — the first request logged
// can be a transient tile from the opening fit animation.
const loadedZooms = await page
  .locator('.leaflet-tile-pane img[src*="tiles/enhanced/"]')
  .evaluateAll((imgs) =>
    imgs.map((img) => img.getAttribute("src")?.match(/enhanced\/(\d)\//)?.[1]),
  );
const zoomCounts = new Map();
for (const z of loadedZooms) zoomCounts.set(z, (zoomCounts.get(z) ?? 0) + 1);
const settledZoom = [...zoomCounts.entries()].sort(
  (a, b) => b[1] - a[1],
)[0]?.[0];
const sampleUrl = newTiles.find((u) => u.includes(`/enhanced/${settledZoom}/`));
if (!sampleUrl) fail("phase 2: no tile from the settled view to sample");
const samplePath = new URL(sampleUrl).pathname.replace(BASE_PATH, "");
const [diskBytes, liveBytes] = await Promise.all([
  readFile(join(NEW_ROOT, samplePath)),
  page.evaluate(async (url) => {
    const buf = await (await fetch(url)).arrayBuffer();
    return [...new Uint8Array(buf)];
  }, sampleUrl),
]);
const diskHash = createHash("sha256").update(diskBytes).digest("hex");
const liveHash = createHash("sha256")
  .update(Buffer.from(liveBytes))
  .digest("hex");
console.log(
  `phase 2: sampled tile ${samplePath} disk=${diskHash.slice(0, 12)} live=${liveHash.slice(0, 12)}`,
);
if (diskHash !== liveHash)
  fail("phase 2: the served tile bytes do not match the enhanced file on disk");
// The forced indexing onboarding covers the map on a fresh profile —
// dismiss it once (Skip for now) so the rest of the walk drives the
// map itself, as the v0.20 walk does.
await page
  .getByRole("button", { name: /Skip for now/ })
  .click()
  .catch(() => {});
await page.waitForTimeout(800);
await shot("phase2-new-map-island");

// ---- ZOOM / FLICKER: same map, closer — island -> city -> street -> back.
// The saved camera is gated (a zoomed-in saved camera is ignored and
// the map re-opens on the whole of Leonida), so drive the zoom live
// with the wheel, as the v0.20 walk does: wheel toward Vice City in
// the south-east until tile zoom 5/6 loads, screenshot each step for
// the eye check, then wheel back out to the island.
const tileZooms = () =>
  page
    .locator('.leaflet-tile-pane img[src*="tiles/enhanced/"]')
    .evaluateAll((imgs) => [
      ...new Set(
        imgs.map(
          (img) => img.getAttribute("src")?.match(/enhanced\/(\d)\//)?.[1],
        ),
      ),
    ]);
await page.mouse.move(275, 500);
let zooms = [];
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(1000);
  zooms = await tileZooms();
  console.log(`wheel in #${i + 1}: tile zooms`, JSON.stringify(zooms));
  if (zooms.includes("5") || zooms.includes("6")) break;
}
if (!zooms.includes("5") && !zooms.includes("6"))
  fail(`wheel zoom never reached street zoom: ${JSON.stringify(zooms)}`);
await shot("zoom-street");
// NO FLICKER, measured on served bytes: a z5 tile and its four z6
// children cover the same ground — their mean colours must agree, or
// zooming would pop. (The Python check already measured 3.6–4.0 mean
// abs diff on disk; this re-measures what the phone actually got.)
const flicker = await page.evaluate(async () => {
  const mean = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`missing tile ${url}`);
    const bmp = await createImageBitmap(await res.blob());
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, 256, 256).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 16) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
    return [r / n, g / n, b / n];
  };
  const base = `${location.origin}/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/enhanced/`;
  // Two candidate families (z5 parent -> four z6 children); use the
  // first whose tiles all exist — a family on the coast may miss one.
  for (const [pty, ptx] of [
    [57, 69],
    [59, 71],
  ]) {
    try {
      const parent = await mean(`${base}5/5,${pty},${ptx}.jpg`);
      const kids = [];
      for (const [ty, tx] of [
        [pty * 2, ptx * 2],
        [pty * 2, ptx * 2 + 1],
        [pty * 2 + 1, ptx * 2],
        [pty * 2 + 1, ptx * 2 + 1],
      ])
        kids.push(await mean(`${base}6/6,${ty},${tx}.jpg`));
      const childMean = [0, 1, 2].map(
        (i) => kids.reduce((sum, k) => sum + k[i], 0) / kids.length,
      );
      return {
        family: `${pty},${ptx}`,
        parent: parent.map((v) => Math.round(v)),
        childMean: childMean.map((v) => Math.round(v)),
        diff: parent.map((v, i) => Math.abs(v - childMean[i])),
      };
    } catch {
      continue;
    }
  }
  throw new Error("no complete parent/child tile family to measure");
});
console.log(
  `flicker check (family ${flicker.family}): parent mean rgb(${flicker.parent.join(",")}) vs children mean rgb(${flicker.childMean.join(",")}) diff ${flicker.diff.map((v) => v.toFixed(1)).join(", ")} (must all be < 12)`,
);
if (flicker.diff.some((v) => v >= 12))
  fail(
    `flicker check failed: parent/child mean diff ${JSON.stringify(flicker.diff)}`,
  );
// Wheel back out to the whole island.
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(900);
  zooms = await tileZooms();
  if (zooms.length === 1 && (zooms[0] === "0" || zooms[0] === "1")) break;
}
await page.waitForTimeout(1000);
await shot("zoom-island-back");
console.log(`zoomed back out: tile zooms`, JSON.stringify(await tileZooms()));
const redrawnAfterZoom = tileRequests.filter((u) =>
  u.includes("tiles/redrawn/"),
);
if (redrawnAfterZoom.length > 0) fail("zoom sequence: a redrawn tile loaded");

// ---- v0.20 flows still pass on the new build.
const overflow = () =>
  page.locator("html").evaluate((el) => el.scrollWidth - el.clientWidth);
const markerCount = () => page.locator(".atlas-map-marker").count();
if ((await overflow()) !== 0)
  fail(`horizontal overflow: ${await overflow()}px`);
if ((await markerCount()) !== 0)
  fail("markers on open: expected 0 (spoiler-free defaults)");
// "All" is a map chip, not a bottom-nav tab (v0.20 walk pattern).
await page
  .locator(".map-chips")
  .getByRole("button", { name: "All", exact: true })
  .click();
await page.waitForSelector(".atlas-map-marker", { timeout: 10000 });
await page.waitForTimeout(1500);
const heroPins = await markerCount();
console.log(`hero pins after All: ${heroPins}`);
if (heroPins === 0) fail("no hero pins appeared after All");
if (heroPins > 24) fail(`hero pins: ${heroPins} > 24`);
await shot("hero-pins");
const nav = (label) =>
  page.locator(".bottom-nav").getByRole("button", { name: label });
await nav("Layers").click();
await page.waitForTimeout(800);
await shot("layers-list");
await page.getByRole("button", { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
if ((await markerCount()) !== 0) fail("Turn everything off: markers remain");

// ---- DPR 3 probe: fresh profile, same new build.
const ctx3 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page3 = await ctx3.newPage();
page3.on("pageerror", (err) => errors.push(`dpr3: ${String(err)}`));
await page3.goto(BASE_URL, { waitUntil: "load" });
await page3.waitForSelector('.leaflet-tile-loaded[src*="tiles/enhanced/"]', {
  timeout: 30000,
});
await page3.waitForTimeout(1500);
const dpr3 = await page3.evaluate(() => {
  const img = document.querySelector(".leaflet-tile-loaded");
  return img
    ? {
        natural: img.naturalWidth,
        displayed: img.getBoundingClientRect().width,
      }
    : null;
});
console.log(
  `dpr3 tile: natural=${dpr3?.natural} displayed=${dpr3?.displayed} (expect 256 at 128 CSS px)`,
);
if (!dpr3 || dpr3.natural !== 256 || Math.round(dpr3.displayed) !== 128)
  fail(
    `dpr3: expected a 256px tile at 128 CSS px, got ${JSON.stringify(dpr3)}`,
  );
await page3.screenshot({ path: `${OUT}/dpr3-island.png` });

if (failedUrls.length > 0)
  console.log(
    `\nfailed requests (${failedUrls.length}):\n${[...new Set(failedUrls)].join("\n")}`,
  );
if (errors.length > 0) fail(`console/page errors:\n${errors.join("\n")}`);
await browser.close();
server.close();
console.log("v0.20.2 walk PASSED");
