const CACHE = 'ctp-logistica-v3'

// Shell mínimo para que la app abra sin conexión mientras llegan los assets.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/CTP.png', '/CTPM.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
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
    // Los assets (/assets/*.js, *.css) van con la ÚLTIMA versión del servidor
    // siempre que haya conexión: así el bundle nunca queda "viejón" apuntando a
    // chunks que el deploy nuevo ya borró. La caché queda solo como respaldo
    // offline.
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copia = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
        }
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit))
  )
})
