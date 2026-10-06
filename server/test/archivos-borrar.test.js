// ============================================================================
// Pruebas de POST /api/archivos/borrar (server/src/routes.js).
// ============================================================================
// Es la ruta con la que se corrige una factura o remisión mal cargada mientras
// la solicitud sigue «En Trámite». Lo que se comprueba aquí es lo que no se ve
// mirando el código: que un rol que no sea privilegiado ni llegue a la base,
// que la carpeta de facturas no se pueda usar para tirar adjuntos de otra
// etapa, que fuera de los estados de trámite responda 409 sin tocar nada, y que
// el happy path limpie el CSV del historial, suba la marca de agua y borre el
// archivo de disco.
//
// MySQL se sustituye por un pool falso: no toca la base ni la red. El disco sí
// es real (server/storage/evidencias), porque lo que se prueba es que el
// archivo acabe fuera.
//   Uso:  node test/archivos-borrar.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

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
// Responde por forma de la consulta. Lo que hay que reconocer es justo el
// camino de esta ruta: el rol del usuario, los códigos visibles, el estado de
// la solicitud, el historial, los adjuntos y los tres UPDATE que deja.
const CARPETA = 'Prueba Usuario/CTPLOG-00042/FacturasoRemisiones'
const RUTA = `${CARPETA}/factura-mala.pdf`
const RUTA_FIRMA = 'https://api.pedro-ctpmedica.com/api/archivos/ver?ruta=' +
  encodeURIComponent(RUTA) + '&exp=1790000000&firma=abc'

const estado = {}

function reiniciar() {
  estado.rol = 'superadmin'
  estado.codigosVisibles = ['CTPLOG-00042']
  estado.existe = true
  estado.estadoSolicitud = 'En Trámite'
  estado.historial = [{ id: 7, adjunto: `${RUTA}, ${CARPETA}/factura-bien.pdf` }]
  estado.adjuntos = JSON.stringify([RUTA_FIRMA, `${CARPETA}/otra.pdf`])
  estado.transaccion = ''
  estado.conmutada = false
  estado.liberada = false
  estado.marcaActualizada = false
  estado.ejecutadas = []
}

async function ejecutar(sql, params) {
  estado.ejecutadas.push([sql, params])
  const s = sql.replace(/\s+/g, ' ').trim()

  if (s.startsWith('SELECT correo, nombre, rol, activo FROM usuarios')) {
    return [[{ correo: 'x@ctpmedica.com', nombre: 'X', rol: estado.rol, activo: 1 }], []]
  }
  if (s.startsWith('SELECT codigo FROM solicitudes WHERE')) {
    return [estado.codigosVisibles.map((c) => ({ codigo: c })), []]
  }
  if (s.startsWith('SELECT estado FROM solicitudes WHERE')) {
    return [estado.existe ? [{ estado: estado.estadoSolicitud }] : [], []]
  }
  if (s.startsWith('SELECT id, adjunto FROM historial')) {
    return [estado.historial, []]
  }
  if (s.startsWith('SELECT adjuntos FROM solicitudes')) {
    return [[{ adjuntos: estado.adjuntos }], []]
  }
  if (s.startsWith('UPDATE historial SET adjunto')) {
    const reg = estado.historial.find((r) => r.id === params[1])
    if (reg) reg.adjunto = params[0]
    return [{ affectedRows: 1 }, []]
  }
  if (s.startsWith('UPDATE solicitudes SET adjuntos')) {
    estado.adjuntos = params[0]
    return [{ affectedRows: 1 }, []]
  }
  if (s.startsWith('UPDATE solicitudes SET actualizado_en')) {
    estado.marcaActualizada = true
    return [{ affectedRows: 1 }, []]
  }
  throw new Error(`Consulta no simulada: ${s}`)
}

const conexion = {
  execute: ejecutar,
  query: ejecutar,
  beginTransaction: async () => { estado.transaccion = 'abierta' },
  commit: async () => { estado.transaccion = 'commit'; estado.conmutada = true },
  rollback: async () => { estado.transaccion = 'rollback' },
  release: () => { estado.liberada = true },
}

