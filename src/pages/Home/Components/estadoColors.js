export const ESTADOS = [
  'Abierto',
  'Autorizado',
  'Cancelado',
  'Cerrado',
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

export const getBadgeColor = (estado) => BADGE_COLORS[estado] || 'bg-green-100 text-green-700'
export const getDotColor = (estado) => DOT_COLORS[estado] || 'bg-green-500'