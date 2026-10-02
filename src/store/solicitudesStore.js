import { getActiveAccount } from '../auth/sesion.js'
import { shortName } from '../auth/user.js'
import { backendActivo, iniciarSesion, datosUsuario, apiGet, apiPost } from '../services/apiClient.js'
import { descargarSolicitudes, empujarSolicitud, borrarSolicitud, borrarTodasSolicitudes } from '../services/solicitudesApi.js'
import { soloAdjuntosSolicitud } from '../utils/pdfUtils.js'
import { solicitudNueva, estadoActualizado, solicitudAsignada, conductorAsignado, solicitudDevuelta, entregaAsignada, asignacionRecibida, entregaRealizada, almacenamientoLleno, solicitudNoGuardada } from '../services/notificaciones.jsx'
import { esConductorDe, esAsignadoA } from '../auth/roles.js'

const STORAGE_KEY = 'ctp_solicitudes'
const COUNTER_KEY = 'ctp_solicitudes_counter'
const WATERMARK_KEY = 'ctp_sync_watermark'

// Caché en memoria de los momentos de devolución (id → ms).
const devolucionesCache = {}

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export const ESTADOS_ENTREGA = ['Entregado', 'Entregado Parcial']

// Campos que el administrador puede marcar como «por corregir» al devolver una
// solicitud al solicitante.
export const CAMPOS_DEVOLUCION = [
  { id: 'tipoSolicitud', etiqueta: 'TIPO DE SOLICITUD' },
  { id: 'cliente', etiqueta: 'CLIENTE' },
  { id: 'adjuntos', etiqueta: 'ADJUNTOS' },
  { id: 'observaciones', etiqueta: 'OBSERVACIONES' },
]

const ETIQUETA_A_ID = Object.fromEntries(CAMPOS_DEVOLUCION.map((c) => [c.etiqueta, c.id]))
const MOTIVO_PREFIJO = /^\[CORREGIR:\s*([^\]]*)\]\s*/

// Codifica los campos marcados dentro de la nota del historial, que es lo único
// que se sincroniza con la base, con el formato «[CORREGIR: A, B] texto».
export function componerMotivoDevolucion(campos, texto) {
  const etiquetas = (Array.isArray(campos) ? campos : [])
    .map((id) => CAMPOS_DEVOLUCION.find((c) => c.id === id)?.etiqueta)
    .filter(Boolean)
  const limpio = (texto || '').trim()
  if (etiquetas.length === 0) return limpio
  return `[CORREGIR: ${etiquetas.join(', ')}] ${limpio}`.trim()
}

// Inverso de componerMotivoDevolucion: devuelve { campos: [ids], texto }.
export function parsearMotivoDevolucion(nota) {
  const crudo = typeof nota === 'string' ? nota : ''
  const m = MOTIVO_PREFIJO.exec(crudo)
  if (!m) return { campos: [], texto: crudo }
  const campos = m[1]
    .split(',')
    .map((s) => ETIQUETA_A_ID[s.trim().toUpperCase()])
    .filter(Boolean)
  return { campos, texto: crudo.slice(m[0].length) }
}

// Caché en memoria: evita re-parsear y re-normalizar todo el localStorage en
// cada llamada. Se invalida comparando el crudo guardado (detecta cambios de
// otras pestañas o escrituras externas).
let cache = null
let cacheRaw = null
// Evita spam de avisos si el almacenamiento falla repetidamente (ej. cuota llena).
let avisoCuotaDado = false

// Suscriptores en vivo: las pantallas (Solicitudes, Administrador, Conductor)
// se registran para recibir la lista actualizada cada vez que cambian los datos,
  // ya sea por una acción local o por un cambio remoto (polling de la API).
const suscriptores = new Set()

export function suscribir(callback) {
  if (typeof callback !== 'function') return () => {}
  suscriptores.add(callback)
  return () => suscriptores.delete(callback)
}

// ---------------------------------------------------------------------------
// AVISOS DE CAMBIOS EN SOLICITUDES
// · Admin/super: aviso "Solicitud nueva" cuando llega por la API una solicitud
//   que NO es del usuario actual.
// · Solicitante: aviso cuando el admin/super cambia SU solicitud (estado,
//   asignación, conductor). Los ecos de acciones hechas en ESTA sesión se
//   omiten para no duplicar los toasts (el actor ya ve su confirmación).
// El rol lo pasa AuthContext (setRolActual) para no depender de RLS.
// ---------------------------------------------------------------------------
let rolActualStore = ''
let listaPrevia = null
const idsAvisados = new Set()
// id → huella de lo último que escribió ESTA sesión (para distinguir ecos).
const mapaEchoLocal = new Map()

export function setRolActual(rol) {
  rolActualStore = rol || ''
}

// Identidad del usuario conectado (nombre + correo de la tabla usuarios). La pasa
// AuthContext; se usa para saber si una solicitud está asignada al conductor actual.
let usuarioActualStore = { nombre: '', correo: '' }
export function setUsuarioActual(usuario) {
  usuarioActualStore = {
    nombre: String(usuario?.nombre || '').trim(),
    correo: String(usuario?.correo || '').trim().toLowerCase(),
  }
}

