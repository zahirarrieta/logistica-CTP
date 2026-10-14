'use strict'

// ============================================================================
// PERMISOS
// Traducción literal de las 15 políticas RLS de supabase/schema.sql a SQL que
// el backend aplica en cada consulta. MySQL no tiene RLS, así que aquí está
// toda la seguridad: si una consulta no pasa por una de estas funciones, no
// debe llegar a la base.
//
// Cada filtro devuelve { sql, params } con un `?` por cada valor, en el mismo
// orden en que aparecen, listo para pool.execute(sql, params).
// ============================================================================

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']
const ESTADOS_ENTREGADAS = ['Entregado', 'Entregado Parcial']
// «Trámite» (paso documental: factura/remisión) no es «Tránsito» (la ruta del
// camión): son estados distintos y solo estos dos admiten adjuntar o borrar una
// factura, igual que ESTADOS_TRAMITE de src/utils/pdfUtils.js.
const ESTADOS_TRAMITE = ['En Trámite', 'En Trámite Parcial']
const PRIVILEGIADOS = ['administrador', 'superadmin']
const SUPERADMIN = 'superadmin'
// Correos que pueden subir el inventario aunque su rol no sea privilegiado: la
// cuenta corporativa de pedidos la usa el personal de bodega que administra el
// stock. Normalizados a minúsculas; misma lista que CORREOS_SUBIR_INVENTARIO de
// src/auth/roles.js.
const CORREOS_SUBIR_INVENTARIO = ['pedidos@ctpmedica.com', 'despachos@ctpmedica.com']

// Resuelve el contexto del usuario una vez por petición: correo (del token de
// Microsoft), nombre y rol (de la tabla usuarios). El rol se lee del servidor y
// nunca del token, para que un admin cambie permisos sin tocar el frontend
// (mismo criterio que rol_actual() en Postgres).
async function contexto(conexion, correo, nombreToken) {
  const [filas] = await conexion.execute(
    'SELECT correo, nombre, rol, activo FROM usuarios WHERE correo = ? LIMIT 1',
    [correo]
  )
  const fila = filas[0]
  const activo = Boolean(fila && fila.activo)
  return {
    correo,
    nombre: (fila && fila.nombre) || nombreToken || '',
    // Sin registro, o inactivo, cae en 'solicitante' como rol_actual().
    rol: activo ? fila.rol : 'solicitante',
    activo,
  }
}

function esPrivilegiado(rol) {
  return PRIVILEGIADOS.includes(rol)
}

// Sube inventario quien es privilegiado o está en la lista de correos
// autorizados (p. ej. pedidos@ctpmedica.com).
function puedeSubirInventario(ctx) {
  return (
    esPrivilegiado(ctx.rol) ||
    CORREOS_SUBIR_INVENTARIO.includes(String(ctx.correo || '').toLowerCase())
  )
}

// El catálogo de clientes es más delicado que el resto: lo consume el selector
// de las solicitudes, así que un borrado accidental afecta a datos que ya se
// usaron. Por eso sus rutas de escritura piden superadmin y no solo privilegiado.
function esSuperAdmin(rol) {
  return rol === SUPERADMIN
}

// ---------------------------------------------------------------------------
// recolecciones
// ---------------------------------------------------------------------------
// Estados propios del módulo de recolección, independientes de los de las
// solicitudes: una recolección se abre, pasa a trámite y termina entregada o
// fallida.
const ESTADOS_RECOLECCION = ['Abierto', 'Trámite', 'Fallido', 'Entregado']

// El conductor no entra al módulo: mueve entregas de solicitudes, no
// recolecciones. Mismo criterio que el inventario.
function puedeVerRecolecciones(ctx) {
  return ctx.rol !== 'conductor'
}

// Quién ve qué: los privilegiados todas; el resto solo las que creó (la columna
// `correo` guarda la cuenta que registró la recolección).
function filtroRecolecciones(ctx) {
  if (esPrivilegiado(ctx.rol)) return { sql: '1 = 1', params: [] }
  return { sql: 'correo = ?', params: [ctx.correo] }
}

// Crean recolecciones el solicitante, el administrador y el superadmin.
function permiteCrearRecoleccion(ctx) {
  return ['solicitante', ...PRIVILEGIADOS].includes(ctx.rol)
}

// Editan (y cambian el estado de) el dueño de la recolección o un privilegiado.
function permiteActualizarRecoleccion(ctx, actual) {
  if (esPrivilegiado(ctx.rol)) return true
  return (actual.correo || '') === ctx.correo
}

