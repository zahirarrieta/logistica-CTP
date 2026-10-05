// ============================================================================
// Pruebas del DESPACHO de correo (server/src/correo.js → despachar).
//
// El resto de pruebas de correo (correo.test.js) cubren la decisión de a quién
// se avisa. Estas cubren lo que sale por el cable: qué campos lleva cada mensaje,
// que un aviso no se mande dos veces y que un buzón inexistente NO impida que el
// solicitante reciba su aviso.
//
// No necesitan ni SMTP ni MySQL: la base se sustituye por un doble en memoria y
// el transporte de nodemailer por uno que solo registra.
//
//   Uso:  node test/correo-envio.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'

// --- SMTP de mentira ------------------------------------------------------
// Se configura ANTES de que el módulo lea la config: es lo que decide si el
// envío se considera habilitado.
process.env.MAIL_HOST = 'mail.prueba.local'
process.env.MAIL_PORT = '465'
process.env.MAIL_USER = 'operaciones@pedro-ctpmedica.com'
process.env.MAIL_PASSWORD = 'clave-de-prueba'
process.env.MAIL_FROM = 'operaciones@pedro-ctpmedica.com'
process.env.MAIL_FROM_NAME = 'Logística CTP'
process.env.MAIL_OPERATIVO = 'operaciones@pedro-ctpmedica.com'

// Trae a propósito un duplicado y un espacio, para comprobar la limpieza.
process.env.CORREOS_ALERTA_CALIDAD =
  'calidad@pedro-ctpmedica.com, calidad@pedro-ctpmedica.com , otra@pedro-ctpmedica.com'
// Vacía a propósito: la de cartera tiene que salir de la lista del código.
process.env.CORREOS_REENCION_CARTERA = ''

const OPERATIVA = 'operaciones@pedro-ctpmedica.com'

// --- Base de datos de mentira ---------------------------------------------
// correo.js hace `require('./db')` al cargarse, así que se sustituye ese módulo
// en la caché antes. Es un doble mínimo: la app solo usa pool.execute.
const enviados = []
const insertados = new Set()
const poolFalso = {
  async execute(sql, params = []) {
    if (/CREATE TABLE/i.test(sql)) return [{ affectedRows: 0 }, []]
    if (/INSERT IGNORE/i.test(sql)) {
      // affectedRows = 0 cuando la clave ya existía: es el deduplicado.
      if (insertados.has(params[0])) return [{ affectedRows: 0 }, []]
      insertados.add(params[0])
      return [{ affectedRows: 1 }, []]
    }
    if (/^\s*DELETE/i.test(sql)) {
      const estaba = insertados.delete(params[0])
      return [{ affectedRows: estaba ? 1 : 0 }, []]
    }
    throw new Error(`SQL inesperado en el doble: ${sql}`)
  },
}

const rutaDb = require.resolve('../src/db')
require.cache[rutaDb] = {
  id: rutaDb,
  filename: rutaDb,
  loaded: true,
  exports: { pool: poolFalso, query: async () => [[[]]] },
}

// --- Transporte de mentira ------------------------------------------------
const correo = require('../src/correo')

// Cada aviso sale en DOS envíos (solicitante + operativa, y operativa + resto de
// áreas), así que las pruebas tienen que poder hacer fallar uno solo: es
// justamente el caso que motiva esa separación.
let fallarPara = null

function ponerTransporte() {
  enviados.length = 0
  fallarPara = null
  correo.usarTransporte({
    async sendMail(mensaje) {
      const destinatarios = [mensaje.to, ...(mensaje.cc || [])].flat()
      if (fallarPara && destinatarios.includes(fallarPara)) {
        const error = new Error(`550 No such user (${fallarPara})`)
        error.code = 'EENVELOPE'
        throw error
      }
      enviados.push(mensaje)
      return { messageId: 'prueba' }
    },
  })
}

// Silencia el log del módulo durante las pruebas: los errores previstos (buzón
// inexistente) ensucian la salida con mensajes en rojo que no son fallos de la
// prueba.
const warnOriginal = console.warn
const errorOriginal = console.error
const silenciar = () => {
  console.warn = () => {}
  console.error = () => {}
}
const restaurar = () => {
  console.warn = warnOriginal
  console.error = errorOriginal
}

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

