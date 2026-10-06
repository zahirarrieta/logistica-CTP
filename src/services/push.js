// ============================================================================
// Notificaciones push (lado del navegador)
//
// Qué hace y qué NO hace:
//
// La Notification API que ya usaba notificaciones.jsx solo funciona con una
// pestaña viva: si el usuario cierra la app, navega a otra web o bloquea el
// celular, ese aviso se pierde. Este servicio se encarga del otro mecanismo,
// Web Push, donde el servidor empuja el aviso al service worker y este lo
// muestra aunque no haya ninguna pestaña abierta.
//
// El flujo completo es:
//
//   1. El navegador pide permiso (Notification.requestPermission).
//   2. Con el permiso dado, se crea una suscripción con la clave pública VAPID
//      que publica el servidor (pushManager.subscribe).
//   3. Esa suscripción (un endpoint + dos claves públicas) se le manda al
//      servidor, que la guarda en push_suscripciones y usará para empujar.
//   4. A partir de ahí, cada evento que el servidor tiene que notificar llega
//      solo, esté la app abierta o no.
//
// En iPhone esto NO funciona si la web no está instalada en la pantalla de
// inicio. Apple no permite Web Push en un Safari normal; hay que usar Compartir
// > Añadir a pantalla de inicio y abrir la app desde el icono. En PC y en
// Android funciona sin instalar nada. Por eso estado() distingue 'requiere-instalar'.
//
// Por qué todo se guarda en localStorage y no en el servidor como "preferencias":
// la suscripción ES el estado. El navegador no expone una forma fiable de
// "dime todas mis suscripciones" desde la página, y el service worker no puede
// hablar con la API por sí solo. La referencia local es para el interruptor de la
// pantalla de Configuración; la fuente de verdad para enviar es la fila en
// push_suscripciones del servidor.
// ============================================================================

import { apiDelete, apiGet, apiPost } from './apiClient.js'

const CLAVE_SUSCRIPCION = 'ctp-push-suscripcion'

// ¿El navegador soporta push? Antes de preguntar nada. Safari de escritorio sí
// lo soporta desde 2023, pero muchos navegadores antiguos y algunos contexts
// seguros raros no.
function soportado() {
  return (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  )
}

// En iOS, push solo funciona en una PWA instalada. Se detecta por la standalone
// display (window.matchMedia('(display-mode: standalone)')) o por
// navigator.standalone, que es lo que Safari rellena en una PWA instalada.
// Es una diferencia clave: el usuario tiene que saber POR QUÉ no le funciona,
// no solo que "no funciona".
function enIphoneInstalado() {
  const esIos = /iP(hone|ad|od)/.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!esIos) return true // no es iPhone: no hace falta instalar
  const instalado = window.matchMedia?.('(display-mode: standalone)').matches
    || navigator.standalone === true
  return instalado
}

// El service worker tiene que estar registrado y activo para poder suscribirse:
// sin él no hay a quién empujar el aviso. Se espera a 'ready'/'activated' en vez
// de asumir que ya está, porque en una carga fresca recién se está instalando.
function esperarServiceWorker() {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) return resolve(null)
    navigator.serviceWorker.ready.then(resolve).catch(() => resolve(null))
  })
}

