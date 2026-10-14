// Colores de los estados del módulo de RECOLECCIÓN (espejo de
// ESTADOS_RECOLECCION en auth/roles.js). Se usan en el filtro por estado y en
// las insignias del listado.

export const ESTADO_RECOLECCION_BADGE = {
  Abierto: 'bg-blue-100 text-blue-700',
  'Trámite': 'bg-amber-100 text-amber-700',
  Fallido: 'bg-red-100 text-red-700',
  Entregado: 'bg-emerald-100 text-emerald-700',
}

export const ESTADO_RECOLECCION_DOT = {
  Abierto: 'bg-blue-500',
  'Trámite': 'bg-amber-500',
  Fallido: 'bg-red-500',
  Entregado: 'bg-emerald-500',
}

export const getRecoleccionBadge = (estado) =>
  ESTADO_RECOLECCION_BADGE[estado] || 'bg-brand-ink/10 text-brand-ink'

export const getRecoleccionDot = (estado) =>
  ESTADO_RECOLECCION_DOT[estado] || 'bg-brand-ink/40'
