// ============================================================================
// Pruebas del módulo de correo (server/src/correo.js).
//
// Lo que se prueba es la DECISIÓN de a quién se avisa: qué entrada de historial
// dispara un correo, cuál no, y a qué dirección. Es la parte que decide si al
// solicitante le llega un aviso duplicado o ninguno, y no necesita ni SMTP ni
// MySQL.
//
// Uso:  node test/correo.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'

const correo = require('../src/correo')

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

// --------------------------------------------------------------- utilidades

const FILA = {
  codigo: 'CTPLOG-00007',
  cliente: 'Laboratorios Andina',
  zona: 'Bogotá Norte',
  numero_referencia: 'FV-88231',
  conductor: 'Pedro Ramírez',
  vehiculo: 'KWL-381',
  placa: 'OKL-913',
  solicitante_nombre: 'Ana Torres',
  solicitante_correo: ' solicitante@cliente.com ',
}

const encuestaMala = (promedio) => ({
  nombreEncuestado: 'JUAN PÉREZ',
  cargo: 'RECEPCIÓN',
  correo: 'JUAN@CLIENTE.COM',
  preguntas: [
    { pregunta: 'TIEMPO EN ENTREGA', puntuacion: 1 },
    { pregunta: 'ESTADO DEL PRODUCTO', puntuacion: 2 },
    { pregunta: 'DISPONIBILIDAD DE LA INFORMACIÓN', puntuacion: 2 },
    { pregunta: 'AMABILIDAD Y ACTITUD DEL SERVICIO', puntuacion: 2 },
    { pregunta: 'ATENCIÓN DE UN RECLAMO (VISITA, SEGUIMIENTO)', puntuacion: 2 },
  ],
  promedio,
})

const entradaEstado = (extra) => ({
  id: 'hist-1',
  solicitud: 'CTPLOG-00007',
  campo: 'estado',
  anterior: 'En Trámite',
  nuevo: 'Entregado',
  nota: 'ENTREGA REALIZADA',
  persona: 'Pedro Ramírez',
  fecha: '2026-10-05',
  hora: '10:30',
  encuesta: null,
  ...extra,
})

// --------------------------------------------------------- planCorreos: umbral

probar('una encuesta por encima del umbral no genera aviso', () => {
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encuestaMala(3) })],
  })
  assert.deepEqual(avisos, [])
})

probar('una encuesta exactamente en el umbral (2.5) SÍ genera aviso', () => {
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encuestaMala(2.5) })],
  })
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].tipo, 'calificacion')
})

probar('una encuesta por debajo del umbral genera aviso', () => {
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encuestaMala(1.6) })],
  })
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].tipo, 'calificacion')
})

probar('un historial sin encuesta no genera el aviso de calidad', () => {
  const avisos = correo.planCorreos({ fila: FILA, historial: [entradaEstado()] })
  assert.deepEqual(avisos, [])
})

probar('una encuesta sin promedio numérico no dispara el aviso', () => {
  // Un promedio en texto o ausente significa que no se puede comparar con el
  // umbral. Mandar el aviso «por si acaso» sería peor: llenaría de alertas
  // falsas a las áreas internas.
  const encapsulated = { ...encuestaMala(1), promedio: '1.0' }
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encapsulated })],
  })
  assert.deepEqual(avisos, [])
})

probar('una encuesta en texto JSON también se reconoce', () => {
  // MySQL y el cuerpo de la petición no siempre entregan el JSON ya parseado.
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: JSON.stringify(encuestaMala(2)) })],
  })
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].tipo, 'calificacion')
})

// ---------------------------------------------------- planCorreos: destinatario

probar('el aviso de calidad va al solicitante con 5 áreas en copia', () => {
  const [aviso] = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encuestaMala(2) })],
  })
  // El correo del solicitante llega normalizado a minúsculas y sin espacios.
  assert.equal(aviso.para, 'solicitante@cliente.com')
  // Mala calificación: 5 áreas internas en copia (dominio @ctpmedica.com)
  assert.equal(aviso.copia.length, 5)
  for (const destinatario of aviso.copia) {
    assert.match(destinatario, /@ctpmedica\.com$/)
    assert.notEqual(destinatario, aviso.para)
  }
})

probar('el aviso de cartera va al solicitante (sin copia)', () => {
  const [aviso] = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ nuevo: 'Retenido por Cartera' })],
  })
  assert.equal(aviso.para, 'solicitante@cliente.com')
  assert.deepEqual(aviso.copia, [])
})

// --------------------------------------------------- planCorreos: cartera