// routes.js hace `const { pool } = require('./db')` al cargarse, así que el
// pool falso tiene que estar puesto ANTES de ese require.
db.pool = {
  execute: ejecutar,
  query: ejecutar,
  getConnection: async () => conexion,
}

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

function absoluta(ruta = RUTA) {
  const archivos = require('../src/archivos')
  return archivos.rutaSegura(ruta)
}

function escribirArchivo(ruta = RUTA) {
  const destino = absoluta(ruta)
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, 'contenido de prueba')
  return destino
}

function tocar(sql) {
  return estado.ejecutadas.some(([s]) => s.replace(/\s+/g, ' ').trim().startsWith(sql))
}

function consulta(sql) {
  return estado.ejecutadas.find(([s]) => s.replace(/\s+/g, ' ').trim().startsWith(sql))
}

// --------------------------------------------------------------- permisos
probar('POST /archivos/borrar: el solicitante no puede borrar facturas', async () => {
  reiniciar()
  estado.rol = 'solicitante'
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 403)
  assert.equal(tocar('SELECT estado FROM solicitudes'), false)
  assert.equal(estado.transaccion, '')
})

probar('POST /archivos/borrar: el conductor tampoco puede', async () => {
  reiniciar()
  estado.rol = 'conductor'
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 403)
  assert.equal(tocar('UPDATE historial SET adjunto'), false)
})

probar('un rol sin privilegio no abre transacción aunque la ruta sea válida', async () => {
  reiniciar()
  estado.rol = 'solicitante'
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(tocar('SELECT estado FROM solicitudes'), false)
  assert.equal(estado.liberada, false)
})

// --------------------------------------------------------------- validación
probar('POST /archivos/borrar sin ruta responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', {})
  assert.equal(r.estado, 400)
  assert.match(r.datos.error, /ruta/i)
})

probar('POST /archivos/borrar con la ruta vacía responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: '   ' })
  assert.equal(r.estado, 400)
})

probar('una ruta fuera de FacturasoRemisiones responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', {
    ruta: 'Prueba Usuario/CTPLOG-00042/Evidencias/foto.jpg',
  })
  assert.equal(r.estado, 400)
  assert.match(r.datos.error, /facturas o remisiones/i)
})

probar('el salto de directorio dentro de la carpeta de facturas responde 400', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', {
    ruta: 'Prueba Usuario/CTPLOG-00042/FacturasoRemisiones/../../otro/clave.txt',
  })
  assert.equal(r.estado, 400)
  assert.equal(tocar('SELECT estado FROM solicitudes'), false)
})

probar('una URL que no trae ?ruta no se puede convertir en ruta cruda', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', {
    ruta: 'https://otro-sitio.com/archivo.pdf',
  })
  assert.equal(r.estado, 400)
})

probar('una solicitud que el usuario no ve responde 403', async () => {
  reiniciar()
  estado.codigosVisibles = []
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 403)
  assert.equal(tocar('SELECT estado FROM solicitudes'), false)
})

// --------------------------------------------------------------- base
probar('una solicitud que no existe responde 404 sin tocar el historial', async () => {
  reiniciar()
  estado.existe = false
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 404)
  assert.equal(estado.transaccion, 'rollback')
  assert.equal(tocar('UPDATE historial SET adjunto'), false)
  assert.equal(estado.conmutada, false)
})

probar('una solicitud fuera de trámite responde 409', async () => {
  reiniciar()
  estado.estadoSolicitud = 'Entregado'
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 409)
  assert.match(r.datos.error, /trámite/i)
})

probar('en «En Tránsito» (ruta del camión) tampoco se puede borrar', async () => {
  reiniciar()
  estado.estadoSolicitud = 'En Tránsito'
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 409)
})

