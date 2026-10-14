import { descargarRecolecciones, actualizarRecoleccion } from '../services/recoleccionesApi.js'
import { esAsignadoA } from '../auth/roles.js'
import {
  recoleccionNueva,
  recoleccionEstadoActualizado,
  recoleccionAsignada,
  asignacionRecoleccionRecibida,
} from '../services/notificaciones.jsx'

// ---------------------------------------------------------------------------
// STORE DE RECOLECCIONES
// Mismo patrón que solicitudesStore, pero en memoria: el hosting compartido no
// tiene WebSockets, así que «en vivo» significa re-descargar cada POLL_MS y
// comparar con la lista anterior para avisar solo lo que cambió.
//
// Las filas conservan los nombres de columna del backend (snake_case); el
// adaptador a forma de solicitud vive en Administrador.jsx.
//
// Ecos locales: cuando el cambio lo hizo ESTA sesión, el actor ya vio su propio
// toast, así que se guarda la huella de lo que escribió y el siguiente ciclo de
// polling la reconoce para no avisar dos veces.
// ---------------------------------------------------------------------------

const POLL_MS = 8000

let lista = []
// null hasta la primera descarga: evita que todo el inventario de recolecciones
// se anuncie como «nueva» al iniciar sesión.
let listaPrevia = null
const suscriptores = new Set()
const ecosLocales = new Map()
const idsAvisados = new Set()

let identidad = { rol: '', nombre: '', correo: '' }
let temporizadorPoll = null
let resyncTimer = null
let bloqueado = false
// Se pone en true con la primera descarga correcta: mientras no, las pantallas
// muestran el loader en vez de «Aún no tienes recolecciones».
let cargadas = false

export function setIdentidadRecolecciones({ rol, nombre, correo } = {}) {
  const siguiente = {
    rol: String(rol || ''),
    nombre: String(nombre || '').trim(),
    correo: String(correo || '').trim().toLowerCase(),
  }
  const cambioUsuario =
    siguiente.correo !== identidad.correo || siguiente.rol !== identidad.rol
  identidad = siguiente
  // Al cambiar de usuario en la misma pestaña la caché ya no es válida: lo que
  // ve el nuevo usuario depende de su rol y de su correo.
  if (cambioUsuario && (lista.length > 0 || listaPrevia !== null)) {
    lista = []
    listaPrevia = null
    cargadas = false
    ecosLocales.clear()
    idsAvisados.clear()
    notificar()
  }
}

function huella(r) {
  return r ? [r.estado, r.asignado_a, r.asignado_correo, r.observaciones].join('|') : ''
}

function asignadaAMi(r) {
  return esAsignadoA(
    { asignadoA: r?.asignado_a, asignadoCorreo: r?.asignado_correo },
    identidad
  )
}

function esDueno(r) {
  const correo = String(r?.correo || '').trim().toLowerCase()
  return Boolean(identidad.correo) && correo === identidad.correo
}

// Lectura síncrona de la caché (para inicializar estados sin esperar la red).
export function loadRecolecciones() {
  return lista
}

// false hasta que la primera descarga terminó: sirve para no confundir «todavía
// no llegó nada» con «no hay recolecciones».
export function recoleccionesCargadas() {
  return cargadas
}

export function suscribirRecolecciones(callback) {
  suscriptores.add(callback)
  callback(lista)
  return () => suscriptores.delete(callback)
}

