// Offline support: keep a copy of the app so it opens without a connection.
// A new version.js makes this worker count as changed, so the browser installs the new copy
// next to the old one and the app offers the update. The new copy takes over when the user presses Update.
importScripts('version.js');
const CACHE = 'timeout-' + self.APP_VERSION;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'court.js', 'config.js', 'version.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
// cache: 'reload' skips the browser's own HTTP cache, so the new copy is never filled with old files.
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data === 'version' && e.ports[0]) e.ports[0].postMessage(self.APP_VERSION);
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return; // sync requests always go to the network
  // Serve the saved copy straight away and refresh it in the background.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
