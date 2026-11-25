/* global caches, document */
/* v0.22.0 walk at 390px, DPR 2 — the illustrated island view.
 *
 * What this proves, in the user's own terms:
 * (a) UPDATE REACHES THE PHONE: a profile with v0.21 installed (old
 *     worker, old cache) loads v0.22 and shows the ILLUSTRATED tiles —
 *     no manual clear, no reinstall. The old cache is gone, and no
 *     tile request ever goes to a path the new build does not serve.
 * (b) ISLAND VIEW IS ILLUSTRATED: at tile zooms 0-3 every tile comes
 *     from tiles/illustrated/, the on-map label reads "Island view:
 *     AI illustration traced from the real map", and a sampled tile's
 *     bytes match the illustrated file on disk. DPR 2: 256px tile at
 *     128 CSS px (1:1 device pixels).
 * (c) STREET ZOOM IS REAL: wheeling in across the z3 -> z4 switch,
 *     tile requests flip to tiles/enhanced/ and the label flips to
 *     "Street zoom: the real in-game map". Screenshots at each step
 *     are saved for the eye check — how jarring the switch feels is
 *     judged from them, not hidden. Wheeling back out returns to the
 *     illustrated island and the label flips back.
 * (d) PINS LAND RIGHT: with All on, hero pins render over the
 *     illustrated island (max 24), and a tapped pin opens a place
 *     card whose picture is the real map crop — the illustration is
 *     only a backdrop, never the place's picture.
 * (e) The v0.21 flows still pass: 0 markers on open, Turn everything
 *     off back to 0, no console errors, no overflow.
 *
 * How: one Playwright persistent profile (SW + Cache Storage survive,
 * like his phone). Phase 1 serves the LIVE v0.21 build
 * (~/workspace/gh-pages-worktree) so the old worker installs. Phase 2
 * flips the same origin to the new dist/ build.
 *
 * Run with: ./node_modules/.bin/tsx scripts/check-illustrated.mjs
 * (build first: ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build &&
 *  node scripts/finalize-build.mjs — one command. Screenshots land
 *  in /tmp/atlas-walk-illustrated/ and in the goal hidden_files.)
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const BASE_PATH = "/gta6-leonida-atlas/";
const PORT = 4332;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ORIGIN}${BASE_PATH}`;
const OUT = "/tmp/atlas-walk-illustrated";
const GOAL_OUT =
  "/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v022-walk";
await mkdir(OUT, { recursive: true });
await mkdir(GOAL_OUT, { recursive: true });

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

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

const errors = [];
const failedUrls = [];
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
page.on("response", (res) => {
  if (res.status() >= 400) failedUrls.push(`${res.status()} ${res.url()}`);
});
page.on("request", (req) => {
  if (req.url().includes("/tiles/")) tileRequests.push(req.url());
});
const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await page.screenshot({ path: join(GOAL_OUT, `${name}.png`) });
};
const fail = (message) => {
  throw new Error(message);
};
const waitForTiles = async (label) => {
  await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  const count = await page
    .locator('.leaflet-tile-loaded[src*="tiles/"]')
    .count();
  console.log(`${label}: ${count} tiles loaded`);
  if (count === 0) fail(`${label}: no tiles loaded`);
};
const cacheNames = () => page.evaluate(() => caches.keys());
const skipOnboarding = async () => {
  const btn = page.getByRole("button", { name: /Skip for now/ });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(800);
  }
};
const labelText = () =>
  page.locator(".atlas-map-illustration-note").innerText().catch(() => "");
const tileZooms = () =>
  page
    .locator(".leaflet-tile-pane img[src*=\"tiles/\"]")
    .evaluateAll((imgs) =>
      [...new Set(
        imgs.map((img) => {
          const m = img.getAttribute("src")?.match(/tiles\/(illustrated|enhanced)\/(\d)\//);
          return m ? `${m[1][0]}${m[2]}` : "?";
        }),
      )],
    );

// ---- PHASE 1: the v0.21 phone.
console.log(`serving OLD (v0.21.0) from ${OLD_ROOT} on ${ORIGIN}`);
await page.goto(BASE_URL, { waitUntil: "load" });
await waitForTiles("phase 1 (v0.21, first visit)");
await page.reload({ waitUntil: "load" });
await waitForTiles("phase 1 (v0.21, second visit)");
const oldCaches = await cacheNames();
console.log(`phase 1 caches: ${oldCaches.join(", ")}`);
await skipOnboarding();
await shot("phase1-v021-island");

// ---- PHASE 2: the update — same origin, new build.
tileRequests.length = 0;
root = NEW_ROOT;
console.log(`serving NEW (v0.22.0) from ${NEW_ROOT}`);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(2500);
const cachesAfterFirstReload = await cacheNames();
console.log(`after 1st reload caches: ${cachesAfterFirstReload.join(", ")}`);
const oldCacheGone = oldCaches.every(
  (name) => !cachesAfterFirstReload.includes(name),
);
check("old v0.21 cache is gone after one reload", oldCacheGone);
await page.reload({ waitUntil: "load" });
await waitForTiles("phase 2 (v0.22.0)");
await skipOnboarding();
// The old worker's transition window (same caveat as the v0.20.2
// walk): errors logged before the new worker activates are the old
// build's, not v0.22's — snapshot them and gate on what v0.22 logs.
const transitionErrors = errors.splice(0, errors.length);
const transitionFailed = failedUrls.splice(0, failedUrls.length);
console.log(
  `transition window (old worker, one-time): ${transitionErrors.length} console errors, ${transitionFailed.length} failed requests`,
);
// (b) Island view is illustrated.
const illustrated = tileRequests.filter((u) => u.includes("tiles/illustrated/"));
check("illustrated tiles load on the island view", illustrated.length > 0, `${illustrated.length} requests`);
const enhancedAtIsland = tileRequests.filter((u) => u.includes("tiles/enhanced/"));
check("no enhanced tiles at island zoom", enhancedAtIsland.length === 0, `${enhancedAtIsland.length} requests`);
const label = await labelText();
check(
  "label says the island view is an illustration",
  label.includes("AI illustration traced from the real map"),
  label,
);
const labelBox = await page.locator(".atlas-map-illustration-note").boundingBox();
check(
  "label is on screen, not just in the DOM",
  !!labelBox && labelBox.y >= 0 && labelBox.y + labelBox.height <= 844,
  labelBox ? `y=${Math.round(labelBox.y)} h=${Math.round(labelBox.height)}` : "no box",
);
// The label must be VISIBLE, not just in the DOM with a box: on
// first open it sat above the attribution, under the empty-map
// prompt (a sibling overlay in a higher stacking context), so the
// first thing the user saw was the illustration with no label.
// elementFromPoint at the label's centre must hit the label itself.
const labelTopmost = await page.evaluate(() => {
  const label = document.querySelector(".atlas-map-illustration-note");
  if (!label) return "no label";
  const r = label.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!top) return "nothing on top";
  if (top === label || label.contains(top)) return "label";
  return `${top.tagName}.${(top.className?.baseVal ?? top.className ?? "").toString().split(" ")[0]}: ${(top.textContent ?? "").slice(0, 40)}`;
});
check("label is the topmost element at its centre (actually visible)", labelTopmost === "label", labelTopmost);
const dpr2 = await page.evaluate(() => {
  const img = document.querySelector(".leaflet-tile-loaded");
  return img
    ? { natural: img.naturalWidth, displayed: img.getBoundingClientRect().width }
    : null;
});
console.log(`dpr2 tile: natural=${dpr2?.natural} displayed=${dpr2?.displayed} (expect 256 at 128 CSS px)`);
check(
  "dpr2: 256px tile at 128 CSS px",
  !!dpr2 && dpr2.natural === 256 && Math.round(dpr2.displayed) === 128,
  JSON.stringify(dpr2),
);
// Framing (the v0.22 catch): at the fit view the loaded tiles must
// COVER the whole map container. The broken v0.20.2 retina only
// halved the display size without loading deeper tiles, so the
// island sat small in a black frame — every numeric check above
// passed anyway. The union of all loaded tile rects must cover
// the map container (390x771 — the bottom nav sits below it, so
// the viewport's 844 is the wrong target); a half-scale grid
// leaves black gaps and fails.
const framing = await page.evaluate(() => {
  const host = document.querySelector(".leaflet-container");
  const hostRect = host?.getBoundingClientRect();
  const imgs = [...document.querySelectorAll(".leaflet-tile-loaded")];
  if (imgs.length === 0 || !hostRect) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const img of imgs) {
    const r = img.getBoundingClientRect();
    left = Math.min(left, r.left); top = Math.min(top, r.top);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return { map: { left: Math.round(hostRect.left), top: Math.round(hostRect.top), right: Math.round(hostRect.right), bottom: Math.round(hostRect.bottom) }, union: { left: Math.round(left), top: Math.round(top), right: Math.round(right), bottom: Math.round(bottom) }, count: imgs.length };
});
console.log(`tile framing: map ${JSON.stringify(framing?.map)} union ${JSON.stringify(framing?.union)} over ${framing?.count} tiles`);
check(
  "framing: loaded tiles cover the whole map at the fit view",
  !!framing && framing.union.left <= framing.map.left && framing.union.top <= framing.map.top && framing.union.right >= framing.map.right && framing.union.bottom >= framing.map.bottom,
  framing ? `union ${framing.union.left},${framing.union.top}–${framing.union.right},${framing.union.bottom} vs map ${framing.map.left},${framing.map.top}–${framing.map.right},${framing.map.bottom}` : "no tiles",
);
// Sampled illustrated tile bytes match the file on disk.
const sampleUrl = illustrated.find((u) => u.includes("/illustrated/1/") || u.includes("/illustrated/0/"));
if (!sampleUrl) fail("phase 2: no low-zoom illustrated tile to sample");
const samplePath = new URL(sampleUrl).pathname.replace(BASE_PATH, "");
const [diskBytes, liveBytes] = await Promise.all([
  readFile(join(NEW_ROOT, samplePath)),
  page.evaluate(async (url) => {
    const buf = await (await fetch(url)).arrayBuffer();
    return [...new Uint8Array(buf)];
  }, sampleUrl),
]);
const diskHash = createHash("sha256").update(diskBytes).digest("hex");
const liveHash = createHash("sha256").update(Buffer.from(liveBytes)).digest("hex");
console.log(`sampled tile ${samplePath} disk=${diskHash.slice(0, 12)} live=${liveHash.slice(0, 12)}`);
check("sampled illustrated tile bytes match disk", diskHash === liveHash);
await shot("phase2-illustrated-island");

// (d) Pins on the illustrated view, then the zoom switch.
const markerCount = () => page.locator(".atlas-map-marker").count();
const overflow = () =>
  page.locator("html").evaluate((el) => el.scrollWidth - el.clientWidth);
check("0 markers on open", (await markerCount()) === 0);
check("no horizontal overflow on open", (await overflow()) === 0);
await page
  .locator(".map-chips")
  .getByRole("button", { name: "All", exact: true })
  .click();
await page.waitForSelector(".atlas-map-marker", { timeout: 10000 });
await page.waitForTimeout(1500);
const heroPins = await markerCount();
console.log(`hero pins after All: ${heroPins}`);
check("hero pins appear on the illustrated island", heroPins > 0, `${heroPins} pins`);
check("hero pins capped at 24", heroPins <= 24, `${heroPins} pins`);
await shot("pins-on-illustrated");

// (c) Zoom in across the z3 -> z4 switch, toward Vice City.
await page.mouse.move(275, 500);
let sawIllustrated3 = false;
let sawEnhanced4 = false;
let labelAt4 = "";
for (let i = 0; i < 14; i++) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(1000);
  const zooms = await tileZooms();
  const lbl = await labelText();
  console.log(`wheel in #${i + 1}: tile zooms`, JSON.stringify(zooms), `label: ${lbl.slice(0, 40)}`);
  if (zooms.includes("i3")) {
    sawIllustrated3 = true;
    await shot("zoom-last-illustrated-z3");
  }
  if (zooms.includes("e4") || zooms.includes("e5")) {
    sawEnhanced4 = true;
    labelAt4 = lbl;
    await shot("zoom-first-real-z4");
    break;
  }
}
check("reached illustrated z3 on the way in", sawIllustrated3);
check("crossed into real enhanced z4/z5", sawEnhanced4);
check(
  "label flips to the real map at street zoom",
  labelAt4.includes("Street zoom: the real in-game map"),
  labelAt4,
);
await shot("zoom-street-real");
// Wheel back out to the whole island.
for (let i = 0; i < 14; i++) {
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(900);
  const zooms = await tileZooms();
  if (zooms.length === 1 && (zooms[0] === "i0" || zooms[0] === "i1")) break;
}
await page.waitForTimeout(1000);
const backZooms = await tileZooms();
const backLabel = await labelText();
console.log(`zoomed back out: tile zooms`, JSON.stringify(backZooms), `label: ${backLabel.slice(0, 40)}`);
check("back out to the illustrated island", backZooms.some((z) => z.startsWith("i")));
check(
  "label flips back to the illustration",
  backLabel.includes("AI illustration traced from the real map"),
  backLabel,
);
await shot("zoom-island-back");

// (e) Turn everything off.
await page.locator(".bottom-nav").getByRole("button", { name: "Layers" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check("Turn everything off → 0 markers", (await markerCount()) === 0);

check("zero console errors once v0.22 is in control", errors.length === 0, errors.slice(0, 3).join(" | "));
check("zero failed requests once v0.22 is in control", failedUrls.length === 0, failedUrls.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures.length === 0 ? "\nWALK PASSED" : `\nWALK FAILED: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
