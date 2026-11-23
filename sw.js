// Generated per release; never cache external analytics, APIs, or private data.
const CACHE="atlas-b40404d5-10cb61c45ea1", PREFIX="atlas-b40404d5-", BASE="/gta6-leonida-atlas/";
const CORE=["/gta6-leonida-atlas/","/gta6-leonida-atlas/index.html","/gta6-leonida-atlas/favicon.svg","/gta6-leonida-atlas/manifest.webmanifest","/gta6-leonida-atlas/icons/icon-192.png","/gta6-leonida-atlas/icons/icon-512.png","/gta6-leonida-atlas/assets/BackupDialog-BSAyQng3.js","/gta6-leonida-atlas/assets/MarkerEditor-JBYbTB2j.js","/gta6-leonida-atlas/assets/PlaceDetails-B-TK8Vej.js","/gta6-leonida-atlas/assets/ProjectPage-Zo_PYxSO.js","/gta6-leonida-atlas/assets/RegionalResearch-Bm9lKITd.css","/gta6-leonida-atlas/assets/RegionalResearch-ZbDcLa4S.js","/gta6-leonida-atlas/assets/SettingsDialog-DA5xbdcH.js","/gta6-leonida-atlas/assets/atlas-hzK8QrF1.js","/gta6-leonida-atlas/assets/cormorant-garamond-500-latin-CUoBjw-S.woff2","/gta6-leonida-atlas/assets/cormorant-garamond-500-latin-ext-ltf1AbuM.woff2","/gta6-leonida-atlas/assets/cormorant-garamond-500italic-latin-Y14P-dkT.woff2","/gta6-leonida-atlas/assets/cormorant-garamond-500italic-latin-ext-CE7zdTnu.woff2","/gta6-leonida-atlas/assets/index-D6G2MQU1.css","/gta6-leonida-atlas/assets/index-DXtJxLSB.js","/gta6-leonida-atlas/assets/inter-cyrillic-400-normal-obahsSVq.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-600-normal-CWCymEST.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2","/gta6-leonida-atlas/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2","/gta6-leonida-atlas/assets/inter-greek-400-normal-B4URO6DV.woff2","/gta6-leonida-atlas/assets/inter-greek-600-normal-plRanbMR.woff2","/gta6-leonida-atlas/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2","/gta6-leonida-atlas/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2","/gta6-leonida-atlas/assets/inter-latin-400-normal-C38fXH4l.woff2","/gta6-leonida-atlas/assets/inter-latin-600-normal-LgqL8muc.woff2","/gta6-leonida-atlas/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/gta6-leonida-atlas/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2","/gta6-leonida-atlas/assets/inter-vietnamese-400-normal-DMkecbls.woff2","/gta6-leonida-atlas/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2","/gta6-leonida-atlas/assets/jsx-runtime-DyZJNswf.js","/gta6-leonida-atlas/assets/leonida-coordinates-CXGuqbYF.js","/gta6-leonida-atlas/assets/oswald-cyrillic-500-normal-Dz4ZC46J.woff2","/gta6-leonida-atlas/assets/oswald-cyrillic-ext-500-normal-DngHVvy4.woff2","/gta6-leonida-atlas/assets/oswald-latin-500-normal-B-eyT0Dw.woff2","/gta6-leonida-atlas/assets/oswald-latin-ext-500-normal-QdEKgtiz.woff2","/gta6-leonida-atlas/assets/oswald-vietnamese-500-normal-hXcn5ojQ.woff2","/gta6-leonida-atlas/assets/public-path-U2E4Y9CW.js","/gta6-leonida-atlas/assets/gta6-leonida-atlas/basemap.svg","/gta6-leonida-atlas/assets/street-leonida/maps/gtadb-landmarks-d406fea.json"];
const APP_FILES=CORE.concat(["/gta6-leonida-atlas/assets/ExplorerView-9qcLU4G6.js","/gta6-leonida-atlas/assets/ExplorerView-CPZbGovK.css","/gta6-leonida-atlas/assets/walk-geography-DD_enY_F.js","/gta6-leonida-atlas/assets/walk-overlays-B3amrVoQ.js","/gta6-leonida-atlas/assets/walk-world-CNjivOMM.js"]);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
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
