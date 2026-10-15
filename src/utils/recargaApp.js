// Recuperación dura tras publicar una versión nueva.
//
// Un equipo que se quedó con el bundle viejo (o con un service worker / caché
// viejos) puede fallar al cargar los chunks nuevos con errores del tipo
// "Failed to fetch dynamically imported module". Un window.location.reload() a
// secas vuelve a servir lo mismo y deja la pantalla pegada en «Se publicó una
// versión nueva». Aquí se desregistran los service workers y se borran las cachés
// ANTES de recargar, para garantizar que la próxima carga venga sí o sí de la red.
export const CLAVE_RECARGA_AUTO = 'ctp_recarga_auto_1'

export async function recuperarVersion() {
  try {
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registros.map((registro) => registro.unregister()))
    }
  } catch {
    // sin service workers o sin permisos: se continúa igual
  }

  try {
    if (typeof caches !== 'undefined') {
      const claves = await caches.keys()
      await Promise.all(claves.map((clave) => caches.delete(clave)))
    }
  } catch {
    // sin CacheStorage: se continúa igual
  }

  window.location.reload()
}