// Convierte la clave VAPID de base64url a algo que Uint8Array pueda leer. La
// librería de la app no está disponible en el service worker ni hay que
// importarla aquí: la conversión es un base64url -> bytes puro.
function vadidABase64UrlABytes(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  const bytes = new Uint8Array(crudo.length)
  for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

// Registra la suscripción con el servidor. Es idempotente: volver a chamar con la
// misma suscripción solo actualiza la fila, no crea duplicados.
async function registrarEnServidor(suscripcion) {
  const cuerpo = {
    subscription: suscripcion.toJSON ? suscripcion.toJSON() : suscripcion,
  }
  await apiPost('/api/notificaciones/suscripcion', cuerpo)
}

// Estado de las notificaciones en este dispositivo. La pantalla de Configuración
// lo pinta tal cual: 'sin-registrar' (aún no se ha activado), 'activas',
// 'rechazadas' (el usuario dijo que no), 'denegadas' (el navegador ya no deja
// pedir), 'requiere-instalar' (iPhone sin PWA instalada), 'soportado' pero sin
// claves VAPID en el servidor, o 'no-soportado'.
export async function estado() {
  if (!soportado()) {
    return { estado: 'no-soportado', detalle: 'Este navegador no admite notificaciones push.' }
  }

  // El permiso ya concedido tiene prioridad sobre el caso de iPhone: si la
  // persona lo concedió, es que la app ya está instalada y el flujo funcionó
  // alguna vez. Preguntar por la instalación primero mandaría a una PWA
  // instalada a una pantalla de instrucciones que ya no necesita.
  const permiso = Notification.permission
  const guardada = leerSuscripcionLocal()

  if (permiso !== 'granted' && !enIphoneInstalado()) {
    return {
      estado: 'requiere-instalar',
      detalle: 'En iPhone las notificaciones necesitan la app en la pantalla de inicio: '
        + 'comparte > Añadir a pantalla de inicio, y ábrela desde el icono.',
    }
  }

  if (permiso !== 'granted') {
    if (permiso === 'denied') {
      return {
        estado: 'denegadas',
        detalle: 'Has bloqueado las notificaciones para este sitio. '
          + 'Para volver a activarlas tienes que hacerlo en los ajustes del navegador.',
      }
    }
    return {
      estado: 'sin-registrar',
      detalle: guardada
        ? 'Había notificaciones activas pero el permiso se perdió (¿se borró el almacenamiento?). '
          + 'Vuelve a activarlas.'
        : 'Todavía no has activado las notificaciones en este equipo.',
    }
  }

  // Permiso concedido: ahora toca ver si el servidor tiene las claves VAPID.
  // Sin ellas no hay con qué empujar, y es mejor decirlo que fallar en silencio
  // al activar.
  let servidor = { activo: false }
  try {
    servidor = await apiGet('/api/notificaciones/push')
  } catch {
    return {
      estado: 'sin-servidor',
      detalle: 'No se pudo contactar al servidor para comprobar las claves push.',
    }
  }
  if (!servidor.activo) {
    return {
      estado: 'sin-claves',
      detalle: servidor.detalle
        || 'El servidor todavía no tiene claves VAPID. Mientras tanto solo llegarán avisos con la app abierta.',
    }
  }

  // Verificar suscripción REAL en el navegador (no solo localStorage).
  // Si el navegador revocó la suscripción (404/410) pero localStorage la tiene,
  // limpiamos localStorage y devolvemos 'sin-registrar' para que el usuario
  // pueda reactivar con un click.
  const worker = await esperarServiceWorker()
  if (!worker) {
    return {
      estado: 'sin-sw',
      detalle: 'El service worker no está listo. Recarga la página e inténtalo de nuevo.',
    }
  }
  const suscripcionReal = await worker.pushManager.getSubscription()
  if (!suscripcionReal) {
    // El navegador ya no tiene la suscripción (la revocó o expiró).
    // Limpiamos localStorage para que el estado sea coherente.
    borrarSuscripcionLocal()
    return {
      estado: 'sin-registrar',
      detalle: 'La suscripción ya no existe en el navegador. Vuelve a activar las notificaciones.',
    }
  }

  // Permiso y claves listos. Si hay una suscripción guardada, está activa; si no,
  // este equipo aún no se ha suscrito (puede pasar si se borró el
  // localStorage sin perder el permiso del navegador).
  return {
    estado: guardada ? 'activas' : 'sin-registrar',
    pendiente: !guardada,
    detalle: guardada
      ? 'Recibirás avisos aunque no tengas la app abierta.'
      : 'El permiso está concedido pero este equipo aún no está suscrito. Vuelve a activarlo.',
  }
}

// Activa las notificaciones. Devuelve el estado resultante.
//
// Puede fallar en varios puntos y cada uno se reporta con su motivo: sin
// soporte, sin permiso concedido, sin service worker, sin claves VAPID en el
// servidor. En un fallo NO se lanza excepción para no romper la pantalla de
// Configuración; el estado devuelto ya explica qué pasó.
export async function activar() {
  if (!soportado()) {
    return { ok: false, estado: 'no-soportado', detalle: 'Este navegador no admite notificaciones push.' }
  }
  if (!enIphoneInstalado()) {
    return {
      ok: false,
      estado: 'requiere-instalar',
      detalle: 'Primero instala la app en la pantalla de inicio (Compartir > Añadir a pantalla de inicio).',
    }
  }

  // El permiso tiene que pedirse desde un gesto del usuario. Esta función la
  // llama el onClick del interruptor, así que el gesto está.
  let permiso = Notification.permission
  if (permiso === 'default') {
    try {
      permiso = await Notification.requestPermission()
    } catch {
      return { ok: false, estado: 'sin-permiso', detalle: 'El navegador no concedió el permiso de notificaciones.' }
    }
  }
  if (permiso !== 'granted') {
    return {
      ok: false,
      estado: permiso === 'denied' ? 'denegadas' : 'sin-permiso',
      detalle: permiso === 'denied'
        ? 'Has bloqueado las notificaciones para este sitio; hay que reactivarlas en el navegador.'
        : 'No se concedió el permiso de notificaciones.',
    }
  }

  const worker = await esperarServiceWorker()
  if (!worker) {
    return {
      ok: false,
      estado: 'sin-sw',
      detalle: 'El service worker no está listo. Recarga la página e inténtalo de nuevo.',
    }
  }

  let servidor
  try {
    servidor = await apiGet('/api/notificaciones/push')
  } catch {
    return { ok: false, estado: 'sin-servidor', detalle: 'No se pudo contactar al servidor.' }
  }
  if (!servidor.activo || !servidor.clavePublica) {
    return {
      ok: false,
      estado: 'sin-claves',
      detalle: servidor.detalle || 'El servidor no tiene claves VAPID configuradas todavía.',
    }
  }

  // Si ya hay una suscripción en el navegador, verificar que siga viva en el servidor.
  // Si el servidor ya no la tiene (404/410), la borramos localmente y creamos una nueva.
  const existente = await worker.pushManager.getSubscription()
  let suscripcion
  if (existente) {
    try {
      // Verificar si el servidor aún tiene esta suscripción
      await apiGet(`/api/notificaciones/push?equipo=${encodeURIComponent(existente.endpoint)}`)
      // El servidor la tiene: la reutilizamos
      suscripcion = existente
    } catch {
      // El servidor ya no la tiene (404/410 u otro error): la borramos y creamos nueva
      await existente.unsubscribe()
      borrarSuscripcionLocal()
      const nueva = await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vadidABase64UrlABytes(servidor.clavePublica),
      })
      suscripcion = nueva
    }
  } else {
    suscripcion = await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vadidABase64UrlABytes(servidor.clavePublica),
    })
  }

  await registrarEnServidor(suscripcion)
  guardarSuscripcionLocal(suscripcion)
  return {
    ok: true,
    estado: 'activas',
    detalle: 'Listo. Recibirás avisos aunque no tengas la app abierta.',
  }
}

