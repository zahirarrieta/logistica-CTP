// ============================================================================
// Pruebas del módulo push (server/src/push.js)
//
// Lo que se comprueba aquí es la parte que decide a QUIÉN se avisa y qué pasa
// con los errores. El envío real a un navegador no se puede probar desde aquí
// (haría falta una suscripción de verdad y una red), así que el transporte se
// sustituye por un doble que registra a quién se le habría mandado.
//
//   Uso:  node test/push.test.js
// ============================================================================
'use strict'

const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'

// --- Base de datos de mentira ---------------------------------------------
// Dos tablas lógicas: usuarios (rol y si está activo) y las suscripciones.
// El doble tiene que responder a lo que push.js consulta de verdad, no a lo que
// le resulte cómodo: si el código cambia la consulta, la prueba tiene que fallar.
const usuarios = [
  { correo: 'admin@ctp.com', rol: 'administrador', activo: 1 },
  { correo: 'super@ctp.com', rol: 'superadmin', activo: 1 },
  { correo: 'jefe@ctp.com', rol: 'administrador', activo: 1 },
  { correo: 'cond1@ctp.com', rol: 'conductor', activo: 1 },
  { correo: 'baja@ctp.com', rol: 'administrador', activo: 0 },
  { correo: 'cliente@acme.com', rol: 'solicitante', activo: 1 },
]

const suscripciones = new Map() // endpoint -> fila
const envios = []
let secuencia = 0

const poolFalso = {
  async execute(sql, params = []) {
    if (/CREATE TABLE/i.test(sql)) return [{ affectedRows: 0 }, []]

    if (/INSERT INTO push_suscripciones/i.test(sql)) {
      const [correo, endpoint, publica, privada, agente] = params
      suscripciones.set(endpoint, { correo, endpoint, clave_publica: publica, clave_privada: privada, agente })
      return [{ affectedRows: 1 }, []]
    }
    if (/DELETE FROM push_suscripciones WHERE correo = \? AND endpoint/i.test(sql)) {
      // La fila se borra solo si BOTH columnas coinciden: el endpoint solo no
      // basta, que es justo lo que comprueba una de las pruebas.
      const [correo, endpoint] = params
      const fila = suscripciones.get(endpoint)
      const borrada = fila && fila.correo === correo
      if (borrada) suscripciones.delete(endpoint)
      return [{ affectedRows: borrada ? 1 : 0 }, []]
    }
    if (/DELETE FROM push_suscripciones WHERE correo = \?$/i.test(sql.trim())) {
      const antes = suscripciones.size
      for (const [endpoint, fila] of suscripciones) {
        if (fila.correo === params[0]) suscripciones.delete(endpoint)
      }
      return [{ affectedRows: antes ? 1 : 0 }, []]
    }
    if (/DELETE FROM push_suscripciones WHERE endpoint/i.test(sql)) {
      return [{ affectedRows: suscripciones.delete(params[0]) ? 1 : 0 }, []]
    }
    if (/UPDATE push_suscripciones SET ultimo_envio_ok_en = CURRENT_TIMESTAMP\(3\) WHERE endpoint = \?/i.test(sql)) {
      const endpoint = params[0]
      const fila = suscripciones.get(endpoint)
      if (fila) {
        // Simulamos la actualización
        return [{ affectedRows: 1 }, []]
      }
      return [{ affectedRows: 0 }, []]
    }
    if (/FROM push_suscripciones/i.test(sql) && /WHERE correo IN/i.test(sql)) {
      const pedidos = params
      return [[...suscripciones.values()].filter((f) => pedidos.includes(f.correo)), []]
    }
    if (/SELECT correo FROM usuarios/i.test(sql)) {
      //(active = 1 AND (rol IN (…) OR correo IN (…)))
      const roles = params.slice(0, (sql.match(/rol IN \(([^)]*)\)/)?.[1].match(/\?/g) || []).length)
      const correos = params.slice(roles.length)
      const filas = usuarios.filter((u) => {
        if (!u.activo) return false
        return roles.includes(u.rol) || correos.includes(u.correo)
      })
      return [filas.map((u) => ({ correo: u.correo })), []]
    }
    throw new Error(`SQL inesperado en el doble: ${sql}`)
  },
}

