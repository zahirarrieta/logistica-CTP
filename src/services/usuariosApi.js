import { apiPost } from './apiClient.js'

// POST /api/usuarios/:correo/restablecer-clave — solo la cuenta de sistemas.
// Sin contrasena el servidor deja su clave predeterminada; con { contrasena }
// se fija una nueva (mínimo 8, la predeterminada es la única excepción).
export function restablecerClave(correo, contrasena = '') {
  const ruta = `/api/usuarios/${encodeURIComponent(correo)}/restablecer-clave`
  return apiPost(ruta, contrasena ? { contrasena } : {})
}
