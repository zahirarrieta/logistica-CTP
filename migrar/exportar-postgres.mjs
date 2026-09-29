// ============================================================================
// EXPORTAR · Supabase (Postgres) → JSON
// Corrérselo UNA vez, antes de dar de baja el proyecto en Supabase.
//
//   1. Supabase > Settings > Database > Connection string > URI (session)
//   2. npm run exportar
//
// Escribe datos.json con las 4 tablas. No borra nada de Supabase.
// ============================================================================

import { writeFileSync } from 'node:fs'
import pg from 'pg'

const CONEXION = process.env.PG_CONNECTION
if (!CONEXION) {
  console.error(
    'Falta la variable de entorno PG_CONNECTION.\n' +
      'Supabase > Settings > Database > Connection string > URI (session mode).'
  )
  process.exit(1)
}

const cliente = new pg.Client({
  connectionString: CONEXION,
  ssl: { rejectUnauthorized: false },
})

// `pg` devuelve los tipos de Postgres crudos; se normalizan a tipos de MySQL:
//   timestamptz → 'YYYY-MM-DD HH:MM:SS.mmm' en UTC
//   jsonb      → texto (el importador lo vuelve a parsear)
//   text[]     → array
//   boolean    → 0 / 1
function alMysql(valor) {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 23).replace('T', ' ')
  if (Buffer.isBuffer(valor)) return valor.toString('base64')
  if (Array.isArray(valor)) return valor.map(alMysql)
  if (typeof valor === 'boolean') return valor ? 1 : 0
  if (typeof valor === 'object') return JSON.stringify(valor)
  return valor
}

async function volcar(consulta) {
  const res = await cliente.query(consulta)
  console.log(`  ${consulta.match(/from\s+(\w+)/i)?.[1] || '?'}: ${res.rows.length} fila(s)`)
  return res.rows.map((fila) => {
    const salida = {}
    for (const [k, v] of Object.entries(fila)) salida[k] = alMysql(v)
    return salida
  })
}

await cliente.connect()
console.log('Conectado a Postgres.')

const datos = {
  exportado_en: new Date().toISOString(),
  usuarios: await volcar('SELECT * FROM public.usuarios'),
  clientes: await volcar('SELECT * FROM public.clientes'),
  solicitudes: await volcar('SELECT * FROM public.solicitudes'),
  historial: await volcar('SELECT * FROM public.historial'),
}

await cliente.end()

writeFileSync('datos.json', JSON.stringify(datos, null, 2), 'utf8')
const total = datos.solicitudes.length + datos.historial.length
console.log(`\nOK  datos.json escrito (${total} registros de solicitudes + historial).`)
console.log('Siguiente paso: configura MYSQL_* y corre `npm run importar`.')