function fingerprint(s) {
  return s
    ? [s.estado, s.asignadoA, s.asignadoCorreo, s.conductor, s.vehiculo, s.placa, s.numeroReferencia, s.observaciones].join('|')
    : ''
}

function marcarEchoLocal(listaScoped) {
  for (const s of listaScoped) {
    if (s?.id) mapaEchoLocal.set(s.id, fingerprint(s))
  }
}

function avisarCambiosRemotos(lista) {
  const esPrivilegiado = rolActualStore === 'administrador' || rolActualStore === 'superadmin'
  const esSolicitante = rolActualStore === 'solicitante'
  if (listaPrevia === null) {
    listaPrevia = lista
    return
  }
  const correoPropio = (datosUsuario().correo || '').toLowerCase()
  const prevById = new Map(listaPrevia.map((s) => [s.id, s]))
  for (const s of lista) {
    if (s.pendienteSync) continue
    const prev = prevById.get(s.id)

    // Conductor: una entrega asignada a él que entra en tránsito (o que aparece
    // ya en tránsito asignada a él) dispara un aviso con el código. No se avisa
    // si es un eco de esta sesión ni si ya estaba asignada y en tránsito.
    if (esConductorDe(s, usuarioActualStore)) {
      const enTransitoAhora = ESTADOS_TRANSITO.includes(s.estado || '')
      const estabaEnTransito = prev ? ESTADOS_TRANSITO.includes(prev.estado || '') : false
      const asignadaAntes = prev ? esConductorDe(prev, usuarioActualStore) : false
      const esEcho = fingerprint(s) === mapaEchoLocal.get(s.id)
      const claveAviso = `entrega:${s.id}:${(s.conductorCorreo || s.conductor || '').toLowerCase()}`
      if (
        enTransitoAhora &&
        !esEcho &&
        !idsAvisados.has(claveAviso) &&
        (!prev || !estabaEnTransito || !asignadaAntes)
      ) {
        idsAvisados.add(claveAviso)
        entregaAsignada(s.id, s.cliente)
      }
    }

    const correo = (safeText(s.correo) || '').toLowerCase()
    if (!prev) {
      // Llegó una solicitud que no estaba en la lista anterior.
      if (!esPrivilegiado) continue
      if (idsAvisados.has(s.id)) continue
      if (correo && correo === correoPropio) continue
      idsAvisados.add(s.id)
      // Si llega ya asignada al usuario actual, el aviso relevante es ése.
      if (esAsignadoA(s, usuarioActualStore)) asignacionRecibida(s.id, s.cliente)
      else solicitudNueva(s)
      continue
    }
    // Cambio sobre una solicitud existente.
    const huella = fingerprint(s)
    const esEcho = huella === mapaEchoLocal.get(s.id)

    // Le acaban de asignar esta solicitud al usuario actual (admin/super): aviso
    // en vivo. Se omite si es un eco de esta sesión o si ya estaba asignada a él.
    if (!esEcho && esAsignadoA(s, usuarioActualStore) && !esAsignadoA(prev, usuarioActualStore)) {
      const claveAviso = `asignacion:${s.id}:${(s.asignadoCorreo || s.asignadoA || '').toLowerCase()}`
      if (!idsAvisados.has(claveAviso)) {
        idsAvisados.add(claveAviso)
        asignacionRecibida(s.id, s.cliente)
      }
    }

    // Pedido entregado por el conductor: avisar a admin/superadmin (ven todo) y
    // al solicitante dueño. Sustituye al aviso genérico de cambio de estado.
    // También cubre Parcial → Entregado (cambio dentro de los estados de entrega).
    const ahoraEntregado = ESTADOS_ENTREGA.includes(s.estado || '')
    const cambioEstado = (prev.estado || '') !== (s.estado || '')
    if (!esEcho && ahoraEntregado && cambioEstado) {
      const duenoSolicitante = esSolicitante && correo && correo === correoPropio
      if (esPrivilegiado || duenoSolicitante) {
        const claveAviso = `entregado:${s.id}:${s.estado}`
        if (!idsAvisados.has(claveAviso)) {
          idsAvisados.add(claveAviso)
          entregaRealizada(s.id, { cliente: s.cliente, estado: s.estado, conductor: s.conductor })
        }
      }
    }

    // Aviso al admin/super cuando cambia el estado de una solicitud asignada a
    // él (p. ej. el superadmin la pasó a En Trámite, Retenido, en tránsito…).
    // Las entregas ya se cubren con entregaRealizada y los ecos de esta sesión
    // se omiten para no duplicar el toast del actor.
    if (esPrivilegiado && esAsignadoA(s, usuarioActualStore) && !esEcho && cambioEstado && !ESTADOS_ENTREGA.includes(s.estado || '')) {
      const claveAviso = `estadoAsignado:${s.id}:${s.estado}`
      if (!idsAvisados.has(claveAviso)) {
        idsAvisados.add(claveAviso)
        estadoActualizado(s.id, s.estado)
      }
    }

    if (!esSolicitante) continue
    if (correo && correo !== correoPropio) continue
    if (huella === fingerprint(prev) || esEcho) continue
    if (s.estado === 'Devolución a Solicitante') {
      solicitudDevuelta(s.id, (Array.isArray(s.historial) && s.historial[0]?.nota) || '')
    } else if ((prev.estado || '') !== (s.estado || '') && !ESTADOS_ENTREGA.includes(s.estado || '')) {
      estadoActualizado(s.id, s.estado)
    } else if ((prev.asignadoA || '') !== (s.asignadoA || '')) {
      solicitudAsignada(s.id, s.asignadoA)
    } else if ((prev.conductor || '') !== (s.conductor || '')) {
      conductorAsignado(s.id, s.conductor)
    }
  }
  if (idsAvisados.size > 300) idsAvisados.clear()
  listaPrevia = lista
}

