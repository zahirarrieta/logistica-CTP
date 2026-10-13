import { apiGet, apiPut, iniciarSesion } from './apiClient.js'

// ============================================================================
// AJUSTES
// Configuración global editable desde «Usuarios y claves». Por ahora una sola
// clave: los módulos que ven los solicitantes.
// ============================================================================

// Devuelve el array de rutas de módulos que ven los solicitantes. Cualquier
// usuario con sesión puede leerla (el frontend la necesita para el menú).
export async function cargarModulosSolicitante() {
  await iniciarSesion()
  const data = await apiGet('/api/ajustes/modulos-solicitante')
  return Array.isArray(data?.modulos) ? data.modulos : null
}

// Guarda la lista de módulos de los solicitantes. La normaliza el servidor.
export async function guardarModulosSolicitante(modulos) {
  await iniciarSesion()
  const data = await apiPut('/api/ajustes/modulos-solicitante', { modulos })
  console.info(`[API] módulos de solicitante guardados: ${(data?.modulos || modulos || []).join(', ')}`)
  return Array.isArray(data?.modulos) ? data.modulos : modulos
}
