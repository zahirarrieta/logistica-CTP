import { msalInstance } from '../../../auth/msal.js'
import { shortName } from '../../../auth/user.js'
import { supabase, backendActivo, iniciarSesion } from '../../../services/supabaseClient.js'
import { descargarSolicitudes, empujarSolicitud, borrarSolicitud, borrarTodasSolicitudes } from '../../../services/solicitudesApi.js'
import { soloAdjuntosSolicitud } from '../../../components/pdfUtils.js'

const STORAGE_KEY = 'ctp_solicitudes'
const COUNTER_KEY = 'ctp_solicitudes_counter'
const WATERMARK_KEY = 'ctp_sync_watermark'

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

// Suscriptores en vivo: las pantallas (Solicitudes, Administrador, Conductor)
// se registran para recibir la lista actualizada cada vez que cambian los datos,
// ya sea por una acción local o por un cambio remoto (Supabase Realtime).
const suscriptores = new Set()

export function suscribir(callback) {
  if (typeof callback !== 'function') return () => {}
  suscriptores.add(callback)
  return () => suscriptores.delete(callback)
}

// Emite la lista vigente a todos los suscriptores.
export function notificar() {
  if (suscriptores.size === 0) return
  const lista = loadSolicitudes()
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
  try {
    raw = JSON.stringify(list)
    localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // Si falla el almacenamiento (ej. cuota), se ignora
  }
  cache = list
  cacheRaw = raw
  return list
}

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function pendiente(id) {
  return escribir(loadSolicitudes().map((s) => (s.id === id ? { ...s, pendienteSync: true } : s)))
}

function empujar(solicitud) {
  if (!backendActivo || !solicitud?.id) return
  if (!navigator.onLine) {
    console.info(`[Supabase] sin conexión: ${solicitud.id} queda en la cola, se sube al volver la red`)
    pendiente(solicitud.id)
    return
  }
  const actual = loadSolicitudes().find((s) => s.id === solicitud.id) || solicitud
  void empujarSolicitud(actual)
    .then(() => {
      escribir(loadSolicitudes().map((s) => (s.id === actual.id ? { ...s, pendienteSync: false } : s)))
    })
    .catch((error) => {
      console.warn('[Supabase] no se pudo subir:', error)
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

function currentPersona() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  return shortName(account)
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
    // Los id de historial se persisten para que la subida a Supabase no duplique filas.
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
  return `CTPLOG-${String(siguienteNumero()).padStart(5, '0')}`
}

export function saveSolicitud(data) {
  const list = loadSolicitudes()
  const now = new Date()
  const entry = {
    id: nextId(),
    fechaSubida: now.toLocaleDateString('es-CO'),
    horaSubida: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    estado: 'Abierto',
    asignadoA: '',
    asignadoCorreo: '',
    historial: [],
    ...data,
  }
  const next = escribir([entry, ...list])
  empujar(entry)
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
  if (backendActivo) void borrarSolicitud(id).catch((error) => console.warn('[Supabase] no se pudo borrar en la base:', error))
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

// Borra todo (local y, si hay backend, en Supabase) y reinicia el contador.
// Pensado para pruebas: el siguiente pedido vuelve a CTPLOG-00001.
export async function resetSolicitudes() {
  if (backendActivo) {
    try {
      await borrarTodasSolicitudes()
    } catch (error) {
      console.warn('[Supabase] no se pudo limpiar en la base, se limpiará solo local:', error)
    }
  }
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

export async function sincronizarPendientes() {
  if (!backendActivo) return 0
  const pendientes = loadSolicitudes().filter((s) => s.pendienteSync)
  if (pendientes.length === 0) return 0
  let subidas = 0
  for (const s of pendientes) {
    try {
      await empujarSolicitud(s)
      subidas += 1
      escribir(loadSolicitudes().map((x) => (x.id === s.id ? { ...x, pendienteSync: false } : x)))
    } catch (error) {
      console.warn('[Supabase] pendientes en pausa:', error)
      break
    }
  }
  if (subidas > 0) notificar()
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

// Trae desde Supabase y lo fusiona con la caché local. Solo re-descarga el
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
    console.warn('[Supabase] sin datos remotos:', error)
    return locales
  }
  if (!resultado || !Array.isArray(resultado.solicitudes)) return locales

  const { solicitudes: remotas, conHistorial, watermark } = resultado
  const porIdLocal = new Map(locales.map((s) => [s.id, s]))
  const idsRemotos = new Set(remotas.map((r) => r.id))

  const fusion = []
  for (const remota of remotas) {
    const local = porIdLocal.get(remota.id)
    if (local?.pendienteSync) {
      fusion.push(local)
    } else if (local && !conHistorial.has(remota.id)) {
      fusion.push({ ...remota, historial: local.historial })
    } else {
      fusion.push(remota)
    }
  }
  // Los locales pendientes que ya no existen en remoto se conservan (aún sin subir).
  for (const local of locales) {
    if (local.pendienteSync && !idsRemotos.has(local.id)) fusion.push(local)
  }

  escribir(fusion)
  guardarWatermark(watermark)
  sembrarContador(fusion)
  void sincronizarPendientes()
  notificar()
  return fusion
}

// ---------------------------------------------------------------------------
// TIEMPO REAL
// Se suscribe a los cambios de la tabla `solicitudes` en Supabase. Cuando otro
// usuario (solicitante, conductor, administrador o superadmin) crea o modifica
// algo, recibimos el evento, re-sincronizamos de forma incremental y avisamos a
// las pantallas abiertas para que tablas y modales se actualicen al instante.
// Requiere que la tabla esté en la publication `supabase_realtime` (ver
// supabase/schema.sql). RLS filtra qué eventos recibe cada usuario.
// ---------------------------------------------------------------------------
let canalRealtime = null
let resyncTimer = null

function programarResync() {
  if (resyncTimer) clearTimeout(resyncTimer)
  resyncTimer = setTimeout(() => {
    resyncTimer = null
    if (!navigator.onLine) return
    void sincronizarInicial().catch((error) =>
      console.warn('[Realtime] no se pudo re-sincronizar:', error)
    )
  }, 600)
}

export function iniciarTiempoReal() {
  if (!backendActivo || canalRealtime) return
  void iniciarSesion()
    .then(() => {
      if (canalRealtime) return
      canalRealtime = supabase
        .channel('solicitudes-tiempo-real')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'solicitudes' },
          () => programarResync()
        )
        .subscribe((estado) => {
          // Al (re)conectarse, sincroniza para no perder cambios ocurridos fuera de línea.
          if (estado === 'SUBSCRIBED') programarResync()
        })
      console.info('[Realtime] suscrito a cambios de solicitudes')
    })
    .catch((error) => console.warn('[Realtime] no se pudo iniciar:', error))
}

export function detenerTiempoReal() {
  if (resyncTimer) {
    clearTimeout(resyncTimer)
    resyncTimer = null
  }
  if (canalRealtime && supabase) {
    void supabase.removeChannel(canalRealtime)
    canalRealtime = null
  }
}