// Emite la lista vigente a todos los suscriptores y avisa de los cambios.
export function notificar() {
  const lista = loadSolicitudes()
  avisarCambiosRemotos(lista)
  if (suscriptores.size === 0) return
  suscriptores.forEach((cb) => {
    try {
      cb(lista)
    } catch (error) {
      console.warn('[Store] suscriptor falló:', error)
    }
  })
}

function escribir(list) {
  let raw = null
  let persistido = true
  try {
    raw = JSON.stringify(list)
    localStorage.setItem(STORAGE_KEY, raw)
    avisoCuotaDado = false
  } catch (error) {
    // Falla de cuota/almacenamiento: avisar una sola vez para que el usuario sepa
    // que los cambios locales NO se guardaron en este dispositivo.
    persistido = false
    if (!avisoCuotaDado) {
      avisoCuotaDado = true
      console.error('[Store] no se pudo guardar en localStorage:', error?.message || error)
      almacenamientoLleno()
    }
  }
  cache = list
  // Si no se pudo persistir (cuota llena), cacheRaw debe seguir apuntando a lo que
  // HAY en localStorage, no al JSON que no se guardó. Así loadSolicitudes devuelve
  // la caché en memoria (correcta) en vez de releer el snapshot viejo: la sesión no
  // pierde lo sincronizado y no vuelve a detectar el hueco en cada tick de 8 s.
  cacheRaw = persistido ? raw : localStorage.getItem(STORAGE_KEY) || ''
  return list
}

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function pendiente(id) {
  return escribir(loadSolicitudes().map((s) => (s.id === id ? { ...s, pendienteSync: true } : s)))
}

// El servidor confirmó que la fila existe. Desde este momento, y solo desde este
// momento, la sincronización puede descartar la copia local si la fila desaparece
// del servidor (borrada en remoto). Una solicitud que el servidor todavía no ha
// confirmado nunca se borra sola.
function confirmarEnServidor(id) {
  return escribir(
    loadSolicitudes().map((s) =>
      s.id === id ? { ...s, pendienteSync: false, rechazada: false, enServidor: true } : s
    )
  )
}

// El servidor la rechazó con 403: no está en la base y reintentar no lo va a
// resolver. Antes se devolvía sin marcar nada, así que la solicitud quedaba
// local como «sincronizada» y el siguiente poll la eliminaba de la lista sin
// avisar a nadie. Se conserva en el dispositivo, marcada para que la cola no la
// reintente en bucle, y se le avisa al usuario.
function marcarRechazada(id) {
  return escribir(
    loadSolicitudes().map((s) =>
      s.id === id ? { ...s, pendienteSync: true, rechazada: true } : s
    )
  )
}

function empujar(solicitud, opciones = {}) {
  if (!backendActivo || !solicitud?.id) return
  if (!navigator.onLine) {
    console.info(`[API] sin conexión: ${solicitud.id} queda en la cola, se sube al volver la red`)
    pendiente(solicitud.id)
    return
  }
  const actual = loadSolicitudes().find((s) => s.id === solicitud.id) || solicitud
  void empujarSolicitud(actual, opciones)
    .then(() => {
      confirmarEnServidor(actual.id)
    })
    .catch((error) => {
      if (esBloqueoPermanente(error)) {
        console.warn(
          `[API] no se pudo subir ${actual.id} (${error?.estado}):`,
          error?.message
        )
        marcarRechazada(actual.id)
        solicitudNoGuardada(actual.id, error?.message)
        return
      }
      console.warn('[API] no se pudo subir:', error)
      pendiente(actual.id)
    })
}

export function buscarEntrega(solicitud) {
  const historial = Array.isArray(solicitud?.historial) ? solicitud.historial : []
  return (
    [...historial]
      .reverse()
      .find((h) => h.campo === 'estado' && ESTADOS_ENTREGA.includes(h.nuevo)) || null
  )
}

// Devuelve la última entrada de historial que marcó la devolución al solicitante,
// para poder mostrar el motivo indicado por el administrador.
export function buscarDevolucion(solicitud) {
  const historial = Array.isArray(solicitud?.historial) ? solicitud.historial : []
  return (
    [...historial]
      .reverse()
      .find((h) => h.campo === 'estado' && h.nuevo === 'Devolución a Solicitante') || null
  )
}

// ---------------------------------------------------------------------------
// VENTANA DE CORRECCIÓN
// Cuando el administrador devuelve una solicitud, el solicitante tiene 5
// minutos para corregirla y reenviarla. Pasado el tiempo ya no se puede editar:
// debe crear una nueva.
// La hora exacta de la devolución se lee de la entrada de historial que dejó el
// admin (fecha/hora en es-CO, escritas por la app), con una caché local como
// respaldo; así la cuenta regresiva no depende de que la pestaña haya estado
// abierta en el momento exacto de la devolución.
// ---------------------------------------------------------------------------
const TIEMPO_DEVOLUCION_MIN = 5
export const TIEMPO_DEVOLUCION_MS = TIEMPO_DEVOLUCION_MIN * 60 * 1000
const DEVOLUCION_TIMES_KEY = 'ctp_devolucion_times'

