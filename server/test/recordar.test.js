// ============================================================================
// Pruebas del «recordar este equipo» (server/src/rutasAuth.js + auth.js).
// ============================================================================
// Lo importante aquí no es que el login funcione, que ya lo hacía, sino que el
// token de confianza NO se parezca en nada a una contraseña guardada:
//
//   - en la tabla se mete el SHA-256, nunca el token en claro;
//   - sin fila en la tabla el token no vale, aunque el hash cuadre;
//   - un token de una cuenta desactivada se revoca y no entra;
//   - revocar exige sesión y solo toca las filas del correo que entra.
//
// MySQL se sustituye por un pool falso con estado: las filas de
// sesiones_recordadas viven en un array, así que se comprueba el viaje entero
// (emitir -> canjear -> revocar) y no solo que la consulta tenga la forma
// correcta.
//
//   Uso:  node test/recordar.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')

process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'secreto-de-prueba'
process.env.FIRMA_SECRET = 'secreto-de-prueba'
process.env.DB_USER = 'prueba'
process.env.DB_PASSWORD = 'prueba'
process.env.DB_NAME = 'prueba'

const express = require('express')
const db = require('../src/db')
const C = require('../src/contrasenas')

// ---------------------------------------------------------------------------
// Estado que simula MySQL
// ---------------------------------------------------------------------------
const CLAVE = {
  admin: 'admin@ctpmedica.com',
  otro: 'otro@ctpmedica.com',
  clave: 'Clave-Fuerte-2026',
}

const estado = {
  usuarios: new Map(),
  recordadas: [],
  inserts: [],
  ultimoUso: 0,
}

function reiniciar() {
  estado.usuarios = new Map()
  estado.recordadas = []
  estado.inserts = []
  estado.ultimoUso = 0
}

let hashReal = ''

function alta(correo, extra = {}) {
  estado.usuarios.set(correo, Object.assign({
    correo,
    nombre: 'Prueba',
    rol: 'superadmin',
    activo: 1,
    password_hash: hashReal,
  }, extra))
}

const filasDeUsuarios =
  'SELECT correo, nombre, rol, activo, password_hash FROM usuarios WHERE correo = ? LIMIT 1'
// /yo usa su propia versión de la misma consulta, sin el hash.
const filasDeUsuariosSinHash =
  'SELECT correo, nombre, rol, activo FROM usuarios WHERE correo = ? LIMIT 1'

async function ejecutar(sql, params) {
  const s = sql.replace(/\s+/g, ' ').trim()

  if (s === filasDeUsuarios || s === filasDeUsuariosSinHash) {
    const u = estado.usuarios.get(params[0])
    if (!u) return [[], []]
    // /yo no pide el hash: se devuelve la fila sin password_hash.
    return [[s === filasDeUsuarios ? u : {
      correo: u.correo, nombre: u.nombre, rol: u.rol, activo: u.activo,
    }], []]
  }
  if (s.startsWith('DELETE FROM sesiones_recordadas WHERE expira_en')) {
    return [{ affectedRows: 0 }, []]
  }
  if (s.startsWith('INSERT INTO sesiones_recordadas')) {
    estado.inserts.push([s, params])
    estado.recordadas.push({
      id: params[0],
      correo: params[1],
      token_hash: params[2],
      agente: params[3],
      expira_en: Date.now() + 3600e3,
    })
    return [{ affectedRows: 1 }, []]
  }
  if (s.startsWith('SELECT correo FROM sesiones_recordadas')) {
    const f = estado.recordadas.find((r) => r.token_hash === params[0])
    return [f ? [{ correo: f.correo }] : [], []]
  }
  if (s.startsWith('UPDATE sesiones_recordadas SET ultimo_uso')) {
    estado.ultimoUso++
    return [{ affectedRows: 1 }, []]
  }
  if (s === 'DELETE FROM sesiones_recordadas WHERE token_hash = ?') {
    const antes = estado.recordadas.length
    estado.recordadas = estado.recordadas.filter((r) => r.token_hash !== params[0])
    return [{ affectedRows: antes - estado.recordadas.length }, []]
  }
  if (s === 'DELETE FROM sesiones_recordadas WHERE token_hash = ? AND correo = ?') {
    const antes = estado.recordadas.length
    estado.recordadas = estado.recordadas.filter(
      (r) => !(r.token_hash === params[0] && r.correo === params[1])
    )
    return [{ affectedRows: antes - estado.recordadas.length }, []]
  }
  if (s === 'DELETE FROM sesiones_recordadas WHERE correo = ?') {
    const antes = estado.recordadas.length
    estado.recordadas = estado.recordadas.filter((r) => r.correo !== params[0])
    return [{ affectedRows: antes - estado.recordadas.length }, []]
  }
  throw new Error(`Consulta no simulada: ${s}`)
}

db.pool = { execute: ejecutar, query: ejecutar }

require('../src/rutasAuth')

