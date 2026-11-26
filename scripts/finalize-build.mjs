import { fileURLToPath } from "node:url";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer, loadEnv } from "vite";

const outDir = process.env.ATLAS_OUT_DIR || "dist";
const base = (process.env.ATLAS_BASE_PATH || "/").replace(/\/?$/, "/");
if (
  !base.startsWith("/") ||
  base.includes("..") ||
  !/^\/[a-zA-Z0-9/_-]*$/.test(base)
)
  throw new Error(
    "ATLAS_BASE_PATH must be an absolute URL path with a trailing slash.",
  );
let html = await readFile(join(outDir, "index.html"), "utf8");
const buildEnv = loadEnv("production", process.cwd(), "VITE_");
const measurementId =
  process.env.VITE_ANALYTICS_ID ?? buildEnv.VITE_ANALYTICS_ID ?? "";
function httpsOrigin(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.origin === value.replace(/\/$/, "")
      ? url.origin
      : "";
  } catch {
    return "";
  }
}
const analyticsOrigin = httpsOrigin(
  process.env.VITE_ANALYTICS_ORIGIN ?? buildEnv.VITE_ANALYTICS_ORIGIN,
);
const parentOrigin = httpsOrigin(
  process.env.VITE_ANALYTICS_PARENT_ORIGIN ??
    buildEnv.VITE_ANALYTICS_PARENT_ORIGIN,
);
const validMeasurementId =
  /^G-[A-Z0-9]{6,20}$/.test(measurementId) &&
  analyticsOrigin &&
  parentOrigin &&
  analyticsOrigin !== parentOrigin
    ? measurementId
    : "";
