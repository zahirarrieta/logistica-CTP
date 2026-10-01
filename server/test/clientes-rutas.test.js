// ============================================================================
// Pruebas de las rutas del catálogo de clientes (server/src/routes.js).
// ============================================================================
// Lo que se comprueba aquí es justo lo que no se ve mirando el código: que un
// 'administrador' NO pueda escribir aunque antes sí pudiera, que un duplicado
// devuelva 409 y no un 500, y que editar o borrar una fila que no existe
// responda 404 en vez de decir "ok" y no hacer nada.
//
// MySQL se sustituye por un pool falso: no toca la base ni la red, solo Node.
//   Uso:  node test/clientes-rutas.test.js
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
// Responde por forma de la consulta, que es lo único que hay que reconocer. Los
// estados (rol del usuario, fila que existe, duplicado) los fija cada prueba
// antes de llamar.
const estado = {
  rol: 'superadmin',
  clientes: [],
  duplicado: false,
  existe: true,
  afectadas: 1,
  ejecutadas: [],
}

function fila(extra) {
  return Object.assign({ id: 1, nit: '900123456', nombre: 'ACME', bodega: '1', zona: 'BOGOTA' }, extra)
}

async function ejecutar(sql, params) {
  estado.ejecutadas.push([sql, params])
  const s = sql.replace(/\s+/g, ' ').trim()

    if (s.startsWith('SELECT correo, nombre, rol, activo FROM usuarios')) {
      return [[{ correo: 'x@ctpmedica.com', nombre: 'X', rol: estado.rol, activo: 1 }], []]
    }
    if (s.startsWith('SELECT id, nit, nombre, bodega, zona FROM clientes')) {
      return [estado.clientes, []]
    }
    if (s.startsWith('SELECT id FROM clientes WHERE id')) {
      return [estado.existe ? [{ id: Number(params[0]) }] : [], []]
    }
    if (s.startsWith('INSERT INTO clientes')) {
      if (estado.duplicado) {
        const e = new Error("Duplicate entry '900123456-1' for key 'clientes_nit_bodega_uq'")
        e.code = 'ER_DUP_ENTRY'
        e.errno = 1062
        throw e
      }
      return [{ insertId: estado.clientes.length + 1, affectedRows: 1 }, []]
    }
    if (s.startsWith('UPDATE clientes SET')) {
      if (estado.duplicado) {
        const e = new Error("Duplicate entry '900123456-1' for key 'clientes_nit_bodega_uq'")
        e.code = 'ER_DUP_ENTRY'
        e.errno = 1062
        throw e
      }
      return [{ affectedRows: 1 }, []]
    }
    if (s.startsWith('DELETE FROM clientes WHERE id')) {
      return [{ affectedRows: estado.afectadas }, []]
    }
    throw new Error(`Consulta no simulada: ${s}`)
}

// El listado usa pool.query y el resto pool.execute: los dos caminos pasan por
// el mismo simulador.
db.pool = {
  execute: ejecutar,
  query: ejecutar,
}

// routes.js hace `const { pool } = require('./db')` al cargarse, así que el pool
// falso tiene que estar puesto ANTES de ese require.
const { protegido } = require('../src/routes')

// ---------------------------------------------------------------------------
// Servidor de pruebas
// ---------------------------------------------------------------------------
const app = express()
app.use(express.json())
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
  estado.clientes = [fila({})]
  estado.duplicado = false
  estado.existe = true
  estado.afectadas = 1
  estado.ejecutadas = []
}

// --------------------------------------------------------------- lectura
probar('GET /clientes devuelve el id, que es lo que usa el CRUD', async () => {
  reiniciar()
  const r = await pedir('GET', '/api/clientes')
  assert.equal(r.estado, 200)
  assert.ok(Array.isArray(r.datos))
  assert.equal(r.datos[0].id, 1)
  assert.equal(r.datos[0].nit, '900123456')
})

probar('GET /clientes lo puede leer un solicitante (lo usa el selector)', async () => {
  reiniciar()
  estado.rol = 'solicitante'
  const r = await pedir('GET', '/api/clientes')
  assert.equal(r.estado, 200)
})

// --------------------------------------------------------------- permisos
probar('POST /clientes: el administrador ya NO puede crear', async () => {
  reiniciar()
  estado.rol = 'administrador'
  const r = await pedir('POST', '/api/clientes', { nit: '1', nombre: 'X' })
  assert.equal(r.estado, 403)
})

probar('PUT /clientes: el administrador ya NO puede editar', async () => {
  reiniciar()
  estado.rol = 'administrador'
  const r = await pedir('PUT', '/api/clientes/1', { nit: '1', nombre: 'X' })
  assert.equal(r.estado, 403)
})

probar('DELETE /clientes: el administrador ya NO puede eliminar', async () => {
  reiniciar()
  estado.rol = 'administrador'
  const r = await pedir('DELETE', '/api/clientes/1')
  assert.equal(r.estado, 403)
})