function avisarCambiosRemotos(siguiente) {
  if (listaPrevia === null) {
    listaPrevia = siguiente
    return
  }
  const esPrivilegiado = identidad.rol === 'administrador' || identidad.rol === 'superadmin'
  const esSolicitante = identidad.rol === 'solicitante'
  const previas = new Map(listaPrevia.map((r) => [r.codigo, r]))

  for (const r of siguiente) {
    const prev = previas.get(r.codigo)
    const eco = ecosLocales.get(r.codigo) === huella(r)

    if (!prev) {
      // Recolección que no estaba: solo le importa a quien gestiona, y no si la
      // creó él mismo (ya vio «Recolección creada»).
      if (!esPrivilegiado) continue
      if (idsAvisados.has(r.codigo)) continue
      if (esDueno(r)) continue
      idsAvisados.add(r.codigo)
      if (asignadaAMi(r)) asignacionRecoleccionRecibida(r.codigo, r.recoge_cliente)
      else recoleccionNueva(r)
      continue
    }

    const cambioEstado = (prev.estado || '') !== (r.estado || '')
    const cambioAsignado = (prev.asignado_a || '') !== (r.asignado_a || '')
    if (!cambioEstado && !cambioAsignado) continue

    // Le acaban de asignar esta recolección al admin/superadmin conectado.
    if (!eco && asignadaAMi(r) && !asignadaAMi(prev)) {
      const clave = `asignacion:${r.codigo}:${(r.asignado_correo || r.asignado_a || '').toLowerCase()}`
      if (!idsAvisados.has(clave)) {
        idsAvisados.add(clave)
        asignacionRecoleccionRecibida(r.codigo, r.recoge_cliente)
      }
    }

    // Admin/super con la recolección asignada: aviso cuando le cambian el estado.
    if (esPrivilegiado && asignadaAMi(r) && !eco && cambioEstado) {
      const clave = `estadoAsignado:${r.codigo}:${r.estado}`
      if (!idsAvisados.has(clave)) {
        idsAvisados.add(clave)
        recoleccionEstadoActualizado(r.codigo, r.estado)
      }
    }

    // Solicitante dueño: le avisan del estado nuevo o de quién la tomó.
    if (!esSolicitante || eco || !esDueno(r)) continue
    if (cambioEstado) {
      const clave = `estado:${r.codigo}:${r.estado}`
      if (!idsAvisados.has(clave)) {
        idsAvisados.add(clave)
        recoleccionEstadoActualizado(r.codigo, r.estado)
      }
    } else if (cambioAsignado) {
      const clave = `asignada:${r.codigo}:${r.asignado_a || ''}`
      if (!idsAvisados.has(clave)) {
        idsAvisados.add(clave)
        recoleccionAsignada(r.codigo, r.asignado_a)
      }
    }
  }

  if (idsAvisados.size > 300) idsAvisados.clear()
  listaPrevia = siguiente
}

function notificar() {
  avisarCambiosRemotos(lista)
  suscriptores.forEach((cb) => {
    try {
      cb(lista)
    } catch (error) {
      console.error('[Recolecciones] suscriptor falló:', error)
    }
  })
}

// Re-descarga y reparte. `codigoEco` marca la fila que esta sesión acaba de
// escribir para que el aviso no le llegue también al actor.
export async function sincronizarRecolecciones(codigoEco = null) {
  const filas = await descargarRecolecciones()
  lista = Array.isArray(filas) ? filas : []
  cargadas = true
  if (codigoEco) {
    const fresca = lista.find((r) => r.codigo === codigoEco)
    if (fresca) ecosLocales.set(codigoEco, huella(fresca))
  }
  notificar()
  return lista
}

export async function cambiarEstadoRecoleccion(codigo, estado, nota = '') {
  await actualizarRecoleccion(codigo, { estado, nota })
  return sincronizarRecolecciones(codigo)
}

export async function asignarRecoleccion(codigo, asignadoA, asignadoCorreo) {
  await actualizarRecoleccion(codigo, {
    asignado_a: asignadoA,
    asignado_correo: asignadoCorreo,
  })
  return sincronizarRecolecciones(codigo)
}

// Alta desde el formulario: la recolección nueva es un eco de esta sesión, así
// que el actor no recibe el aviso de «recolección nueva».
export async function registrarRecoleccionCreada(codigo) {
  return sincronizarRecolecciones(codigo)
}

function programarResync() {
  if (resyncTimer) clearTimeout(resyncTimer)
  resyncTimer = setTimeout(() => {
    resyncTimer = null
    if (!navigator.onLine) return
    void sincronizarRecolecciones().catch((error) =>
      console.warn('[Polling Recolecciones] no se pudo re-sincronizar:', error)
    )
  }, 600)
}

function alEnfocarVentana() {
  if (document.hidden) return
  programarResync()
}

export function iniciarTiempoRealRecolecciones() {
  if (temporizadorPoll) return
  temporizadorPoll = setInterval(() => {
    if (bloqueado || document.hidden || !navigator.onLine) return
    bloqueado = true
    void sincronizarRecolecciones()
      .catch((error) => console.warn('[Polling Recolecciones] fallo el ciclo:', error))
      .finally(() => {
        bloqueado = false
      })
  }, POLL_MS)
  window.addEventListener('focus', alEnfocarVentana)
  console.info(`[Polling Recolecciones] actualizaciones cada ${POLL_MS / 1000}s`)
}

export function detenerTiempoRealRecolecciones() {
  if (temporizadorPoll) {
    clearInterval(temporizadorPoll)
    temporizadorPoll = null
  }
  if (resyncTimer) {
    clearTimeout(resyncTimer)
    resyncTimer = null
  }
  window.removeEventListener('focus', alEnfocarVentana)
}