function leerDevoluciones() {
  try {
    const crudo = JSON.parse(localStorage.getItem(DEVOLUCION_TIMES_KEY) || '{}') || {}
    return crudo && typeof crudo === 'object' ? crudo : {}
  } catch {
    return {}
  }
}

function guardarDevoluciones(mapa) {
  try {
    localStorage.setItem(DEVOLUCION_TIMES_KEY, JSON.stringify(mapa))
  } catch {
    // ignorar
  }
}

// Convierte la fecha/hora (es-CO «24/09/2026 14:30:05») de una entrada de
// historial en milisegundos. Null si no se puede interpretar.
function tsHistorial(h) {
  const fm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(h?.fecha || ''))
  if (!fm) return null
  const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(h?.hora || '').trim())
  if (!hm) return null
  const ts = new Date(
    Number(fm[3]),
    Number(fm[2]) - 1,
    Number(fm[1]),
    Number(hm[1]),
    Number(hm[2]),
    Number(hm[3] || 0)
  ).getTime()
  return Number.isFinite(ts) ? ts : null
}

// Momento (ms) en que se devolvió la solicitud, o null si no está en devolución.
// Prioriza la caché en memoria, luego el timestamp del historial y por último
// registra el momento en que se observó por primera vez.
export function devolucionInicio(solicitud) {
  if (!solicitud || solicitud.estado !== 'Devolución a Solicitante') return null
  if (devolucionesCache[solicitud.id] != null) return devolucionesCache[solicitud.id]
  const persistidas = leerDevoluciones()
  const guardado = persistidas[solicitud.id]
  if (typeof guardado === 'number' && Number.isFinite(guardado)) {
    devolucionesCache[solicitud.id] = guardado
    return guardado
  }
  const delHistorial = tsHistorial(buscarDevolucion(solicitud))
  const inicio = delHistorial != null ? delHistorial : Date.now()
  devolucionesCache[solicitud.id] = inicio
  persistidas[solicitud.id] = inicio
  guardarDevoluciones(persistidas)
  return inicio
}

// Milisegundos que faltan de la ventana de corrección (0 si ya venció).
// Null si la solicitud no está en devolución.
export function restanteDevolucion(solicitud, ahora = Date.now()) {
  const inicio = devolucionInicio(solicitud)
  if (inicio == null) return null
  return Math.max(0, TIEMPO_DEVOLUCION_MS - (ahora - inicio))
}

function currentPersona() {
  return shortName(getActiveAccount())
}

function numeroDe(id) {
  const n = parseInt(String(id).replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// Próxima secuencia: siempre por encima del contador local y de los IDs que ya
// existen en la lista. Así, aunque otro navegador/dispositivo haya dejado un
// contador viejo, tras reiniciar (lista vacía) el siguiente pedido vuelve a
// CTPLOG-00001 y nunca se reutiliza o salta un número por un contador obsoleto.
function siguienteNumero() {
  const lista = loadSolicitudes()
  const maximoLista = lista.reduce((acc, s) => Math.max(acc, numeroDe(s.id)), 0)
  const contadorLocal = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0
  return Math.max(contadorLocal, maximoLista) + 1
}

// ---------------------------------------------------------------------------
// CÓDIGO GLOBAL
// El próximo ID puede "verse" sin avanzar la secuencia (RPC `siguiente_codigo`)
// o "reservarse" de forma atómica (RPC `proximo_codigo`, que consume nextval y
// solo se llama al CREAR). Así todos los usuarios ven el mismo número y el
// contador solo incrementa cuando de verdad se hace una solicitud.
// Sin backend o sin conexión se usa la derivación local (siguienteNumero).
// ---------------------------------------------------------------------------
let proximoVisible = null
let avisoReservaDado = false

function codigoValido(v) {
  return typeof v === 'string' && /^CTPLOG-\d{5}$/.test(v)
}

// Ver el próximo código en el servidor SIN consumirlo. Se usa para el aviso
// preventivo y el botón de actualizar. Antes era la RPC `siguiente_codigo`
// (leía la secuencia); ahora es un GET que solo lee el contador.
export async function refrescarProximoCodigo() {
  if (!backendActivo || !navigator.onLine) return null
  try {
    await iniciarSesion()
    const { codigo } = await apiGet('/api/codigos/siguiente')
    if (!codigoValido(codigo)) return null
    proximoVisible = codigo
    return codigo
  } catch {
    return null
  }
}

// Reserva el siguiente código de forma atómica (avanza el contador). SOLO se
// llama al crear una solicitud: garantiza que el ID asignado sea único y que
// después de crear el siguiente número sea el consecutivo. El backend lo hace
// con una transacción y un bloqueo de fila sobre el contador. Devuelve null si
// no hay backend o falla → la app usa la derivación local.
export async function reservarProximoCodigo() {
  if (!backendActivo || !navigator.onLine) return null
  try {
    await iniciarSesion()
    const { codigo } = await apiPost('/api/codigos/reservar')
    if (!codigoValido(codigo)) return null
    proximoVisible = null
    return codigo
  } catch (error) {
    if (!avisoReservaDado) {
      avisoReservaDado = true
      console.warn('[API] no se pudo reservar el código:', error?.message)
    }
    return null
  }
}

// Devuelve al contador un código reservado que acabó sin usarse (la creación
// falló al subir los adjuntos o antes de guardar). El servidor solo lo descuenta
// si ese número sigue siendo el último reservado y no existe ninguna fila con
// él, así que nunca recicla un código ya publicado.
export async function liberarProximoCodigo(codigo) {
  if (!backendActivo || !navigator.onLine || !codigoValido(codigo)) return false
  try {
    await iniciarSesion()
    const data = await apiPost('/api/codigos/liberar', { codigo })
    if (!data?.liberado) return false
    proximoVisible = null
    console.info(`[API] código liberado: ${codigo}`)
    return true
  } catch (error) {
    console.warn('[API] no se pudo liberar el código reservado:', error?.message)
    return false
  }
}

function nextId() {
  const counter = siguienteNumero()
  try {
    localStorage.setItem(COUNTER_KEY, String(counter))
  } catch {
    // ignorar
  }
  return `CTPLOG-${String(counter).padStart(5, '0')}`
}

export function safeText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const candidato = [
      value.asignadoA,
      value.nombre,
      value.name,
      value.nombreCompleto,
      value.label,
      value.usuario,
      value.correo,
    ].find((v) => typeof v === 'string' && v.trim())
    return candidato ? candidato.trim() : ''
  }
  return ''
}

