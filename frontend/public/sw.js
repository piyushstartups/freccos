/* Freccos service worker — light app-shell cache. */
const CACHE = "freccos-shell-v2";
const SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Paths that must never be intercepted or cached by this worker — they belong
// to other service workers and need to come straight from the network.
const PASSTHROUGH = [
  "/OneSignalSDKWorker.js",
  "/OneSignalSDKUpdaterWorker.js",
];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache API or auth callbacks
  if (url.pathname.startsWith("/api/")) return;
  // Never intercept other service workers' scripts — let the browser fetch them
  // directly so registration sees the real JS file, not a stale shell.
  if (PASSTHROUGH.includes(url.pathname)) return;
  // Network-first for navigation
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || new Response("offline", { status: 503 })))
    );
    return;
  }
  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type !== "opaque") cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
