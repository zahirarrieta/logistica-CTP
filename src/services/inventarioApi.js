import { apiFetch } from './apiClient.js'

// ============================================================================
// Módulo Inventario (artículos, lotes y vencimientos por bodega)
// ============================================================================
// El backend guarda SOLO las columnas originales del reporte pegado. Las
// calculadas (Estado, Días de Vigencia y Días de Inventario por rangos) se
// derivan en el navegador al mostrarlas, así que no viajan ni se guardan.
//
// Cada POST reemplaza el inventario completo: la hoja de Excel que se pega es
// la fuente de verdad. Solo administrador/superadmin pueden escribir (el
// backend también lo comprueba; aquí solo evitamos mostrar el botón).

export async function listarInventario() {
  const data = await apiFetch('/api/inventario')
  return data || []
}

export function guardarInventario(filas) {
  return apiFetch('/api/inventario', { method: 'POST', body: { filas } })
}
