const CACHE = 'ctp-logistica-v4'

// Shell mínimo para que la app abra sin conexión mientras llegan los assets.
// Incluye /inicio porque es el start_url del manifest (lo usan los lanzamientos
// desde pantalla de inicio / instalada).
const SHELL = ['/', '/index.html', '/inicio', '/manifest.webmanifest', '/CTP.png', '/CTPM.png']

// Página mínima de respaldo si el usuario está offline y la app aún no quedó
// en caché (evita el mensaje "Sin conexión" del navegador / dinosaurio).
const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sin conexión · Logística CTP</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#071A3D;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
  .c{max-width:340px}.logo{width:88px;height:88px;object-fit:contain;border-radius:22px;background:#00E5FF;padding:10px}
  h1{font-size:20px;margin:18px 0 6px}.p{color:#9fb6cc;font-size:14px;margin:0 0 22px}
  button{border:0;border-radius:999px;background:#00E5FF;color:#071A3D;font-weight:800;font-size:15px;padding:12px 28px;cursor:pointer}
</style>
</head>
<body>
  <div class="c"><img class="logo" src="/CTPM.png" alt="CTP" />
  <h1>Estás sin conexión</h1>
  <p class="p">La app aún no se cargó en este equipo. Conecta a internet un momento y vuelve a intentarlo.</p>
  <button onclick="location.reload()">Reintentar</button>
  </div>
</body>
</html>`

// Precachea el shell tolerando fallos por archivo: un archivo que falle no debe
// dejar la caché vacía (si addAll falla en masa, se intenta individual).
async function precargarShell() {
  const cache = await caches.open(CACHE)
  try {
    await cache.addAll(SHELL)
  } catch {
    // Intento individual: alguno puede fallar (ej. /inicio) sin tirar los demás.
    for (const ruta of SHELL) {
      try {
        const resp = await fetch(ruta, { cache: 'reload' })
        if (resp && resp.ok) await cache.put(ruta, resp.clone())
      } catch {
        // este archivo no se pudo precachear; se ignora
      }
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precargarShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function responderOffline() {
  const hit = (await caches.match('/index.html')) || (await caches.match('/'))
  if (hit) return hit
  return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Navegaciones: primero la red (siempre el HTML más nuevo); si falla, la
    // entrada cacheada de esa ruta o el index.html / página offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copia = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copia))
          }
          return response
        })
        .catch(() => responderOffline())
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
      .catch(() =>
        caches.match(request).then((hit) => hit || new Response('', { status: 404, statusText: 'Sin conexión' }))
      )
  )
})