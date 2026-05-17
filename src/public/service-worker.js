const CACHE = "queryforge-v14";
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

  // Never cache: API calls, JS, CSS, HTML — they have server-side cache busting
  if (url.pathname.startsWith("/api/")) return;
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const ext = url.pathname.split(".").pop();
  if (["js", "css", "html", ""].includes(ext)) return;

  // Cache-first for icons/manifests only
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
  );
});