// Responsable de una recolección. Es un listado operativo cerrado: el solicitante
// elige a quién le encarga el pedido al crearlo y el administrador solo puede
// reasignarlo dentro de estos cuatro. No sale de la tabla usuarios porque son
// cuentas de operación compartidas (despachos, pedidos, operaciones de cada sede).
// Espejo de RESPONSABLES_RECOLECCION en src/utils/responsablesRecoleccion.js.
const RESPONSABLES_RECOLECCION = [
  { nombre: 'Yonathan Ortiz', correo: 'despachos@ctpmedica.com' },
  { nombre: 'Daniel Chamorro', correo: 'pedidos2@ctpmedica.com' },
  { nombre: 'Duber Sepúlveda', correo: 'operacionesmedellin@ctpmedica.com' },
  { nombre: 'Sebastián Rojas', correo: 'operacionescali@ctpmedica.com' },
]

// Devuelve el responsable del listado para ese correo, o null si no pertenece a
// él (así el alta y la reasignación rechazan cualquier otro destino).
function responsableRecoleccion(correo) {
  const buscado = String(correo || '').trim().toLowerCase()
  if (!buscado) return null
  return RESPONSABLES_RECOLECCION.find((p) => p.correo === buscado) || null
}

// Marcadores `?` para un IN de tamaño fijo.
function marcas(valores) {
  return valores.map(() => '?').join(', ')
}

// ---------------------------------------------------------------------------
// solicitudes · SELECT
// ---------------------------------------------------------------------------
// privileged
//   OR solicitante_correo = :correo
//   OR (conductor AND ( estado IN (tránsito)
//                      OR (estado IN (entregadas) AND (conductor_correo = :correo
//                                                    OR conductor = :nombre)) ))
// La rama de entregadas es para que el conductor vea su propio historial de
// entregas al refrescar, incluidos los registros antiguos que solo guardan el
// nombre y no el conductor_correo.
function filtroSolicitudes(ctx) {
  if (esPrivilegiado(ctx.rol)) return { sql: '1 = 1', params: [] }
  if (ctx.rol === 'conductor') {
    return {
      sql: `(solicitante_correo = ?
        OR estado IN (${marcas(ESTADOS_TRANSITO)})
        OR (estado IN (${marcas(ESTADOS_ENTREGADAS)})
            AND (NULLIF(conductor_correo, '') = ? OR NULLIF(conductor, '') = ?)))`,
      params: [
        ctx.correo,
        ...ESTADOS_TRANSITO,
        ...ESTADOS_ENTREGADAS,
        ctx.correo,
        ctx.nombre,
      ],
    }
  }
  return { sql: 'solicitante_correo = ?', params: [ctx.correo] }
}

// ---------------------------------------------------------------------------
// solicitudes · INSERT (WITH CHECK)
// ---------------------------------------------------------------------------
function permiteInsertarSolicitud(ctx, fila) {
  if (['solicitante', ...PRIVILEGIADOS].includes(ctx.rol)) return true
  if ((fila.solicitante_correo || '') === ctx.correo) return true
  if (ctx.rol === 'conductor') {
    return [...ESTADOS_TRANSITO, ...ESTADOS_ENTREGADAS].includes(fila.estado)
  }
  return false
}

// ---------------------------------------------------------------------------
// solicitudes · UPDATE
// ---------------------------------------------------------------------------
// USING     → qué fila puede tocar: privileged, propia, o conductor y en tránsito.
// WITH CHECK → qué puede dejar escrito: privileged, propia, o conductor y en
//               tránsito o ya entregada. Se comprueban las dos.
function permiteActualizarSolicitud(ctx, actual, nuevo) {
  if (esPrivilegiado(ctx.rol)) return true
  if ((actual.solicitante_correo || '') === ctx.correo) return true
  if (ctx.rol === 'conductor' && ESTADOS_TRANSITO.includes(actual.estado)) {
    return [...ESTADOS_TRANSITO, ...ESTADOS_ENTREGADAS].includes(nuevo.estado)
  }
  return false
}

// ---------------------------------------------------------------------------
// solicitudes · DELETE
// ---------------------------------------------------------------------------
function permiteBorrarSolicitud(ctx, fila) {
  return esPrivilegiado(ctx.rol) || (fila.solicitante_correo || '') === ctx.correo
}

// ---------------------------------------------------------------------------
// historial
// ---------------------------------------------------------------------------
// SELECT: hereda la visibilidad de su solicitud, pero el conductor ve todo lo
// que esté en tránsito o entregado, no solo lo suyo.
function filtroHistorial(ctx) {
  if (esPrivilegiado(ctx.rol)) return { sql: '1 = 1', params: [] }
  if (ctx.rol === 'conductor') {
    const estados = [...ESTADOS_TRANSITO, ...ESTADOS_ENTREGADAS]
    return {
      sql: `EXISTS (SELECT 1 FROM solicitudes s
             WHERE s.codigo = historial.solicitud AND s.estado IN (${marcas(estados)}))`,
      params: estados,
    }
  }
  return {
    sql: `EXISTS (SELECT 1 FROM solicitudes s
           WHERE s.codigo = historial.solicitud AND s.solicitante_correo = ?)`,
    params: [ctx.correo],
  }
}

