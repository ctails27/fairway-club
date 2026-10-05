/* Fairway Club service worker — cache-first app shell so the app opens with no signal after one visit.
   VERSION is a hash of the built files; a new deploy installs a new cache and the page offers "New version available — tap to refresh". */
var VERSION = '880b04694609';
var SHELL = 'fairway-shell-' + VERSION;
var SDK = 'fairway-sdk-v1';            // Firebase SDK files (versioned URLs), cached the first time they load
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './privacy.html', './terms.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })); }));
  }).then(function () {
    // first install: take over right away. Updates wait until the user taps the refresh prompt.
    return self.registration.active ? null : self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('fairway-shell-') === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {   // any page in scope (incl. ?join=CODE invite links) -> cached page, else index.html
      e.respondWith(caches.open(SHELL).then(function (c) {
        return c.match(req, { ignoreSearch: true }).then(function (r) {
          return r || c.match('./index.html').then(function (ix) { return ix || fetch(req); });
        });
      }).catch(function () { return fetch(req); }));
      return;
    }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || fetch(req).then(function (res) {
        if (res && res.ok && url.pathname.indexOf('/__/') < 0) { var cp = res.clone(); caches.open(SHELL).then(function (c) { c.put(req, cp); }); }
        return res;
      });
    }));
    return;
  }
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) {
    e.respondWith(caches.open(SDK).then(function (c) {
      return c.match(req).then(function (r) {
        return r || fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; });
      });
    }));
  }
  // everything else (Firebase Auth / Firestore APIs, Google sign-in) goes straight to the network
});