probar('pasar a Retenido por Cartera genera el aviso', () => {
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [
      entradaEstado({ id: 'hist-9', anterior: 'En Trámite', nuevo: 'Retenido por Cartera', nota: 'CARTERA INFORMA SALDO' }),
    ],
  })
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].tipo, 'cartera')
  assert.match(avisos[0].asunto, /CTPLOG-00007/)
  assert.match(avisos[0].asunto, /retenida por cartera/i)
  // El motivo que escribió el administrador tiene que llegarle al solicitante.
  assert.match(avisos[0].html, /CARTERA INFORMA SALDO/)
})

probar('un estado que ya venía en Retenido por Cartera NO vuelve a avisar', () => {
  // Es el guardado repetido del mismo hecho, no una transición nueva. Sin esta
  // comprobación el solicitante recibiría el aviso en cada guardado posterior.
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [
      entradaEstado({ id: 'hist-9', anterior: 'Retenido por Cartera', nuevo: 'Retenido por Cartera' }),
    ],
  })
  assert.deepEqual(avisos, [])
})

probar('cualquier otro estado no genera el aviso de cartera', () => {
  const estados = [
    'Abierto',
    'Pendiente por Autorización',
    'Devolución a Solicitante',
    'En Trámite',
    'En Tránsito',
    'En Tránsito Parcial',
    'Entregado Parcial',
    'Entregado',
  ]
  for (const nuevo of estados) {
    const avisos = correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ nuevo })],
    })
    assert.deepEqual(avisos, [], `«${nuevo}» no debería avisar`)
  }
})

// ------------------------------------------- planCorreos: claves y robustness

probar('cada aviso lleva una clave estable basada en el id del historial', () => {
  // El frontend reenvía el historial completo en cada guardado, así que la clave
  // tiene que salir del id de la entrada, no del contenido: es lo único que no
  // cambia entre un guardado y el siguiente del mismo hecho.
  const entrada = entradaEstado({ encuesta: encuestaMala(2) })
  const primero = correo.planCorreos({ fila: FILA, historial: [entrada] })
  const segundo = correo.planCorreos({ fila: FILA, historial: [entrada] })
  assert.equal(primero[0].clave, segundo[0].clave)
  assert.equal(primero[0].clave, 'calificacion:hist-1')
})

probar('las claves de los dos avisos son distintas', () => {
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [
      entradaEstado({
        id: 'hist-9',
        anterior: 'En Trámite',
        nuevo: 'Retenido por Cartera',
        encuesta: encuestaMala(2),
      }),
    ],
  })
  assert.equal(avisos.length, 2)
  assert.notEqual(avisos[0].clave, avisos[1].clave)
})

probar('una entrada sin id no genera avisos', () => {
  const entradas = [
    entradaEstado({ id: undefined, encuesta: encuestaMala(1) }),
    entradaEstado({ id: '', nuevo: 'Retenido por Cartera' }),
  ]
  assert.deepEqual(correo.planCorreos({ fila: FILA, historial: entradas }), [])
})

probar('solo las entradas de tipo estado generan avisos', () => {
  // Las entradas 'asignado' y 'conductor' no llevan encuesta ni cambian el
  // estado del pedido; si contaran, avisarían de cosas que no pasaron.
  const entradas = [
    entradaEstado({ id: 'h1', campo: 'asignado', nuevo: 'Ana Torres', encuesta: encuestaMala(1) }),
    entradaEstado({ id: 'h2', campo: 'conductor', nuevo: 'Pedro Ramírez', encuesta: encuestaMala(1) }),
  ]
  assert.deepEqual(correo.planCorreos({ fila: FILA, historial: entradas }), [])
})

probar('planCorreos aguanta entradas raras sin romperse', () => {
  for (const historial of [undefined, null, [], [null], [undefined], [{}], [{ id: 'x' }]]) {
    assert.ok(Array.isArray(correo.planCorreos({ fila: FILA, historial })))
  }
  assert.deepEqual(correo.planCorreos(), [])
  assert.deepEqual(correo.planCorreos({}), [])
  assert.deepEqual(correo.planCorreos({ fila: null, historial: [entradaEstado()] }), [])
})

probar('una solicitud sin correo de solicitante genera el aviso sin destinatario', () => {
  // No se descarta aquí: la decisión de a quién se avisa se deja para el
  // despacho, que es quien tiene el log y puede avisar del pedido huérfano.
  const avisos = correo.planCorreos({
    fila: { ...FILA, solicitante_correo: '' },
    historial: [entradaEstado({ encuesta: encuestaMala(2) })],
  })
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].para, '')
})

// ---------------------------------------------------------------- plantillas

