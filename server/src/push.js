// ============================================================================
// Notificaciones push (Web Push / VAPID)
//
// Qué resuelve esto y por qué no lo hace el código que ya existía:
//
// La Notification API del navegador (src/services/notificaciones.jsx) SOLO
// existe mientras hay una pestaña viva. Con la app en otra pestaña el aviso se
// pierde en cuanto el polling se detiene —que es exactamente lo que pasa,
// porque el polling se pausa cuando document.hidden—, con el navegador cerrado
// no hay nada, y con el celular bloqueado tampoco.
//
// Web Push invierte eso: el SERVIDOR es quien empuja el aviso a través de los
// servidores de Mozilla/Google/Apple, y el service worker de la app lo muestra
// aunque no haya ninguna pestaña abierta. El coste es que hay que guardar a quién
// se le empuja (la suscripción) y decidir en el servidor quién recibe cada evento.
//
// Por eso este módulo tiene dos mitades:
//
//   1. Suscripciones: guardar y quitar los "endpoint" que el navegador entrega al
//      suscribirse. Cada dispositivo (o navegador) es uno.
//   2. deciding(): a quién le toca enterarse de un evento. Es el espejo de
//      avisarCambiosRemotos() en el frontend. La lógica está en los dos lados a
//      propósito: el frontend cubre el caso "app abierta" sin latencia y el
//      servidor cubre "app cerrada". Cuando cambien las reglas hay que tocarlas
//      las dos, y avisarCambiosRemotos lo dice junto a su código.
//
// Nunca lanza, por el mismo motivo que el correo: quien llama ya guardó el
// cambio, y perder un guardado por un push caído sería mucho peor que perder el
// aviso.
// ============================================================================
'use strict'

const webpush = require('web-push')

const config = require('./config')
const { pool } = require('./db')

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

// ¿Hay claves VAPID? Sin ellas no se puede firmar nada, y tratar de hacerlo
// lanzaría en cada envío. Se comprueba una vez y se cachea el resultado.
const hayClaves = Boolean(config.push.publica && config.push.privada)
let avisadoSinClaves = false

// El servicio de web-push solo se configura una vez: setVapidDetails es global al
// módulo y llamarlo en cada envío es trabajo inútil.
let servicioConfigurado = false
function configurarServicio() {
  if (!hayClaves || servicioConfigurado) return hayClaves
  try {
    webpush.setVapidDetails(
      config.push.contacto,
      config.push.publica,
      config.push.privada
    )
    servicioConfigurado = true
  } catch (error) {
    console.error(`[Push] claves VAPID rechazadas por la librería: ${error?.message}`)
  }
  return servicioConfigurado
}

// ---------------------------------------------------------------------------
// Tabla de suscripciones
//
// No viene en schema.mysql.sql a propósito: se crea sola la primera vez, igual
// que correos_enviados. Así un hosting que ya está desplegado no necesita que
// alguien pegue SQL en phpMyAdmin para que le lleguen los avisos.
// ---------------------------------------------------------------------------

let tablaIntentada = false