export function nombreDeAsignado(value) {
  return safeText(value)
}

const TEXT_FIELDS = [
  'id',
  'fechaSubida',
  'horaSubida',
  'fecha',
  'hora',
  'nombreCompleto',
  'correo',
  'tipoSolicitud',
  'cliente',
  'bodega',
  'nit',
  'zona',
  'observaciones',
  'notaEstado',
  'numeroReferencia',
  'estado',
  'asignadoA',
  'asignadoCorreo',
  'conductor',
  'conductorCorreo',
  'vehiculo',
  'placa',
  'evidencia',
]

export function loadSolicitudes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || ''
    if (cache && raw === cacheRaw) return cache
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) {
      cache = []
      cacheRaw = raw
      return cache
    }
    let faltanIds = false
    const normalizada = list.map((s) => {
      if (!s || typeof s !== 'object') return {}
      const normal = { ...s }
      for (const key of TEXT_FIELDS) {
        if (typeof normal[key] !== 'string') normal[key] = safeText(normal[key])
      }
      normal.adjuntos = soloAdjuntosSolicitud(normal.adjuntos)
      if (Array.isArray(normal.historial)) {
        normal.historial = normal.historial.map((h) => {
          if (!h || typeof h !== 'object') return {}
          const hn = { ...h }
          if (typeof hn.id !== 'string' || !hn.id) {
            hn.id = generarId()
            faltanIds = true
          }
          if (typeof hn.anterior !== 'string') hn.anterior = safeText(hn.anterior)
          if (typeof hn.nuevo !== 'string') hn.nuevo = safeText(hn.nuevo)
          if (typeof hn.persona !== 'string') hn.persona = safeText(hn.persona)
          if (typeof hn.fecha !== 'string') hn.fecha = safeText(hn.fecha)
          if (typeof hn.hora !== 'string') hn.hora = safeText(hn.hora)
          if (typeof hn.nota !== 'string') hn.nota = safeText(hn.nota)
          if (typeof hn.referencia !== 'string') hn.referencia = safeText(hn.referencia)
          if (typeof hn.adjunto !== 'string') hn.adjunto = safeText(hn.adjunto)
          if (typeof hn.vehiculo !== 'string') hn.vehiculo = safeText(hn.vehiculo)
          if (typeof hn.placa !== 'string') hn.placa = safeText(hn.placa)
          if (typeof hn.conductor !== 'string') hn.conductor = safeText(hn.conductor)
          if (typeof hn.evidencia !== 'string') hn.evidencia = safeText(hn.evidencia)
          if (hn.encuesta && typeof hn.encuesta !== 'object') hn.encuesta = null
          return hn
        })
      }
      return normal
    })
    // Los id de historial se persisten para que la subida a la API no duplique filas.
    if (faltanIds) return escribir(normalizada)
    cache = normalizada
    cacheRaw = raw
    return cache
  } catch {
    return []
  }
}