const rutaDb = require.resolve('../src/db')
require.cache[rutaDb] = {
  id: rutaDb,
  filename: rutaDb,
  loaded: true,
  exports: { pool: poolFalso },
}

// --- web-push de mentira ----------------------------------------------------
// El envío real necesita una suscripción auténtica y sale a internet. Aquí se
// sustituye la función de envío por un doble que apunta qué se habría mandado y
// a qué endpoint. Las claves VAPID sí son las de verdad: así se comprueba que
// push.js las valida y las firma con el formato correcto, que es donde se
// cuelan los errores (una clave con un byte de más hace que NADA salga).
const webpushReal = require('web-push')
const VAPID_PRUEBA = webpushReal.generateVAPIDKeys()

/** Endpoints cuyo envío debe fallar, con el código que se les devuelve. */
const fallosSimulados = new Map()

const webpushFalso = {
  setVapidDetails(subject, publicKey, privateKey) {
    // Se delega en la librería real: si push.js pasa algo que no es una clave,
    // aquí revienta igual que en producción.
    return webpushReal.setVapidDetails(subject, publicKey, privateKey)
  },
  async sendNotification(suscripcion, payload, opciones) {
    const endpoint = suscripcion.endpoint
    if (fallosSimulados.has(endpoint)) {
      const codigo = fallosSimulados.get(endpoint)
      const error = new Error(`simulado ${codigo}`)
      error.statusCode = codigo
      throw error
    }
    // push.js solo le pasa a web-push el endpoint y las claves (es lo que la
    // librería acepta). Para saber de quién es cada envío, el doble lo resuelve
    // mirando la fila guardada en la base de mentira.
    envios.push({
      endpoint,
      correo: suscripciones.get(endpoint)?.correo,
      carga: typeof payload === 'string' ? JSON.parse(payload) : payload,
      opciones,
    })
    return { statusCode: 201 }
  },
}

const rutaWebpush = require.resolve('web-push')
require.cache[rutaWebpush] = {
  id: rutaWebpush,
  filename: rutaWebpush,
  loaded: true,
  exports: webpushFalso,
}

// El código bajo prueba leerá estas variables al arrancar, así que se fijan antes
// de importarlo.
process.env.VAPID_PUBLIC_KEY = VAPID_PRUEBA.publicKey
process.env.VAPID_PRIVATE_KEY = VAPID_PRUEBA.privateKey
process.env.VAPID_SUBJECT = 'mailto:admin@ctp.com'

// Claves VAPID falsas pero con el formato que espera la librería. Sin esto
// push.configurarServicio() no firmaría nada y todas las pruebas de envío
// pasarían por el atajo de "sin claves", que no es lo que se quiere probar.

const rutaConfig = require.resolve('../src/config')
delete require.cache[rutaConfig]
const rutaPush = require.resolve('../src/push')
delete require.cache[rutaPush]
const push = require('../src/push')

const pruebas = []
const probar = (nombre, fn) => pruebas.push([nombre, fn])

const silencio = { w: console.warn, e: console.error, l: console.log }
function callar() {
  console.warn = () => {}
  console.error = () => {}
  console.log = () => {}
}
function hablar() {
  console.warn = silencio.w
  console.error = silencio.e
  console.log = silencio.l
}

// FILA base. Cada prueba cambia lo que necesita sobre una copia.
const FILA = {
  codigo: 'CTPLOG-00042',
  cliente: 'Laboratorios Andina',
  numero_referencia: 'FV-99120',
  estado: 'Abierto',
  solicitante_correo: 'cliente@acme.com',
  asignado_correo: '',
  conductor_correo: '',
  conductor: '',
}

const encuestaMala = {
  nombreEncuestado: 'JUAN PÉREZ',
  promedio: 1.6,
}

// Limpia el estado entre pruebas: la tabla de suscripciones y la lista de envíos
// son globales del módulo.
function limpiar() {
  suscripciones.clear()
  envios.length = 0
  fallosSimulados.clear()
  secuencia = 0
}

// Registra una suscripción ficticia para un correo.
//
// Las claves tienen que tener el tamaño que espera web-push: p256dh son 65 bytes
// (una clave pública P-256 sin comprimir, que es lo que devuelve el navegador) y
// auth son 16. Con claves de texto inventadas la librería las rechazaría al
// cifrar y las pruebas de envío pasarían sin comprobar nada del envío real.
function clavesFalsas() {
  const crypto = require('node:crypto')
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  // getPublicKey() ya viene con el prefijo 0x04: son 65 bytes, los que espera
  // web-push. Si se le añadiera el prefijo otra vez serían 66 y la librería
  // rechazaría la suscripción.
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  }
}