if (process.env.ATLAS_NGINX_CSP_FILE) {
  const originPattern = /^https:\/\/(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d+)?$/;
  const enabled =
    validMeasurementId &&
    [analyticsOrigin, parentOrigin].every((value) => originPattern.test(value));
  if (validMeasurementId && !enabled)
    throw new Error("Invalid nginx analytics hostname.");
  const frameSources = enabled ? "'self' " + analyticsOrigin : "'self'";
  const ancestors = enabled ? parentOrigin : "'none'";
  await writeFile(
    process.env.ATLAS_NGINX_CSP_FILE,
    "map $uri $atlas_analytics_ancestors {\n" +
      "  default \"'self'\";\n" +
      '  /analytics.html "' +
      ancestors +
      '";\n' +
      "}\nmap $uri $atlas_frame_sources {\n" +
      '  default "' +
      frameSources +
      '";\n' +
      "  /analytics.html \"'none'\";\n" +
      "}\n",
  );
}
await writeFile(
  join(outDir, "analytics.html"),
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><title>Atlas anonymous measurement</title><script defer src="${base}analytics-bootstrap.js"></script></head><body></body></html>`,
);
await writeFile(
  join(outDir, "analytics-bootstrap.js"),
  `(function(){
  var id=${JSON.stringify(validMeasurementId)},expectedOrigin=${JSON.stringify(analyticsOrigin)},parentOrigin=${JSON.stringify(parentOrigin)},base=${JSON.stringify(base)};
  // Only the dedicated, different origin may run the tag, and only inside a frame.
  if(!id||!expectedOrigin||!parentOrigin||expectedOrigin===parentOrigin||window.parent===window||window.origin!==expectedOrigin||location.origin!==expectedOrigin)return;
  // An empty hidden page must not manufacture Enhanced Measurement scroll events.
  document.body.style.minHeight='10000px';
  var configured=false,revoked=false;
  function send(type){window.parent.postMessage({type:type},parentOrigin);}
  function revoke(){
    revoked=true;window['ga-disable-'+id]=true;
    ['atlas_ga','atlas_ga_'+id.slice(2)].forEach(function(name){document.cookie=name+'=; Max-Age=0; Path='+base+'; SameSite=Lax; Secure';});
    send('atlas:analytics:revoked');
  }
  window.addEventListener('message',function(event){
    if(event.source!==window.parent||event.origin!==parentOrigin||!event.data||typeof event.data!=='object'||Array.isArray(event.data))return;
    var data=event.data;
    if(data.type==='atlas:analytics:revoke'&&Object.keys(data).length===1){revoke();return;}
    if(configured||revoked||data.type!=='atlas:analytics:configure'||data.consent!=='granted'||Object.keys(data).length!==2)return;
    configured=true;
    window.dataLayer=[];function gtag(){window.dataLayer.push(arguments);}
    gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('js',new Date());
    var safeLocation=parentOrigin+base;
    gtag('config',id,{send_page_view:false,cookie_domain:'none',cookie_path:base,cookie_prefix:'atlas',cookie_flags:'SameSite=Lax;Secure',page_location:safeLocation,page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false});
    gtag('event','page_view',{page_title:'ViceWire',page_location:safeLocation,page_referrer:''});
    var script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
  });
  send('atlas:analytics:ready');
})();`,
);
const pages = [
  "about",
  "documentation",
  "credits",
  "contributing",
  "changelog",
  "licenses",
];
const siteOrigin =
  process.env.VITE_ATLAS_SITE_ORIGIN ?? buildEnv.VITE_ATLAS_SITE_ORIGIN ?? "";
const template = html;
function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
function documentHtml({ metadata, markup }) {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = metadata.canonical && escapeHtml(metadata.canonical);
  // Idempotency (v0.30.0): finalize READS dist/index.html, which a
  // previous finalize already SSR-rendered — so without stripping,
  // every run appended another robots/og block before </head> and
  // the root markup went stale (the literal '<div id="root"></div>'
  // replace never fires again once markup is in place). The injected
  // head block and root markup are wrapped in sentinels and stripped
  // before re-injection, so re-running finalize over its own output
  // reproduces byte-identical files and the content hash (and the SW
  // cache name) stays put when nothing changed. Found because two
  // consecutive finalize runs produced different cache names.
  const stripped = template
    .replace(/<!-- vicewire-ssr-head -->[\s\S]*?<!-- \/vicewire-ssr-head -->\n?/g, "")
    .replace(/<!-- vicewire-ssr-root -->[\s\S]*?<!-- \/vicewire-ssr-root -->/g, "");
  return stripped
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${description}">`,
    )
    .replace(
      "</head>",
      `<!-- vicewire-ssr-head -->
<meta name="robots" content="${metadata.robots}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
${
  canonical
    ? `<link rel="canonical" href="${canonical}">
<meta property="og:url" content="${canonical}">`
    : ""
}
<!-- /vicewire-ssr-head -->
</head>`,
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root"><!-- vicewire-ssr-root -->${markup}<!-- /vicewire-ssr-root --></div>`,
    );
}
// Use the existing project components as the initial HTML; no second editorial copy.
// The interactive app still mounts normally, including private account extensions.
const renderer = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  envDir: process.cwd(),
  base,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    middlewareMode: true,
    // v0.18.0: ignore the tile pyramids — ~62k files (day + styled)
    // exhaust the inotify limit and the watcher spams one ENOSPC error
    // per file to stderr (4+ MB), which overflowed the calling test's
    // exec buffer. This server only SSR-renders static pages; it never
    // needs to watch static assets.
    // v0.30.0: the source pyramid moved to tiles-source/day/ — the
    // segment is "tiles-source", not "tiles", so the old pattern did
    // not match it and the spam came back (measured 887 KB / 5,569
    // ENOSPC lines on one run, right at the test's 1 MB exec buffer).
    // Both pyramids are ignored now.
    watch: { ignored: ["**/tiles/**", "**/tiles-source/**"] },
  },
  appType: "custom",
});
try {
  const { renderStaticPage } = await renderer.ssrLoadModule(
    "/src/features/project/static-page.tsx",
  );
  html = documentHtml(renderStaticPage("", base, siteOrigin));
  await writeFile(join(outDir, "index.html"), html);
  for (const page of pages) {
    await mkdir(join(outDir, page), { recursive: true });
    await writeFile(
      join(outDir, page, "index.html"),
      documentHtml(renderStaticPage(page, base, siteOrigin)),
    );
  }
  const utility = renderStaticPage("", base, siteOrigin);
  utility.metadata.robots = "noindex, follow";
  await mkdir(join(outDir, "app"), { recursive: true });
  await writeFile(join(outDir, "app/index.html"), documentHtml(utility));
  await writeFile(
    join(outDir, "404.html"),
    documentHtml({
      metadata: {
        ...utility.metadata,
        canonical: null,
        title: "Atlas page not found",
        description: "This Atlas address does not identify an available page.",
      },
      markup: `<main class="project-page"><div class="project-layout"><article class="project-article"><h1>Atlas page not found</h1><p><a href="${base}">Return to ViceWire</a></p></article></div></main>`,
    }).replace(/<script type="module"[^>]*><\/script>/g, ""),
  );
} finally {
  await renderer.close();
}
const assets = (await readdir(join(outDir, "assets")))
  .filter((name) => /\.(?:js|css|woff2)$/.test(name))
  .map((name) => `${base}assets/${name}`);
