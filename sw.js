const CACHE_VERSION = "tlg-v8.9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=8.9",
  "./translations.js?v=8.9",
  "./firebase-config.js?v=8.9",
  "./app.js?v=8.9",
  "./pwa.js?v=8.9",
  "./account.js?v=8.9",
  "./manifest.webmanifest?v=8.9",
  "./favicon.svg?v=8.9",
  "./favicon-vinyl.png?v=8.9",
  "./favicon.ico?v=8.9",
  "./assets/icons/icon-180.png?v=8.9",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./data/albums.json?v=8.9",
  "./data/songs.json?v=8.9",
  "./data/editorial-notes.json?v=8.9",
  "./data/screen-appearances.json?v=8.9"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith("tlg-") && key !== CACHE_VERSION)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    return cache.match("./index.html");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: false });

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.includes("/assets/covers-master/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.includes("/data/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