async function suscribirFalsa(correo, etiqueta = 'equipo') {
  secuencia += 1
  const endpoint = `https://fcm.googleapis.com/fcm/send/${correo}-${etiqueta}-${secuencia}`
  await push.suscribir(correo, { endpoint, keys: clavesFalsas() })
  return endpoint
}

// -------------------------------------------------------------- suscripciones

probar('suscribir guarda la suscripción de un equipo', async () => {
  limpiar()
  const resultado = await push.suscribir('admin@ctp.com', {
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc123',
    keys: { p256dh: 'clave-publica', auth: 'clave-privada' },
  })
  assert.equal(resultado.ok, true)
  assert.equal(suscripciones.size, 1)
  const fila = [...suscripciones.values()][0]
  assert.equal(fila.correo, 'admin@ctp.com')
  assert.equal(fila.clave_publica, 'clave-publica')
})

probar('repetir la suscripción en el mismo equipo no la duplica', async () => {
  limpiar()
  const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/abc123'
  await push.suscribir('admin@ctp.com', { endpoint, keys: { p256dh: 'v1', auth: 'v1' } })
  await push.suscribir('admin@ctp.com', { endpoint, keys: { p256dh: 'v2', auth: 'v2' } })
  assert.equal(suscripciones.size, 1)
  // Y la segunda pasó a ser la buena: una clave antigua tras un cambio de
  // navegador dejaría de poder cifrar.
  assert.equal([...suscripciones.values()][0].clave_publica, 'v2')
})

probar('el mismo equipo en dos cuentas distintas no se pisa', async () => {
  // El endpoint identifica al navegador, no a la persona. Si alguien cierra
  // sesión sin pasar por el desuscripción y entra otra cuenta en el mismo
  // navegador, la suscripción cambia de dueño en vez de quedarse en la antigua.
  limpiar()
  const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/abc123'
  await push.suscribir('admin@ctp.com', { endpoint, keys: { p256dh: 'a', auth: 'a' } })
  await push.suscribir('jefe@ctp.com', { endpoint, keys: { p256dh: 'b', auth: 'b' } })
  assert.equal(suscripciones.size, 1)
  assert.equal([...suscripciones.values()][0].correo, 'jefe@ctp.com')
})

probar('una suscripción con datos inválidos se rechaza sin tocar la base', async () => {
  limpiar()
  const basicos = [
    null,
    {},
    { endpoint: 'https://ok.example/1' },                       // sin claves
    { endpoint: 'https://ok.example/1', keys: {} },
    { endpoint: 'no-es-https', keys: { p256dh: 'a', auth: 'b' } },
    // http:// no sirve: el servicio de push exige https y sin esto la fila
    // aceptada nunca podría recibir nada.
    { endpoint: 'http://ok.example/1', keys: { p256dh: 'a', auth: 'b' } },
  ]
  for (const malo of basicos) {
    const resultado = await push.suscribir('admin@ctp.com', malo)
    assert.equal(resultado.ok, false, `debería rechazar: ${JSON.stringify(malo)}`)
  }
  assert.equal(suscripciones.size, 0)
})

probar('desuscribir quita solo el equipo indicado, no los demás', async () => {
  limpiar()
  const movil = await suscribirFalsa('admin@ctp.com', 'movil')
  await suscribirFalsa('admin@ctp.com', 'portatil')
  assert.equal(suscripciones.size, 2)

  await push.desuscribir('admin@ctp.com', movil)
  assert.equal(suscripciones.size, 1)
  assert.ok(![...suscripciones.keys()].includes(movil))
  // El portátil sigue: es lo que espera alguien que activa en el móvil y en el
  // portátil y apaga solo en el móvil.
  assert.ok([...suscripciones.keys()].some((e) => e.includes('portatil')))
})

probar('desuscribir sin equipo quita todos los de la cuenta', async () => {
  limpiar()
  await suscribirFalsa('admin@ctp.com', 'movil')
  await suscribirFalsa('admin@ctp.com', 'portatil')
  await suscribirFalsa('super@ctp.com', 'movil')
  await push.desuscribir('admin@ctp.com')
  assert.equal(suscripciones.size, 1)
  assert.equal([...suscripciones.values()][0].correo, 'super@ctp.com')
})