const FILA = {
  codigo: 'CTPLOG-00042',
  cliente: 'Laboratorios Andina',
  zona: 'Bogotá Norte',
  numero_referencia: 'FV-99120',
  conductor: 'Pedro Ramírez',
  vehiculo: 'KWL-381',
  placa: 'OKL-913',
  solicitante_nombre: 'Ana Torres',
  solicitante_correo: 'ana@acme.com',
}

const entradaEstado = (extra) => ({
  id: 'hist-1',
  solicitud: 'CTPLOG-00042',
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

const encuestaMala = {
  nombreEncuestado: 'JUAN PÉREZ',
  cargo: 'RECEPCIÓN',
  preguntas: [
    { pregunta: 'TIEMPO EN ENTREGA', puntuacion: 1 },
    { pregunta: 'ESTADO DEL PRODUCTO', puntuacion: 2 },
    { pregunta: 'DISPONIBILIDAD DE LA INFORMACIÓN', puntuacion: 2 },
    { pregunta: 'AMABILIDAD Y ACTITUD DEL SERVICIO', puntuacion: 1 },
    { pregunta: 'ATENCIÓN DE UN RECLAMO (VISITA, SEGUIMIENTO)', puntuacion: 2 },
  ],
  promedio: 1.6,
}

// ------------------------------------------------------------------ envío

probar('un aviso sale en dos envíos: al solicitante y a las áreas', async () => {
  ponerTransporte()
  const resultado = await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-a', encuesta: encuestaMala })],
    })
  )

  // `resultado` cuenta AVISOS, no envíos: uno aunque salgan dos mensajes.
  assert.equal(resultado, 1)
  assert.equal(enviados.length, 2)

  // 1 · el solicitante, con la operación en copia.
  assert.equal(enviados[0].to, 'ana@acme.com')
  assert.deepEqual(enviados[0].cc, [OPERATIVA])

  // 2 · la operación, con el resto de áreas en copia.
  assert.equal(enviados[1].to, OPERATIVA)
  assert.deepEqual(enviados[1].cc, ['calidad@pedro-ctpmedica.com', 'otra@pedro-ctpmedica.com'])
})

probar('los dos envíos llevan el remitente del hosting y el diseño', async () => {
  ponerTransporte()
  await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-b', encuesta: encuestaMala })],
    })
  )
  for (const mensaje of enviados) {
    // El remitente es el del hosting, nunca el del navegador ni el del solicitante.
    assert.match(mensaje.from, /<operaciones@pedro-ctpmedica\.com>$/)
    assert.match(mensaje.from, /"Logística CTP"/)
    assert.match(mensaje.subject, /Calificación baja \(1\.6\) en entrega CTPLOG-00042/)
    // Siempre cuerpo en HTML (el diseño) y en texto: hay lectores que solo
    // muestran el texto.
    assert.match(mensaje.html, /<!DOCTYPE html>/)
    assert.ok(mensaje.text.length > 0)
    assert.ok(!mensaje.text.includes('<'))
  }
})

probar('la casilla operativa no se repite dentro del mismo mensaje', async () => {
  ponerTransporte()
  await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-c', nuevo: 'Retenido por Cartera' })],
    })
  )
  for (const mensaje of enviados) {
    const todos = [mensaje.to, ...(mensaje.cc || [])].map((d) => String(d).toLowerCase())
    assert.equal(new Set(todos).size, todos.length, `destinatario repetido: ${todos.join(', ')}`)
  }
})

probar('una lista de copia vacía cae en la lista por defecto del código', async () => {
  ponerTransporte()
  // CORREOS_REENCION_CARTERA está vacía a propósito: la de cartera tiene que
  // salir de la lista del código, no quedarse sin copiar.
  await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-d', nuevo: 'Retenido por Cartera' })],
    })
  )
  assert.deepEqual(enviados[1].cc, [
    'cotizacionesylicitaciones@pedro-ctpmedica.com',
    'servicioalcliente2@pedro-ctpmedica.com',
  ])
})