// Desactiva en ESTE equipo. Deja la suscripción en el servidor borrada solo de
// este navegador; los otros equipos donde la cuenta tenga notificaciones activas
// siguen funcionando, que es lo que espera alguien con el móvil y el portátil.
//
// Solo la llama el usuario desde el interruptor: cerrar sesión ya NO desactiva
// los avisos (ver reasociarSuscripcion), así que aquí siempre hay token y
// apiDelete puede hablar con la API con normalidad.
export async function desactivarEnEsteEquipo() {
  if (!soportado()) return { ok: false }

  const worker = await esperarServiceWorker()
  if (!worker) return { ok: false }

  try {
    const suscripcion = await worker.pushManager.getSubscription()
    if (suscripcion) {
      // Se quita primero del servidor, usando el endpoint exacto de ESTA
      // suscripción: así no se toca la de otros equipos del mismo usuario.
      await apiDelete(`/api/notificaciones/suscripcion?equipo=${encodeURIComponent(suscripcion.endpoint)}`)
      await suscripcion.unsubscribe()
    }
  } catch {
    // Si la API falla, aun así se desuscribe en local: si no, el navegador
    // seguiría recibiendo push que el servidor ya no puede enviar, y el usuario
    // vería un interruptor apagado con avisos que llegan igual. La fila que queda
    // en el servidor se limpia sola cuando el navegador deja de reconocerla.
    try {
      const suscripcion = await worker.pushManager.getSubscription()
      if (suscripcion) await suscripcion.unsubscribe()
    } catch { /* nada que hacer */ }
  }

  borrarSuscripcionLocal()
  return { ok: true, detalle: 'Desactivadas en este equipo.' }
}

