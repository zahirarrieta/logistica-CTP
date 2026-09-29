// ============================================================================
// IMPORTAR · datos.json (de Supabase) → MySQL del hosting
// Corrérselo UNA vez, después de exportar y después de haber importado
// schema.mysql.sql + los seeds en phpMyAdmin.
//
//   MYSQL_HOST=localhost MYSQL_USER=ctp_logistica \
//   MYSQL_PASSWORD=... MYSQL_DATABASE=ctp_logistica npm run importar
//
// Inserta con INSERT IGNORE: se puede repetir sin duplicar. El historial entra
// después que las solicitudes porque tiene clave foránea.
// ============================================================================

import { readFileSync } from 'node:fs'
import mysql from 'mysql2/promise'

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || '',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || '',
  multipleStatements: false,
}

if (!config.user || !config.database) {
  console.error('Faltan MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE.')
  process.exit(1)
}

const datos = JSON.parse(readFileSync(new URL('./datos.json', import.meta.url), 'utf8'))

const conexion = await mysql.createConnection(config)

// La sesión en UTC replica el timestamptz de Postgres, para que las marcas de
// agua (actualizado_en) que compara el frontend no cambien de huso.
await conexion.query("SET time_zone = '+00:00'")
// Lotes: los permisos de cPanel suelen limitar packet_allowed_packet a 16 MB.
await conexion.query('SET SESSION sql_mode = ""')

// Inserta en lotes de N filas, tolerando claves duplicadas.
async function insertarLotes(tabla, columnas, filas) {
  const LOTE = 200
  let insertadas = 0
  for (let i = 0; i < filas.length; i += LOTE) {
    const trozo = filas.slice(i, i + LOTE)
    const marcadores = trozo
      .map(() => `(${columnas.map(() => '?').join(',')})`)
      .join(',')
    const plano = trozo.flatMap((f) => columnas.map((c) => f[c] ?? null))
    await conexion.query(
      `INSERT IGNORE INTO ${tabla} (${columnas.join(',')}) VALUES ${marcadores}`,
      plano
    )
    insertadas += trozo.length
  }
  console.log(`  ${tabla}: ${insertadas} fila(s)`)
}

// Las columnas se fijan a mano (no se usa information_schema) para que el
// importador no dependa del orden en que MySQL reportó las de Postgres.
const COL_SOLICITUDES = [
  'codigo', 'fecha_subida', 'hora_subida', 'tipo_solicitud', 'cliente', 'nit',
  'bodega', 'zona', 'cedula', 'orden_compra', 'observaciones', 'adjuntos',
  'solicitante_nombre', 'solicitante_correo', 'estado', 'asignado_a',
  'asignado_correo', 'conductor', 'conductor_correo', 'vehiculo', 'placa',
  'numero_referencia', 'creado_por', 'creado_en', 'actualizado_en',
  'pendiente_sync',
]

const COL_HISTORIAL = [
  'id', 'solicitud', 'campo', 'anterior', 'nuevo', 'nota', 'referencia',
  'adjunto', 'conductor', 'vehiculo', 'placa', 'evidencia_url', 'encuesta',
  'persona', 'fecha', 'hora', 'creado_en',
]

console.log('Importando datos...')
await insertarLotes('usuarios', ['id', 'correo', 'nombre', 'rol', 'vehiculo', 'placa', 'es_conductor', 'activo', 'creado_en'], datos.usuarios || [])
await insertarLotes('clientes', ['nit', 'nombre', 'bodega', 'zona'], datos.clientes || [])
await insertarLotes('solicitudes', COL_SOLICITUDES, datos.solicitudes || [])
// historial al final: su FK apunta a solicitudes.codigo
await insertarLotes('historial', COL_HISTORIAL, datos.historial || [])

// El contador debe quedar en el siguiente número libre tras el código más alto.
await conexion.query(
  `UPDATE contadores
      SET valor = GREATEST(
        COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(codigo, '[^0-9]', 'g') AS UNSIGNED))
                    FROM solicitudes WHERE codigo REGEXP '^CTPLOG-[0-9]+$'), 0) + 1,
        1)
    WHERE nombre = 'solicitudes_codigo'`
)
const [[contador]] = await conexion.query(
  "SELECT valor FROM contadores WHERE nombre = 'solicitudes_codigo'"
)
const [[maxCodigo]] = await conexion.query(
  "SELECT MAX(codigo) AS c FROM solicitudes WHERE codigo REGEXP '^CTPLOG-[0-9]+$'"
)

await conexion.end()
console.log(`\nOK  contador sincronizado: siguiente código = CTPLOG-${String(contador.valor).padStart(5, '0')}`)
console.log(`    código más alto importado: ${maxCodigo.c || '(ninguno)'}`)
console.log('\nSiguiente paso: sube el backend (server/) y el frontend (dist/).')