probar('desuscribir no toca las suscripciones de otro usuario', async () => {
  // Con endpoint incluido: si no se filtra por correo, un endpoint adivinado
  // podría borrar la suscripción de otra cuenta.
  limpiar()
  const endpoint = await suscribirFalsa('jefe@ctp.com', 'movil')
  await push.desuscribir('admin@ctp.com', endpoint)
  assert.equal(suscripciones.size, 1)
})

// ------------------------------------------------------------ destinatarios

probar('correoQueCumplen trae admins activos y deja fuera a los dados de baja', async () => {
  const correos = await push.correosQueCumplen({ roles: ['administrador', 'superadmin'] })
  assert.deepEqual(correos.sort(), ['admin@ctp.com', 'jefe@ctp.com', 'super@ctp.com'])
  assert.ok(!correos.includes('baja@ctp.com'), 'una cuenta desactivada no debe recibir avisos')
  assert.ok(!correos.includes('cond1@ctp.com'), 'un conductor no es destinatario de avisos de admin')
})

probar('correoQueCumplen con correos sueltos los trae aunque no sean admin', async () => {
  const correos = await push.correosQueCumplen({ correos: ['cliente@acme.com', 'cond1@ctp.com'] })
  assert.deepEqual(correos.sort(), ['cliente@acme.com', 'cond1@ctp.com'])
})

probar('correoQueCumplen sin condiciones no toca la base', async () => {
  assert.deepEqual(await push.correosQueCumplen({}), [])
  assert.deepEqual(await push.correosQueCumplen(), [])
})

// ------------------------------------------------------------------- eventos

probar('una solicitud nueva avisa a los admins pero no al que la creó', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: null,
    fila: FILA,
    actor: { correo: 'admin@ctp.com', rol: 'administrador' },
    historial: [],
  })
  assert.equal(eventos.length, 1)
  const evento = eventos[0]
  assert.match(evento.titulo, /Solicitud nueva/)
  assert.ok(!evento.destinatarios.includes('admin@ctp.com'), 'el actor ya la tiene en pantalla')
  assert.deepEqual(evento.destinatarios.sort(), ['jefe@ctp.com', 'super@ctp.com'])
})

probar('una solicitud nueva no avisa al propio solicitante', async () => {
  // Si un admin es también solicitante de otro pedido, el aviso de "hay una
  // solicitud nueva por revisar" no debe llegarle por su condición de solicitante.
  limpiar()
  const eventos = await push.eventosDe({
    anterior: null,
    fila: { ...FILA, solicitante_correo: 'jefe@ctp.com' },
    actor: { correo: 'admin@ctp.com', rol: 'administrador' },
    historial: [],
  })
  assert.equal(eventos.length, 1)
  assert.ok(!eventos[0].destinatarios.includes('jefe@ctp.com'))
  assert.deepEqual(eventos[0].destinatarios, ['super@ctp.com'])
})

probar('asignar una solicitud avisa al que la recibe', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, asignado_correo: '' },
    fila: { ...FILA, asignado_correo: 'jefe@ctp.com' },
    actor: { correo: 'super@ctp.com', rol: 'superadmin' },
    historial: [],
  })
  const asignacion = eventos.find((e) => e.titulo.includes('asignaron'))
  assert.ok(asignacion, `esperaba un aviso de asignación, hubo: ${eventos.map((e) => e.titulo)}`)
  assert.deepEqual(asignacion.correos, ['jefe@ctp.com'])
})

probar('asignar una solicitud NO avisa al que ya la tenía', async () => {
  // Reasignar entre saves (el frontend reenvía la fila entera) no puede generar
  // un aviso por guardado: sería un pitido por cada guardado posterior.
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, asignado_correo: 'jefe@ctp.com' },
    fila: { ...FILA, asignado_correo: 'jefe@ctp.com' },
    actor: { correo: 'super@ctp.com', rol: 'superadmin' },
    historial: [],
  })
  assert.equal(eventos.filter((e) => e.titulo.includes('asignaron')).length, 0)
})

