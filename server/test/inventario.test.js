// ============================================================================
// Pruebas de la sección de Inventario de rutas (server/src/routes.js).
// ============================================================================
// Lo que se comprueba aquí es la semántica acordada del módulo:
//   · el conductor NO ve el inventario (403) ni en GET ni en POST,
//   · subir solo lo pueden los roles privilegiados (administrador/superadmin),
//   · cada subida REEMPLAZA el inventario completo (DELETE + INSERT),
//   · lo que no es fecha válida se guarda vacía y no rompe la subida,
//   · no subir nada (o pasar de 20.000 filas) responde 400,
//   · la tabla se crea sola en el primer uso.
//
// MySQL se sustituye por un pool falso: no toca la base ni la red, solo Node.
//   Uso:  node test/inventario.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'secreto-de-prueba'
process.env.FIRMA_SECRET = 'secreto-de-prueba'
process.env.DB_USER = 'prueba'
process.env.DB_PASSWORD = 'prueba'
process.env.DB_NAME = 'prueba'

const express = require('express')
const db = require('../src/db')

// ---------------------------------------------------------------------------
// Pool falso
// ---------------------------------------------------------------------------
// Responde por forma de la consulta. Los estados (rol del usuario, filas
// guardadas, errores) los fija cada prueba antes de llamar.
const estado = {
  rol: 'superadmin',
  filas: [],
  creada: false,
  actualizadoEn: '2026-10-06 12:34:56.789',
  borrar: true, // si el DELETE llega a ejecutarse
  errorInsert: false,
  ejecutadas: [],
}

function fila(extra) {
  return Object.assign({
    id: 1,
    numero_articulo: 'A-1',
    descripcion: 'ARTICULO',
    lote: 'L1',
    fecha_vencimiento: '2027-01-15',
    cantidad: '10',
    dias_inventario: 120,
    bodega: '1',
    nombre_bodega: 'PRINCIPAL',
    zona: 'BOGOTA',
    grupo_articulos: 'MEDICAMENTOS',
    tipo_bodega: 'SECA',
    comercial: 'SI',
  }, extra)
}

async function ejecutar(sql, params) {
  estado.ejecutadas.push([sql, params])
  const s = sql.replace(/\s+/g, ' ').trim()

  if (s.startsWith('SELECT correo, nombre, rol, activo FROM usuarios')) {
    return [[{ correo: 'x@ctpmedica.com', nombre: 'X', rol: estado.rol, activo: 1 }], []]
  }
  if (s.startsWith('CREATE TABLE IF NOT EXISTS inventario')) {
    estado.creada = true
    return [[], []]
  }
  if (s.startsWith('SELECT id, numero_articulo')) {
    return [estado.filas, []]
  }
  if (s.startsWith('SELECT MAX(creado_en)')) {
    return [[{ actualizado_en: estado.actualizadoEn }], []]
  }
  if (s.startsWith('DELETE FROM inventario')) {
    if (estado.borrar) estado.filas = []
    return [{ affectedRows: estado.filas.length }, []]
  }
  if (s.startsWith('INSERT INTO inventario')) {
    if (estado.errorInsert) {
      const e = new Error("Data too long for column 'lote'")
      e.code = 'ER_DATA_TOO_LONG'
      throw e
    }
    return [{ insertId: 1, affectedRows: params.length / 12 }, []]
  }
  throw new Error(`Consulta no simulada: ${s}`)
}

// POST necesita una conexión con transacción (begin/commit/rollback).
const conexionFalsa = {
  beginTransaction: async () => { estado.ejecutadas.push(['BEGIN', []]) },
  commit: async () => { estado.ejecutadas.push(['COMMIT', []]) },
  rollback: async () => { estado.ejecutadas.push(['ROLLBACK', []]) },
  release: () => { estado.ejecutadas.push(['RELEASE', []]) },
  execute: ejecutar,
}

db.pool = {
  execute: ejecutar,
  query: ejecutar,
  getConnection: async () => conexionFalsa,
}

// routes.js hace `const { pool } = require('./db')` al cargarse, así que el pool
// falso tiene que estar puesto ANTES de ese require.
const { protegido, reiniciarInventarioPruebas } = require('../src/routes')

// ---------------------------------------------------------------------------
// Servidor de pruebas
// ---------------------------------------------------------------------------
const app = express()
// Mismo límite que server/src/index.js: una subida de 20.000 filas pesa varios MB.
app.use(express.json({ limit: '25mb' }))
// Sustituye a autenticar(): aquí lo que interesa son los permisos, no el token.
app.use((req, _res, next) => {
  req.correo = 'x@ctpmedica.com'
  req.nombreToken = 'X'
  next()
})
app.use('/api', protegido)

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

