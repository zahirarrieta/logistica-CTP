import { apiFetch } from './apiClient.js'

// ============================================================================
// Catálogo de clientes (CRUD del super administrador)
// ============================================================================
// A diferencia de cargarClientes() en solicitudesApi.js, que devuelve la lista
// con el alias `cliente` para el selector de las solicitudes, aquí se mantiene
// la forma cruda de la tabla (id, nit, nombre, bodega, zona) porque el modal de
// administración necesita el `id` para editar y borrar.
//
// Todas las rutas de escritura van por id, no por NIT: un mismo NIT puede
// tener varias sedes con bodega distinta.

export async function listarClientes() {
  const data = await apiFetch('/api/clientes')
  return data || []
}

export function crearCliente(cliente) {
  return apiFetch('/api/clientes', { method: 'POST', body: cliente })
}

export function actualizarCliente(id, cliente) {
  return apiFetch(`/api/clientes/${id}`, { method: 'PUT', body: cliente })
}

export function eliminarCliente(id) {
  return apiFetch(`/api/clientes/${id}`, { method: 'DELETE' })
}