// INSERT: privileged, conductor, o el propio solicitante de esa solicitud.
function permiteInsertarHistorial(ctx, solicitud) {
  if ([...PRIVILEGIADOS, 'conductor'].includes(ctx.rol)) return true
  return (solicitud.solicitante_correo || '') === ctx.correo
}

// UPDATE: privileged, conductor, o el propio solicitante.
function permiteActualizarHistorial(ctx, solicitud) {
  if (esPrivilegiado(ctx.rol)) return true
  if (ctx.rol === 'conductor') return true
  return (solicitud.solicitante_correo || '') === ctx.correo
}

// ---------------------------------------------------------------------------
// usuarios
// ---------------------------------------------------------------------------
// Cada quien ve y edita su propia fila; los privilegiados ven y editan todas.
function filtroUsuarios(ctx) {
  if (esPrivilegiado(ctx.rol)) return { sql: '1 = 1', params: [] }
  return { sql: 'correo = ?', params: [ctx.correo] }
}

// ---------------------------------------------------------------------------
// Módulos visibles para los solicitantes (ajuste global)
// ---------------------------------------------------------------------------
// El menú y los guards del frontend se gobiernan por la lista de módulos que el
// rol tiene permitidos. Para los solicitantes esa lista es CONFIGURABLE desde
// «Usuarios y claves»: hay módulos nuevos (Inventario, y los que vengan) que se
// activan para el resto de roles pero que a los solicitantes se les quiere
// ocultar. Inicio nunca se puede quitar —sin él no habría a dónde volver— y el
// resto (Solicitudes, Inventario, Conductor, Administrador) sí.
// «recolecciones» no es una ruta: apaga el botón «Recolección» y la pestaña
// «Mis recolecciones» de los solicitantes sin tocar el resto del módulo.
const MODULO_RECOLECCIONES = 'recolecciones'
const MODULOS_CONFIGURABLES = ['/solicitudes', '/inventario', '/conductor', '/administrador', MODULO_RECOLECCIONES]
const MODULOS_SOLICITANTE_POR_DEFECTO = ['/inicio', '/solicitudes', '/inventario', MODULO_RECOLECCIONES]

// Normaliza lo guardado (JSON o array) a una lista válida, sin duplicados y con
// Inicio siempre presente. Cualquier valor desconocido se descarta, así que un
// ajuste corrupto o manipulado no puede habilitar una ruta arbitraria.
function normalizarModulosSolicitante(valor) {
  let lista = valor
  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor)
    } catch {
      lista = null
    }
  }
  if (!Array.isArray(lista)) lista = MODULOS_SOLICITANTE_POR_DEFECTO
  const permitidos = new Set(['/inicio', ...MODULOS_CONFIGURABLES])
  const limpio = []
  for (const modulo of lista) {
    if (permitidos.has(modulo) && !limpio.includes(modulo)) limpio.push(modulo)
  }
  if (!limpio.includes('/inicio')) limpio.unshift('/inicio')
  return limpio
}

// ---------------------------------------------------------------------------
// guardar_solicitud (el RPC que se saltaba RLS)
// ---------------------------------------------------------------------------
// Réplica exacta de la comprobación de la función SECURITY DEFINER. Ahora es la
// vía de escritura normal: el backend autoriza y escribe en la misma
// transacción, sin depender de que RLS acepte el INSERT/UPDATE.
function permiteGuardarSolicitud(ctx, fila) {
  return permiteInsertarSolicitud(ctx, fila)
}

module.exports = {
  contexto,
  esPrivilegiado,
  esSuperAdmin,
  puedeSubirInventario,
  puedeVerRecolecciones,
  filtroRecolecciones,
  permiteCrearRecoleccion,
  permiteActualizarRecoleccion,
  RESPONSABLES_RECOLECCION,
  responsableRecoleccion,
  filtroSolicitudes,
  permiteInsertarSolicitud,
  permiteActualizarSolicitud,
  permiteBorrarSolicitud,
  filtroHistorial,
  permiteInsertarHistorial,
  permiteActualizarHistorial,
  filtroUsuarios,
  permiteGuardarSolicitud,
  MODULO_RECOLECCIONES,
  MODULOS_CONFIGURABLES,
  MODULOS_SOLICITANTE_POR_DEFECTO,
  normalizarModulosSolicitante,
  ESTADOS_TRANSITO,
  ESTADOS_ENTREGADAS,
  ESTADOS_TRAMITE,
  ESTADOS_RECOLECCION,
}