probar('la lista interna del código usa el dominio del hosting', async () => {
  ponerTransporte()
  // La lista por defecto venía con @ctpmedica.com, que no es el dominio de este
  // hosting: esas casillas no existen y harían rebotar el envío entero.
  for (const lista of [correo.CORREOS_ALERTA_CALIDAD, correo.CORREOS_REENCION_CARTERA]) {
    for (const direccion of lista) {
      assert.match(direccion, /@pedro-ctpmedica\.com$/)
    }
  }
  assert.ok(correo.CORREOS_ALERTA_CALIDAD.includes(OPERATIVA))
  assert.ok(correo.CORREOS_REENCION_CARTERA.includes(OPERATIVA))
})

probar('el aviso de cartera lleva el motivo del cambio', async () => {
  ponerTransporte()
  const resultado = await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [
        entradaEstado({
          id: 'hist-e',
          anterior: 'En Trámite',
          nuevo: 'Retenido por Cartera',
          nota: 'CARTERA INFORMA SALDO PENDIENTE',
          persona: 'Ana Torres',
        }),
      ],
    })
  )
  assert.equal(resultado, 1)
  assert.match(enviados[0].subject, /retenida por cartera/i)
  assert.match(enviados[0].html, /CARTERA INFORMA SALDO PENDIENTE/)
  assert.match(enviados[0].html, /Ana Torres/)
})

probar('sin correo del solicitante no se intenta enviar', async () => {
  ponerTransporte()
  const resultado = await correo.despachar(
    correo.planCorreos({
      fila: { ...FILA, solicitante_correo: '' },
      historial: [entradaEstado({ id: 'hist-f', encuesta: encuestaMala })],
    })
  )
  assert.equal(resultado, 0)
  assert.equal(enviados.length, 0)
})

// ------------------------------------------------- el motivo de los dos envíos

probar('un buzón interno inexistente NO impide el aviso al solicitante', async () => {
  // El caso que motiva la separación: el servidor de correo rechaza el mensaje
  // ENTERO si una sola dirección no existe. Con un solo envío, un buzón ajeno sin
  // crear dejaría al cliente sin enterarse de nada.
  ponerTransporte()
  fallarPara = 'otra@pedro-ctpmedica.com'
  silenciar()
  let resultado
  try {
    resultado = await correo.despachar(
      correo.planCorreos({
        fila: FILA,
        historial: [entradaEstado({ id: 'hist-g', encuesta: encuestaMala })],
      })
    )
  } finally {
    restaurar()
  }

  // El aviso se da por entregado: el solicitante sí lo recibió.
  assert.equal(resultado, 1)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].to, 'ana@acme.com')
})

probar('un correo de solicitante inválido NO impide el aviso a las áreas', async () => {
  ponerTransporte()
  fallarPara = 'ana@acme.com'
  silenciar()
  let resultado
  try {
    resultado = await correo.despachar(
      correo.planCorreos({
        fila: FILA,
        historial: [entradaEstado({ id: 'hist-h', encuesta: encuestaMala })],
      })
    )
  } finally {
    restaurar()
  }

  // Aunque el cliente no lo recibiera, operaciones sí: el problema se ve igual.
  assert.equal(resultado, 1)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].to, OPERATIVA)
})

probar('si no sale ningún envío, el aviso se reintenta en el siguiente guardado', async () => {
  // Si la clave quedara reservada para siempre, un corte de red de treinta
  // segundos convertiría ese aviso en algo que no sale nunca.
  const plan = () =>
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-reintento', encuesta: encuestaMala })],
    })

  ponerTransporte()
  fallarPara = OPERATIVA
  silenciar()
  let resultado
  try {
    resultado = await correo.despachar(plan())
  } finally {
    restaurar()
  }
  assert.equal(resultado, 0)
  assert.equal(enviados.length, 0)

  ponerTransporte()
  assert.equal(await correo.despachar(plan()), 1)
  assert.equal(enviados.length, 2)
})

probar('un aviso entregado a medias no se repite en cada guardado', async () => {
  // Si el solicitante lo recibió pero las áreas fallaron, no se vuelve a intentar
  // en cada guardado: lo que falló se queda en el log, no se martillea el buzón.
  const plan = () =>
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-parcial', encuesta: encuestaMala })],
    })

  ponerTransporte()
  fallarPara = 'otra@pedro-ctpmedica.com'
  silenciar()
  try {
    assert.equal(await correo.despachar(plan()), 1)
  } finally {
    restaurar()
  }

  ponerTransporte()
  assert.equal(await correo.despachar(plan()), 0)
  assert.equal(enviados.length, 0)
})