async function asegurarTabla() {
  if (tablaIntentada) return true
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS push_suscripciones (
        id            INT AUTO_INCREMENT NOT NULL,
        correo        VARCHAR(190) NOT NULL,
        endpoint      VARCHAR(500) NOT NULL,
        clave_publica VARCHAR(255) NOT NULL,
        clave_privada VARCHAR(255) NOT NULL,
        agente        VARCHAR(255) NOT NULL DEFAULT '',
        creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        visto_en      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        -- El endpoint es un identificador largo y único: sin este índice cada
        -- alta volvería a comprobar contra toda la tabla, y MySQL no indexa
        -- VARCHAR(500) entero (límite de 3072 bytes en utf8mb4).
        UNIQUE KEY push_endpoint_uq (endpoint(191)),
        KEY push_correo_idx (correo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    tablaIntentada = true
    return true
  } catch (error) {
    // No se registra cada intento: si la tabla no se puede crear, el error va a
    // salir igual en cada envío y llenaría el log del hosting.
    console.error(`[Push] no se pudo crear/verificar push_suscripciones: ${error?.message}`)
    return false
  }
}

// Normaliza lo que llega del navegador. El service worker y el cliente lo mandan
// como { endpoint, expirationTime, keys: { p256dh, auth } }.
function normalizarSuscripcion(entrada) {
  if (!entrada || typeof entrada !== 'object') return null
  const endpoint = String(entrada.endpoint || '').trim()
  const claves = entrada.keys || entrada.claves || {}
  const publica = String(claves.p256dh || claves.publica || '').trim()
  const privada = String(claves.auth || claves.privada || '').trim()
  // Un endpoint de push siempre es https a un servidor de Mozilla/Google/Apple.
  // Se comprueba para no guardar basura ni aceptar que alguien use esta tabla
  // como almacenamiento arbitrario.
  if (!/^https:\/\/[a-z0-9.-]+\//i.test(endpoint)) return null
  if (!publica || !privada) return null
  // Los límites son los de las columnas: recortar aquí evita un error de MySQL
  // que se manifestaría como un 500 en el registro de la suscripción.
  return {
    endpoint: endpoint.slice(0, 500),
    publica: publica.slice(0, 255),
    privada: privada.slice(0, 255),
  }
}

// Registrar o actualizar la suscripción de un dispositivo.
//
// La clave primaria lógica es el endpoint: un mismo navegador siempre entrega el
// mismo. Si la persona inicia sesión en otro equipo se crea otra fila, y si
// vuelve a activar notificaciones en un equipo donde ya lo había hecho se
// actualiza esta en vez de duplicarla.
async function suscribir(correo, entrada, agente = '') {
  const sus = normalizarSuscripcion(entrada)
  if (!sus) return { ok: false, motivo: 'suscripción inválida' }
  if (!(await asegurarTabla())) return { ok: false, motivo: 'tabla no disponible' }

  const usuario = String(correo || '').trim().toLowerCase()
  if (!usuario) return { ok: false, motivo: 'sin usuario' }

  try {
    await pool.execute(
      `INSERT INTO push_suscripciones (correo, endpoint, clave_publica, clave_privada, agente)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         correo = VALUES(correo),
         clave_publica = VALUES(clave_publica),
         clave_privada = VALUES(clave_privada),
         agente = VALUES(agente),
         visto_en = CURRENT_TIMESTAMP(3)`,
      [usuario, sus.endpoint, sus.publica, sus.privada, String(agente || '').slice(0, 255)]
    )
    return { ok: true, endpoint: sus.endpoint }
  } catch (error) {
    console.error(`[Push] no se pudo registrar la suscripción de ${usuario}: ${error?.message}`)
    return { ok: false, motivo: error?.message || 'error al guardar' }
  }
}

// Dar de baja las suscripciones de un usuario. Se llama al cerrar sesión o al
// apagar el interruptor. Con `soloEndpoint` se quita una sola: es el caso de
// "desactivar en ESTE equipo", que es distinto de "desactivar en todos".
async function desuscribir(correo, soloEndpoint = '') {
  const usuario = String(correo || '').trim().toLowerCase()
  if (!usuario) return { ok: false }
  if (!(await asegurarTabla())) return { ok: false }
  try {
    const endpoint = String(soloEndpoint || '').trim()
    if (endpoint) {
      await pool.execute(
        'DELETE FROM push_suscripciones WHERE correo = ? AND endpoint = ?',
        [usuario, endpoint]
      )
    } else {
      await pool.execute('DELETE FROM push_suscripciones WHERE correo = ?', [usuario])
    }
    return { ok: true }
  } catch (error) {
    console.error(`[Push] no se pudo quitar la suscripción de ${usuario}: ${error?.message}`)
    return { ok: false }
  }
}

// Suscripciones de un conjunto de correos. Se usa para enviar, nunca para
// decidir: decidir es trabajo de decidir(), que no toca la base.
async function suscripcionesDe(correos) {
  const lista = [...new Set(
    (Array.isArray(correos) ? correos : [correos])
      .map((c) => String(c || '').trim().toLowerCase())
      .filter(Boolean)
  )]
  if (lista.length === 0) return []
  if (!(await asegurarTabla())) return []
  const marcas = lista.map(() => '?').join(', ')
  try {
    const [filas] = await pool.execute(
      `SELECT correo, endpoint, clave_publica, clave_privada FROM push_suscripciones
        WHERE correo IN (${marcas})`,
      lista
    )
    return filas || []
  } catch (error) {
    console.error(`[Push] no se pudieron leer las suscripciones: ${error?.message}`)
    return []
  }
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

// Los códigos con los que el servicio de push dice "esta suscripción ya no
// existe". No es un error del servidor: es el navegador informando que cerró el
// service worker, se desinstaló la app o se cerró sesión en el servicio de
// notificaciones. La fila se borra para no volver a intentarlo jamás.
const SUSCRIPCION_MUERTA = new Set([404, 410])

// Un envío a una persona no debe retrasar la respuesta HTTP: el usuario ya está
// esperando confirmación de su guardado. El push se manda sin esperar.
async function enviarUno(suscripcion, carga) {
  try {
    await webpush.sendNotification(
      {
        endpoint: suscripcion.endpoint,
        keys: {
          p256dh: suscripcion.clave_publica,
          auth: suscripcion.clave_privada,
        },
      },
      // El payload viaja como texto JSON: web-push solo admite string o Buffer,
      // y el service worker lo vuelve a convertir con JSON.parse.
      JSON.stringify(carga),
      { TTL: 60 * 60 * 6, urgency: 'high' }
    )
    return true
  } catch (error) {
    const codigo = error?.statusCode
    if (SUSCRIPCION_MUERTA.has(codigo)) {
      try {
        await pool.execute('DELETE FROM push_suscripciones WHERE endpoint = ?', [suscripcion.endpoint])
        console.log(`[Push] suscripción retirada (${codigo}): ya no existe en el navegador`)
      } catch (errorBorrar) {
        console.warn(`[Push] no se pudo limpiar la suscripción muerta: ${errorBorrar?.message}`)
      }
      return false
    }
    // 413 = el payload era demasiado grande. Es un fallo de este código, no del
    // dispositivo, así que se avisa: significa que un texto se está yendo de las
    // manos.
    console.error(
      `[Push] envío a ${suscripcion.correo} falló${codigo ? ` (${codigo})` : ''}: ${error?.message}`
    )
    return false
  }
}

// Envía una carga a los correos indicados. `carga` es el objeto que viaja al
// service worker: { titulo, cuerpo, tag, url, datos, sonido }.
async function enviar(correos, carga) {
  if (!configurarServicio()) return { enviados: 0, destinatarios: 0 }
  const suscripciones = await suscripcionesDe(correos)
  if (suscripciones.length === 0) return { enviados: 0, destinatarios: 0 }
  const resultados = await Promise.all(suscripciones.map((s) => enviarUno(s, carga)))
  const enviados = resultados.filter(Boolean).length
  console.log(`[Push] «${carga.titulo}» a ${enviados}/${suscripciones.length} dispositivo(s)`)
  return { enviados, destinatarios: suscripciones.length }
}

// ---------------------------------------------------------------------------
// A quién se avisa
//
// Aquí está el corazón del asunto. Las reglas replican las de
// avisarCambiosRemotos() del frontend, y por diseño son conservadoras: es peor
// equivocar el destinatario y mandar un aviso interno a un solicitante (datos de
// otro cliente) que no avisar de más.
//
// El actor (quien hizo el cambio) queda siempre excluido: ya tiene la pantalla
// delante y el toast saliendo. Avisarle a él por push sería ruido.
// ---------------------------------------------------------------------------

const ROLES_ADMIN = ['administrador', 'superadmin']

// Consulta en una sola pasada a los usuarios que encajan con un conjunto de
// roles y correos. Devuelve correos, no filas: al enviar solo importa a quién.
async function correosQueCumplen({ roles = [], correos = [] } = {}) {
  const condiciones = []
  const valores = []

  const rolesLimpios = roles.map((r) => String(r || '').trim()).filter(Boolean)
  if (rolesLimpios.length > 0) {
    condiciones.push(`rol IN (${rolesLimpios.map(() => '?').join(', ')})`)
    valores.push(...rolesLimpios)
  }

  const correosLimpios = [...new Set(
    correos.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
  )]
  if (correosLimpios.length > 0) {
    condiciones.push(`correo IN (${correosLimpios.map(() => '?').join(', ')})`)
    valores.push(...correosLimpios)
  }

  if (condiciones.length === 0) return []

  try {
    const [filas] = await pool.execute(
      // activo = 1: un usuario desactivado no debe recibir avisos. La fila se
      // queda (no se borra) para que al reactivarlo le vuelva a llegar.
      `SELECT correo FROM usuarios WHERE activo = 1 AND (${condiciones.join(' OR ')})`,
      valores
    )
    return filas.map((f) => String(f.correo || '').trim().toLowerCase()).filter(Boolean)
  } catch (error) {
    console.error(`[Push] no se pudieron buscar destinatarios: ${error?.message}`)
    return []
  }
}

// Un mismo evento puede llegar por dos caminos (ej. "te asignaron esto" y
// "cambió el estado de lo que tienes asignado"). Se quita el actor y se
// deduplica, porque mandar dos notificaciones casi idénticas seguidas es peor
// que mandar una.
function limpiarDestinatarios(correos, actor) {
  const fuera = String(actor || '').trim().toLowerCase()
  return [...new Set(
    (Array.isArray(correos) ? correos : [])
      .map((c) => String(c || '').trim().toLowerCase())
      .filter((c) => c && c !== fuera)
  )]
}

// Los estados en los que la solicitud está en manos del conductor: entrar aquí
// es lo que dispara el aviso de "te asignaron una entrega". Deben coincidir con
// ESTADOS_TRANSITO del frontend.
const ESTADOS_TRANSITO = new Set(['En tránsito', 'En Tránsito', 'En tránsito parcial', 'En Tránsito Parcial'])
const ESTADOS_ENTREGA = new Set(['Entregado', 'Entregado Parcial'])

// Detecta los eventos de un guardado comparando la fila de antes con la de ahora.
// Devuelve la lista de eventos con nombre y destinatarios ya resueltos por rol
// o por correo; el envío los traduce a suscripciones.
async function eventosDe({ anterior, fila, actor, historial = [] }) {
  const eventos = []
  const actorCorreo = String(actor?.correo || '').trim().toLowerCase()

  const solicitante = String(fila?.solicitante_correo || '').trim().toLowerCase()
  const asignado = String(fila?.asignado_correo || '').trim().toLowerCase()
  const conductor = String(fila?.conductor_correo || '').trim().toLowerCase()
  const codigo = String(fila?.codigo || '').trim()

  // --- Solicitud nueva -----------------------------------------------------
  // Nadie la había visto todavía. Se avisa a los administradores, menos al que
  // la creó (ya la tiene en pantalla) y menos al propio solicitante (es suya).
  if (!anterior) {
    const destinatarios = limpiarDestinatarios(
      await correosQueCumplen({ roles: ROLES_ADMIN }),
      actorCorreo
    ).filter((c) => c !== solicitante)
    if (destinatarios.length > 0) {
      eventos.push({
        clave: `nueva:${codigo}`,
        titulo: 'Solicitud nueva',
        cuerpo: `${fila?.cliente || codigo}${fila?.numero_referencia ? ` · ${fila.numero_referencia}` : ''} necesita revisión.`,
        url: `/solicitudes?s=${encodeURIComponent(codigo)}`,
        tag: `ctp-nueva-${codigo}`,
        roles: ROLES_ADMIN,
        excluir: [actorCorreo, solicitante],
        destinatarios,
      })
    }
  }

  // --- Asignación a un administrador ---------------------------------------
  // Solo si antes no era suya. Si ya estaba asignada, no hay nada nuevo.
  const asignadoAntes = String(anterior?.asignado_correo || '').trim().toLowerCase()
  if (anterior && asignado && asignado !== actorCorreo && asignado !== asignadoAntes) {
    eventos.push({
      clave: `asignacion:${codigo}:${asignado}`,
      titulo: 'Te asignaron una solicitud',
      cuerpo: `${fila?.cliente || codigo} quedó a tu nombre.`,
      url: `/solicitudes?s=${encodeURIComponent(codigo)}`,
      tag: `ctp-asignada-${codigo}`,
      correos: [asignado],
      excluir: [actorCorreo],
    })
  }

  // --- Conductor: le mandaron una entrega a entregar -----------------------
  // Entra en tránsito Y es suya. Solo al conductor, nunca a los admins: el
  // conductor no necesita enterarse de otra cosa.
  const estadoAhora = String(fila?.estado || '')
  const estadoAntes = String(anterior?.estado || '')
  // Para saber si la entrega es nueva hay que comparar el CONDUCTOR de antes con
  // el de ahora. Comparar con asignado_correo no sirve: casi siempre son campos
  // distintos y el conductor anterior se compararía contra un administrador, así
  // que un simple guardado posterior de una entrega ya en tránsito se tomaría por
  // una asignación nueva.
  const conductorAntes = String(anterior?.conductor_correo || '').trim().toLowerCase()
  if (conductor && conductor !== actorCorreo && ESTADOS_TRANSITO.has(estadoAhora)) {
    if (!anterior || !ESTADOS_TRANSITO.has(estadoAntes) || conductorAntes !== conductor) {
      eventos.push({
        clave: `entrega:${codigo}:${conductor}`,
        titulo: 'Te asignaron una entrega',
        cuerpo: `${fila?.cliente || codigo} está en tránsito y te toca entregar.`,
        url: '/conductor',
        tag: `ctp-entrega-${codigo}`,
        correos: [conductor],
        excluir: [actorCorreo],
      })
    }
  }

  // --- Pedido entregado ----------------------------------------------------
  // A los administradores y al solicitante dueño. Es el evento que más importa
  // fuera de la app: quien está fuera es justamente quien no sabe que ya llegó.
  if (anterior && ESTADOS_ENTREGA.has(estadoAhora) && estadoAhora !== estadoAntes) {
    const parcial = estadoAhora === 'Entregado Parcial'
    // Siempre se consultan los admins, también cuando quien entrega es un
    // administrador. La variable `esAdmin` no se usa aquí como atajo para "los
    // admins no les interesa": solo sirve para no contarse a sí mismo. Si un
    // administrador registra la entrega, los OTROS admins sí deben enterarse.
    const admins = await correosQueCumplen({ roles: ROLES_ADMIN })
    const destinatarios = limpiarDestinatarios([...admins, solicitante], actorCorreo)
    if (destinatarios.length > 0) {
      eventos.push({
        clave: `entregado:${codigo}:${estadoAhora}`,
        titulo: parcial ? 'Entrega parcial registrada' : 'Pedido entregado',
        cuerpo: `${fila?.cliente || codigo}${fila?.conductor ? ` · Conductor: ${fila.conductor}` : ''}.`,
        url: `/solicitudes?s=${encodeURIComponent(codigo)}`,
        tag: `ctp-entregado-${codigo}`,
        roles: ROLES_ADMIN,
        correos: [solicitante],
        excluir: [actorCorreo],
        destinatarios,
      })
    }
  }

  // --- Cambio de estado de lo que tiene asignado ---------------------------
  // Cuando lo movió otro. Si lo movió el mismo dueño, ya lo tiene en pantalla.
  if (anterior && asignado && asignado !== actorCorreo && estadoAhora !== estadoAntes) {
    eventos.push({
      clave: `estado:${codigo}:${estadoAhora}`,
      titulo: 'Cambió el estado',
      cuerpo: `${fila?.cliente || codigo} pasó a ${estadoAhora}.`,
      url: `/solicitudes?s=${encodeURIComponent(codigo)}`,
      tag: `ctp-estado-${codigo}-${estadoAhora}`,
      correos: [asignado],
      excluir: [actorCorreo],
    })
  }

  // --- Mala calificación ----------------------------------------------------
  // Ya sale por correo (ver correo.js). Aquí se avisa a quien lo ve, para que con
  // la app cerrada no dependa de abrir el correo.
  const calificaciones = (historial || []).filter((h) => h?.encuesta && h.encuesta.promedio != null)
  for (const entrada of calificaciones) {
    const promedio = Number(entrada.encuesta.promedio)
    if (!(promedio <= 2.5)) continue
    const destinatarios = await correosQueCumplen({ roles: ROLES_ADMIN, correos: [solicitante] })
    const limpios = limpiarDestinatarios(destinatarios, actorCorreo)
    if (limpios.length === 0) continue
    eventos.push({
      clave: `calidad:${codigo}:${entrada.id || ''}`,
      titulo: `Calificación baja (${promedio})`,
      cuerpo: `${fila?.cliente || codigo} · ${entrada.encuesta.nombreEncuestado || 'Encuesta recibida'}.`,
      url: `/solicitudes?s=${encodeURIComponent(codigo)}`,
      tag: `ctp-calidad-${codigo}`,
      roles: ROLES_ADMIN,
      correos: [solicitante],
      excluir: [actorCorreo],
      destinatarios: limpios,
    })
  }

  return eventos
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

// Dedup por clave dentro de una misma tanda: el historial que reenvía el
// frontend puede traer la misma entrada repetida, y mandar el aviso dos veces en
// el mismo instante es visible.
function deduplicar(eventos) {
  const vistas = new Set()
  const salida = []
  for (const evento of eventos) {
    if (!evento?.titulo || vistas.has(evento.clave)) continue
    vistas.add(evento.clave)
    salida.push(evento)
  }
  return salida
}

async function despachar(notificacion, { anterior = null, fila = null, actor = null, historial = [] } = {}) {
  try {
    if (!configurarServicio()) {
      if (!avisadoSinClaves) {
        avisadoSinClaves = true
        console.warn('[Push] sin claves VAPID: los avisos con la app cerrada no se pueden enviar')
      }
      return { eventos: 0, enviados: 0 }
    }

    const eventos = deduplicar(await eventosDe({ anterior, fila, actor, historial }))
    let enviados = 0
    for (const evento of eventos) {
      // Los eventos con destinatarios ya resueltos se usan tal cual (así no se
      // repite la consulta); el resto se resuelven aquí por rol/correo.
      const correos = evento.destinatarios
        || limpiarDestinatarios(
          await correosQueCumplen({ roles: evento.roles, correos: evento.correos }),
          actor?.correo
        )
      const utiles = evento.excluir
        ? correos.filter((c) => !evento.excluir.includes(String(c || '').toLowerCase()))
        : correos
      if (utiles.length === 0) continue

      const resultado = await enviar(utiles, {
        titulo: evento.titulo,
        cuerpo: evento.cuerpo,
        tag: evento.tag,
        url: evento.url,
        datos: { tipo: evento.clave.split(':')[0], codigo: fila?.codigo || '' },
      })
      enviados += resultado.enviados
    }
    return { eventos: eventos.length, enviados }
  } catch (error) {
    // Igual que el correo: nunca se pierde un guardado por una notificación.
    console.error(`[Push] fallo el despacho: ${error?.message}`)
    return { eventos: 0, enviados: 0 }
  }
}

module.exports = {
  hayClaves,
  asegurarTabla,
  suscribir,
  desuscribir,
  suscripcionesDe,
  correosQueCumplen,
  eventosDe,
  despachar,
  enviar,
  ESTADOS_TRANSITO,
  ESTADOS_ENTREGA,
  ROLES_ADMIN,
}
