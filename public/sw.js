const CACHE = 'ctp-logistica-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copia = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          const copia = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
          return response
        })
    )
  )
})