probar('una entrega en tránsito avisa al conductor, no a los admins', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'En Trámite' },
    fila: { ...FILA, estado: 'En tránsito', conductor_correo: 'cond1@ctp.com', conductor: 'Pedro' },
    actor: { correo: 'admin@ctp.com', rol: 'administrador' },
    historial: [],
  })
  const entrega = eventos.find((e) => e.titulo.includes('entrega'))
  assert.ok(entrega, `esperaba el aviso de entrega, hubo: ${eventos.map((e) => e.titulo)}`)
  assert.deepEqual(entrega.correos, ['cond1@ctp.com'])
})

probar('el conductor no recibe el aviso si ya venía en tránsito y era suyo', async () => {
  limpiar()
  const anterior = {
    ...FILA,
    estado: 'En tránsito',
    conductor_correo: 'cond1@ctp.com',
    asignado_correo: 'cond1@ctp.com',
  }
  const eventos = await push.eventosDe({
    anterior,
    fila: { ...anterior },
    actor: { correo: 'admin@ctp.com', rol: 'administrador' },
    historial: [],
  })
  assert.equal(eventos.filter((e) => e.titulo.includes('entrega')).length, 0)
})

probar('el conductor que registra la entrega no se avisa a sí mismo', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'En tránsito', conductor_correo: 'cond1@ctp.com' },
    fila: { ...FILA, estado: 'Entregado', conductor_correo: 'cond1@ctp.com', conductor: 'Pedro' },
    actor: { correo: 'cond1@ctp.com', rol: 'conductor' },
    historial: [],
  })
  const entregado = eventos.find((e) => /entregado/i.test(e.titulo))
  assert.ok(entregado)
  assert.ok(!entregado.destinatarios.includes('cond1@ctp.com'), 'ya lo tiene en pantalla')
  assert.ok(entregado.destinatarios.includes('cliente@acme.com'), 'el solicitante sí debe enterarse')
})

probar('pedido entregado avisa a los admins y al solicitante', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'En tránsito' },
    fila: { ...FILA, estado: 'Entregado', conductor: 'Pedro' },
    actor: { correo: 'cond1@ctp.com', rol: 'conductor' },
    historial: [],
  })
  const entregado = eventos.find((e) => /Pedido entregado/.test(e.titulo))
  assert.ok(entregado, `esperaba el aviso de entregado, hubo: ${eventos.map((e) => e.titulo)}`)
  assert.deepEqual(entregado.destinatarios.sort(), [
    'admin@ctp.com', 'cliente@acme.com', 'jefe@ctp.com', 'super@ctp.com',
  ])
})

probar('un admin que entrega ve el aviso al resto, no a sí mismo', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'En tránsito' },
    fila: { ...FILA, estado: 'Entregado' },
    actor: { correo: 'admin@ctp.com', rol: 'administrador' },
    historial: [],
  })
  const entregado = eventos.find((e) => /Pedido entregado/.test(e.titulo))
  assert.ok(!entregado.destinatarios.includes('admin@ctp.com'))
  assert.ok(entregado.destinatarios.includes('super@ctp.com'))
  assert.ok(entregado.destinatarios.includes('cliente@acme.com'))
})

probar('cambió el estado de lo que tiene asignado el admin, y es otro', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'Abierto', asignado_correo: 'jefe@ctp.com' },
    fila: { ...FILA, estado: 'Retenido por Cartera', asignado_correo: 'jefe@ctp.com' },
    actor: { correo: 'super@ctp.com', rol: 'superadmin' },
    historial: [],
  })
  const cambio = eventos.find((e) => e.titulo.includes('estado'))
  assert.ok(cambio, `esperaba el aviso de estado, hubo: ${eventos.map((e) => e.titulo)}`)
  assert.deepEqual(cambio.correos, ['jefe@ctp.com'])
})

probar('quien cambia el estado de lo suyo no recibe el aviso', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'Abierto', asignado_correo: 'jefe@ctp.com' },
    fila: { ...FILA, estado: 'Retenido por Cartera', asignado_correo: 'jefe@ctp.com' },
    actor: { correo: 'jefe@ctp.com', rol: 'administrador' },
    historial: [],
  })
  assert.equal(eventos.filter((e) => e.titulo.includes('estado')).length, 0)
})

