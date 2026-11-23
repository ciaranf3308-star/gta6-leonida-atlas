// Generated per release; never cache external analytics, APIs, or private data.
const CACHE="atlas-8a5edab2-1b0bc27a7bbd", PREFIX="atlas-8a5edab2-", BASE="/";
const CORE=["/","/index.html","/favicon.svg","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png","/assets/BackupDialog-BiwfVKKm.js","/assets/MarkerEditor-BBmClI7f.js","/assets/PlaceDetails-DmqQ47cD.js","/assets/ProjectPage-Dze7AlhV.js","/assets/RegionalResearch-BhRApGhg.css","/assets/RegionalResearch-Cv14ID5s.js","/assets/SettingsDialog-Wr809nql.js","/assets/gtadb-CZYq3MnW.js","/assets/index-DxIK6_ig.css","/assets/index-GCKXHuKq.js","/assets/inter-cyrillic-400-normal-obahsSVq.woff2","/assets/inter-cyrillic-600-normal-CWCymEST.woff2","/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2","/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2","/assets/inter-greek-400-normal-B4URO6DV.woff2","/assets/inter-greek-600-normal-plRanbMR.woff2","/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2","/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2","/assets/inter-latin-400-normal-C38fXH4l.woff2","/assets/inter-latin-600-normal-LgqL8muc.woff2","/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2","/assets/inter-vietnamese-400-normal-DMkecbls.woff2","/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2","/assets/jsx-runtime-DyZJNswf.js","/assets/leonida-coordinates-CXGuqbYF.js","/assets/leonida-evidence-BTSqoURv.js","/assets/oswald-cyrillic-500-normal-Dz4ZC46J.woff2","/assets/oswald-cyrillic-ext-500-normal-DngHVvy4.woff2","/assets/oswald-latin-500-normal-B-eyT0Dw.woff2","/assets/oswald-latin-ext-500-normal-QdEKgtiz.woff2","/assets/oswald-vietnamese-500-normal-hXcn5ojQ.woff2","/assets/public-path-DoqNwZJ4.js","/assets/gta6-leonida-atlas/basemap.svg","/assets/street-leonida/maps/gtadb-landmarks-d406fea.json"];
const APP_FILES=CORE.concat(["/assets/ExplorerView-CPZbGovK.css","/assets/ExplorerView-DKe8jwNS.js","/assets/walk-overlays-Cl9svvq8.js","/assets/walk-world-BFf4L2BT.js"]);
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