// ---------------------------------------------------------------------------
// Servidor de pruebas
// ---------------------------------------------------------------------------
const app = express()
app.set('trust proxy', true)
app.use(express.json())
app.use('/api/auth', require('../src/rutasAuth'))

let servidor
let base
let contadorIp = 0

// Cada petición va con una IP distinta para no agotar el límite de intentos
// entre pruebas. La que prueba el límite reutiliza la suya a propósito.
async function pedir(metodo, ruta, cuerpo, opciones = {}) {
  const cabeceras = { 'User-Agent': 'Prueba/1.0' }
  cabeceras['X-Forwarded-For'] = opciones.ip || `10.0.0.${++contadorIp % 250 + 1}`
  if (opciones.token) cabeceras.Authorization = `Bearer ${opciones.token}`

  const init = { method: metodo, headers: cabeceras }
  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json'
    init.body = JSON.stringify(cuerpo)
  }

  const r = await fetch(base + ruta, init)
  const texto = await r.text()
  let datos = null
  try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
  return { estado: r.status, datos }
}

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')

// Atajo: deja al admin listo y entra con «recordar» marcado.
async function entrarRecordando(correo = CLAVE.admin) {
  const r = await pedir('POST', '/api/auth/login', {
    correo, contrasena: CLAVE.clave, recordar: true,
  })
  assert.equal(r.estado, 200, `login falló: ${JSON.stringify(r.datos)}`)
  assert.ok(r.datos.confianza, 'no volvió token de confianza')
  return r.datos.confianza.token
}

// =========================================================== emitir el token
probar('login SIN marcar no devuelve token de confianza', async () => {
  reiniciar(); alta(CLAVE.admin)
  const r = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.confianza, null)
  assert.equal(estado.recordadas.length, 0)
})

probar('login marcando «recordar» devuelve token de confianza', async () => {
  reiniciar(); alta(CLAVE.admin)
  const r = await pedir('POST', '/api/auth/login', {
    correo: CLAVE.admin, contrasena: CLAVE.clave, recordar: true,
  })
  assert.equal(r.estado, 200)
  assert.equal(typeof r.datos.confianza.token, 'string')
  assert.ok(r.datos.confianza.token.length > 20)
})

probar('el token es aleatorio en cada login', async () => {
  reiniciar(); alta(CLAVE.admin)
  const a = await entrarRecordando()
  const b = await entrarRecordando()
  assert.notEqual(a, b)
})

probar('en la tabla se guarda el SHA-256, NUNCA el token', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const fila = estado.recordadas[0]
  assert.notEqual(fila.token_hash, token, '¡se guardó el token en claro!')
  assert.equal(fila.token_hash, sha256(token))
  assert.equal(fila.token_hash.length, 64)
})

probar('el token guardado no parece una contraseña ni un JWT', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  assert.ok(!token.includes('.'), 'parece un JWT, y un JWT sería verificable sin tabla')
  assert.equal(token.includes('$'), false)
  assert.ok(!/^[a-z]+\$/i.test(token), 'parece un hash scrypt')
})

probar('la caducidad la calcula MySQL, no el código', async () => {
  reiniciar(); alta(CLAVE.admin)
  await entrarRecordando()
  const sql = estado.inserts[0][0]
  assert.ok(sql.includes('DATE_ADD(NOW(3)'), 'la caducidad debe salir de NOW(3) en UTC')
  assert.ok(Number.isInteger(estado.inserts[0][1][4]), 'el TTL debe ir como entero')
})

// ============================================================ canjear token
probar('canjear un token válido devuelve sesión y usuario', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const r = await pedir('POST', '/api/auth/recordar', { token })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.usuario.correo, CLAVE.admin)
  assert.equal(typeof r.datos.token, 'string')
  assert.equal(r.datos.usuario.password_hash, undefined, '¡se filtró el hash!')
})

probar('canjear marca el último uso', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const antes = estado.ultimoUso
  await pedir('POST', '/api/auth/recordar', { token })
  assert.ok(estado.ultimoUso > antes)
})

probar('la sesión que devuelve el canje sirve para pedir /yo', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const canje = await pedir('POST', '/api/auth/recordar', { token })
  const yo = await pedir('GET', '/api/auth/yo', undefined, { token: canje.datos.token })
  assert.equal(yo.estado, 200)
  assert.equal(yo.datos.correo, CLAVE.admin)
})

probar('un token inventado responde 401', async () => {
  reiniciar(); alta(CLAVE.admin)
  const r = await pedir('POST', '/api/auth/recordar', { token: 'inventado'.repeat(6) })
  assert.equal(r.estado, 401)
})

probar('sin token responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/auth/recordar', {})
  assert.equal(r.estado, 400)
})

probar('un token revocado deja de servir (se borra la fila)', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const sesion = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })
  const r1 = await pedir('POST', '/api/auth/recordar/revocar', { token }, { token: sesion.datos.token })
  assert.equal(r1.estado, 200)
  assert.equal(estado.recordadas.length, 0)
  const r2 = await pedir('POST', '/api/auth/recordar', { token })
  assert.equal(r2.estado, 401)
})

