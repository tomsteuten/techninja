var CACHE_NAME = "techninja-cache-v2";
var APP_SHELL_URLS = [
  "index.html",
  "wizard.js",
  "manifest.json",
  "machines/index.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

function isSameOrigin(req) {
  try { return new URL(req.url).origin === self.location.origin; } catch (e) { return false; }
}

self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL_URLS);

    // Best-effort: precache machine configs listed in machines/index.json.
    // If this fails (first load offline, or fetch error), the app shell still installs.
    try {
      var resp = await fetch("machines/index.json", { cache: "no-store" });
      if (resp && resp.ok) {
        var idx = await resp.json();
        var list = (idx && idx.machines) ? idx.machines : [];
        var urls = [];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].config) urls.push(list[i].config);
        }
        if (urls.length) await cache.addAll(urls);
      }
    } catch (e) {}
  })());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// Cache-first, with runtime caching for fetched assets (including new machine JSONs).
self.addEventListener("fetch", function (event) {
  if (!isSameOrigin(event.request)) return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (networkResp) {
        try {
          var copy = networkResp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        } catch (e) {}
        return networkResp;
      });
    })
  );
});