probar('un estado fuera de trámite no ejecuta ningún UPDATE', async () => {
  reiniciar()
  estado.estadoSolicitud = 'En Tránsito'
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(tocar('UPDATE historial SET adjunto'), false)
  assert.equal(tocar('UPDATE solicitudes SET actualizado_en'), false)
  assert.equal(estado.transaccion, 'rollback')
})

// --------------------------------------------------------------- happy path
probar('borrar con la ruta cruda limpia el historial y el disco', async () => {
  reiniciar()
  const destino = escribirArchivo()
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.ok, true)
  assert.equal(r.datos.quitadas, 2)
  assert.equal(fs.existsSync(destino), false)
  assert.equal(estado.conmutada, true)
  assert.equal(estado.liberada, true)
})

probar('acepta la misma ruta llegada como URL firmada', async () => {
  reiniciar()
  const destino = escribirArchivo()
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA_FIRMA })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.quitadas, 2)
  assert.equal(fs.existsSync(destino), false)
})

probar('el historial de la otra factura queda intacto', async () => {
  reiniciar()
  escribirArchivo()
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  const upd = consulta('UPDATE historial SET adjunto')
  assert.deepEqual(upd[1], [`${CARPETA}/factura-bien.pdf`, 7])
})

probar('las entradas del historial guardadas como URL firmada también se quitan', async () => {
  reiniciar()
  estado.historial = [{ id: 3, adjunto: RUTA_FIRMA }]
  estado.adjuntos = '[]'
  escribirArchivo()
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.quitadas, 1)
  const upd = consulta('UPDATE historial SET adjunto')
  assert.deepEqual(upd[1], ['', 3])
})

probar('también limpia adjuntos de la solicitud si la fila vieja los trae', async () => {
  reiniciar()
  escribirArchivo()
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  const upd = consulta('UPDATE solicitudes SET adjuntos')
  assert.deepEqual(upd[1], [JSON.stringify([`${CARPETA}/otra.pdf`]), 'CTPLOG-00042'])
})

probar('sube la marca de agua para que los demás equipos re-descarguen', async () => {
  reiniciar()
  escribirArchivo()
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(estado.marcaActualizada, true)
  assert.match(
    consulta('UPDATE solicitudes SET actualizado_en')[0],
    /CURRENT_TIMESTAMP/
  )
})

probar('la transacción se commitea y la conexión se devuelve', async () => {
  reiniciar()
  escribirArchivo()
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(estado.transaccion, 'commit')
  assert.equal(estado.liberada, true)
})

// --------------------------------------------------------------- sin cambios
probar('una ruta que no está en la base devuelve 200 con quitadas en 0', async () => {
  reiniciar()
  estado.historial = [{ id: 1, adjunto: `${CARPETA}/otra.pdf` }]
  estado.adjuntos = '[]'
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.quitadas, 0)
})

probar('sin referencias no se sube la marca de agua', async () => {
  reiniciar()
  estado.historial = [{ id: 1, adjunto: `${CARPETA}/otra.pdf` }]
  estado.adjuntos = '[]'
  await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(estado.marcaActualizada, false)
})

probar('un archivo que ya no está en el disco no es un error', async () => {
  reiniciar()
  const r = await pedir('POST', '/api/archivos/borrar', { ruta: RUTA })
  assert.equal(r.estado, 200)
  assert.equal(r.datos.ok, true)
})

// --------------------------------------------------------------- arranque
async function main() {
  reiniciar()
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

  // Limpia la carpeta de prueba que se creó en server/storage/evidencias.
  try {
    fs.rmSync(absoluta('Prueba Usuario'), { recursive: true, force: true })
  } catch { /* ya no estaba */ }

  console.log(`\narchivos · borrar: ${pasadas}/${pruebas.length} correctas`)
  for (const [nombre, e] of fallos) {
    console.error(`  FALLO: ${nombre}`)
    console.error(`         ${e && e.message}`)
  }
  process.exit(fallos.length === 0 ? 0 : 1)
}

main()
