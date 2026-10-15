// Colores de los estados del módulo de RECOLECCIÓN. Las recolecciones comparten
// los mismos estados que las solicitudes (más «Fallido»), así que los colores se
// delegan en estadoColors.js para que el listado, la tabla, el filtro y las
// notificaciones se vean idénticos en ambos módulos. Se conserva este módulo como
// punto de entrada único del módulo de recolección.
import { getBadgeColor, getDotColor } from './estadoColors.js'

export const getRecoleccionBadge = getBadgeColor

export const getRecoleccionDot = getDotColor
