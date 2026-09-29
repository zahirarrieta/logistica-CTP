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
const PRIVILEGIADOS = ['administrador', 'superadmin']

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
  filtroSolicitudes,
  permiteInsertarSolicitud,
  permiteActualizarSolicitud,
  permiteBorrarSolicitud,
  filtroHistorial,
  permiteInsertarHistorial,
  permiteActualizarHistorial,
  filtroUsuarios,
  permiteGuardarSolicitud,
  ESTADOS_TRANSITO,
  ESTADOS_ENTREGADAS,
}
