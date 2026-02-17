var CACHE_NAME = 'chum-image_tool-v3.3.0';
var ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.webmanifest',
    './assets/favicon.ico',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (name) {
                    return name !== CACHE_NAME;
                }).map(function (name) {
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request).then(function (response) {
            return response || fetch(event.request).then(function (fetchResponse) {
                if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
                    var responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            });
        }).catch(function () {
            return caches.match('./index.html');
        })
    );
});
