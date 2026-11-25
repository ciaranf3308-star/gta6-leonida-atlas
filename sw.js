// Generated per release; never cache external analytics, APIs, or private data.
// Cache name is a content hash of the shell + precache + tile fingerprint:
// a tile re-render changes it, and install skipWaits so the update
// activates immediately instead of waiting for every tab to close
// (v0.20: no skipWaiting meant the new worker waited forever and the
// phone kept serving stale tiles from the old cache).
const CACHE="atlas-b40404d5-f08ffcf507d2", PREFIX="atlas-b40404d5-", BASE="/gta6-leonida-atlas/";
const CORE=["/gta6-leonida-atlas/","/gta6-leonida-atlas/index.html","/gta6-leonida-atlas/favicon.svg","/gta6-leonida-atlas/manifest.webmanifest","/gta6-leonida-atlas/icons/icon-192.png","/gta6-leonida-atlas/icons/icon-512.png","/gta6-leonida-atlas/assets/BackupDialog-B-nkDuAz.js","/gta6-leonida-atlas/assets/MarkerEditor-Cq_7DLbr.js","/gta6-leonida-atlas/assets/PlaceDetails-C1HytkxG.js","/gta6-leonida-atlas/assets/ProjectPage-CjCYMhIZ.js","/gta6-leonida-atlas/assets/RegionalResearch-Bm9lKITd.css","/gta6-leonida-atlas/assets/RegionalResearch-dM2Ef8Mh.js","/gta6-leonida-atlas/assets/SettingsDialog-CRKq44le.js","/gta6-leonida-atlas/assets/anton-400-latin-Byf51wtH.woff2","/gta6-leonida-atlas/assets/index-AY5db6r8.js","/gta6-leonida-atlas/assets/index-BDSK7Rxu.css","/gta6-leonida-atlas/assets/inter-cyrillic-400-normal-obahsSVq.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-600-normal-CWCymEST.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2","/gta6-leonida-atlas/assets/inter-greek-400-normal-B4URO6DV.woff2","/gta6-leonida-atlas/assets/inter-greek-600-normal-plRanbMR.woff2","/gta6-leonida-atlas/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2","/gta6-leonida-atlas/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2","/gta6-leonida-atlas/assets/inter-latin-400-normal-C38fXH4l.woff2","/gta6-leonida-atlas/assets/inter-latin-600-normal-LgqL8muc.woff2","/gta6-leonida-atlas/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/gta6-leonida-atlas/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2","/gta6-leonida-atlas/assets/inter-vietnamese-400-normal-DMkecbls.woff2","/gta6-leonida-atlas/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2","/gta6-leonida-atlas/assets/jsx-runtime-DyZJNswf.js","/gta6-leonida-atlas/assets/oswald-400-latin-9AWb_KF-.woff2","/gta6-leonida-atlas/assets/oswald-cyrillic-500-normal-Dz4ZC46J.woff2","/gta6-leonida-atlas/assets/oswald-cyrillic-ext-500-normal-DngHVvy4.woff2","/gta6-leonida-atlas/assets/oswald-latin-500-normal-B-eyT0Dw.woff2","/gta6-leonida-atlas/assets/oswald-latin-ext-500-normal-QdEKgtiz.woff2","/gta6-leonida-atlas/assets/oswald-vietnamese-500-normal-hXcn5ojQ.woff2","/gta6-leonida-atlas/assets/public-path-U2E4Y9CW.js","/gta6-leonida-atlas/assets/gta6-leonida-atlas/basemap.svg","/gta6-leonida-atlas/assets/street-leonida/maps/gtadb-landmarks-d406fea.json"];
const APP_FILES=CORE.concat(["/gta6-leonida-atlas/assets/ExplorerView-CPZbGovK.css","/gta6-leonida-atlas/assets/ExplorerView-DkyPrTCT.js","/gta6-leonida-atlas/assets/walk-geography-yrqsL7gC.js","/gta6-leonida-atlas/assets/walk-overlays-ByyaJm5E.js","/gta6-leonida-atlas/assets/walk-world-BD_Pg6GP.js"]);
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
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  if(url.pathname===BASE+'analytics.html'||url.pathname===BASE+'analytics-bootstrap.js')return;
  const navigation=request.mode==='navigate';
  const publicOptional=(url.pathname.startsWith(BASE+'assets/street-leonida/')||url.pathname.startsWith(BASE+'assets/gta6-leonida-atlas/tiles/'))&&/\.(?:webp|jpg|png|svg|json)$/.test(url.pathname);
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
    if(!response.ok&&url.pathname.startsWith(BASE+'assets/gta6-leonida-atlas/tiles/')&&/\.jpg$/.test(url.pathname)){
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
    return response;
  }).catch(()=>fetch(request)));
});