function nowStamp() {
  const now = new Date()
  return {
    fecha: now.toLocaleDateString('es-CO'),
    hora: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

export function peekNextId() {
  if (proximoVisible) return proximoVisible
  return `CTPLOG-${String(siguienteNumero()).padStart(5, '0')}`
}

export async function saveSolicitud(data, idFijo = null) {
  // Con backend se reserva el código al momento de creAR (avanza la secuencia
  // una sola vez), para que el ID sea único y el siguiente sea el consecutivo.
  // idFijo llega cuando el modal ya reservó (para que la carpeta de archivos
  // coincida con el código final). Sin id y sin backend → derivación local.
  let id = null
  if (idFijo) {
    id = idFijo
  } else if (backendActivo && navigator.onLine) {
    id = await reservarProximoCodigo()
  }
  const list = loadSolicitudes()
  const now = new Date()
  const entry = {
    id: id || nextId(),
    fechaSubida: now.toLocaleDateString('es-CO'),
    horaSubida: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    estado: 'Abierto',
    asignadoA: '',
    asignadoCorreo: '',
    historial: [],
    ...data,
  }
  const next = escribir([entry, ...list])
  marcarEchoLocal([entry])
  // Alta, no edición: el servidor lo usa para rechazar con 409 en vez de
  // convertirla en edición si el código ya estuviera ocupado.
  empujar(entry, { crear: true })
  notificar()
  return next
}

export function updateEstado(id, estado) {
  const next = escribir(loadSolicitudes().map((s) => (s.id === id ? { ...s, estado } : s)))
  empujar({ id })
  notificar()
  return next
}

export function updateSolicitud(id, updates) {
  const list = loadSolicitudes()
  const next = list.map((s) => {
    if (s.id !== id) return s
    const historial = Array.isArray(s.historial) ? s.historial : []
    const pdfUrls = Array.isArray(updates.nuevaFacturaUrls) ? updates.nuevaFacturaUrls : []
    const adjuntoTramite = Array.isArray(updates.adjuntosTramite) ? updates.adjuntosTramite.join(', ') : ''
    const campos = []
    if (updates.estado && updates.estado !== (s.estado || 'Abierto')) {
      const transito = ESTADOS_TRANSITO.includes(updates.estado)
      campos.push({
        campo: 'estado',
        anterior: s.estado || 'Abierto',
        nuevo: updates.estado,
        nota: updates.notaEstado || '',
        referencia: updates.numeroReferencia || s.numeroReferencia || '',
        adjunto: pdfUrls.length > 0 ? pdfUrls.join(', ') : adjuntoTramite,
        conductor: transito ? s.conductor || '' : '',
        vehiculo: transito ? s.vehiculo || '' : '',
        placa: transito ? s.placa || '' : '',
        evidencia: updates.evidencia || '',
        encuesta: updates.encuesta || null,
      })
    }
    if ('asignadoA' in updates && updates.asignadoA !== (s.asignadoA || '')) {
      campos.push({ campo: 'asignado', anterior: s.asignadoA || 'Sin asignar', nuevo: updates.asignadoA || 'Sin asignar' })
    }
    if ('conductor' in updates && (updates.conductor || '') !== (s.conductor || '')) {
      campos.push({
        campo: 'conductor',
        anterior: s.conductor || 'Sin asignar',
        nuevo: updates.conductor || 'Sin asignar',
        vehiculo: updates.vehiculo || '',
        placa: updates.placa || '',
      })
    }
    const adicionales = { ...updates }
    delete adicionales.nuevaFacturaUrls
    delete adicionales.adjuntosTramite

    let historialFinal = historial
    if (campos.length === 0 && pdfUrls.length > 0) {
      // Sin cambio de estado: se actualiza el adjunto del trámite en el historial
      historialFinal = [...historial]
      const idx = historialFinal.findIndex((h) => h.campo === 'estado' && h.nuevo === 'En Trámite')
      if (idx >= 0) {
        historialFinal[idx] = { ...historialFinal[idx], adjunto: pdfUrls.join(', ') }
      } else {
        const { fecha, hora } = nowStamp()
        historialFinal = [
          {
            id: generarId(),
            campo: 'estado',
            anterior: s.estado || 'Abierto',
            nuevo: s.estado || 'Abierto',
            nota: '',
            referencia: updates.numeroReferencia || s.numeroReferencia || '',
            adjunto: pdfUrls.join(', '),
            persona: currentPersona(),
            fecha,
            hora,
          },
          ...historialFinal,
        ].slice(0, 30)
      }
    }

    if (campos.length === 0) return { ...s, ...adicionales, historial: historialFinal }
    const { fecha, hora } = nowStamp()
    const nuevos = campos.map((c) => ({ ...c, id: generarId(), fecha, hora, persona: currentPersona() }))
    return { ...s, ...adicionales, historial: [...nuevos, ...historialFinal].slice(0, 30) }
  })
  escribir(next)
  // Este cambio es obra de esta sesión: no debe avisarse como cambio remoto.
  marcarEchoLocal(next.filter((s) => s.id === id))
  empujar({ id })
  notificar()
  return next
}

// Corrección tras una devolución: actualiza los campos editables, devuelve la
// solicitud a estado 'Abierto' y deja constancia en el historial.
export function corregirSolicitud(id, datos) {
  return updateSolicitud(id, {
    ...datos,
    estado: 'Abierto',
    notaEstado: 'SOLICITUD CORREGIDA Y REENVIADA POR EL SOLICITANTE',
  })
}

export function removeSolicitud(id) {
  const next = escribir(loadSolicitudes().filter((s) => s.id !== id))
  if (backendActivo) void borrarSolicitud(id).catch((error) => console.warn('[API] no se pudo borrar en la base:', error))
  notificar()
  return next
}

export function clearSolicitudes() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(COUNTER_KEY)
    localStorage.removeItem(WATERMARK_KEY)
  } catch {
    // ignorar
  }
  cache = []
  cacheRaw = ''
  notificar()
  return cache
}

