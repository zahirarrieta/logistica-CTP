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
// el stock. Las recolecciones viven como pestaña dentro de Solicitudes.
const MODULOS_POR_ROL = {
  [ROLES.CONDUCTOR]: [RUTA_INICIO, RUTA_CONDUCTOR],
  [ROLES.SOLICITANTE]: [RUTA_INICIO, RUTA_SOLICITUDES, RUTA_INVENTARIO],
  [ROLES.ADMINISTRADOR]: TODOS,
  [ROLES.SUPERADMIN]: TODOS,
}

// Valor del ajuste que apaga el botón «Recolección» y la pestaña «Mis
// recolecciones» de los solicitantes (no es una ruta: las recolecciones viven
// dentro de Solicitudes). Espejo de P.MODULO_RECOLECCIONES del backend.
export const MODULO_RECOLECCIONES = 'recolecciones'

// Módulos que ven los solicitantes cuando no hay ajuste guardado. Espejo de
// MODULOS_SOLICITANTE_POR_DEFECTO del backend.
export const MODULOS_SOLICITANTE_POR_DEFECTO = [RUTA_INICIO, RUTA_SOLICITUDES, RUTA_INVENTARIO, MODULO_RECOLECCIONES]

// Módulos que se pueden marcar/desmarcar para los solicitantes desde «Usuarios y
// claves». Inicio no aparece: es obligatorio (sin él no habría a dónde volver).
export const MODULOS_CONFIGURABLES = [
  { ruta: RUTA_SOLICITUDES, label: 'Solicitudes' },
  { ruta: RUTA_INVENTARIO, label: 'Inventario' },
  { ruta: RUTA_CONDUCTOR, label: 'Conductor' },
  { ruta: RUTA_ADMIN, label: 'Administrador' },
  { ruta: MODULO_RECOLECCIONES, label: 'Recolecciones' },
]

// Estados del módulo de recolección. Espejo de P.ESTADOS_RECOLECCION del backend.
export const ESTADOS_RECOLECCION = ['Abierto', 'Trámite', 'Fallido', 'Entregado']

// Crean recolecciones el solicitante, el administrador y el superadmin. Espejo
// de P.permiteCrearRecoleccion.
export function puedeCrearRecoleccion(rol) {
  return rol === ROLES.SOLICITANTE || esPrivilegiado(rol)
}

// ¿Se le muestra el módulo de recolección (botón «Recolección» y pestaña «Mis
// recolecciones»)? A los solicitantes se les puede apagar desde el ajuste global
// «modulos_solicitante»; el resto de roles que crean recolecciones lo ven siempre.
export function puedeRecolectar(rol, modulosSolicitante) {
  if (!puedeCrearRecoleccion(rol)) return false
  if (rol !== ROLES.SOLICITANTE) return true
  const lista = Array.isArray(modulosSolicitante) ? modulosSolicitante : MODULOS_SOLICITANTE_POR_DEFECTO
  return lista.includes(MODULO_RECOLECCIONES)
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
// Para los solicitantes la lista sale del ajuste global «modulos_solicitante»
// (editable en «Usuarios y claves»): Inicio siempre está y el resto se filtra
// contra MODULOS_CONFIGURABLES. `modulosSolicitante` llega del AuthContext.
export function modulosPermitidos(rol, modulosSolicitante) {
  if (rol !== ROLES.SOLICITANTE) {
    return MODULOS_POR_ROL[rol] || MODULOS_POR_ROL[ROLES.SOLICITANTE]
  }
  const lista = Array.isArray(modulosSolicitante) ? modulosSolicitante : MODULOS_SOLICITANTE_POR_DEFECTO
  const validos = new Set([RUTA_INICIO, ...MODULOS_CONFIGURABLES.map((m) => m.ruta)])
  const limpio = []
  for (const modulo of lista) {
    if (validos.has(modulo) && !limpio.includes(modulo)) limpio.push(modulo)
  }
  if (!limpio.includes(RUTA_INICIO)) limpio.unshift(RUTA_INICIO)
  return limpio
}

// ¿Puede el rol visitar la ruta dada? «/» y «/inicio» se tratan como Inicio.
// Configuración es la excepción: la ven todos los roles, así que se comprueba
// aparte de la lista de módulos.
export function puedeVer(rol, path, modulosSolicitante) {
  const ruta = path === '/' ? RUTA_INICIO : path
  if (ruta === RUTA_CONFIGURACION || ruta.startsWith(`${RUTA_CONFIGURACION}/`)) return true
  return modulosPermitidos(rol, modulosSolicitante).some((m) => ruta === m || ruta.startsWith(`${m}/`))
}

// Ruta a la que se envía al usuario cuando intenta entrar a un módulo vetado.
export function rutaInicial(rol, modulosSolicitante) {
  const modulos = modulosPermitidos(rol, modulosSolicitante)
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
