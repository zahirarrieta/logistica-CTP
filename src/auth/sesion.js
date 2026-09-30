// ============================================================================
// SESIÓN PROPIA
// Reemplaza a la sesión de Microsoft (MSAL). Aquí no hay biblioteca de por medio:
// el token lo firma la API (server/src/rutasAuth.js) y este módulo solo lo guarda
// en el navegador y lo devuelve.
//
// El token se guarda en localStorage y NO en sessionStorage a propósito: es lo
// que hacía MSAL, y es lo que evita que el usuario tenga que escribir su
// contraseña cada vez que cierra una pestaña. El bearer es la contrapartida: si
// alguien lee el almacenamiento del navegador, ya está dentro de la cuenta.
//
// `account` se expone con la FORMA que usan los componentes (name, username,
// idTokenClaims.email) para no tener que tocar los ocho sitios que leen el
// nombre del usuario. Es un caso de compatibility, no un resquicio a Microsoft:
// el contenido sale del token que firmamos nosotros.
// ============================================================================

const CLAVE_TOKEN = 'ctp_token'
const CLAVE_CUENTA = 'ctp_cuenta'

// Cuenta en memoria. Se lee de localStorage al arrancar y se actualiza en cada
// cambio, para que ninguna función tenga que ir al almacenamiento a leerla.
let cuentaActual = leerCuenta()

function leer() {
  try {
    return window.localStorage.getItem(CLAVE_TOKEN) || ''
  } catch {
    // Navegador sin almacenamiento (modo privado estricto, iframa sin permisos).
    // La sesión durará lo que dure la pestaña, pero la app funciona.
    return ''
  }
}

function escribir(clave, valor) {
  try {
    if (valor) window.localStorage.setItem(clave, valor)
    else window.localStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento: el token vive solo en memoria durante esta carga.
  }
}

function leerCuenta() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_CUENTA)
    if (!crudo) return null
    const cuenta = JSON.parse(crudo)
    if (cuenta && typeof cuenta.correo === 'string' && cuenta.correo) {
      return aAccount(cuenta.correo, cuenta.nombre || '')
    }
  } catch {
    // Datos guardados inválidos: se limpian abajo al no haber cuenta.
  }
  return null
}

// Normaliza un {correo, nombre} al objeto que espera el resto de la app.
export function aAccount(correo, nombre = '') {
  const mail = String(correo || '').trim().toLowerCase()
  return {
    name: String(nombre || '').trim(),
    username: mail,
    idTokenClaims: { email: mail, name: String(nombre || '').trim() },
  }
}

// Token guardado, o '' si no hay sesión.
export function tokenSesion() {
  return leer()
}

// Cuenta guardada, o null.
export function getActiveAccount() {
  return cuentaActual
}

// ¿Hay algo guardado? No dice si el token SIGUE siendo válido: eso solo lo sabe
// el backend, comprobando con GET /api/auth/yo. Para eso está validarSesion() en
// AuthContext.
export function haySesion() {
  return Boolean(leer() && cuentaActual)
}

// Guarda la sesión que devuelve la API. Se llama tras registrarse o iniciar
// sesión, y también al recuperar una sesión caducada.
export function guardarSesion({ token, usuario = {} }) {
  const correo = String(usuario.correo || '').trim().toLowerCase()
  if (!token || !correo) {
    throw new Error('La respuesta del servidor no trae una sesión válida')
  }
  cuentaActual = aAccount(correo, usuario.nombre || '')
  escribir(CLAVE_TOKEN, token)
  escribir(CLAVE_CUENTA, JSON.stringify({ correo, nombre: usuario.nombre || '' }))
  return cuentaActual
}

// Borra la sesión del navegador. El backend no guarda sesiones (el token es
// autocontenido y sin estado), así que no hay nada que revocar en el servidor:
// cerrar sesión es olvidar el token aquí.
export function cerrarSesionLocal() {
  cuentaActual = null
  escribir(CLAVE_TOKEN, '')
  escribir(CLAVE_CUENTA, '')
}

// Lo llama apiClient cuando el backend responde 401: la sesión guardada está
// caducada o el servidor reinició con otro SESSION_SECRET, así que quedarse con
// ella solo produciría otra petición rechazada.
export function limpiarSesionCaducada() {
  if (haySesion()) {
    console.warn('[Auth] la sesión guardada ya no vale; se pide volver a entrar.')
    cerrarSesionLocal()
  }
}
