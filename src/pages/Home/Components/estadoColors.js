export const ESTADOS = [
  'Abierto',
  'Pendiente por Autorización',
  'Devolución a Solicitante',
  'Retenido por Cartera',
  'En Trámite',
  'En Tránsito',
  'En Tránsito Parcial',
  'Entregado Parcial',
  'Entregado',
]

export const BADGE_COLORS = {
  'Abierto': 'bg-yellow-100 text-yellow-700',
  'Devolución a Solicitante': 'bg-fuchsia-100 text-fuchsia-700',
  'Pendiente por Autorización': 'bg-orange-100 text-orange-700',
  'Retenido por Cartera': 'bg-red-100 text-red-700',
  'En Trámite': 'bg-blue-100 text-blue-700',
  'En Tránsito': 'bg-purple-100 text-purple-700',
  'En Tránsito Parcial': 'bg-yellow-200 text-yellow-800',
  'Entregado Parcial': 'bg-yellow-200 text-yellow-800',
  'Entregado': 'bg-green-100 text-green-700',
}

export const DOT_COLORS = {
  'Abierto': 'bg-yellow-500',
  'Devolución a Solicitante': 'bg-fuchsia-500',
  'Pendiente por Autorización': 'bg-orange-500',
  'Retenido por Cartera': 'bg-red-500',
  'En Trámite': 'bg-blue-500',
  'En Tránsito': 'bg-purple-500',
  'En Tránsito Parcial': 'bg-yellow-500',
  'Entregado Parcial': 'bg-yellow-500',
  'Entregado': 'bg-green-500',
}

export const SOFT_COLORS = {
  'Abierto': 'bg-white ring-1 ring-yellow-400/60 text-yellow-700',
  'Devolución a Solicitante': 'bg-white ring-1 ring-fuchsia-400/60 text-fuchsia-700',
  'Pendiente por Autorización': 'bg-white ring-1 ring-orange-400/60 text-orange-700',
  'Retenido por Cartera': 'bg-white ring-1 ring-red-400/60 text-red-700',
  'En Trámite': 'bg-white ring-1 ring-blue-400/60 text-blue-700',
  'En Tránsito': 'bg-white ring-1 ring-purple-400/60 text-purple-700',
  'En Tránsito Parcial': 'bg-white ring-1 ring-yellow-400/60 text-yellow-700',
  'Entregado Parcial': 'bg-white ring-1 ring-yellow-400/60 text-yellow-700',
  'Entregado': 'bg-white ring-1 ring-green-400/60 text-green-700',
}

export const PASTEL_BG = {
  'Abierto': 'bg-yellow-100',
  'Pendiente por Autorización': 'bg-orange-100',
  'Devolución a Solicitante': 'bg-fuchsia-100',
  'Retenido por Cartera': 'bg-red-100',
  'En Trámite': 'bg-blue-100',
  'En Tránsito': 'bg-purple-100',
  'En Tránsito Parcial': 'bg-yellow-100',
  'Entregado Parcial': 'bg-yellow-100',
  'Entregado': 'bg-green-100',
}

export const getEstadoBg = (estado) => PASTEL_BG[estado] || 'bg-white'

export const getBadgeColor = (estado) => BADGE_COLORS[estado] || 'bg-green-100 text-green-700'
export const getDotColor = (estado) => DOT_COLORS[estado] || 'bg-green-500'
export const getSoftColor = (estado) => SOFT_COLORS[estado] || 'bg-white ring-1 ring-green-400/60 text-green-700'