import { fileURLToPath } from "node:url";
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
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
  return template
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${description}">`,
    )
    .replace(
      "</head>",
      `<meta name="robots" content="${metadata.robots}">
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
</head>`,
    )
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
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
    watch: { ignored: ["**/tiles/**"] },
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
  /\/(?:ExplorerView|walk-[a-z-]+)-[^/]+\.(?:js|css)$/.test(url),
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
  `${base}assets/street-leonida/maps/gtadb-landmarks-d406fea.json`,
];
const contentHash = createHash("sha256").update(
  html + JSON.stringify([precache, threeDimensionalAssets]),
);
for (const url of [...precache, ...threeDimensionalAssets]) {
  if (url !== base)
    contentHash.update(await readFile(join(outDir, url.slice(base.length))));
}
// Tile fingerprint (v0.20.2): the cache name MUST change when tile bytes
// change, even when no app code changed. v0.20 re-rendered all 31,022
// tiles at the same filenames and the content hash above — which only
// covers the app shell and precached assets — did not move, so the old
// cache (and its stale tiles) survived. The fingerprint is the list of
// tile paths + sizes for ALL pyramids (enhanced z0-6, illustrated
// z0-3, vicewire-v2 z0-6): cheap (stat only, no content reads) and it
// moves on any tile re-render. A tile re-render must ALSO change the
// tile path (see gtadb-tiles.ts) — both layers, not one hope.
// v0.25: the fingerprint now covers vicewire-v2 (the live pyramid)
// instead of vicewire-v1. v1 stays on disk in public/ and dist/ as
// the previous generation, like enhanced/illustrated, but it is no
// longer served, so its bytes cannot stale the cache and it is no
// longer fingerprinted. (A tile re-render must still change the tile
// path — see gtadb-tiles.ts — so a future v3 gets its own entry.)
const tileDir = join(outDir, "assets/gta6-leonida-atlas/tiles/enhanced");
const illustratedDir = join(
  outDir,
  "assets/gta6-leonida-atlas/tiles/illustrated",
);
const vicewireDir = join(
  outDir,
  "assets/gta6-leonida-atlas/tiles/vicewire-v2",
);
try {
  for (const [dir, topZoom, label] of [
    [tileDir, 6, "enhanced"],
    [illustratedDir, 3, "illustrated"],
    [vicewireDir, 6, "vicewire-v2"],
  ]) {
    for (let zoom = 0; zoom <= topZoom; zoom++) {
      let names;
      try {
        names = (await readdir(join(dir, String(zoom)))).sort();
      } catch {
        continue; // No tiles at this zoom in this build — not an error.
      }
      for (const name of names) {
        const { size } = await stat(join(dir, String(zoom), name));
        contentHash.update(`${label}/${zoom}/${name}:${size}\n`);
      }
    }
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
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
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
    const response=await fetch(request);
    // A missing tile is ocean by definition (v0.20.2): the GTADB
    // pyramid only draws land, and Leaflet asks for one tile beyond
    // the grid edge (its bounds check counts edge-touching tiles as
    // valid — worse with 128px retina tiles). Answer with the ocean
    // tile instead of the 404, so the image loads cleanly, no console
    // error is logged, and the tile is cached as ocean for offline.
    if(!response.ok&&url.pathname.startsWith(BASE+'assets/gta6-leonida-atlas/tiles/')&&/\\.jpg$/.test(url.pathname)){
      const oceanUrl=new URL(BASE+'assets/gta6-leonida-atlas/tiles/ocean.jpg',self.location.origin).href;
      let ocean=await cache.match(oceanUrl);
      if(!ocean||!ocean.ok){
        const fetched=await fetch(oceanUrl);
        if(fetched.ok){try{await cache.put(oceanUrl,fetched.clone());}catch{}ocean=fetched;}
      }
      if(ocean&&ocean.ok){
        try{await cache.put(request,ocean.clone());}catch{}
        return ocean;
      }
    }
    if(response.ok&&response.type==='basic'&&!/private|no-store/i.test(response.headers.get('cache-control')||'')){
      // Bound optional asset caching (3D assets and map tiles visited);
      // the app shell and public data remain pinned.
      try {
        if(publicOptional&&!APP_FILES.includes(url.pathname)){
          const keys=await cache.keys();const extras=keys.filter(key=>!APP_FILES.includes(new URL(key.url).pathname));
          if(extras.length>=1500)await cache.delete(extras[0]);
        }
        await cache.put(request,response.clone());
      } catch { /* Cache quota must not discard a successful network response. */ }
    }
    return response;
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