// Re-asocia la suscripción push YA EXISTENTE de este equipo al usuario que acaba
// de iniciar sesión. El servidor usa el endpoint como clave única, así que volver
// a registrarlo reasigna la fila al correo del token actual: quien entra en el
// equipo es quien recibe los avisos, y el usuario anterior deja de recibirlos ahí.
//
// No pide permiso ni crea una suscripción nueva: si el equipo no tenía los avisos
// activados, no hace nada. Es lo que permite que CERRAR SESIÓN no apague el
// interruptor —solo el usuario puede apagarlo (desactivarEnEsteEquipo)— y a la vez
// evita que en un equipo compartido el siguiente usuario reciba los avisos del
// anterior: al entrar, la suscripción se reasigna a su propia cuenta.
export async function reasociarSuscripcion() {
  if (!soportado()) return
  // Sin marca local este equipo nunca activó los avisos: no hay nada que reasociar
  // y no se debe pedir permiso por sorpresa.
  if (!leerSuscripcionLocal()) return
  const worker = await esperarServiceWorker()
  if (!worker) return
  try {
    const suscripcion = await worker.pushManager.getSubscription()
    if (!suscripcion) {
      // El navegador ya no la tiene (revocada o expirada): se limpia la marca para
      // que el estado del interruptor sea coherente.
      borrarSuscripcionLocal()
      return
    }
    await registrarEnServidor(suscripcion)
    guardarSuscripcionLocal(suscripcion)
  } catch {
    // Sin token válido o sin servidor: se reintentará en la próxima carga. No se
    // borra nada; la suscripción sigue viva en el navegador.
  }
}

// Envía un push de prueba a los equipos del usuario actual (endpoint de la API,
// que no acepta destinatario: ver la nota de seguridad en routes.js).
export async function enviarPrueba() {
  const resultado = await apiPost('/api/notificaciones/prueba', {})
  return resultado
}

// --------------------------------------------------------------- estado local

// La suscripción vive en localStorage como { endpoint }. No se guarda el
// PushSubscription entero porque no es serializable, y guardar el endpoint basta
// para saber "este equipo está suscrito" sin volver a preguntar al pushManager.
function leerSuscripcionLocal() {
  try {
    const crudo = localStorage.getItem(CLAVE_SUSCRIPCION)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function guardarSuscripcionLocal(suscripcion) {
  try {
    localStorage.setItem(CLAVE_SUSCRIPCION, JSON.stringify({ endpoint: suscripcion.endpoint }))
  } catch {
    // Sin espacio en localStorage el aviso push sigue funcionando: solo se
    // pierde el estado del interruptor, que se recalcula en la próxima carga.
  }
}

function borrarSuscripcionLocal() {
  try {
    localStorage.removeItem(CLAVE_SUSCRIPCION)
  } catch { /* nada */ }
}
