// Definición centralizada de permisos por rol.
//
// Roles (viven en la tabla public.usuarios, columna rol):
//  - solicitante:   Inicio + Solicitudes (solo las suyas)
//  - conductor:     Inicio + Conductor (solo solicitudes en tránsito)
//  - administrador: todos los módulos; ve las solicitudes SIN asignar y las que
//                   tiene asignadas a su nombre/correo (tab «Mis asignaciones»)
//  - superadmin:    todos los módulos y TODAS las solicitudes (abiertas,
//                   cerradas, asignadas, sin asignar, etc.)

export const ROLES = {
  SOLICITANTE: 'solicitante',
  CONDUCTOR: 'conductor',
  ADMINISTRADOR: 'administrador',
  SUPERADMIN: 'superadmin',
}

// Rutas de los módulos del menú superior.
export const RUTA_INICIO = '/inicio'
export const RUTA_SOLICITUDES = '/solicitudes'
export const RUTA_INVENTARIO = '/inventario'
export const RUTA_CONDUCTOR = '/conductor'
export const RUTA_ADMIN = '/administrador'
// Configuración es para todo el mundo: cada rol tiene algo que activar ahí (el
// conductor, las notificaciones push) y una pantalla que solo le sirva a un rol
// sería un callejón sin salida cada vez que aparezca un ajuste nuevo.
export const RUTA_CONFIGURACION = '/configuracion'

const TODOS = [RUTA_INICIO, RUTA_SOLICITUDES, RUTA_INVENTARIO, RUTA_CONDUCTOR, RUTA_ADMIN]

// Módulos visibles/permitidos por rol (usado por el Header y por los guards).
// El conductor queda fuera de Inventario: él mueve las entregas, no administra
// el stock.
const MODULOS_POR_ROL = {
  [ROLES.CONDUCTOR]: [RUTA_INICIO, RUTA_CONDUCTOR],
  [ROLES.SOLICITANTE]: [RUTA_INICIO, RUTA_SOLICITUDES, RUTA_INVENTARIO],
  [ROLES.ADMINISTRADOR]: TODOS,
  [ROLES.SUPERADMIN]: TODOS,
}

export function esSuperAdmin(rol) {
  return rol === ROLES.SUPERADMIN
}

// Cuenta de sistemas (Zahir). Única que ve el menú «Usuarios y claves» del
// desplegable del header para restablecer contraseñas olvidadas. Espejo del
// CORREO_SISTEMAS del backend: la regla vive en el servidor y aquí solo gobierna
// la interfaz.
export const CORREO_SISTEMAS = 'sistemas@ctpmedica.com'

export function esAdministrador(rol) {
  return rol === ROLES.ADMINISTRADOR
}

// Roles que suben el inventario y editan el catálogo: espejo de
// P.esPrivilegiado del backend.
export function esPrivilegiado(rol) {
  return rol === ROLES.ADMINISTRADOR || rol === ROLES.SUPERADMIN
}

// Correos que pueden subir el inventario aunque su rol no sea privilegiado (la
// cuenta corporativa de pedidos la usa el personal de bodega). Normalizados a
// minúsculas; misma lista que CORREOS_SUBIR_INVENTARIO de server/src/permisos.js.
export const CORREOS_SUBIR_INVENTARIO = ['pedidos@ctpmedica.com', 'despachos@ctpmedica.com']

// ¿Este rol+correo puede ver el botón «Subir información» del inventario?
// Espejo de P.puedeSubirInventario del backend.
export function puedeSubirInventario(rol, correo) {
  if (esPrivilegiado(rol)) return true
  return CORREOS_SUBIR_INVENTARIO.includes(String(correo || '').trim().toLowerCase())
}

export function esConductor(rol) {
  return rol === ROLES.CONDUCTOR
}

// Un usuario hace entregas si su rol es conductor o si está marcado como
// es_conductor (p. ej. administradores que también conducen). Recibe la fila de
// la tabla usuarios.
export function esConductorUsuario(usuario) {
  return usuario?.rol === ROLES.CONDUCTOR || usuario?.es_conductor === true
}

// Lista de rutas permitidas para un rol (por defecto, las de solicitante).
export function modulosPermitidos(rol) {
  return MODULOS_POR_ROL[rol] || MODULOS_POR_ROL[ROLES.SOLICITANTE]
}

// ¿Puede el rol visitar la ruta dada? «/» y «/inicio» se tratan como Inicio.
// Configuración es la excepción: la ven todos los roles, así que se comprueba
// aparte de la lista de módulos.
export function puedeVer(rol, path) {
  const ruta = path === '/' ? RUTA_INICIO : path
  if (ruta === RUTA_CONFIGURACION || ruta.startsWith(`${RUTA_CONFIGURACION}/`)) return true
  return modulosPermitidos(rol).some((m) => ruta === m || ruta.startsWith(`${m}/`))
}

// Ruta a la que se envía al usuario cuando intenta entrar a un módulo vetado.
export function rutaInicial(rol) {
  const modulos = modulosPermitidos(rol)
  return modulos[0] || RUTA_INICIO
}

// Determina si una solicitud pertenece al usuario actual.
// Prioriza el correo asignado (asignadoCorreo, único); si el registro es antiguo
// y solo tiene nombre (asignadoA), compara por nombre o por correo como respaldo.
export function esAsignadoA(solicitud, usuario) {
  const correoAsig = String(solicitud?.asignadoCorreo || '').trim().toLowerCase()
  const asignado = String(solicitud?.asignadoA || '').trim().toLowerCase()
  const nombre = String(usuario?.nombre || '').trim().toLowerCase()
  const correo = String(usuario?.correo || '').trim().toLowerCase()
  if (correoAsig && correo) return correoAsig === correo
  if (!asignado) return false
  return (nombre && asignado === nombre) || (correo && asignado === correo)
}

// Determina si una solicitud está asignada al conductor actual.
// Prioriza el correo del conductor (conductorCorreo, único); si el registro es
// antiguo o es un conductor externo («Otro»/«Elite») y solo tiene nombre
// (conductor), compara por nombre o por correo como respaldo.
export function esConductorDe(solicitud, usuario) {
  const correoCond = String(solicitud?.conductorCorreo || '').trim().toLowerCase()
  const nombreCond = String(solicitud?.conductor || '').trim().toLowerCase()
  const nombre = String(usuario?.nombre || '').trim().toLowerCase()
  const correo = String(usuario?.correo || '').trim().toLowerCase()
  if (correoCond && correo) return correoCond === correo
  if (!nombreCond) return false
  return (nombre && nombreCond === nombre) || (correo && nombreCond === correo)
}