probar('una mala calificación genera un aviso de calidad', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'Entregado' },
    fila: { ...FILA, estado: 'Entregado' },
    actor: { correo: 'cond1@ctp.com', rol: 'conductor' },
    historial: [{ id: 'h1', campo: 'encuesta', encuesta: encuestaMala }],
  })
  const calidad = eventos.find((e) => e.titulo.includes('Calificación baja'))
  assert.ok(calidad, `esperaba el aviso de calidad, hubo: ${eventos.map((e) => e.titulo)}`)
  assert.match(calidad.titulo, /1\.6/)
  assert.ok(calidad.destinatarios.includes('cliente@acme.com'))
  assert.ok(calidad.destinatarios.includes('super@ctp.com'))
})

probar('una encuesta buena no genera aviso de calidad', async () => {
  limpiar()
  const eventos = await push.eventosDe({
    anterior: { ...FILA, estado: 'Entregado' },
    fila: { ...FILA, estado: 'Entregado' },
    actor: { correo: 'cond1@ctp.com', rol: 'conductor' },
    historial: [{ id: 'h1', campo: 'encuesta', encuesta: { promedio: 4.4, nombreEncuestado: 'ANA' } }],
  })
  assert.equal(eventos.filter((e) => e.titulo.includes('Calificación')).length, 0)
})

probar('guardar dos veces lo mismo no duplica avisos', async () => {
  // El frontend reenvía el historial entero en cada guardado, así que un mismo
  // registro puede aparecer dos veces en la misma petición. Si el aviso se
  // emitiera dos veces, el usuario recibiría dos notificaciones idénticas
  // seguidas por un solo guardado: la clave de cada evento es lo que evita eso,
  // y se comprueba en despachar(), que es donde se aplica.
  limpiar()
  await suscribirFalsa('super@ctp.com', 'movil')
  await suscribirFalsa('jefe@ctp.com', 'movil')
  const historial = [
    { id: 'h1', campo: 'encuesta', encuesta: encuestaMala },
    { id: 'h1', campo: 'encuesta', encuesta: encuestaMala },
  ]

  callar()
  let resultado
  try {
    resultado = await push.despachar(null, {
      anterior: { ...FILA, estado: 'Entregado' },
      fila: { ...FILA, estado: 'Entregado' },
      actor: { correo: 'cond1@ctp.com', rol: 'conductor' },
      historial,
    })
  } finally {
    hablar()
  }
  assert.equal(resultado.eventos, 1, 'los dos registros de historial deben fundirse en un aviso')
  assert.equal(resultado.enviados, 2, 'y ese aviso se envía una sola vez a cada equipo')
})

probar('un guardado no genera ningún evento si nada cambió de verdad', async () => {
  limpiar()
  const anterior = { ...FILA, estado: 'En tránsito', conductor_correo: 'cond1@ctp.com', asignado_correo: 'jefe@ctp.com' }
  const eventos = await push.eventosDe({
    anterior,
    fila: { ...anterior },
    actor: { correo: 'super@ctp.com', rol: 'superadmin' },
    historial: [],
  })
  assert.equal(eventos.length, 0, `no debería haber avisos, hubo: ${eventos.map((e) => e.titulo)}`)
})

// -------------------------------------------------------------------- envío

probar('enviar llega solo a los equipos suscritos de esos correos', async () => {
  limpiar()
  await suscribirFalsa('admin@ctp.com', 'movil')
  await suscribirFalsa('admin@ctp.com', 'portatil')
  await suscribirFalsa('jefe@ctp.com', 'movil')
  await suscribirFalsa('cond1@ctp.com', 'movil')

  const resultado = await push.enviar(
    ['admin@ctp.com', 'jefe@ctp.com'],
    { titulo: 'Prueba', cuerpo: 'Hola', tag: 't', url: '/solicitudes' }
  )
  assert.equal(resultado.destinatarios, 3)
  assert.equal(resultado.enviados, 3)
  assert.equal(envios.length, 3)
  // El conductor no estaba en la lista: ni una notificación suya.
  assert.ok(!envios.some((e) => e.correo === 'cond1@ctp.com'))
  // Los dos equipos del mismo admin reciben su propia copia: cada equipo es una
  // suscripción y cada una va por separado.
  assert.equal(envios.filter((e) => e.correo === 'admin@ctp.com').length, 2)
  // Y lo que viaja es texto JSON con lo que el service worker sabe leer.
  assert.equal(envios[0].carga.titulo, 'Prueba')
  assert.equal(envios[0].carga.url, '/solicitudes')
  assert.ok(envios[0].opciones.TTL > 0, 'sin TTL los navegadores tiran el aviso en sleeping tabs')
})

