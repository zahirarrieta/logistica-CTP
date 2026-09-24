import { sileo } from 'sileo'
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