probar('si solo hay una casilla interna no se manda un segundo envío vacío', async () => {
  // Si la lista interna fuera solo la operativa, no hay a quién copiarle: el
  // segundo envío sería redundante y, si fallara, dejaría la clave reservada
  // para siempre sin reintento posible.
  //
  // config se lee al cargarse, así que hay que recargar los módulos: cambiar
  // process.env aquí no cambiaría nada.
  const listaOriginal = process.env.CORREOS_ALERTA_CALIDAD
  const rutaConfig = require.resolve('../src/config')
  const rutaCorreo = require.resolve('../src/correo')

  process.env.CORREOS_ALERTA_CALIDAD = OPERATIVA
  delete require.cache[rutaConfig]
  delete require.cache[rutaCorreo]

  const soloOperativa = require('../src/correo')
  enviados.length = 0
  soloOperativa.usarTransporte({
    async sendMail(mensaje) {
      enviados.push(mensaje)
      return { messageId: 'prueba' }
    },
  })

  let resultado
  try {
    resultado = await soloOperativa.despachar(
      soloOperativa.planCorreos({
        fila: FILA,
        historial: [entradaEstado({ id: 'hist-solo-operativa', encuesta: encuestaMala })],
      })
    )
  } finally {
    process.env.CORREOS_ALERTA_CALIDAD = listaOriginal
    delete require.cache[rutaConfig]
    delete require.cache[rutaCorreo]
    require('../src/correo')
  }

  assert.equal(resultado, 1)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].to, 'ana@acme.com')
  assert.deepEqual(enviados[0].cc, [OPERATIVA])
})

// ------------------------------------------------------------ duplicados

probar('el mismo aviso no se manda dos veces', async () => {
  ponerTransporte()
  const plan = () =>
    correo.planCorreos({
      fila: FILA,
      historial: [entradaEstado({ id: 'hist-dup', encuesta: encuestaMala })],
    })

  // El frontend reenvía el historial completo en cada guardado, así que esto
  // ocurre en cada guardado posterior del mismo pedido.
  assert.equal(await correo.despachar(plan()), 1)
  assert.equal(enviados.length, 2)
  assert.equal(await correo.despachar(plan()), 0)
  assert.equal(enviados.length, 2)
  assert.equal(await correo.despachar(plan()), 0)
  assert.equal(enviados.length, 2)
})

probar('los dos avisos del mismo registro salen los dos', async () => {
  ponerTransporte()
  const resultado = await correo.despachar(
    correo.planCorreos({
      fila: FILA,
      historial: [
        entradaEstado({
          id: 'hist-dos',
          nuevo: 'Retenido por Cartera',
          encuesta: encuestaMala,
        }),
      ],
    })
  )
  assert.equal(resultado, 2)
  assert.equal(enviados.length, 4)
})

// ------------------------------------------------------------- tolerancia

probar('despachar acepta una lista vacía o inexistente', async () => {
  ponerTransporte()
  assert.equal(await correo.despachar([]), 0)
  assert.equal(await correo.despachar(undefined), 0)
  assert.equal(enviados.length, 0)
})

probar('que la base de reservas caiga no impide enviar', async () => {
  // Sin registro no se puede saber si el aviso ya salió. Se manda antes que dejar
  // al solicitante sin su aviso: el coste es una copia de más en su bandeja.
  const guardar = poolFalso.execute
  poolFalso.execute = async () => {
    throw new Error('ER_CON_COUNT_ERROR: Lost connection')
  }
  ponerTransporte()
  silenciar()
  try {
    const resultado = await correo.despachar(
      correo.planCorreos({
        fila: FILA,
        historial: [entradaEstado({ id: 'hist-sin-db', encuesta: encuestaMala })],
      })
    )
    assert.equal(resultado, 1)
    assert.equal(enviados.length, 2)
  } finally {
    restaurar()
    poolFalso.execute = guardar
  }
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
  console.log(`\ncorreo-envio: ${pruebas.length - fallos}/${pruebas.length} pruebas OK`)
  process.exit(fallos > 0 ? 1 : 0)
})()
