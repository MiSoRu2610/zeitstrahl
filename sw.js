// Offline-Speicher: App-Dateien werden beim ersten Öffnen gesichert und danach ohne Internet geladen.
const CACHE = "zeitstrahl-app-v4";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

// Erst aus dem Speicher antworten, im Hintergrund (falls online) die neue Version holen.
// Hat sich die Seite geändert, bekommt die geöffnete App Bescheid und lädt sich neu.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: "no-cache" }).then(async r => {
      if (r.ok) {
        const old = hit && e.request.mode === "navigate" ? await hit.clone().text() : null;
        const fresh = old !== null ? await r.clone().text() : null;
        await c.put(e.request, r.clone());
        if (old !== null && old !== fresh) {
          const cs = await self.clients.matchAll();
          cs.forEach(cl => cl.postMessage("updated"));
        }
      }
      return r;
    }).catch(() => null);
    e.waitUntil(net);
    return hit || (await net) || (await c.match("./index.html"));
  }));
});