let servidor
let base

async function pedir(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, headers: {} }
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json'
    opciones.body = JSON.stringify(cuerpo)
  }
  const r = await fetch(base + ruta, opciones)
  let datos = null
  const texto = await r.text()
  try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
  return { estado: r.status, datos }
}

function reiniciar() {
  estado.rol = 'superadmin'
  estado.filas = [fila({})]
  estado.creada = false
  estado.actualizadoEn = '2026-10-06 12:34:56.789'
  estado.borrar = true
  estado.errorInsert = false
  estado.ejecutadas = []
}

const consultoInventario = (sql) => /inventario/i.test(sql)

// --------------------------------------------------------------- lectura
probar('GET /inventario devuelve las filas guardadas', async () => {
  reiniciar()
  const r = await pedir('GET', '/api/inventario')
  assert.equal(r.estado, 200)
  assert.ok(Array.isArray(r.datos.filas))
  assert.equal(r.datos.filas[0].numero_articulo, 'A-1')
  assert.equal(r.datos.filas[0].fecha_vencimiento, '2027-01-15')
})

probar('GET /inventario informa la fecha de la última subida', async () => {
  reiniciar()
  estado.actualizadoEn = '2026-10-06 09:00:00.000'
  const r = await pedir('GET', '/api/inventario')
  assert.equal(r.estado, 200)
  assert.equal(r.datos.actualizadoEn, '2026-10-06 09:00:00.000')
  assert.equal(r.datos.filas.length, 1)
})

probar('GET /inventario lo puede leer un solicitante', async () => {
  reiniciar()
  estado.rol = 'solicitante'
  const r = await pedir('GET', '/api/inventario')
  assert.equal(r.estado, 200)
})

probar('GET /inventario devuelve la fecha como texto aaaa-mm-dd (sin desfase horario)', async () => {
  reiniciar()
  await pedir('GET', '/api/inventario')
  const lectura = estado.ejecutadas.find(([sql]) => sql.startsWith('SELECT id, numero_articulo'))
  assert.match(lectura[0], /DATE_FORMAT\(fecha_vencimiento, '%Y-%m-%d'\)/)
})

// --------------------------------------------------------------- permisos
probar('GET /inventario: el conductor recibe 403 y no consulta la tabla', async () => {
  reiniciar()
  estado.rol = 'conductor'
  const r = await pedir('GET', '/api/inventario')
  assert.equal(r.estado, 403)
  assert.equal(estado.ejecutadas.some(([sql]) => consultoInventario(sql) && !sql.includes('usuarios')), false)
})

probar('POST /inventario: el conductor recibe 403', async () => {
  reiniciar()
  estado.rol = 'conductor'
  const r = await pedir('POST', '/api/inventario', { filas: [fila({})] })
  assert.equal(r.estado, 403)
})

probar('POST /inventario: el solicitante recibe 403 (solo sube admin/super)', async () => {
  reiniciar()
  estado.rol = 'solicitante'
  const r = await pedir('POST', '/api/inventario', { filas: [fila({})] })
  assert.equal(r.estado, 403)
})

probar('ningún rol no privilegiado llega al borrado ni a la inserción', async () => {
  for (const rol of ['solicitante', 'conductor', '']) {
    reiniciar()
    estado.rol = rol
    await pedir('POST', '/api/inventario', { filas: [fila({})] })
    const escribio = estado.ejecutadas.some(([sql]) =>
      sql.startsWith('DELETE FROM inventario') || sql.startsWith('INSERT INTO inventario'))
    assert.equal(escribio, false, `el rol ${rol} llegó a la escritura`)
  }
})

probar('POST /inventario sí lo acepta un administrador', async () => {
  reiniciar()
  estado.rol = 'administrador'
  const r = await pedir('POST', '/api/inventario', { filas: [fila({})] })
  assert.equal(r.estado, 201)
})

// --------------------------------------------------------------- subir
probar('POST /inventario reemplaza todo: borra y responde { ok, total }', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', { filas: [fila({}), fila({ id: 2 })] })
  assert.equal(r.estado, 201)
  assert.deepEqual(r.datos, { ok: true, total: 2 })
  const borrado = estado.ejecutadas.filter(([sql]) => sql.startsWith('DELETE FROM inventario'))
  assert.equal(borrado.length, 1, 'se esperaba un único DELETE (reemplazo completo)')
  assert.ok(estado.ejecutadas.some(([sql]) => sql === 'COMMIT'))
})

