const CACHE = 'workoutboard-shell-v4'

const scopedUrl = path => new URL(path, self.registration.scope).href

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll([
        scopedUrl('./'),
        scopedUrl('./manifest.webmanifest'),
        scopedUrl('./icon.svg')
      ]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy=response.clone()
          caches.open(CACHE).then(cache => cache.put(scopedUrl('./'),copy))
          return response
        })
        .catch(() => caches.match(scopedUrl('./')))
    )
    return
  }

  // During active development, prefer the network for app assets so a phone
  // refresh cannot remain pinned to an older JS/CSS bundle. Cache is fallback only.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request,response.clone()))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
