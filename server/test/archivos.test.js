// ============================================================================
// Pruebas de la capa de archivos (server/src/archivos.js).
// Es la parte con criptografía y rutas de disco, así que merece tests propio.
// Solo necesita Node: no toca MySQL ni la red.  Uso:  node test/archivos.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const path = require('node:path')

process.env.FIRMA_SECRET = 'secreto-de-prueba'
process.env.NODE_ENV = 'test'

const archivos = require('../src/archivos')

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

// ---------------------------------------------------------------- rutas
probar('rutaSegura acepta una ruta relativa normal', () => {
  const r = archivos.rutaSegura('CTPLOG-00001/foto.jpg')
  assert.ok(r.startsWith(archivos.RAIZ_EVIDENCIAS))
  assert.ok(r.endsWith(path.join('CTPLOG-00001', 'foto.jpg')))
})

probar('rutaSegura bloquea el salto de directorio con ..', () => {
  assert.equal(archivos.rutaSegura('../../.env'), null)
  assert.equal(archivos.rutaSegura('CTPLOG-1/../../servidor/.env'), null)
  assert.equal(archivos.rutaSegura('..'), null)
})

probar('rutaSegura confina las rutas absolutas dentro de la carpeta', () => {
  // No se rechazan: se vuelven relativas. '/etc/passwd' acaba en
  // evidencias/etc/passwd, que es inocuo. Lo que importa es que nunca escapen.
  for (const entrada of ['/etc/passwd', 'C:/Windows/system32', '..\\..\\app.js']) {
    const r = archivos.rutaSegura(entrada)
    const base = path.resolve(archivos.RAIZ_EVIDENCIAS)
    assert.ok(
      r === null || r === base || r.startsWith(base + path.sep),
      `${entrada} escapó de la base: ${r}`
    )
  }
})

probar('rutaSegura confina cualquier intento de escape', () => {
  const base = path.resolve(archivos.RAIZ_EVIDENCIAS)
  const hostiles = [
    '../.env',
    '../../.env',
    'CTPLOG-1/../../servidor/.env',
    '..',
    '../..',
    './../../x',
    '....//....//x',
    '/../..',
    'CTPLOG-1/./../../x',
  ]
  for (const entrada of hostiles) {
    const r = archivos.rutaSegura(entrada)
    assert.ok(r === null || r === base || r.startsWith(base + path.sep), `${entrada} escapó: ${r}`)
  }
})

probar('rutaSegura tolera barras iniciales y duplicadas', () => {
  assert.ok(archivos.rutaSegura('///CTPLOG-1//foto.jpg'))
})

// ---------------------------------------------------------------- firmas
probar('una URL firmada propia verifica', () => {
  const url = new URL(archivos.urlFirmada('CTPLOG-1/f.jpg', 'https://api.x.com'))
  assert.ok(url.searchParams.get('ruta'))
  assert.ok(
    archivos.verificarFirma(
      url.searchParams.get('ruta'),
      url.searchParams.get('exp'),
      url.searchParams.get('firma')
    )
  )
})

probar('una firma alterada no verifica', () => {
  const url = new URL(archivos.urlFirmada('CTPLOG-1/f.jpg', 'https://api.x.com'))
  const firma = url.searchParams.get('firma')
  const invertida = firma[0] === 'a' ? 'b' : 'a'
  assert.equal(
    archivos.verificarFirma(url.searchParams.get('ruta'), url.searchParams.get('exp'), invertida + firma.slice(1)),
    false
  )
})

probar('la firma no se puede trasladar a otra ruta', () => {
  const url = new URL(archivos.urlFirmada('CTPLOG-1/f.jpg', 'https://api.x.com'))
  assert.equal(
    archivos.verificarFirma('CTPLOG-2/f.jpg', url.searchParams.get('exp'), url.searchParams.get('firma')),
    false,
    'si la firma no cubriera la ruta, quien la obtuviera de una solicitud ajena podría pedir la de otra'
  )
})