probar('ningún rol que no sea superadmin llega a la consulta de escritura', async () => {
  for (const rol of ['administrador', 'conductor', 'solicitante', '']) {
    reiniciar()
    estado.rol = rol
    await pedir('POST', '/api/clientes', { nit: '1' })
    const escribio = estado.ejecutadas.some(([sql]) => sql.startsWith('INSERT INTO clientes'))
    assert.equal(escribio, false, `el rol ${rol} llegó al INSERT`)
  }
})

// --------------------------------------------------------------- crear
probar('POST /clientes crea y devuelve 201', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/clientes', {
    nit: '900999', nombre: 'NUEVO', bodega: '2', zona: 'CALI',
  })
  assert.equal(r.estado, 201)
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO clientes'))
  assert.deepEqual(insercion[1], ['900999', 'NUEVO', '2', 'CALI'])
})

probar('POST /clientes recorta los espacios del NIT antes de guardar', async () => {
  reiniciar()
  await pedir('POST', '/api/clientes', { nit: '  900999  ', nombre: ' N ' })
  const insercion = estado.ejecutadas.find(([sql]) => sql.startsWith('INSERT INTO clientes'))
  assert.deepEqual(insercion[1], ['900999', 'N', '', ''])
})

probar('POST /clientes sin NIT responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/clientes', { nombre: 'SIN NIT' })
  assert.equal(r.estado, 400)
})

probar('POST /clientes duplicado responde 409 y no 500', async () => {
  reiniciar()
  estado.duplicado = true
  const r = await pedir('POST', '/api/clientes', { nit: '900123456', nombre: 'X' })
  assert.equal(r.estado, 409)
  assert.match(r.datos.error, /Ya existe/)
})

// --------------------------------------------------------------- editar
probar('PUT /clientes actualiza la fila correcta', async () => {
  reiniciar()
  const r = await pedir('PUT', '/api/clientes/7', {
    nit: '900777', nombre: 'EDITADO', bodega: '9', zona: 'MEDELLIN',
  })
  assert.equal(r.estado, 200)
  const actualizacion = estado.ejecutadas.find(([sql]) => sql.startsWith('UPDATE clientes SET'))
  assert.deepEqual(actualizacion[1], ['900777', 'EDITADO', '9', 'MEDELLIN', 7])
})

probar('PUT /clientes sobre un id inexistente responde 404', async () => {
  reiniciar()
  estado.existe = false
  const r = await pedir('PUT', '/api/clientes/999', { nit: '1', nombre: 'X' })
  assert.equal(r.estado, 404)
})

probar('PUT /clientes no hace el UPDATE si el id no existe', async () => {
  reiniciar()
  estado.existe = false
  await pedir('PUT', '/api/clientes/999', { nit: '1', nombre: 'X' })
  const actualizo = estado.ejecutadas.some(([sql]) => sql.startsWith('UPDATE clientes SET'))
  assert.equal(actualizo, false)
})

probar('PUT /clientes con id no numérico responde 400', async () => {
  reiniciar()
  const r = await pedir('PUT', '/api/clientes/abc', { nit: '1', nombre: 'X' })
  assert.equal(r.estado, 400)
})

probar('PUT /clientes que choca con otro NIT+bodega responde 409', async () => {
  reiniciar()
  estado.duplicado = true
  const r = await pedir('PUT', '/api/clientes/1', { nit: '900123456', nombre: 'X' })
  assert.equal(r.estado, 409)
})

probar('PUT /clientes sin NIT responde 400', async () => {
  reiniciar()
  const r = await pedir('PUT', '/api/clientes/1', { nombre: 'SIN NIT' })
  assert.equal(r.estado, 400)
})

// --------------------------------------------------------------- eliminar
probar('DELETE /clientes borra la fila indicada', async () => {
  reiniciar()
  const r = await pedir('DELETE', '/api/clientes/5')
  assert.equal(r.estado, 200)
  const borrado = estado.ejecutadas.find(([sql]) => sql.startsWith('DELETE FROM clientes'))
  assert.deepEqual(borrado[1], [5])
})

probar('DELETE /clientes que no affecta filas responde 404', async () => {
  reiniciar()
  estado.afectadas = 0
  const r = await pedir('DELETE', '/api/clientes/5')
  assert.equal(r.estado, 404)
})

probar('DELETE /clientes con id no numérico responde 400', async () => {
  reiniciar()
  const r = await pedir('DELETE', '/api/clientes/abc')
  assert.equal(r.estado, 400)
})

// --------------------------------------------------------------- arranque
async function main() {
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${servidor.address().port}`

  let pasadas = 0
  const fallos = []
  for (const [nombre, fn] of pruebas) {
    try {
      await fn()
      pasadas++
    } catch (e) {
      fallos.push([nombre, e])
    }
  }
  servidor.close()

  console.log(`\nclientes · rutas: ${pasadas}/${pruebas.length} correctas`)
  for (const [nombre, e] of fallos) {
    console.error(`  FALLO: ${nombre}`)
    console.error(`         ${e && e.message}`)
  }
  process.exit(fallos.length === 0 ? 0 : 1)
}

main()
