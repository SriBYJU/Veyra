const CACHE='veyra-v3.4.2';
const CORE=['./','./index.html','./styles.css','./enhancements.css','./master-audit.css','./config.js','./app.js','./enhancements.js','./food-intelligence.js','./vision-ai.js','./release-polish.js','./clarity.js','./final-audit.js','./dynamic-intelligence.js','./master-audit-fixes.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png','./assets/shriyan.jpg','./assets/brand-board.png','./assets/veyra-promo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  // Never cache Spotify/Open Food Facts/other third-party API responses. Keep the offline cache app-only.
  if(url.origin!==self.location.origin){e.respondWith(fetch(e.request));return;}
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res;}).catch(()=>caches.match('./index.html')));
    return;
  }
  // Publisher configuration can change after deployment (Spotify Client ID / Gateway URL),
  // so config.js must be network-first instead of getting stuck in an old PWA cache.
  if(url.pathname.endsWith('/config.js')){
    e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./config.js',copy));}return res;}).catch(()=>caches.match('./config.js')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return res;})));
});