// Borra todo (local y, si hay backend, en la base) y reinicia el contador.
// Pensado para pruebas: el siguiente pedido vuelve a CTPLOG-00001.
export async function resetSolicitudes() {
  if (backendActivo) {
    try {
      await borrarTodasSolicitudes()
      if (navigator.onLine) {
        await iniciarSesion()
        await apiPost('/api/codigos/reiniciar')
      }
    } catch (error) {
      console.warn('[API] no se pudo limpiar en la base, se limpiará solo local:', error)
    }
  }
  proximoVisible = null
  listaPrevia = null
  idsAvisados.clear()
  mapaEchoLocal.clear()
  return clearSolicitudes()
}

const BORRADOR_KEY = 'ctp_entrega_borrador_'

export function guardarBorradorEntrega(id, datos) {
  try {
    localStorage.setItem(BORRADOR_KEY + id, JSON.stringify({ ...datos, guardadoEn: Date.now() }))
  } catch {
    // ignorar
  }
}

export function cargarBorradorEntrega(id) {
  try {
    const raw = localStorage.getItem(BORRADOR_KEY + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function eliminarBorradorEntrega(id) {
  try {
    localStorage.removeItem(BORRADOR_KEY + id)
  } catch {
    // ignorar
  }
}

// Contactos usados recientemente en la encuesta de satisfacción (nombre, cargo y
// correo de quien recibe). Se recuerdan para que el conductor no vuelva a
// escribir los mismos datos en la próxima entrega.
const CONTACTOS_KEY = 'ctp_contactos_encuesta'

function claveContacto(c) {
  return `${(c?.nombre || '').trim().toLowerCase()}|${(c?.cargo || '').trim().toLowerCase()}|${(c?.correo || '').trim().toLowerCase()}`
}

export function cargarContactosEncuesta() {
  try {
    const raw = localStorage.getItem(CONTACTOS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function guardarContactoEncuesta(contacto) {
  const nombre = (contacto?.nombre || '').trim()
  const cargo = (contacto?.cargo || '').trim()
  const correo = (contacto?.correo || '').trim()
  if (!nombre && !correo) return cargarContactosEncuesta()
  const nuevo = { nombre, cargo, correo }
  const clave = claveContacto(nuevo)
  const lista = [nuevo, ...cargarContactosEncuesta().filter((c) => claveContacto(c) !== clave)].slice(0, 10)
  try {
    localStorage.setItem(CONTACTOS_KEY, JSON.stringify(lista))
  } catch {
    // ignorar
  }
  return lista
}

export function marcarPendienteSync(id) {
  return pendiente(id)
}

// Un rechazo que reintentar no resuelve: 403 (permiso denegado) o 409 (el código
// ya estaba ocupado, o no era una reserva válida de esta cuenta). El 409 antes
// no existía en el servidor y salía como 500 genérico, con lo que el frontend lo
// tratava como error de red y reintentaba cada 8 s para siempre.
function esBloqueoPermanente(error) {
  return error?.estado === 403 || error?.estado === 409
}

export async function sincronizarPendientes() {
  if (!backendActivo) return 0
  // Las rechazadas (403) ya no se reintentan: se guardaron en el dispositivo
  // para que el solicitante no vea desaparecer lo que acaba de crear, pero no
  // pueden volver a la cola cada 8 segundos.
  const pendientes = loadSolicitudes().filter((s) => s.pendienteSync && !s.rechazada)
  if (pendientes.length === 0) return 0
  let subidas = 0
  let cambio = false
  const liberar = (id) => {
    confirmarEnServidor(id)
    cambio = true
  }
  for (const s of pendientes) {
    try {
      // Si el servidor nunca confirmó la fila, es un alta y tiene que decirlo:
      // es lo que hace que el backend rechace con 409 un código ya ocupado en
      // vez de pisar la solicitud que hubiera.
      await empujarSolicitud(s, { crear: !s.enServidor })
      subidas += 1
      liberar(s.id)
    } catch (error) {
      if (esBloqueoPermanente(error)) {
        console.warn(
          `[API] pendiente ${s.id} descartado (${error?.estado}, no se reintentará):`,
          error?.message
        )
        marcarRechazada(s.id)
        solicitudNoGuardada(s.id, error?.message)
        cambio = true
        continue
      }
      console.warn('[API] pendientes en pausa:', error)
      break
    }
  }
  if (cambio) notificar()
  return subidas
}

function sembrarContador(list) {
  const maximo = list.reduce((acc, s) => Math.max(acc, numeroDe(s.id)), 0)
  if (maximo <= 0) return
  const actual = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0
  if (maximo > actual) {
    try {
      localStorage.setItem(COUNTER_KEY, String(maximo))
    } catch {
      // ignorar
    }
  }
}

function leerWatermark() {
  try {
    return localStorage.getItem(WATERMARK_KEY) || ''
  } catch {
    return ''
  }
}

function guardarWatermark(valor) {
  if (!valor) return
  try {
    localStorage.setItem(WATERMARK_KEY, valor)
  } catch {
    // ignorar
  }
}

// Trae desde la API y lo fusiona con la caché local. Solo re-descarga el
// historial de las solicitudes que cambiaron desde la última sincronización
// (marca de agua); el resto conserva su historial local. Lo que esté marcado
// como pendiente de sincronizar gana sobre lo remoto (se hizo sin conexión).
export async function sincronizarInicial() {
  const locales = loadSolicitudes()
  if (!backendActivo || !navigator.onLine) return locales

  let resultado
  try {
    resultado = await descargarSolicitudes(leerWatermark())
  } catch (error) {
    console.warn('[API] sin datos remotos:', error)
    return locales
  }
  if (!resultado || !Array.isArray(resultado.solicitudes)) return locales

  // La descarga incremental solo trae el historial de las filas que cambiaron
  // desde el watermark; del resto se asume que ya está en la caché local. Esa
  // suposición se rompe cuando la caché no se pudo persistir (cuota de
  // localStorage llena: en producción hay >1000 pedidos con su historial y no
  // caben) o quedó vieja tras un fallo de escritura. El watermark sobrevive pero
  // la caché no, y las filas sin historial local llegan VACÍAS: un pedido
  // entregado se ve como «Aún no hay una entrega registrada» y sin su PDF. Se
  // detecta el hueco (fila del servidor sin historial recién traído y sin copia
  // local) y se fuerza una descarga completa, que sí trae todo el historial.
  if (leerWatermark()) {
    const idsLocales = new Set(locales.map((s) => s.id))
    const hueco = resultado.solicitudes.some(
      (r) => !resultado.conHistorial.has(r.id) && !idsLocales.has(r.id)
    )
    if (hueco) {
      try {
        const completo = await descargarSolicitudes('')
        if (completo && Array.isArray(completo.solicitudes)) resultado = completo
      } catch (error) {
        console.warn('[API] no se pudo re-sincronizar completo:', error)
      }
    }
  }

  const { solicitudes: remotas, conHistorial, watermark } = resultado
  const porIdLocal = new Map(locales.map((s) => [s.id, s]))
  const idsRemotos = new Set(remotas.map((r) => r.id))

  const fusion = []
  for (const remota of remotas) {
    const local = porIdLocal.get(remota.id)
    // El servidor trajo la fila: existe para los dos lados.
    if (local?.pendienteSync) {
      // Cambios locales sin subir: gana la versión local, pero ya se sabe que el
      // servidor la tiene, así que a partir de aquí puede borrarse si desaparece
      // de la respuesta.
      fusion.push({ ...local, enServidor: true, rechazada: false })
    } else if (local && !conHistorial.has(remota.id)) {
      fusion.push({ ...remota, historial: local.historial, enServidor: true })
    } else {
      fusion.push({ ...remota, enServidor: true })
    }
  }
  // Lo que el servidor NO trajo, en vez de borrarse, se conserva salvo que se
  // confirme que estaba en la base y allí desapareció (borrado en remoto). Antes
  // la lista se armaba solo con lo remoto, de modo que cualquier solicitud
  // recién creada cuyo POST iba en camino, o que el servidor había rechazado con
  // 403, se borraba de este dispositivo en el siguiente tick de 8 s sin dejar
  // rastro: el contador ya había avanzado y no aparecía por ninguna parte.
  for (const local of locales) {
    if (idsRemotos.has(local.id)) continue
    if (local.enServidor && !local.pendienteSync) continue
    fusion.push(local)
  }

  escribir(fusion)
  guardarWatermark(watermark)
  sembrarContador(fusion)
  void sincronizarPendientes()
  notificar()
  return fusion
}

// ---------------------------------------------------------------------------
// ACTUALIZACIÓN EN VIVO (polling)
// El hosting compartido no tiene WebSockets, así que la suscripción de
// postgres_changes de Supabase se reemplaza por una re-sincronización
// incremental cada POLL_MS. Cuando otro usuario (solicitante, conductor,
// administrador o superadmin) crea o modifica algo, el siguiente tick lo trae y
// las pantallas abiertas se actualizan. Sigue siendo incremental: la marca de
// agua evita volver a descargar lo que no cambió.
// La sincronización al volver a la pestaña se dispara en el evento `focus`.
// ---------------------------------------------------------------------------
const POLL_MS = 8000

let temporizadorPoll = null
let resyncTimer = null
let bloqueado = false

function programarResync() {
  if (resyncTimer) clearTimeout(resyncTimer)
  resyncTimer = setTimeout(() => {
    resyncTimer = null
    if (!navigator.onLine) return
    void sincronizarInicial().catch((error) =>
      console.warn('[Polling] no se pudo re-sincronizar:', error)
    )
  }, 600)
}

function alEnfocarVentana() {
  if (!backendActivo || document.hidden) return
  programarResync()
}

export function iniciarTiempoReal() {
  if (!backendActivo || temporizadorPoll) return
  // Marca de identidad del tick: evita que dos sincronizaciones se solapen si la
  // red va lenta, para no gastar peticiones en downloads que se pisan.
  temporizadorPoll = setInterval(() => {
    if (bloqueado || document.hidden || !navigator.onLine) return
    bloqueado = true
    void sincronizarInicial()
      .catch((error) => console.warn('[Polling] fallo el ciclo:', error))
      .finally(() => {
        bloqueado = false
      })
  }, POLL_MS)
  window.addEventListener('focus', alEnfocarVentana)
  console.info(`[Polling] actualizaciones cada ${POLL_MS / 1000}s`)
}

export function detenerTiempoReal() {
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