probar('el 401 del canje no dice si caducó o se revocó', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const sesion = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })

  // Dos formas de invalidarlo, y las dos deben dar EXACTAMENTE el mismo 401:
  // distinguir "caducó" de "se revocó" le diría a quien tenga el token en qué
  // estado está, que es información que no necesita.
  await pedir('POST', '/api/auth/recordar/revocar', { token }, { token: sesion.datos.token })
  const r1 = await pedir('POST', '/api/auth/recordar', { token })

  const otro = await entrarRecordando()
  estado.recordadas = [] // simula que la fila se fue por caducidad
  const r2 = await pedir('POST', '/api/auth/recordar', { token: otro })

  for (const r of [r1, r2]) {
    const texto = JSON.stringify(r.datos).toLowerCase()
    assert.equal(r.estado, 401)
    assert.equal(texto.includes('caduc'), false)
    assert.equal(texto.includes('revoc'), false)
    assert.equal(texto.includes('expir'), false)
  }
  assert.equal(r1.datos.error, r2.datos.error, 'los dos 401 deben ser el mismo texto')
})

// ====================================================== cuenta desactivada
probar('cuenta desactivada: no entra y su token queda revocado', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  alta(CLAVE.admin, { activo: 0 })
  const r = await pedir('POST', '/api/auth/recordar', { token })
  assert.equal(r.estado, 401)
  assert.equal(estado.recordadas.length, 0, 'el token debería quedar borrado')
})

probar('cuenta borrada: el token no entra', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  estado.usuarios.delete(CLAVE.admin)
  const r = await pedir('POST', '/api/auth/recordar', { token })
  assert.equal(r.estado, 401)
})

// ================================================================= revocar
probar('revocar sin sesión responde 401', async () => {
  reiniciar(); alta(CLAVE.admin)
  const token = await entrarRecordando()
  const r = await pedir('POST', '/api/auth/recordar/revocar', { token })
  assert.equal(r.estado, 401)
  assert.equal(estado.recordadas.length, 1, 'no debe borrar nada sin sesión')
})

probar('revocar sin token en el cuerpo responde 400', async () => {
  reiniciar(); alta(CLAVE.admin)
  const sesion = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })
  const r = await pedir('POST', '/api/auth/recordar/revocar', {}, { token: sesion.datos.token })
  assert.equal(r.estado, 400)
})

probar('revocar el token de OTRO usuario no lo borra', async () => {
  reiniciar(); alta(CLAVE.admin); alta(CLAVE.otro)
  const tokenAjeno = await entrarRecordando(CLAVE.otro)
  const sesion = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })
  const r = await pedir('POST', '/api/auth/recordar/revocar', { token: tokenAjeno }, { token: sesion.datos.token })
  assert.equal(r.estado, 404)
  assert.equal(estado.recordadas.length, 1, 'la fila del otro debe seguir ahí')
  // Y el token ajeno sigue sirviendo: no se revocó por error.
  const canje = await pedir('POST', '/api/auth/recordar', { token: tokenAjeno })
  assert.equal(canje.estado, 200)
})

probar('«salir de todos los dispositivos» borra solo las filas propias', async () => {
  reiniciar(); alta(CLAVE.admin); alta(CLAVE.otro)
  await entrarRecordando(CLAVE.admin)
  await entrarRecordando(CLAVE.otro)
  const sesion = await pedir('POST', '/api/auth/login', { correo: CLAVE.admin, contrasena: CLAVE.clave })
  const r = await pedir('POST', '/api/auth/recordar/revocar', { todos: true }, { token: sesion.datos.token })
  assert.equal(r.estado, 200)
  assert.equal(estado.recordadas.length, 1)
  assert.equal(estado.recordadas[0].correo, CLAVE.otro)
})

// ============================================================ límite de intentos
probar('el canje se bloquea tras 10 intentos fallidos desde una IP', async () => {
  reiniciar(); alta(CLAVE.admin)
  const ip = '10.9.9.9'
  for (let i = 0; i < 10; i++) {
    const r = await pedir('POST', '/api/auth/recordar', { token: `malo${i}` }, { ip })
    assert.equal(r.estado, 401, `intento ${i} debería ser 401`)
  }
  const r = await pedir('POST', '/api/auth/recordar', { token: 'otro' }, { ip })
  assert.equal(r.estado, 429)
})

// ---------------------------------------------------------------- arranque
async function main() {
  hashReal = await C.hashear(CLAVE.clave)
  // Una llamada de humo: verifica que el scrypt del fixture es el esperado.
  assert.equal(await C.verificar(CLAVE.clave, hashReal), true)

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

  console.log(`\nrecordar · ${pasadas}/${pruebas.length} correctas`)
  for (const [nombre, e] of fallos) {
    console.error(`  FALLO: ${nombre}`)
    console.error(`         ${e && e.message}`)
  }
  process.exit(fallos.length === 0 ? 0 : 1)
}

main()
