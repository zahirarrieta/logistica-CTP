// Colores de los estados del módulo de RECOLECCIÓN. Las recolecciones comparten
// los mismos estados que las solicitudes (más «Fallido»), así que los colores se
// delegan en estadoColors.js para que el listado, la tabla, el filtro y las
// notificaciones se vean idénticos en ambos módulos. Se conserva este módulo como
// punto de entrada único del módulo de recolección.
import { getBadgeColor, getDotColor, getEstadoBg } from './estadoColors.js'

export const getRecoleccionBadge = getBadgeColor

export const getRecoleccionDot = getDotColor

// Fondo de fila por estado, para pintar la tabla igual que la de solicitudes.
export const getRecoleccionBg = getEstadoBg

// Campos de una recolección que el administrador puede marcar como «por
// corregir» al devolvérsela al solicitante. Son los campos propios del formulario
// de recolección (no los de una solicitud), para que el motivo diga qué hay que
// arreglar en la recolección: qué se recoge, de dónde, cuándo, el contacto, dónde
// se entrega, los adjuntos y las observaciones.
export const CAMPOS_DEVOLUCION_RECOLECCION = [
  { id: 'queRecogemos', etiqueta: 'QUÉ RECOGEMOS' },
  { id: 'recoge', etiqueta: 'LUGAR DE RECOGIDA' },
  { id: 'fechaHora', etiqueta: 'FECHA Y HORA' },
  { id: 'contacto', etiqueta: 'CONTACTO' },
  { id: 'entrega', etiqueta: 'LUGAR DE ENTREGA' },
  { id: 'adjuntos', etiqueta: 'ADJUNTOS' },
  { id: 'observaciones', etiqueta: 'OBSERVACIONES' },
]
