const CACHE = 'ctp-logistica-v9'

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

// ---------------------------------------------------------------------------
// Push
//
// Esto es lo que hace que los avisos lleguen con la app CERRADA. El service
// worker es el único trozo de JavaScript que sigue vivo cuando no hay ninguna
// pestaña abierta: por eso es el que puede mostrar la notificación. El resto de
// la app (React, el polling) no existe en ese momento.
//
// El servidor manda un objeto con { titulo, cuerpo, tag, url, datos }. Se lee
// event.data, que es un PushMessageEvent con el texto del servidor: el
// service worker no tiene acceso a ninguna variable del bundle, y el `event` del
// constructor solo sirve si la app se abrió desde un push, no desde una
// suscripción que uno mismo registered.
// ---------------------------------------------------------------------------

// Iconos que ya existen en /public. Se eligen por tipo para que el aviso se
// distinga de un vistazo en el centro de notificaciones del sistema.
const ICONOS = {
  nueva: '/icons/icon-192.png',
  asignacion: '/icons/icon-192.png',
  entrega: '/icons/icon-192.png',
  entregado: '/icons/icon-192.png',
  estado: '/icons/icon-192.png',
  calidad: '/icons/icon-192.png',
  inventario: '/ITitulos/IInventario.png',
}

self.addEventListener('push', (event) => {
  let carga = {}
  try {
    // Los servidores de push (Mozilla/Google) pueden mandar un mensaje vacío
    // como prueba de vida: en ese caso event.data es null y hay que tolerarlo.
    carga = event.data ? event.data.json() : {}
  } catch {
    carga = { titulo: 'PEDRO-CTP', cuerpo: event.data ? event.data.text() : '' }
  }

  const titulo = carga.titulo || 'PEDRO-CTP'
  const cuerpo = carga.cuerpo || ''
  const tipo = (carga.datos && carga.datos.tipo) || ''

  event.waitUntil(
    (async () => {
      // Si hay una pestaña VISIBLE, la app ya está avisos por su cuenta: el
      // polling del store sondea mientras document.hidden es false y pinta el
      // toast en pantalla. Mostrar además el aviso del sistema sería el mismo
      // evento dos veces.
      //
      // Con la pestaña oculta o en segundo plano NO se suprime nada: es
      // exactamente el caso para el que existe el push, porque el polling está
      // parado y si no se mostrara aquí el aviso se perdería.
      const clientes = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const algunaVisible = clientes.some((c) => c.visibilityState === 'visible')
      // Con `forzar` se muestra igual: hay eventos (inventario) que no tienen el
      // polling de solicitudes sonando en la pestaña, así que si no se mostrara
      // aquí, quien tuviera la app abierta no se enteraría de nada.
      if (algunaVisible && !carga.forzar) return

      await self.registration.showNotification(titulo, {
        body: cuerpo,
        // El tag evita el aviso apilado: si llegan dos avisos del mismo pedido,
        // el segundo REEMPLAZA al primero en lugar de dejar dos iguales. Con
        // renotify false no vuelve a sonar, que es lo que se quiere: el segundo
        // aviso es una actualización, no una alarma nueva.
        tag: carga.tag || `ctp-${tipo || 'aviso'}`,
        renotify: false,
        icon: ICONOS[tipo] || ICONOS.nueva,
        badge: '/icons/icon-192.png',
        // En Android, esto decide si la notificación suena: 'default' sí. Sin
        // vibrate el teléfono no hace ruido cuando está bloqueado.
        silent: false,
        requireInteraction: false,
        data: { url: carga.url || '/inicio' },
        vibrate: [120, 60, 120],
      })
    })()
  )
})

// Qué pasa al tocar la notificación. El caso interesante es este: el usuario
// está en otra app, o tiene el celular bloqueado, y toca el aviso. Hay que
// abrir la PWA en la pantalla correcta, no solo enfocarla.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/inicio'

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Si la app ya está abierta en alguna pestaña, se enfoca esa: abrir una
      // segunda copia de la PWA es confuso y en algunos navegadores duplica el
      // estado.
      for (const cliente of clientes) {
        if ('focus' in cliente) {
          // navigate() no existe en algunos navegadores antiguos; si no está,
          // el focus() a secas es el mejor esfuerzo posible.
          if ('navigate' in cliente) {
            try {
              await cliente.navigate(destino)
            } catch {
              /* si no se puede navegar, al menos se enfoca */
            }
          }
          return cliente.focus()
        }
      }

      // No había ninguna pestaña: se abre una nueva.
      if (self.clients.openWindow) {
        await self.clients.openWindow(destino)
      }
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // La API nunca se cachea. Hoy vive en otro origen (subdominio api.*) y este
  // guardia no hace falta, pero si algún día se sirve en el mismo dominio
  // (dominio/api), evita que el service worker devuelva datos viejos.
  if (url.pathname.startsWith('/api/')) return

  // version.json se consulta para detectar una versión nueva: SIEMPRE a la red,
  // nunca a la caché (si no, el aviso de actualización no llegaría). Se deja pasar
  // sin interceptar para que el navegador lo pida fresco (la app además manda
  // cache: 'no-store').
  if (url.pathname === '/version.json') return

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