import { sileo } from 'sileo'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  MdAssignmentInd,
  MdAssignmentReturn,
  MdCloudDone,
  MdCloudUpload,
  MdErrorOutline,
  MdFolderShared,
  MdInbox,
  MdLocalShipping,
  MdRestartAlt,
  MdSend,
  MdSwapHoriz,
} from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { getBadgeColor } from '../pages/Home/Components/estadoColors.js'

const BASE = {
  duration: 4500,
  roundness: 18,
  fill: '#071A3D',
  styles: {
    title: '!text-white !normal-case !font-extrabold !tracking-wide',
    description: '!text-brand-mist',
    badge: '!bg-brand-cyan/20 !text-brand-cyan',
  },
}

const ESTADO_TIPO = {
  'Entregado': 'success',
  'Entregado Parcial': 'success',
  'Retenido por Cartera': 'error',
  'Devolución a Solicitante': 'warning',
  'Pendiente por Autorización': 'warning',
  'En Tránsito': 'info',
  'En Tránsito Parcial': 'info',
  'En Trámite': 'info',
  'Abierto': 'info',
}

// -------------------------------------------------------------
// Sonido + notificación del sistema: cada aviso reproduce un tono
// corto (uno distinto para cambio de estado y otro para cambio de
// conductor) y, si el equipo está bloqueado/pestaña oculta, dispara
// una notificación nativa del sistema.
// -------------------------------------------------------------
let audioCtx = null

function getCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = audioCtx || new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

// 'blip': clic agudo y muy corto (sonido por defecto).
function blip() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gan = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1200, t)
  gan.gain.setValueAtTime(0.0001, t)
  gan.gain.exponentialRampToValueAtTime(0.16, t + 0.005)
  gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  osc.connect(gan)
  gan.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.09)
}

// 'pop': caída de tono tipo burbuja (cambio de conductor).
function pop() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gan = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(900, t)
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.09)
  gan.gain.setValueAtTime(0.0001, t)
  gan.gain.exponentialRampToValueAtTime(0.25, t + 0.008)
  gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.connect(gan)
  gan.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.14)
}

// 'ding': campana con armónicos y cola (cambio de estado).
function ding() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const base = 880
  const parciales = [1, 2, 2.76, 5.4]
  parciales.forEach((mult, i) => {
    const osc = ctx.createOscillator()
    const gan = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = base * mult
    const vol = 0.16 / (i + 1)
    const fin = t + 0.45 - i * 0.05
    gan.gain.setValueAtTime(0.0001, t)
    gan.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    gan.gain.exponentialRampToValueAtTime(0.0001, fin)
    osc.connect(gan)
    gan.connect(ctx.destination)
    osc.start(t)
    osc.stop(fin + 0.02)
  })
}

export function sonidoNotificacion(tipo) {
  try {
    if (tipo === 'estado') ding() // cambio de estado
    else if (tipo === 'conductor') pop() // cambio de conductor
    else blip() // resto de avisos
  } catch {
    // Sin audio disponible: se ignora.
  }
}

let pidioPermiso = false
function permisoSistema() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'default' && !pidioPermiso) {
      pidioPermiso = true
      Notification.requestPermission().catch(() => {})
    }
    return false
  } catch {
    return false
  }
}

