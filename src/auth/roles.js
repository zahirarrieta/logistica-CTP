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
export const RUTA_CONDUCTOR = '/conductor'
export const RUTA_ADMIN = '/administrador'

const TODOS = [RUTA_INICIO, RUTA_SOLICITUDES, RUTA_CONDUCTOR, RUTA_ADMIN]

// Módulos visibles/permitidos por rol (usado por el Header y por los guards).
const MODULOS_POR_ROL = {
  [ROLES.CONDUCTOR]: [RUTA_INICIO, RUTA_CONDUCTOR],
  [ROLES.SOLICITANTE]: [RUTA_INICIO, RUTA_SOLICITUDES],
  [ROLES.ADMINISTRADOR]: TODOS,
  [ROLES.SUPERADMIN]: TODOS,
}

export function esSuperAdmin(rol) {
  return rol === ROLES.SUPERADMIN
}

export function esAdministrador(rol) {
  return rol === ROLES.ADMINISTRADOR
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
export function puedeVer(rol, path) {
  const ruta = path === '/' ? RUTA_INICIO : path
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
