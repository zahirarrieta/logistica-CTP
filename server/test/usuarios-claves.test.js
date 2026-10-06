// ============================================================================
// Pruebas de POST /usuarios/:correo/restablecer-clave (server/src/routes.js).
// ============================================================================
// Lo que se comprueba aquí es la semántica acordada:
//   · SOLO la cuenta sistemas@ctpmedica.com puede restablecer (403 para el
//     resto, incluidos los demás superadmins),
//   · sin cuerpo se deja la clave predeterminada CTP2026 (7 caracteres, la
//     única excepción a la regla de mínimo 8),
//   · una clave personalizada se exige con mínimo 8 como en toda la app,
//   · el hash que se guarda es scrypt y verifica contra la clave nueva,
//   · un usuario inexistente responde 404 y NO se ejecuta ningún UPDATE.
//
// MySQL se sustituye por un pool falso: no toca la base ni la red, solo Node.
//   Uso:  node test/usuarios-claves.test.js
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
// Responde por forma de la consulta. Quién llama (rol/correo), qué usuarios
// existen y qué hash se guardó los fija cada prueba antes de llamar.
const estado = {
  correoLlamador: 'sistemas@ctpmedica.com',
  rol: 'superadmin',
  usuarios: new Set(['pedidos@ctpmedica.com']),
  hashGuardado: null,
  updates: 0,
}

async function ejecutar(sql, params) {
  const s = sql.replace(/\s+/g, ' ').trim()

  // permisos.contexto (rol del que llama)
  if (s.startsWith('SELECT correo, nombre, rol, activo FROM usuarios')) {
    return [[{ correo: estado.correoLlamador, nombre: 'Llamador', rol: estado.rol, activo: 1 }], []]
  }
  // ¿Existe el usuario destino?
  if (s.startsWith('SELECT correo FROM usuarios WHERE correo')) {
    const destino = String(params[0] || '').toLowerCase()
    return [estado.usuarios.has(destino) ? [{ correo: destino }] : [], []]
  }
  // UPDATE de la clave nueva
  if (s.startsWith('UPDATE usuarios SET password_hash')) {
    estado.hashGuardado = params[0]
    estado.updates += 1
    return [{ affectedRows: 1 }, []]
  }
  throw new Error(`Consulta no simulada: ${s}`)
}

db.pool = {
  execute: ejecutar,
  query: ejecutar,
  getConnection: async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: ejecutar,
  }),
}

// El pool falso tiene que estar puesto ANTES del require de routes.
const { protegido } = require('../src/routes')
const C = require('../src/contrasenas')

// ---------------------------------------------------------------------------
// Servidor de pruebas
// ---------------------------------------------------------------------------
const app = express()
app.use(express.json({ limit: '1mb' }))
// Sustituye a autenticar(): aquí lo que interesa son los permisos, no el token.
// El correo se lee del estado en cada petición para poder cambiar de llamador.
app.use((req, _res, next) => {
  req.correo = estado.correoLlamador
  req.nombreToken = 'Llamador'
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
  estado.correoLlamador = 'sistemas@ctpmedica.com'
  estado.rol = 'superadmin'
  estado.usuarios = new Set(['pedidos@ctpmedica.com'])
  estado.hashGuardado = null
  estado.updates = 0
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
probar('sistemas restablece con la clave predeterminada (CTP2026)', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave', {})
  assert.equal(r.estado, 200)
  assert.deepEqual(r.datos, { ok: true, predeterminada: true })
  assert.equal(estado.updates, 1)
  // Se guarda un hash scrypt, nunca la clave en claro…
  assert.match(estado.hashGuardado, /^scrypt\$/)
  // …y ese hash verifica contra CTP2026 (7 caracteres, la excepción permitida).
  assert.equal(await C.verificar('CTP2026', estado.hashGuardado), true)
})

probar('sin cuerpo también se usa la predeterminada', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave')
  assert.equal(r.estado, 200)
  assert.equal(r.datos.predeterminada, true)
  assert.equal(await C.verificar('CTP2026', estado.hashGuardado), true)
})

probar('clave personalizada válida (8+ caracteres)', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave', {
    contrasena: 'MiClave1234',
  })
  assert.equal(r.estado, 200)
  assert.deepEqual(r.datos, { ok: true, predeterminada: false })
  assert.equal(await C.verificar('MiClave1234', estado.hashGuardado), true)
  // La predeterminada ya NO es la que quedó guardada.
  assert.equal(await C.verificar('CTP2026', estado.hashGuardado), false)
})

probar('clave personalizada corta (menos de 8) se rechaza sin tocar la base', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave', {
    contrasena: 'corta',
  })
  assert.equal(r.estado, 400)
  assert.match(r.datos.error, /8 caracteres/)
  assert.equal(estado.updates, 0)
})

probar('otro superadmin NO puede restablecer (403)', async () => {
  reiniciar()
  estado.correoLlamador = 'almacen@ctpmedica.com'
  estado.rol = 'superadmin'
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave', {})
  assert.equal(r.estado, 403)
  assert.equal(estado.updates, 0)
})

probar('un solicitante NO puede restablecer (403)', async () => {
  reiniciar()
  estado.correoLlamador = 'cualquiera@ctpmedica.com'
  estado.rol = 'solicitante'
  const r = await pedir('POST', '/api/usuarios/pedidos@ctpmedica.com/restablecer-clave', {})
  assert.equal(r.estado, 403)
  assert.equal(estado.updates, 0)
})

probar('usuario inexistente responde 404 y no escribe nada', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/nadie@ctpmedica.com/restablecer-clave', {})
  assert.equal(r.estado, 404)
  assert.equal(estado.updates, 0)
})

probar('el correo destino se compara en minúsculas', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/usuarios/PEDIDOS@CTPMEDICA.COM/restablecer-clave', {})
  assert.equal(r.estado, 200)
  assert.equal(estado.updates, 1)
})

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  await new Promise((resolver) => {
    servidor = app.listen(0, () => {
      base = `http://127.0.0.1:${servidor.address().port}`
      resolver()
    })
  })

  let correctas = 0
  for (const [nombre, fn] of pruebas) {
    try {
      await fn()
      correctas += 1
    } catch (error) {
      console.error(`\nFALLO · ${nombre}`)
      console.error(error)
    }
  }

  await new Promise((resolver) => servidor.close(resolver))

  if (correctas !== pruebas.length) {
    console.error(`usuarios-claves · rutas: ${correctas}/${pruebas.length} correctas`)
    process.exit(1)
  }
  console.log(`usuarios-claves · rutas: ${correctas}/${pruebas.length} correctas`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