function textoPlano(elemento) {
  if (typeof elemento === 'string') return elemento
  try {
    return renderToStaticMarkup(elemento)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

function notificacionSistema(titulo, cuerpo) {
  try {
    if (!document.hidden) return
    if (!permisoSistema()) return
    const n = new Notification(titulo || 'Logística CTP', {
      body: textoPlano(cuerpo) || titulo || 'Tienes una notificación nueva.',
      tag: 'ctp-logistica',
    })
    n.onclick = () => {
      try { window.focus() } catch { /* noop */ }
      n.close()
    }
    setTimeout(() => n.close(), 12000)
  } catch {
    // Las notificaciones del sistema no están disponibles en este navegador.
  }
}

// Todos los avisos pasan por sileo: se envuelve para reproducir el sonido
// correspondiente y, si la pestaña está oculta, mostrar la notificación nativa.
const METODOS_SILEO = ['success', 'info', 'warning', 'error']
METODOS_SILEO.forEach((m) => {
  const original = sileo[m]
  if (typeof original !== 'function') return
  sileo[m] = (opts) => {
    try {
      sonidoNotificacion(opts?.sonido)
      notificacionSistema(opts?.title, opts?.description)
    } catch { /* noop */ }
    return original.call(sileo, opts)
  }
})

const linea = (children) => (
  <span className="block text-sm font-semibold leading-snug text-white">{children}</span>
)

const detalle = (children) => (
  <span className="mt-1 block text-xs font-medium text-brand-mist/80">{children}</span>
)

function titulo(id, fallback) {
  return id ? `${id}` : fallback
}

export function solicitudCreada(solicitud = {}) {
  const id = solicitud.numeroReferencia || solicitud.id
  sileo.success({
    ...BASE,
    title: titulo(id, 'Solicitud creada'),
    icon: <MdSend />,
    description: (
      <>
        {linea('Solicitud creada correctamente.')}
        {solicitud.cliente && detalle(`Cliente: ${solicitud.cliente}`)}
      </>
    ),
  })
}

// Aviso para administradores/superadmin cuando OTRA persona crea una solicitud:
// llega al instante por Realtime y no requiere refrescar la página.
export function solicitudNueva(solicitud = {}) {
  sileo.info({
    ...BASE,
    duration: 7000,
    title: 'Solicitud nueva',
    icon: <MdInbox />,
    description: (
      <>
        {linea('Hay una solicitud nueva por revisar.')}
        {solicitud.id && detalle(`Código: ${solicitud.id}`)}
        {solicitud.cliente && detalle(`Cliente: ${solicitud.cliente}`)}
      </>
    ),
  })
}

export function estadoActualizado(id, estado) {
  const tipo = ESTADO_TIPO[estado] || 'info'
  sileo[tipo]({
    ...BASE,
    sonido: 'estado',
    title: titulo(id, 'Estado actualizado'),
    icon: <MdSwapHoriz />,
    description: (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white">Nuevo estado:</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBadgeColor(estado)}`}>
          {estado || '—'}
        </span>
      </span>
    ),
  })
}

export function solicitudAsignada(id, asignadoA) {
  sileo.info({
    ...BASE,
    title: titulo(id, 'Solicitud asignada'),
    icon: <MdAssignmentInd />,
    description: (
      <span className="text-sm font-semibold text-white">
        Asignada a «<span className="text-brand-cyan">{asignadoA || 'Sin asignar'}</span>».
      </span>
    ),
  })
}

// Aviso al administrador cuando el superadmin/admin le asigna una solicitud a su
// nombre o correo: llega al instante por Realtime y aparece en «Mis asignaciones».
export function asignacionRecibida(id, cliente) {
  sileo.info({
    ...BASE,
    duration: 7000,
    title: titulo(id, 'Solicitud asignada'),
    icon: <MdAssignmentInd />,
    description: (
      <>
        {linea('Te asignaron esta solicitud.')}
        {cliente && detalle(`Cliente: ${cliente}`)}
      </>
    ),
  })
}

export function solicitudDevuelta(id, motivo) {
  sileo.warning({
    ...BASE,
    duration: 6500,
    title: titulo(id, 'Solicitud devuelta'),
    icon: <MdAssignmentReturn />,
    description: (
      <>
        {linea('Devuelta al solicitante para corrección.')}
        {motivo && detalle(`Motivo: ${motivo}`)}
      </>
    ),
  })
}

export function solicitudCorregida(id) {
  sileo.success({
    ...BASE,
    title: titulo(id, 'Solicitud corregida'),
    icon: <MdSend />,
    description: linea('Tu corrección se envió y la solicitud volvió a estado Abierto.'),
  })
}

export function conductorAsignado(id, conductor) {
  sileo.info({
    ...BASE,
    sonido: 'conductor',
    title: titulo(id, 'Conductor asignado'),
    icon: <RiSteering2Line />,
    description: (
      <span className="text-sm font-semibold text-white">
        Conductor «<span className="text-brand-cyan">{conductor || '—'}</span>» asignado.
      </span>
    ),
  })
}

// Aviso para el CONDUCTOR cuando el administrador/superadmin pone en tránsito
// una solicitud que le fue asignada: llega al instante por Realtime.
export function entregaAsignada(id, cliente) {
  sileo.info({
    ...BASE,
    duration: 8000,
    sonido: 'estado',
    title: titulo(id, 'Entrega asignada'),
    icon: <RiSteering2Line />,
    description: (
      <>
        {linea('Te asignaron una entrega en tránsito.')}
        {id && detalle(`Solicitud: ${id}`)}
        {cliente && detalle(`Cliente: ${cliente}`)}
      </>
    ),
  })
}

// Aviso a solicitante, administrador y superadmin cuando el conductor marca una
// solicitud como entregada: llega al instante por Realtime, sin refrescar.
export function entregaRealizada(id, { cliente, estado, conductor } = {}) {
  const parcial = estado === 'Entregado Parcial'
  sileo.success({
    ...BASE,
    duration: 7000,
    sonido: 'estado',
    title: titulo(id, 'Pedido entregado'),
    icon: <MdLocalShipping />,
    description: (
      <>
        {linea(parcial ? 'El conductor registró una entrega parcial.' : 'El conductor entregó este pedido.')}
        {conductor && detalle(`Conductor: ${conductor}`)}
        {cliente && detalle(`Cliente: ${cliente}`)}
      </>
    ),
  })
}

export function syncRestablecida(cantidad) {
  sileo.success({
    ...BASE,
    title: 'Conexión restablecida',
    icon: <MdCloudDone />,
    description: linea(`${cantidad} entrega(s) sincronizada(s) con el servidor.`),
  })
}

export function datosReiniciados() {
  sileo.success({
    ...BASE,
    title: 'Datos restablecidos',
    icon: <MdRestartAlt />,
    description: linea('Solicitudes eliminadas y contador reiniciado en CTPLOG-00001.'),
  })
}

export function documentosSubidos({ id, nombres = [], destino = 'carpeta compartida' } = {}) {
  const lista = nombres.filter(Boolean)
  sileo.success({
    ...BASE,
    title: titulo(id, lista.length > 1 ? `${lista.length} archivos subidos` : 'Archivo subido'),
    icon: <MdCloudUpload />,
    description: (
      <>
        {linea(`Guardado(s) correctamente en la ${destino} de OneDrive/SharePoint.`)}
        {lista.length > 0 && detalle(lista.join(', '))}
      </>
    ),
  })
}

export function evidenciaSubida({ id, archivo } = {}) {
  sileo.success({
    ...BASE,
    title: titulo(id, 'Evidencia adjuntada'),
    icon: <MdCloudUpload />,
    description: (
      <>
        {linea('La evidencia de entrega se guardó en la carpeta compartida de OneDrive/SharePoint.')}
        {archivo && detalle(archivo)}
      </>
    ),
  })
}

export function subidaPendiente(mensaje, id) {
  sileo.warning({
    ...BASE,
    duration: 6000,
    title: titulo(id, 'Evidencia guardada localmente'),
    icon: <MdErrorOutline />,
    description: linea(
      mensaje || 'No se pudo subir la evidencia a la carpeta compartida; se conservará en este dispositivo.'
    ),
  })
}

export function errorSubida(mensaje, id) {
  sileo.error({
    ...BASE,
    duration: 6000,
    title: titulo(id, 'No se pudo subir el archivo'),
    icon: <MdErrorOutline />,
    description: linea(mensaje || 'Intenta nuevamente en unos segundos.'),
  })
}

export function carpetaNoCompartida() {
  sileo.error({
    ...BASE,
    duration: 9000,
    title: 'Carpeta OneDrive no compartida',
    icon: <MdFolderShared />,
    description: (
      <>
        {linea("No se encontró la carpeta 'solicitudes' compartida con tu cuenta de Microsoft.")}
        {detalle(
          "Pídele al administrador que, desde sistemas@ctpmedica.com, haga clic derecho sobre 'solicitudes' → Compartir → 'Mi organización', permiso 'Puede editar'. Prueba de nuevo después de aceptar la invitación."
        )}
      </>
    ),
  })
}