probar('POST /inventario guarda las 12 columnas en el orden esperado', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', { filas: [fila({})] })
  assert.equal(r.estado, 201)
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO inventario'))
  assert.deepEqual(insercion[1], [
    'A-1', 'ARTICULO', 'L1', '2027-01-15', '10', 120,
    '1', 'PRINCIPAL', 'BOGOTA', 'MEDICAMENTOS', 'SECA', 'SI',
  ])
})

probar('POST /inventario con fecha inválida la guarda vacía (NULL) sin fallar', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', {
    filas: [fila({ fecha_vencimiento: '31/12/2027' })],
  })
  assert.equal(r.estado, 201)
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO inventario'))
  assert.equal(insercion[1][3], null)
})

probar('POST /inventario recorta y aplana los textos antes de guardar', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', {
    filas: [fila({ descripcion: '  CLORO   FISOL  ', lote: '  L-9  ' })],
  })
  assert.equal(r.estado, 201)
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO inventario'))
  assert.equal(insercion[1][1], 'CLORO FISOL')
  assert.equal(insercion[1][2], 'L-9')
})

probar('POST /inventario convierte dias_inventario a entero tolerando 1.234', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', {
    filas: [fila({ dias_inventario: '1.234' })],
  })
  assert.equal(r.estado, 201)
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO inventario'))
  assert.equal(insercion[1][5], 1234)
})

probar('POST /inventario vacío responde 400 y no borra nada', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', { filas: [] })
  assert.equal(r.estado, 400)
  assert.equal(estado.ejecutadas.some(([sql]) => sql.startsWith('DELETE FROM inventario')), false)
})

probar('POST /inventario sin filas responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/inventario', {})
  assert.equal(r.estado, 400)
})

probar('POST /inventario con más de 20.000 filas responde 400', async () => {
  reiniciar()
  const filas = Array.from({ length: 20001 }, (_, i) => fila({ id: i }))
  const r = await pedir('POST', '/api/inventario', { filas })
  assert.equal(r.estado, 400)
  assert.match(r.datos.error, /20.000/)
})

probar('POST /inventario acotado a 20.000 filas sí se acepta', async () => {
  reiniciar()
  const filas = Array.from({ length: 20000 }, () => fila({}))
  const r = await pedir('POST', '/api/inventario', { filas })
  assert.equal(r.estado, 201)
  assert.equal(r.datos.total, 20000)
})

// --------------------------------------------------------------- transacción
probar('si la inserción falla se hace rollback y NO se responde 201', async () => {
  reiniciar()
  estado.errorInsert = true
  const r = await pedir('POST', '/api/inventario', { filas: [fila({})] })
  assert.equal(r.estado, 500)
  assert.ok(estado.ejecutadas.some(([sql]) => sql === 'ROLLBACK'))
  assert.equal(estado.ejecutadas.some(([sql]) => sql === 'COMMIT'), false)
})

// --------------------------------------------------------------- tabla sola
probar('la tabla se crea sola en el primer GET', async () => {
  reiniciar()
  reiniciarInventarioPruebas()
  await pedir('GET', '/api/inventario')
  assert.equal(estado.creada, true)
})

probar('la tabla se crea sola antes de la primera subida', async () => {
  reiniciar()
  reiniciarInventarioPruebas()
  await pedir('POST', '/api/inventario', { filas: [fila({})] })
  const creacion = estado.ejecutadas.findIndex(([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS inventario'))
  const borrado = estado.ejecutadas.findIndex(([sql]) => sql.startsWith('DELETE FROM inventario'))
  assert.ok(creacion !== -1, 'no se intentó crear la tabla')
  assert.ok(borrado !== -1, 'no se ejecutó el DELETE')
  assert.ok(creacion < borrado, 'la tabla debe crearse antes de escribir en ella')
})

probar('una vez creada no se vuelve a crear la tabla en cada llamada', async () => {
  reiniciar()
  reiniciarInventarioPruebas()
  await pedir('GET', '/api/inventario')
  estado.creada = false
  await pedir('GET', '/api/inventario')
  assert.equal(estado.creada, false, 'la segunda llamada no debería intentar crearla otra vez')
})

// --------------------------------------------------------------- arranque
async function main() {
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${servidor.address().port}`

  let pasadas = 0
  const fallos = []
  for (const [nombre, fn] of pruebas) {
    reiniciar()
    try {
      await fn()
      pasadas++
    } catch (e) {
      fallos.push([nombre, e])
    }
  }
  servidor.close()

  console.log(`\ninventario · rutas: ${pasadas}/${pruebas.length} correctas`)
  for (const [nombre, e] of fallos) {
    console.error(`  FALLO: ${nombre}`)
    console.error(`         ${e && e.message}`)
  }
  process.exit(fallos.length === 0 ? 0 : 1)
}

main()
