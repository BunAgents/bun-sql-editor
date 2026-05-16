const CACHE = "queryforge-v11";
// Only cache static assets, not JS/CSS (they have cache-busting via ?v= query)
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network-only, no caching
  if (url.pathname.startsWith("/api/")) return;
  // Only cache same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
      // Stale-while-revalidate: serve cache instantly, update in background
      return cached ?? fetchPromise;
    })
  );
});
