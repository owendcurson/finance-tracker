var CACHE_NAME = 'finance-tracker-v21';
var ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './modules/state.js',
  './modules/constants.js',
  './modules/tax.js',
  './modules/utils.js',
  './modules/firebase.js',
  './modules/payday.js',
  './modules/theme.js',
  './modules/ui.js',
  './modules/pots.js',
  './modules/inbox.js',
  './modules/charts.js',
  './modules/achievements.js',
  './modules/insights.js',
  './modules/tracker.js',
  './modules/history.js',
  './modules/dashboard.js',
  './modules/settings.js',
  './modules/auth.js',
  './modules/notifications.js',
  './modules/payday_modal.js',
  './modules/privacy.js',
  './modules/onboarding.js',
  './modules/demo.js',
  './modules/offline.js',
];
var CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js'
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

self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data = { title: 'Finance Tracker', body: event.data.text() }; }
  }
  var title = data.title || 'Finance Tracker';
  var options = {
    body: data.body || '',
    icon: './icon-192.svg',
    badge: './icon-192.svg',
    tag: data.tag || 'finance-tracker',
    data: { url: data.url || './index.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', function(event) {
  var d = event.data || {};
  if (d.type === 'show-notification') {
    var title = d.title || 'Finance Tracker';
    var options = {
      body: d.body || '',
      icon: './icon-192.svg',
      badge: './icon-192.svg',
      tag: d.tag || 'finance-tracker',
      data: { url: d.url || './index.html' }
    };
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title, options);
    }
  }
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
