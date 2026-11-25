/* v0.21.0 walk at 390px, DPR 2 — ViceWire: the game's own categories,
 * a useful place card, your tags, and the rebrand.
 *
 * What this proves, in the user's own terms:
 * (a) REBRAND: the header says VICEWIRE (VICE ivory, WIRE coral) with
 *     the V mark; the manifest name/short_name is ViceWire; the
 *     192/512/maskable icons and favicon are the drawn V, 200.
 * (b) CATEGORIES: Layers is grouped by the game's nine Map Index
 *     groups (Personal, Story, Robberies, Activities, Exploration,
 *     Vehicles, Weapons, Style, Food & Drink) plus Collectibles /
 *     My markers / Unverified. No "Business" group or toggle anywhere
 *     in Layers. Personal honestly says 0 verified places.
 * (c) PLACE CARD: opening a lootable place shows Available loot,
 *     Hidden collectables, Mark as explored, and Your tags with an
 *     Add-a-tag box — and no raw game coordinates.
 * (d) TAGS: adding "sells t-shirts" to that place survives a reload
 *     (shown as "Your tag"), and searching "sells t-shirts" finds it.
 * (e) EXPLORED: Mark as explored sticks across a reload and the
 *     button reads Explored.
 * (f) The v0.20 flows still pass: 0 markers on open, hero pins,
 *     Turn everything off back to 0, no console errors, no overflow.
 *
 * Fresh profile against dist/ (the basemap + SW are unchanged from
 * v0.20.2, so no stale-profile phase). Screenshots land in
 * /tmp/atlas-walk-v021/ and in the goal hidden_files.
 * Run with: ./node_modules/.bin/tsx scripts/check-v021.mjs
 * (build first: ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build &&
 *  node scripts/finalize-build.mjs — one command.)
 */
import { mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const BASE_PATH = "/gta6-leonida-atlas/";
const PORT = 4331;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ORIGIN}${BASE_PATH}`;
const OUT = "/tmp/atlas-walk-v021";
const GOAL_OUT =
  "/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v021-walk";
await mkdir(OUT, { recursive: true });
await mkdir(GOAL_OUT, { recursive: true });

const ROOT = join(process.cwd(), "dist");
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }
  path = path.slice(BASE_PATH.length) || "index.html";
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(404);
    res.end();
    return;
  }
  readFile(file)
    .then((body) => {
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});
await new Promise((resolve) => server.listen(PORT, resolve));

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const consoleErrors = [];
const failedRequests = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("requestfailed", (req) =>
  failedRequests.push(`${req.url()} — ${req.failure()?.errorText ?? ""}`),
);
const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await page.screenshot({ path: join(GOAL_OUT, `${name}.png`) });
};

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1500);

// The forced indexing onboarding (v0.11) covers the screen on first
// launch — skip it, the way a returning user would.
const skipOnboarding = page.getByRole("button", { name: /Skip for now/ });
if ((await skipOnboarding.count()) > 0) {
  await skipOnboarding.first().click();
  await page.waitForTimeout(800);
}

// (a) Rebrand: header, manifest, icons.
const headerText = await page.locator(".map-hero-titles").innerText();
const headerDomText = await page.locator(".map-hero-titles").textContent();
check("header says VICEWIRE", /VICE\s*WIRE/.test(headerText), headerText.trim());
check(
  "header has the V mark",
  (await page.locator(".map-hero-mark").count()) === 1,
);
// The sub hides on phones (CSS) but must exist in the DOM.
check("header sub is GTA VI · Leonida", (headerDomText ?? "").includes("GTA VI"));
const manifest = JSON.parse(
  await (await fetch(`${BASE_URL}manifest.webmanifest`)).text(),
);
check("manifest name is ViceWire", manifest.name.startsWith("ViceWire"), manifest.name);
check("manifest short_name is ViceWire", manifest.short_name === "ViceWire");
for (const src of [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "favicon.svg",
]) {
  const res = await fetch(`${BASE_URL}${src}`);
  check(`icon ${src} is 200`, res.status === 200, `got ${res.status}`);
}
// The wordmark must be VISIBLE, not just in the DOM: a CSS bug once
// stretched the V mark to 362px and pushed the whole lockup off the
// top of the screen while the text checks still passed.
const titlesBox = await page.locator(".map-hero-titles").boundingBox();
check(
  "hero wordmark is on screen",
  !!titlesBox && titlesBox.y >= 0 && titlesBox.y + titlesBox.height <= 64,
  titlesBox ? `y=${Math.round(titlesBox.y)} h=${Math.round(titlesBox.height)}` : "no box",
);
const markBox = await page.locator(".map-hero-mark").boundingBox();
check(
  "V mark is 42px, not stretched",
  !!markBox && markBox.width <= 60 && markBox.height <= 60,
  markBox ? `${Math.round(markBox.width)}x${Math.round(markBox.height)}` : "no box",
);
await shot("a-header-vicewire");

// (f) Clean first: 0 markers, no overflow.
const markerCount = () => page.locator(".atlas-map-marker").count();
check("0 markers on open", (await markerCount()) === 0);
const overflow = await page
  .locator("html")
  .evaluate((el) => el.scrollWidth - el.clientWidth);
check("no horizontal overflow on open", overflow === 0, `${overflow}px`);

// (b) Layers grouped by the game's nine.
const nav = (label) =>
  page.locator(".bottom-nav").getByRole("button", { name: label });
await nav("Layers").click();
await page.waitForTimeout(800);
// The panel header carries the brand too — it once still said the old name.
const brandText = (await page.locator(".brand-header").textContent()) ?? "";
check("panel header says ViceWire", /vicewire/i.test(brandText), brandText.trim());
check("panel header has no old brand", !brandText.includes("Leonida Atlas"));
for (const group of [
  "Personal",
  "Story",
  "Robberies",
  "Activities",
  "Exploration",
  "Vehicles",
  "Weapons",
  "Style",
  "Food & Drink",
]) {
  check(
    `Layers group: ${group}`,
    (await page.locator(`.layer-group-section[aria-label="${group}"]`).count()) === 1,
  );
}
const layersText = await page.locator(".layer-manager").innerText();
check(
  "no Business group in Layers",
  !/\bBusiness\b/.test(layersText),
  layersText.includes("Business") ? "found 'Business'" : "",
);
check(
  "Personal group is honest about 0 places",
  /No verified places yet/.test(layersText),
);
await shot("b-layers-nine-groups");
await nav("Map").click();
await page.waitForTimeout(800);

// (c) Place card: open a lootable place from Find (the map pins
// cluster at this zoom, so the list is the reliable way in).
await page.getByRole("button", { name: /show lootable/i }).click();
await page.waitForSelector(".atlas-map-marker", { timeout: 10000 });
await page.waitForTimeout(1500);
const pins = await markerCount();
check("lootable pins appear", pins > 0, `${pins} pins`);
await nav("Find").click();
await page.waitForTimeout(800);
await page.locator(".place-result").first().click();
await page.waitForSelector(".place-sheet", { timeout: 10000 });
await page.waitForTimeout(800);
// NB: sheet headings render in ALL CAPS via CSS text-transform, and
// innerText returns the transformed text — textContent is the honest
// DOM text for these checks.
const sheet = page.locator(".place-sheet");
const sheetText = (await sheet.textContent()) ?? "";
const placeTitle = (await sheet.locator("h2").textContent()) ?? "";
check("card shows Available loot", sheetText.includes("Available loot"));
check("card shows Hidden collectables", sheetText.includes("Hidden collectables"));
check("card shows Mark as explored", sheetText.includes("Mark as explored"));
check("card shows Your tags", sheetText.includes("Your tags"));
check(
  "card has no raw game coordinates",
  !/Game coordinates/.test(sheetText),
);
await shot("c-place-card");

// (d) Tags + (e) explored, then a reload to prove they stick.
await sheet.getByLabel(/Add your own tag/i).fill("sells t-shirts");
await sheet.getByRole("button", { name: "Add tag", exact: true }).click();
await page.waitForTimeout(800);
check(
  "tag appears as Your tag",
  ((await sheet.textContent()) ?? "").includes("Your tag: sells t-shirts"),
);
await sheet.getByRole("button", { name: /Mark as explored/ }).click();
await page.waitForTimeout(800);
check(
  "explored button flips to Explored",
  ((await sheet.textContent()) ?? "").includes("Explored ✓"),
);
await shot("d-tag-and-explored");

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('.leaflet-tile-loaded[src*="tiles/"]', { timeout: 20000 });
await page.waitForTimeout(1200);
// Layers deliberately do NOT re-apply on launch (v0.16 clean-launch
// rule) — the saved set comes back in one tap on the empty prompt.
const restore = page.getByRole("button", { name: /Restore my last layers/ });
if ((await restore.count()) > 0) {
  await restore.first().click();
  await page.waitForTimeout(1200);
}
// Reopen the same place by name from Find.
await nav("Find").click();
await page.waitForTimeout(800);
await page.locator("#atlas-search").fill(placeTitle);
await page.waitForTimeout(1000);
await page
  .locator(".sidebar")
  .getByRole("button", { name: new RegExp(placeTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
  .first()
  .click();
await page.waitForSelector(".place-sheet", { timeout: 10000 });
await page.waitForTimeout(800);
const sheet2Text = (await page.locator(".place-sheet").textContent()) ?? "";
check("tag survives reload", sheet2Text.includes("Your tag: sells t-shirts"));
check("explored survives reload", sheet2Text.includes("Explored ✓"));
await shot("e-reload-sticks");

// (d2) Search finds the place by its tag.
await nav("Find").click();
await page.waitForTimeout(800);
await page.locator("#atlas-search").fill("sells t-shirts");
await page.waitForTimeout(1000);
const searchText = (await page.locator(".sidebar").textContent()) ?? "";
check(
  "search 'sells t-shirts' finds the tagged place",
  searchText.includes(placeTitle),
  `looking for ${placeTitle}`,
);
await shot("f-search-by-tag");

// (f) Turn everything off.
await nav("Layers").click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Turn everything off/i }).click();
await page.waitForTimeout(800);
check("Turn everything off → 0 markers", (await markerCount()) === 0);

check("zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
check(
  "zero failed requests",
  failedRequests.length === 0,
  failedRequests.slice(0, 3).join(" | "),
);

await browser.close();
server.close();
console.log(failures.length === 0 ? "\nWALK PASSED" : `\nWALK FAILED: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