probar('el HTML de mala calificación muestra el promedio y las respuestas', () => {
  const html = correo.htmlMalaCalificacion(
    { id: 'CTPLOG-00007', cliente: 'Acme', zona: 'Norte', numeroReferencia: 'FV-1', conductor: 'Pedro', vehiculo: 'KWL', placa: 'OKL' },
    encuestaMala(2)
  )
  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /MALA CALIFICACIÓN EN ENTREGA/)
  assert.match(html, /2\.0 \/ 3\.00/)
  assert.match(html, /CTPLOG-00007/)
  assert.match(html, /TIEMPO EN ENTREGA/)
  assert.match(html, /JUAN PÉREZ/)
})

probar('el HTML de mala calificación escapa los datos que vienen del cliente', () => {
  // El nombre, el cargo y las preguntas los escribe el conductor en el móvil. Sin
  // escapar, un '<script>' en el nombre se ejecutaría en el correo del solicitante
  // y en el de las áreas internas.
  const html = correo.htmlMalaCalificacion(
    { id: 'CTPLOG-1', cliente: '<b>Acme</b>' },
    {
      nombreEncuestado: '<script>alert(1)</script>',
      cargo: 'Recepción & "Coop"',
      preguntas: [{ pregunta: '<img src=x onerror=alert(1)>', puntuacion: 1 }],
      promedio: 1,
    }
  )
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img src=x'))
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&amp;/)
  assert.match(html, /&quot;/)
})

probar('el HTML de cartera explica la retención y muestra el motivo', () => {
  const html = correo.htmlRetencionCartera(
    {
      id: 'CTPLOG-00007',
      cliente: 'Acme',
      zona: 'Norte',
      numeroReferencia: 'FV-1',
      estadoAnterior: 'En Trámite',
      fechaEstado: '2026-10-05 10:30',
    },
    { nota: 'CARTERA INFORMA SALDO', persona: 'Ana Torres' }
  )
  assert.match(html, /RETENIDA POR CARTERA/)
  assert.match(html, /CARTERA INFORMA SALDO/)
  assert.match(html, /En Trámite/)
  assert.match(html, /CTPLOG-00007/)
  // El solicitante tiene que entender qué hacer, no solo que le pasó algo.
  assert.match(html, /Cartera/i)
})

probar('el HTML de cartera aguanta que no haya motivo ni responsable', () => {
  const html = correo.htmlRetencionCartera({ id: 'CTPLOG-2' }, {})
  assert.match(html, /No se registró un motivo/)
})

// ------------------------------------------------------- normalizarCorreos

probar('normalizarCorreos limpia, baja y quita duplicados', () => {
  const resultado = correo.normalizarCorreos(
    ' Uno@CtP.com , dos@ctp.com, uno@ctp.com,, inválido , tres@ctp.com'
  )
  assert.deepEqual(resultado, ['uno@ctp.com', 'dos@ctp.com', 'tres@ctp.com'])
})

probar('normalizarCorreos acepta un array y una lista de entorno', () => {
  assert.deepEqual(correo.normalizarCorreos(['A@b.com', 'a@b.com']), ['a@b.com'])
  assert.deepEqual(correo.normalizarCorreos(''), [])
  assert.deepEqual(correo.normalizarCorreos(undefined), [])
})

probar('normalizarCorreos no se pasa del tope de destinatarios', () => {
  // Un solo mensaje con 200 destinatarios es la vía más rápida a la carpeta de
  // spam de todos los servidores a la vez.
  const muchos = Array.from({ length: 200 }, (_, i) => `user${i}@ctpmedica.com`)
  assert.ok(correo.normalizarCorreos(muchos).length <= 20)
})

// --------------------------------------------------------------- despacho

probar('sin SMTP configurado el aviso no se envía pero la app no falla', async () => {
  // Es el estado por defecto en desarrollo y en una instalación sin correo:
  // tiene que devolver «no enviado» sin lanzar, para que el guardado de la
  // solicitud (que ya está confirmado en la base) no se caiga.
  if (correo.correoConfigurado()) return
  const avisos = correo.planCorreos({
    fila: FILA,
    historial: [entradaEstado({ encuesta: encuestaMala(2) })],
  })
  assert.equal(await correo.despachar(avisos), 0)
  assert.equal(await correo.despachar([]), 0)
  assert.equal(await correo.despachar(undefined), 0)
})

// ------------------------------------------------------------------ salida

let fallos = 0
;(async () => {
  for (const [nombre, fn] of pruebas) {
    try {
      await fn()
      console.log(`  ok  ${nombre}`)
    } catch (error) {
      fallos += 1
      console.error(`FALLO  ${nombre}`)
      console.error(`       ${error?.message}`)
    }
  }
  console.log(`\ncorreo: ${pruebas.length - fallos}/${pruebas.length} pruebas OK`)
  process.exit(fallos > 0 ? 1 : 0)
})()
