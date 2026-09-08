export const ESTADOS = [
  'Abierto',
  'Autorizado',
  'Cancelado',
  'Devolución Solicitante',
  'En alistamiento',
  'Entregado',
  'Entregado/Parcial',
  'En Transito',
  'En Tramite',
  'Despacho Parcial',
]

export const BADGE_COLORS = {
  'Abierto': 'bg-green-100 text-green-700',
  'Autorizado': 'bg-blue-100 text-blue-700',
  'Cancelado': 'bg-red-100 text-red-700',
  'Cerrado': 'bg-gray-200 text-gray-700',
  'Devolución Solicitante': 'bg-amber-100 text-amber-700',
  'En alistamiento': 'bg-cyan-100 text-cyan-700',
  'Entregado': 'bg-emerald-100 text-emerald-700',
  'Entregado/Parcial': 'bg-teal-100 text-teal-700',
  'En Transito': 'bg-indigo-100 text-indigo-700',
  'En Tramite': 'bg-purple-100 text-purple-700',
  'Despacho Parcial': 'bg-orange-100 text-orange-700',
}

export const DOT_COLORS = {
  'Abierto': 'bg-green-500',
  'Autorizado': 'bg-blue-500',
  'Cancelado': 'bg-red-500',
  'Cerrado': 'bg-gray-500',
  'Devolución Solicitante': 'bg-amber-500',
  'En alistamiento': 'bg-cyan-500',
  'Entregado': 'bg-emerald-500',
  'Entregado/Parcial': 'bg-teal-500',
  'En Transito': 'bg-indigo-500',
  'En Tramite': 'bg-purple-500',
  'Despacho Parcial': 'bg-orange-500',
}

export const SOFT_COLORS = {
  'Abierto': 'bg-white ring-1 ring-green-400/60 text-green-700',
  'Autorizado': 'bg-white ring-1 ring-blue-400/60 text-blue-700',
  'Cancelado': 'bg-white ring-1 ring-red-400/60 text-red-700',
  'Cerrado': 'bg-white ring-1 ring-gray-400/60 text-gray-600',
  'Devolución Solicitante': 'bg-white ring-1 ring-amber-400/60 text-amber-700',
  'En alistamiento': 'bg-white ring-1 ring-cyan-400/60 text-cyan-700',
  'Entregado': 'bg-white ring-1 ring-emerald-400/60 text-emerald-700',
  'Entregado/Parcial': 'bg-white ring-1 ring-teal-400/60 text-teal-700',
  'En Transito': 'bg-white ring-1 ring-indigo-400/60 text-indigo-700',
  'En Tramite': 'bg-white ring-1 ring-purple-400/60 text-purple-700',
  'Despacho Parcial': 'bg-white ring-1 ring-orange-400/60 text-orange-700',
}

export const getBadgeColor = (estado) => BADGE_COLORS[estado] || 'bg-green-100 text-green-700'
export const getDotColor = (estado) => DOT_COLORS[estado] || 'bg-green-500'
export const getSoftColor = (estado) => SOFT_COLORS[estado] || 'bg-white ring-1 ring-green-400/60 text-green-700'