const threeDimensionalAssets = assets.filter((url) =>
  /\/(?:walk-[a-z-]+)-[^/]+\.(?:js|css)$/.test(url),
);
const precache = [
  base,
  `${base}index.html`,
  `${base}favicon.svg`,
  `${base}manifest.webmanifest`,
  `${base}icons/icon-192.png`,
  `${base}icons/icon-512.png`,
  ...assets.filter((url) => !threeDimensionalAssets.includes(url)),
  `${base}assets/gta6-leonida-atlas/basemap.svg`,
  `${base}assets/street-leonida/maps/gtadb-landmarks-2e9e194.json`,
];
// Startup-needed chunks (v0.30.1, QA Finding #3): Vite
// modulepreloads the chunks the entry point imports at startup.
// Those belong in CORE, not APP_FILES: on the first visit the
// preload fetch races ahead of the not-yet-controlling worker and
// never lands in the cache, so an offline reload after exactly one
// visit fails to hydrate (the 3D chunk walk-geography-*.js). Derive
// them from the built index.html instead of naming files, so
// whatever the bundler preloads next release is covered too.
for (const match of html.matchAll(
  /<link rel="modulepreload"[^>]*href="([^"]+)"/g,
)) {
  const url = match[1];
  if (url.startsWith(base) && !precache.includes(url)) precache.push(url);
}
// A startup chunk stops being a lazy 3D asset once it is precached.
for (let i = threeDimensionalAssets.length - 1; i >= 0; i--) {
  if (precache.includes(threeDimensionalAssets[i]))
    threeDimensionalAssets.splice(i, 1);
}
const contentHash = createHash("sha256").update(
  html + JSON.stringify([precache, threeDimensionalAssets]),
);
for (const url of [...precache, ...threeDimensionalAssets]) {
  if (url !== base)
    contentHash.update(await readFile(join(outDir, url.slice(base.length))));
}
// Tile manifest (v0.30.0): which tiles the pyramid actually drew, and
// which of them are pure sea — so the worker can tell a failed LAND
// tile (never ocean) from genuine water. A tile is "ocean" when its
// bytes are identical to ocean.jpg: the 505 fill tiles are all the
// same graded pure-sea image, and ocean.jpg is that same image, so
// the check is exact, not a colour guess. The manifest is a per-zoom
// bitset over the full grid (3·2^z wide × 4·2^z tall): "p" = present,
// "o" = ocean, hex-encoded so the worker needs no atob. It is folded
// into the content hash with the tile bytes, so a re-render moves the
// cache name. The ocean.jpg fallback is hashed too: it is served for
// genuine ocean and cached under those tiles' URLs.
// v0.28: the fingerprint covers tiles/graded/ only. The ViceWire
// pyramids (v1/v2/v3), illustrated and enhanced are no longer on
// disk, so they are no longer fingerprinted — a future re-render gets
// its own tile path and its own entry here.
const gradedDir = join(
  outDir,
  "assets/gta6-leonida-atlas/tiles/graded",
);
let oceanBytes = null;
try {
  oceanBytes = await readFile(
    join(outDir, "assets/gta6-leonida-atlas/tiles/ocean.jpg"),
  );
  contentHash.update("ocean.jpg:");
  contentHash.update(oceanBytes);
  contentHash.update("\n");
} catch {
  // No ocean fallback in this build — not an error.
}
const tileManifest = {};
try {
  for (let zoom = 0; zoom <= 6; zoom++) {
    let names;
    try {
      names = (await readdir(join(gradedDir, String(zoom)))).sort();
    } catch {
      continue; // No tiles at this zoom in this build — not an error.
    }
    const width = 3 * (1 << zoom);
    const height = 4 * (1 << zoom);
    const present = new Uint8Array(Math.ceil((width * height) / 8));
    const ocean = new Uint8Array(Math.ceil((width * height) / 8));
    for (const name of names) {
      const bytes = await readFile(join(gradedDir, String(zoom), name));
      contentHash.update(`graded/${zoom}/${name}:`);
      contentHash.update(bytes);
      contentHash.update("\n");
      const parts = /^(\d+),(\d+),(\d+)\.jpg$/.exec(name);
      if (!parts) continue;
      const tileZoom = Number(parts[1]);
      const tileY = Number(parts[2]);
      const tileX = Number(parts[3]);
      if (tileZoom !== zoom || tileY >= height || tileX >= width) continue;
      const bit = tileY * width + tileX;
      present[bit >> 3] |= 1 << (bit & 7);
      if (oceanBytes !== null && bytes.equals(oceanBytes))
        ocean[bit >> 3] |= 1 << (bit & 7);
    }
    tileManifest[String(zoom)] = {
      p: Buffer.from(present).toString("hex"),
      o: Buffer.from(ocean).toString("hex"),
    };
  }
} catch {
  // No tile pyramids in this build (older checkouts) — the hash
  // still covers the shell; tiles are not cached from this build.
}
const revision = contentHash.digest("hex").slice(0, 12);
const prefix = `atlas-${createHash("sha256").update(base).digest("hex").slice(0, 8)}-`;
const worker = `// Generated per release; never cache external analytics, APIs, or private data.
// Cache name is a content hash of the shell + precache + tile fingerprint:
// a tile re-render changes it, and install skipWaits so the update
// activates immediately instead of waiting for every tab to close
// (v0.20: no skipWaiting meant the new worker waited forever and the
// phone kept serving stale tiles from the old cache).
const CACHE=${JSON.stringify(prefix + revision)}, PREFIX=${JSON.stringify(prefix)}, BASE=${JSON.stringify(base)};
const CORE=${JSON.stringify(precache)};
const APP_FILES=CORE.concat(${JSON.stringify(threeDimensionalAssets)});
// Tile manifest (v0.30.0): per-zoom bitsets over the full grid
// (3·2^z wide × 4·2^z tall), hex-encoded — "p" = the pyramid drew
// this tile, "o" = the tile is pure sea (byte-identical to
// ocean.jpg). Decoded lazily, one zoom at a time.
const TILE_MANIFEST=${JSON.stringify(tileManifest)};
const TILE_DATA={};
function tileHexBytes(hex){const a=new Uint8Array(hex.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(hex.substr(i*2,2),16);return a;}
function tileData(z){
  if(TILE_DATA[z]!==undefined)return TILE_DATA[z];
  const entry=TILE_MANIFEST[String(z)];
  if(!entry){TILE_DATA[z]=null;return null;}
  const data={present:tileHexBytes(entry.p),ocean:tileHexBytes(entry.o)};
  TILE_DATA[z]=data;
  return data;
}
function tileBit(arr,z,y,x){
  const w=3*(1<<z),h=4*(1<<z);
  if(x<0||y<0||x>=w||y>=h)return false;
  const i=y*w+x;
  return ((arr[i>>3]>>(i&7))&1)===1;
}
// Genuine ocean, by the pyramid's own marking: a tile the pyramid
// never drew (open sea beyond the grid — Leaflet asks for one tile
// past the edge), or a tile whose bytes are the pyramid's pure-sea
// image (the 505 fill tiles). Anything else is land-or-coast: a
// failed fetch for it must NEVER be answered with ocean (v0.24 P0:
// max zoom on land rendered ocean because tile zoom 7 404'd and the
// worker silently answered ocean.jpg).
function tileIsOcean(z,y,x){
  const data=tileData(z);
  if(!data)return true;
  if(tileBit(data.ocean,z,y,x))return true;
  if(!tileBit(data.present,z,y,x))return true;
  return false;
}
// Optional-asset budget (v0.29, measured): a real session loads ~600
// distinct tiles in two minutes of driving, and the old 1500 cap
// evicted the oldest tile on every put past it — tiles seen five
// minutes ago re-fetched over the network. The cap is now 6000
// (~37 MB at ~6 KB/tile) and the count is kept in memory instead of
// re-scanning cache.keys() on every put: that O(n) scan ran per tile
// and grew with the cache, and under Leaflet's concurrent tile loads
// the check-then-put raced anyway (a 1600-fetch proof run left 1599
// entries in the cache, not 1500). The count is soft — concurrent
// puts can overshoot by a batch — the browser quota is the hard
// limit. Eviction still drops the oldest first, in bulk (100 at a
// time), and the counter is re-counted after each eviction so drift
// from re-puts can never accumulate.
let optionalCount=-1;
const OPTIONAL_CAP=6000,OPTIONAL_EVICT=100;
async function countOptional(cache){
  if(optionalCount<0){
    const keys=await cache.keys();
    optionalCount=keys.filter(k=>!APP_FILES.includes(new URL(k.url).pathname)).length;
  }
  return optionalCount;
}
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
// v0.30.1: install-time skipWaiting() alone does not reliably
// activate the new worker — measured 7 of 9 first reloads left it
// sitting in 'waiting' in this Chromium, with the old worker
// controlling the page for the whole session. So the page also
// prompts an already-installed waiting worker explicitly (see
// main.tsx): a skipWaiting() call on an installed worker activates
// it immediately. Both paths call the same thing; the prompt is the
// one that lands.
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  if(url.pathname===BASE+'analytics.html'||url.pathname===BASE+'analytics-bootstrap.js')return;
  const navigation=request.mode==='navigate';
  const publicOptional=(url.pathname.startsWith(BASE+'assets/street-leonida/')||url.pathname.startsWith(BASE+'assets/gta6-leonida-atlas/tiles/'))&&/\\.(?:webp|jpg|png|svg|json)$/.test(url.pathname);
  const asset=APP_FILES.includes(url.pathname)||publicOptional;
  if(request.headers.has('authorization')||(!navigation&&url.search))return;
  if(!navigation&&!asset)return;
  if(navigation){event.respondWith(fetch(request).catch(()=>caches.match(BASE+'index.html')));return;}
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request);if(cached)return cached;
    const isTile=url.pathname.startsWith(BASE+'assets/gta6-leonida-atlas/tiles/graded/')&&/\\.jpg$/.test(url.pathname);
    let response=null;
    try{response=await fetch(request);}catch{response=null;}
    if(isTile&&(!response||!response.ok)){
      // A failed tile is ocean ONLY when the pyramid marks it as
      // water (tileIsOcean): never drawn, or pure sea. A failed LAND
      // tile is handed back as the failure it is — never ocean, never
      // cached — so Leaflet fires tileerror and shows the error tile
      // instead of painting water over land (v0.24 P0), and the next
      // pan retries it. The ocean tile itself is cached as ocean for
      // offline, as before.
      const m=url.pathname.match(/\\/graded\\/(\\d+)\\/(\\d+),(-?\\d+),(-?\\d+)\\.jpg$/);
      const z=m?Number(m[1]):-1,y=m?Number(m[3]):-1,x=m?Number(m[4]):-1;
      if(z>=0&&z<=6&&tileIsOcean(z,y,x)){
        const oceanUrl=new URL(BASE+'assets/gta6-leonida-atlas/tiles/ocean.jpg',self.location.origin).href;
        let ocean=await cache.match(oceanUrl);
        if(!ocean||!ocean.ok){
          const fetched=await fetch(oceanUrl).catch(()=>null);
          if(fetched&&fetched.ok){try{await cache.put(oceanUrl,fetched.clone());}catch{}ocean=fetched;}
        }
        if(ocean&&ocean.ok){
          try{await cache.put(request,ocean.clone());}catch{}
          return ocean;
        }
      }
      if(response)return response;
      throw new Error('Tile unavailable');
    }
    if(response&&response.ok&&response.type==='basic'&&!/private|no-store/i.test(response.headers.get('cache-control')||'')){
      // Bound optional asset caching (3D assets and map tiles visited);
      // the app shell and public data remain pinned. Eviction is
      // bulk oldest-first (see countOptional above); the per-put scan
      // the old cap did is gone.
      try {
        if(publicOptional&&!APP_FILES.includes(url.pathname)&&await countOptional(cache)>=OPTIONAL_CAP){
          const keys=await cache.keys();
          const extras=keys.filter(k=>!APP_FILES.includes(new URL(k.url).pathname)).slice(0,OPTIONAL_EVICT);
          await Promise.all(extras.map(k=>cache.delete(k)));
          optionalCount=-1;
        }
        await cache.put(request,response.clone());
        if(publicOptional&&!APP_FILES.includes(url.pathname))optionalCount++;
      } catch { /* Cache quota must not discard a successful network response. */ }
    }
    if(response)return response;
    throw new Error('Asset unavailable');
  }).catch(()=>fetch(request)));
});
`;
await writeFile(join(outDir, "sw.js"), worker);
await writeFile(join(outDir, "_redirects"), `${base}* ${base}index.html 200\n`);
await writeFile(
  join(outDir, "_headers"),
  `${base}*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n${base}sw.js\n  Cache-Control: no-cache\n`,
);
console.log(
  `Static routes: ${pages.length + 2}; offline core: ${precache.length} files; base: ${base}`,
);
