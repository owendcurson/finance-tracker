var CACHE_NAME = 'finance-tracker-v9';
var ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];
var CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).then(function() {
        return Promise.all(CDN_ASSETS.map(function(url) {
          return fetch(url, { mode: 'cors' }).then(function(resp) {
            if (resp.ok) return cache.put(url, resp);
          }).catch(function() {});
        }));
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name) { return caches.delete(name); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
