// Conversión de los seeds de Postgres (supabase/*.sql) a MySQL.
// Uso:  node server/sql/convertir-seeds.mjs
//
// Se ejecuta una sola vez, al preparar la base en el hosting. Lee los .sql de
// supabase/ como UTF-8 (los nombres traen tildes y ñ) y escribe los .sql de
// server/sql/ listos para importar en phpMyAdmin.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..', '..')

const leer = (p) => readFileSync(join(RAIZ, p), 'utf8')

// Postgres escribe los booleanos como true/false; MySQL como 1/0.
const booleanos = (s) => s.replace(/\btrue\b/g, '1').replace(/\bfalse\b/g, '0')

// ---------------------------------------------------------------- clientes
function convertirClientes() {
  const sql = leer('supabase/seed_clientes.sql')
  const salida = `-- ============================================================================
-- Seed de clientes (MySQL) — generado desde supabase/seed_clientes.sql
-- ${(sql.match(/^\s*\('/gm) || []).length} registros. Importar en phpMyAdmin.
-- INSERT IGNORE evita el error de clave duplicada si se re-importa.
-- ============================================================================

SET NAMES utf8mb4;

${booleanos(
    sql
      .replace(/^--.*$/gm, '')
      .replace(/INSERT INTO public\.clientes/gi, 'INSERT IGNORE INTO clientes')
      .replace(/ON CONFLICT \(nit, bodega\) DO NOTHING;?/gi, ';')
      .replace(/INSERT INTO\s+public\./gi, 'INSERT INTO ')
      .trim()
  )}
`
  writeFileSync(join(AQUI, 'seed_clientes.mysql.sql'), salida, 'utf8')
  return (sql.match(/^\s*\('/gm) || []).length
}

// ---------------------------------------------------------------- usuarios
function convertirUsuarios() {
  const sql = leer('supabase/seed_usuarios.sql')
  const cuerpo = sql
    // El schema ya crea la tabla; la sentencia ALTER no existe en MySQL.
    .replace(/alter table[^;]+;/gi, '')
    .replace(/--.*$/gm, '')
    .trim()

  // Cada fila de VALUES necesita el id (UUID()), que en Postgres lo generaba
  // el DEFAULT de la columna. Se inserta tras el paréntesis de apertura; la
  // declaración de la columna se agrega más abajo, cuando ya sin el prefijo
  // `public.`.
  const conId = cuerpo.replace(/^(\s*)\(\s*'/gm, "$1(UUID(), '")

  // `ON CONFLICT (x) DO UPDATE SET a = excluded.a, b = true` →
  //   `ON DUPLICATE KEY UPDATE a = VALUES(a), b = true`
  // Solo lo que viene de `excluded.` se traduce; los literales (activo = true)
  // se dejan intactos para que booleanos() los convierta a 1/0.
  const onDuplicate = conId.replace(
    /on conflict \([^)]*\) do update\s+set\s+([\s\S]*?);?\s*$/i,
    (__, assignments) => {
      const pares = assignments
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [col, valor] = p.split('=').map((x) => x.trim())
          if (/^excluded\./i.test(valor)) {
            return `${col} = VALUES(${valor.replace(/^excluded\./i, '')})`
          }
          return `${col} = ${valor}`
        })
        .join(',\n     ')
      return `ON DUPLICATE KEY UPDATE\n     ${pares};`
    }
  )

  const salida = `-- ============================================================================
-- Seed de usuarios (MySQL) — generado desde supabase/seed_usuarios.sql
-- Asigna el correo, rol, vehículo y placa de cada integrante del equipo.
-- Importar DESPUÉS de schema.mysql.sql. Seguro de re-ejecutar.
--
-- es_conductor = 1 marca a quienes hacen entregas, aunque su rol principal
-- sea otro (p. ej. los administradores que también conducen moto). Aparecen en
-- la lista de conductores de los modales.
-- ============================================================================

SET NAMES utf8mb4;

${booleanos(
    onDuplicate
      .replace(/insert into\s+public\./gi, 'INSERT INTO ')
      .replace(/insert into/gi, 'INSERT INTO')
      // Las filas llevan UUID() como primer valor, así que `id` tiene que estar
      // en la lista de columnas o MySQL complains de recuento desalineado.
      .replace(/INSERT INTO usuarios\s*\(/i, 'INSERT INTO usuarios (id, ')
  )}
`
  writeFileSync(join(AQUI, 'seed_usuarios.mysql.sql'), salida, 'utf8')
  return (sql.match(/^\s*\('/gm) || []).length
}

const nClientes = convertirClientes()
const nUsuarios = convertirUsuarios()
console.log(`OK  seed_clientes.mysql.sql  ${nClientes} registros`)
console.log(`OK  seed_usuarios.mysql.sql  ${nUsuarios} registros`)
