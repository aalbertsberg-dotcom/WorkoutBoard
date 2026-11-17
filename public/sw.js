const release=new URL(self.location.href).searchParams.get('build')||'legacy'
const CACHE='workset-offline-v2-'+release.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)

const scopedUrl = path => new URL(path, self.registration.scope).href

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE)
    const shellUrl=scopedUrl('./')
    const shell=await fetch(shellUrl,{cache:'no-store'})
    if(!shell.ok)throw new Error('Offline shell unavailable')
    const html=await shell.clone().text()
    await cache.put(shellUrl,shell)
    // Precache the built app's hashed JS and CSS for first-use offline launch.
    const assets=[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map(match=>new URL(match[1],shellUrl).href)
      .filter(url=>url.startsWith(self.registration.scope))
    await cache.addAll([...new Set([scopedUrl('./manifest.webmanifest'),scopedUrl('./icon.svg'),...assets])])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && /^(workset-|workoutboard-)/i.test(key)).map(key => caches.delete(key))))
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
          if(response.ok)caches.open(CACHE).then(cache=>cache.put(scopedUrl('./'),copy))
          return response
        })
        .catch(() => caches.match(scopedUrl('./')))
    )
    return
  }

  // Prefer the network for app assets so refreshes still pick up new releases.
  // Every successful response is cached and becomes the offline fallback.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request,response.clone()))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
