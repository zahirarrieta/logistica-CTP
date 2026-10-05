// ============================================================================
// Verificación estática: comprueba que las columnas que el backend da por
// buenas existan realmente en schema.mysql.sql.
//
// No sustituye a probar contra un MySQL real (esto no abre ninguna conexión),
// pero atrapa los "Unknown column 'xyz'" que solo se verían en producción.
//
//   Uso:  node server/sql/verificar-columnas.mjs
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SERVER = join(AQUI, '..')

// ---------------------------------------------------- 1. columnas del schema
const schema = readFileSync(join(SERVER, 'sql/schema.mysql.sql'), 'utf8')
const tablas = {}
for (const bloque of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\)\s*ENGINE=/gi)) {
  const [, tabla, cuerpo] = bloque
  const columnas = new Set()
  for (const linea of cuerpo.split('\n')) {
    const m = linea.match(/^\s{2}(\w+)\s+(?:CHAR|VARCHAR|TEXT|JSON|BIGINT|INT|TINYINT|DATETIME|DECIMAL)/i)
    if (m) columnas.add(m[1].toLowerCase())
  }
  tablas[tabla.toLowerCase()] = columnas
}
console.log(`Tablas detectadas: ${Object.keys(tablas).map((t) => `${t}(${tablas[t].size})`).join(', ')}\n`)

// ------------------------------------- 2. columnas que el backend necesita
// Esta lista es el contrato: si agregas una columna al backend, agrégala aquí.
const esperadas = {
  solicitudes: [
    'codigo', 'fecha_subida', 'hora_subida', 'tipo_solicitud', 'cliente', 'nit', 'bodega',
    'zona', 'cedula', 'orden_compra', 'observaciones', 'adjuntos', 'solicitante_nombre',
    'solicitante_correo', 'estado', 'asignado_a', 'asignado_correo', 'conductor',
    'conductor_correo', 'vehiculo', 'placa', 'numero_referencia', 'creado_por', 'creado_en',
    'actualizado_en', 'pendiente_sync',
  ],
  historial: [
    'id', 'solicitud', 'campo', 'anterior', 'nuevo', 'nota', 'referencia', 'adjunto',
    'conductor', 'vehiculo', 'placa', 'evidencia_url', 'encuesta', 'persona', 'fecha',
    'hora', 'creado_en',
  ],
  usuarios: ['id', 'correo', 'nombre', 'rol', 'vehiculo', 'placa', 'es_conductor', 'activo', 'creado_en'],
  clientes: ['id', 'nit', 'nombre', 'bodega', 'zona'],
  contadores: ['nombre', 'valor'],
  codigos_reservados: ['codigo', 'correo', 'creado_en'],
  // La crea la propia API si no existe (correo.js), pero si está en el schema
  // tiene que tener estas columnas: es donde se reserva cada aviso para no
  // mandarlo dos veces.
  correos_enviados: ['clave', 'tipo', 'solicitud', 'destinatario', 'asunto', 'enviado_en'],
}

let problemas = 0
for (const [tabla, columnas] of Object.entries(esperadas)) {
  const definidas = tablas[tabla]
  if (!definidas) {
    console.log(`FALTA LA TABLA en el schema: ${tabla}`)
    problemas++
    continue
  }
  const faltan = columnas.filter((c) => !definidas.has(c))
  const sobran = [...definidas].filter((c) => !columnas.includes(c))
  if (faltan.length) {
    console.log(`FALTA en el schema → ${tabla}: ${faltan.join(', ')}`)
    problemas++
  }
  if (sobran.length) {
    console.log(`En el schema pero sin usar → ${tabla}: ${sobran.join(', ')}`)
  }
}

// ------------------------------------- 3. funciones que piden MySQL 8
// REGEXP_REPLACE no existe en 5.7; si vuelve a usarse en una consulta, el
// endpoint fallaría solo en el hosting. Se ignoran los comentarios para no
// dar falsos positivos con las notas que explican justo esto.
const soloMySQL8 = ['REGEXP_REPLACE', 'REGEXP_SUBSTR', 'REGEXP_INSTR', 'JSON_TABLE']
for (const archivo of readdirSync(join(SERVER, 'src')).filter((f) => f.endsWith('.js'))) {
  const codigo = readFileSync(join(SERVER, 'src', archivo), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const fn of soloMySQL8) {
    if (new RegExp(`\\b${fn}\\b`, 'i').test(codigo)) {
      console.log(`\u26A0 ${archivo} usa ${fn}, que no existe en MySQL 5.7`)
      problemas++
    }
  }
}

console.log(problemas === 0 ? '\nOK  backend y schema coinciden' : `\n${problemas} problema(s) por revisar`)
process.exit(problemas === 0 ? 0 : 1)