probar('un 410 del navegador borra la suscripción y no se repite', async () => {
  // El navegador responde 404/410 cuando la suscripción ya no existe (se
  // desinstaló la PWA, se cerró sesión en el servicio). La fila debe borrarse
  // sola: si no, cada evento futuro volvería a intentar mandarle a un
  // dispositivo fantasma y llenaría el log de errores.
  limpiar()
  const endpoint = await suscribirFalsa('admin@ctp.com', 'movil')
  fallosSimulados.set(endpoint, 410)

  callar()
  let resultado
  try {
    resultado = await push.enviar(['admin@ctp.com'], { titulo: 'Prueba', cuerpo: 'Hola' })
  } finally {
    hablar()
  }
  assert.equal(resultado.enviados, 0)
  assert.equal(suscripciones.size, 0, 'la suscripción muerta debe quedar borrada')

  // Y al siguiente evento ya ni se intenta.
  const segundo = await push.enviar(['admin@ctp.com'], { titulo: 'Otra', cuerpo: 'Otra' })
  assert.equal(segundo.destinatarios, 0)
  assert.equal(envios.length, 0)
})

probar('un 404 también se limpia, y un 500 no borra la suscripción', async () => {
  // La diferencia importa: 404/410 es "este dispositivo ya no está", pero un 500
  // es un problema del servicio de push. Si se borrara la fila por un 500, un
  // fallo pasajero dejaría a alguien sin avisos para siempre.
  limpiar()
  const temporal = await suscribirFalsa('admin@ctp.com', 'movil')
  fallosSimulados.set(temporal, 500)

  callar()
  let resultado
  try {
    resultado = await push.enviar(['admin@ctp.com'], { titulo: 'Prueba', cuerpo: 'Hola' })
  } finally {
    hablar()
  }
  assert.equal(resultado.enviados, 0)
  assert.equal(suscripciones.size, 1, 'un 500 del servicio no puede borrar la suscripción')

  const endpoint404 = await suscribirFalsa('jefe@ctp.com', 'movil')
  fallosSimulados.set(endpoint404, 404)
  callar()
  try {
    await push.enviar(['jefe@ctp.com'], { titulo: 'Prueba', cuerpo: 'Hola' })
  } finally {
    hablar()
  }
  assert.equal(suscripciones.size, 1)
  assert.ok(![...suscripciones.keys()].includes(endpoint404), 'un 404 sí se limpia')
})

probar('enviar a quien no tiene equipos suscritos no rompe nada', async () => {
  limpiar()
  const resultado = await push.enviar(['nadie@ctp.com'], { titulo: 'Prueba', cuerpo: '' })
  assert.equal(resultado.enviados, 0)
  assert.equal(resultado.destinatarios, 0)
})

probar('despachar manda el aviso solo a quien le toca', async () => {
  limpiar()
  await suscribirFalsa('super@ctp.com', 'movil')
  await suscribirFalsa('jefe@ctp.com', 'movil')
  // El que creó la solicitud no debe recibir su propio aviso.
  await suscribirFalsa('admin@ctp.com', 'movil')

  callar()
  let resultado
  try {
    resultado = await push.despachar(null, {
      anterior: null,
      fila: FILA,
      actor: { correo: 'admin@ctp.com', rol: 'administrador' },
      historial: [],
    })
  } finally {
    hablar()
  }
  assert.equal(resultado.eventos, 1)
  assert.equal(resultado.enviados, 2)
})

probar('despachar sin cambios no manda nada', async () => {
  limpiar()
  await suscribirFalsa('super@ctp.com', 'movil')
  const anterior = { ...FILA, estado: 'En tránsito', conductor_correo: 'cond1@ctp.com', asignado_correo: 'jefe@ctp.com' }
  const resultado = await push.despachar(null, {
    anterior,
    fila: { ...anterior },
    actor: { correo: 'super@ctp.com', rol: 'superadmin' },
    historial: [],
  })
  assert.equal(resultado.eventos, 0)
  assert.equal(resultado.enviados, 0)
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
  console.log(`\npush: ${pruebas.length - fallos}/${pruebas.length} pruebas OK`)
  process.exit(fallos > 0 ? 1 : 0)
})()