probar('una firma caducada no verifica', () => {
  const exp = Math.floor(Date.now() / 1000) - 1
  const firma = crypto.createHmac('sha256', 'secreto-de-prueba').update(`CTPLOG-1/f.jpg|${exp}`).digest('hex')
  assert.equal(archivos.verificarFirma('CTPLOG-1/f.jpg', String(exp), firma), false)
})

probar('una firma con expiración absurda o inválida no verifica', () => {
  assert.equal(archivos.verificarFirma('a/b.jpg', 'no-es-un-numero', 'x'), false)
  assert.equal(archivos.verificarFirma('a/b.jpg', '', ''), false)
})

// ---------------------------------------------------------------- nombres
probar('sanitizar deja un único segmento sin separadores', () => {
  const limpio = archivos.sanitizar('../../evil/archivo?.jpg')
  assert.ok(!limpio.includes('/'))
  assert.ok(!limpio.includes('\\'))
  assert.ok(!/[<>:"/\\|?*]/.test(limpio))
  // Los '..' que sobrevivieron son texto plano dentro de un solo segmento, no
  // un salto de directorio: sin separadores no pueden escalar nada.
  assert.equal(limpio.split('..').length - 1, 2, 'los puntos se conservan como caracteres')
  assert.equal(path.basename(limpio), limpio, 'todo el resultado es un único nombre de archivo')
})

probar('sanitizar no deja pasar un salto de línea ni un null', () => {
  const limpio = archivos.sanitizar('a\nb\u0000c.jpg')
  // eslint-disable-next-line no-control-regex
  assert.ok(!/[\u0000-\u001f]/.test(limpio))
})

probar('sanitizar acota la longitud del nombre', () => {
  assert.ok(archivos.sanitizar('x'.repeat(500)).length <= 180)
})

// ------------------------------------------------------------------- disco
probar('guardar escribe el archivo dentro de la carpeta de evidencias', () => {
  const ruta = archivos.guardar('CTPLOG-TEST', 'nota.txt', Buffer.from('hola'))
  assert.ok(archivos.existe(ruta))
  assert.equal(ruta, 'CTPLOG-TEST/nota.txt')
})

probar('guardar conserva la estructura usuario → solicitud → subcarpeta', () => {
  const ruta = archivos.guardar('Juan Perez/CTPLOG-TEST/FacturasoRemisiones', 'f.pdf', Buffer.from('x'))
  assert.equal(ruta, 'Juan_Perez/CTPLOG-TEST/FacturasoRemisiones/f.pdf')
  assert.ok(archivos.existe(ruta))
  // La marca que usa pdfUtils.js para separar facturas de adjuntos.
  assert.ok(/\/FacturasoRemisiones\//i.test(ruta))
})

probar('guardar confina un código manipulado dentro de la carpeta', () => {
  // Cada segmento se sanea y los '..' se descartan, así que '../../escapo' no
  // puede escalar: acaba escrito dentro de evidencias/ como 'escapo/x.txt'.
  const ruta = archivos.guardar('../../escapo', 'x.txt', Buffer.from('y'))
  const base = path.resolve(archivos.RAIZ_EVIDENCIAS)
  const destino = path.resolve(archivos.RAIZ_EVIDENCIAS, ruta)
  assert.ok(destino.startsWith(base + path.sep), `escribió fuera: ${destino}`)
  assert.ok(archivos.existe(ruta))
  assert.equal(ruta, 'escapo/x.txt')
  assert.ok(!ruta.includes('..'), 'no debe quedar ningún salto de directorio')
})

probar('existe devuelve false para rutas que no están', () => {
  assert.equal(archivos.existe('CTPLOG-TEST/no-existe.txt'), false)
  assert.equal(archivos.existe('../../.env'), false)
})

probar('existe devuelve false para un directorio', () => {
  assert.equal(archivos.existe('CTPLOG-TEST'), false)
})

// ------------------------------------------------------- crearCarpeta
// Es lo que permite que una solicitud 'administrativa', sin adjunto, tenga su
// carpeta. Se prueba en la RAÍZ real (no en un temporal) porque es lo que hace
// el servidor, y se limpia al final para no dejar basura.
const CARPETA_PRUEBA = 'PRUEBA-CARPETA/CTPLOG-00000'
function limpiarCarpetaPrueba() {
  try {
    require('fs').rmSync(path.join(archivos.RAIZ_EVIDENCIAS, 'PRUEBA-CARPETA'), {
      recursive: true, force: true,
    })
  } catch { /* ya no estaba */ }
}

probar('crearCarpeta crea la carpeta aunque esté vacía', () => {
  const rel = archivos.crearCarpeta(CARPETA_PRUEBA)
  assert.equal(rel, CARPETA_PRUEBA)
  const abs = archivos.rutaSegura(CARPETA_PRUEBA)
  assert.ok(require('fs').statSync(abs).isDirectory(), 'debería ser un directorio')
  // Sin archivos dentro: es justo el caso de la administrativa sin adjunto.
  assert.deepEqual(require('fs').readdirSync(abs), [])
})

probar('crearCarpeta es idempotente y no borra lo que ya había', () => {
  const base = path.join(archivos.RAIZ_EVIDENCIAS, 'PRUEBA-CARPETA', 'CTPLOG-00000')
  require('fs').writeFileSync(path.join(base, 'factura.pdf'), 'x')
  assert.doesNotThrow(() => archivos.crearCarpeta(CARPETA_PRUEBA))
  assert.ok(require('fs').existsSync(path.join(base, 'factura.pdf')), 'no debe borrar el archivo previo')
})

probar('crearCarpeta nunca sale de la base con rutas hostiles', () => {
  const base = path.resolve(archivos.RAIZ_EVIDENCIAS)
  const hostiles = [
    '../PRUEBA-CARPETA', '../../.env', '..', './../../PRUEBA-CARPETA',
    'PRUEBA-CARPETA/../../../etc', '....//....//PRUEBA-CARPETA', 'A/../../..',
  ]
  for (const entrada of hostiles) {
    const rel = archivos.crearCarpeta(entrada)
    if (rel === null) continue
    const abs = path.resolve(archivos.rutaSegura(rel))
    assert.ok(
      abs === base || abs.startsWith(base + path.sep),
      `${entrada} se salió de la base: ${abs}`,
    )
    assert.ok(!rel.includes('..'), `${entrada} dejó un salto de directorio: ${rel}`)
    try { require('fs').rmSync(abs, { recursive: true, force: true }) } catch { /* noop */ }
  }
})

probar('crearCarpeta devuelve null cuando no queda nada que crear', () => {
  assert.equal(archivos.crearCarpeta(''), null)
  assert.equal(archivos.crearCarpeta('..'), null)
  assert.equal(archivos.crearCarpeta('/'), null)
})

probar('crearCarpeta normaliza un nombre de persona con espacios', () => {
  const rel = archivos.crearCarpeta('Juan Perez/CTPLOG-00001')
  assert.equal(rel, 'Juan_Perez/CTPLOG-00001')
  require('fs').rmSync(path.join(archivos.RAIZ_EVIDENCIAS, 'Juan_Perez'), {
    recursive: true, force: true,
  })
})

// ------------------------------------------------------------------- runner
;(async () => {
  let fallos = 0
  for (const [nombre, fn] of pruebas) {
    try {
      await fn()
      console.log(`  ok  ${nombre}`)
    } catch (error) {
      fallos++
      console.error(`FALLA  ${nombre}\n        ${error.message}`)
    }
  }
  limpiarCarpetaPrueba()
  console.log(`\n${pruebas.length - fallos}/${pruebas.length} pruebas correctas`)
  process.exit(fallos > 0 ? 1 : 0)
})()
