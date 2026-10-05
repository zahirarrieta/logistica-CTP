'use strict'

// ============================================================================
// CORREO DE AVISOS
//
// Dos avisos automáticos, los dos salen desde el servidor y nunca desde el
// navegador:
//
//   1. Mala calificación   → al solicitante, con las áreas internas en copia.
//      Se dispara cuando una encuesta de satisfacción queda en 2.5 o menos.
//
//   2. Retención por cartera → al solicitante.
//      Se dispara cuando la solicitud pasa a estado 'Retenido por Cartera'.
//
// Por qué aquí y no en el frontend: mandar correo desde el navegador haría que
// CUALQUIER usuario con una sesión abierta pudiera enviar mensajes en nombre de
// la empresa: el remitente, y con él el dominio, quedarían en sus manos. Aquí hay
// una sola identidad —la del buzón que configura el hosting— y cada envío queda
// escrito en el log del servidor con quién lo pidió.
//
// Los avisos se deciden DESPUÉS del commit de la transacción que guardó el cambio
// (ver routes.js). Así no se avisa de nada que no haya pasado; y si el correo
// falla, la solicitud ya está guardada y no se pierde por un SMTP caído.
// ============================================================================

const nodemailer = require('nodemailer')
const config = require('./config')
const { pool } = require('./db')

// ---------------------------------------------------------------- constantes

// Umbral de la alerta de calidad: promedios menores o iguales a él disparan el
// aviso. Es el mismo valor que el frontend usaba antes de que el envío pasara al
// servidor, así que no cambia cuándo se avisa: solo cambia quién lo envía.
const UMBRAL_ALERTA_CALIDAD = 2.5

const ESTADO_RETENIDO = 'Retenido por Cartera'

// Destinatarios internos por defecto. Se pueden sustituir por entorno con
// CORREOS_ALERTA_CALIDAD / CORREOS_REENCION_CARTERA (lista separada por comas).
//
// Son operaciones, almacén, servicio al cliente (dos cuentas), cotizaciones y
// gestión de calidad: quien tiene que actuar sobre uno u otro caso.
//
// Ojo con el dominio: la lista arranca en @pedro-ctpmedica.com porque es el del
// hosting. Si alguna de estas casillas NO existe todavía, el servidor de correo
// rechaza el mensaje entero con «550 No such user» y el solicitante se queda sin
// su aviso. Por eso el despacho va en dos envíos separados (ver despacharUno).
const CORREOS_ALERTA_CALIDAD = [
  'almacen@ctpmedica.com',
  'operaciones@ctpmedica.com',
  'gestiondecalidad@ctpmedica.com',
  'cotizacionesylicitaciones@ctpmedica.com',
  'servicioalcliente2@ctpmedica.com',
]

const CORREOS_REENCION_CARTERA = []

const CALIFICACIONES = ['Malo', 'Regular', 'Bueno']

// Tope de destinatarios por mensaje. Está puesto por el servidor de correo, que
// suele recortar a los 50 destinatarios, pero es mejor enterarse en el log
// antes que descubrir que el mensaje llegó sin la mitad.
const MAXIMO_DESTINATARIOS = 20

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Los destinatarios llegan de dos sitios: el array de arriba y una variable de
// entorno. Aquí se limpian y se quitan los duplicados, porque un mismo correo
// repetido en la lista de copia es una forma fácil de que una entrega se marque
// como spam en varios servidores a la vez.
function normalizarCorreos(valor) {
  const lista = Array.isArray(valor) ? valor : String(valor || '').split(',')
  const vistos = new Set()
  const salida = []
  for (const crudo of lista) {
    const correo = String(crudo || '').trim().toLowerCase()
    if (!correo || vistos.has(correo)) continue
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) continue
    vistos.add(correo)
    salida.push(correo)
  }
  return salida.slice(0, MAXIMO_DESTINATARIOS)
}

// Lo que llega en el cuerpo de la petición puede venir como objeto o como texto
// (según quién construyó la petición), y lo que sale de MySQL puede venir
// igual. Se normaliza a objeto o null para no tener que comprobarlo en cada uso.
function objetoONull(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor
  if (typeof valor === 'string' && valor.trim()) {
    try {
      const parseado = JSON.parse(valor)
      return parseado && typeof parseado === 'object' && !Array.isArray(parseado) ? parseado : null
    } catch {
      return null
    }
  }
  return null
}

function fechaLegible() {
  const ahora = new Date()
  return ahora.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
}

// ---------------------------------------------------------------------------
// Configuración efectiva
// ---------------------------------------------------------------------------
// Mala calificación: copia a las 5 áreas internas (dominio @ctpmedica.com).
// Retención por cartera: sin copia (solo al solicitante).
function copiaCalidad() {
  const deEntorno = normalizarCorreos(config.correo.copiaCalidad)
  return deEntorno.length > 0 ? deEntorno : normalizarCorreos(CORREOS_ALERTA_CALIDAD)
}

function copiaCartera() {
  return []
}

// Casilla que SIEMPRE recibe, aunque el resto de la lista interna no exista. Es
// la que el hosting tiene creada, así que es la que no puede hacer fallar un
// envío. Por defecto es la misma que emite (MAIL_USER); con MAIL_OPERATIVO se
// puede separar la casilla que envía de la que responsablemente recibe.
function casillaOperativa() {
  const declarada = normalizarCorreos(config.correo.operativo)[0]
  if (declarada) return declarada
  const usuario = normalizarCorreos(config.correo.usuario)[0]
  if (usuario) return usuario
  return String(config.correo.remitente || '').trim().toLowerCase()
}

// ¿Se puede enviar? Faltan el servidor y el remitente: sin remitente el mensaje
// saldría con el nombre de la cuenta del hosting, que no es lo que se quiere
// que vea el cliente.
function correoConfigurado() {
  return Boolean(config.correo.host && config.correo.remitente)
}

// ---------------------------------------------------------------------------
// Transporte SMTP
//
// Se crea una vez y se reutiliza: abrir y cerrar la conexión TLS en cada aviso
// cuesta más que el propio envío, y son varios por minuto en temporada alta.
// ---------------------------------------------------------------------------
let transporte = null

function obtenerTransporte() {
  if (!correoConfigurado()) return null
  if (transporte) return transporte
  transporte = nodemailer.createTransport({
    host: config.correo.host,
    port: config.correo.puerto,
    secure: config.correo.secure,
    auth: config.correo.usuario
      ? { user: config.correo.usuario, pass: config.correo.clave }
      : undefined,
    // Tiempos de espera cortos y explícitos. Un SMTP colgado (firewall que tira
    // los paquetes, buzón que no responde) no puede dejar una petición colgada:
    // el aviso se pierde, pero la entrega ya está guardada.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
  return transporte
}

// Permite forzar un transporte propio en las pruebas.
function usarTransporte(custom) {
  transporte = custom
}

// ---------------------------------------------------------------------------
// Registro de enviados (evita duplicados)
//
// El frontend manda el historial COMPLETO de la solicitud en cada guardado, no
// solo lo nuevo (ver empujarSolicitud en src/services/solicitudesApi.js). Sin un
// registro de lo ya enviado, la misma encuesta de una mala calificación avisaría
// en cada guardado posterior de ese pedido, y lo mismo con la retención por
// cartera.
//
// La clave es el id del registro de historial, que el navegador genera una sola
// vez con crypto.randomUUID y luego reenvía siempre igual: eso convierte un
// guardado repetido en el mismo aviso en una no-op.
//
// INSERT IGNORE con clave primaria única hace el trabajo atómico: dos guardados
// simultáneos del mismo pedido compiten por la misma fila y solo uno la gana.
// ---------------------------------------------------------------------------
let tablaVerificada = false

const CREAR_TABLA = `CREATE TABLE IF NOT EXISTS correos_enviados (
  clave       VARCHAR(190) NOT NULL,
  tipo        VARCHAR(40)  NOT NULL DEFAULT '',
  solicitud   VARCHAR(32)  NOT NULL DEFAULT '',
  destinatario VARCHAR(190) NOT NULL DEFAULT '',
  asunto      VARCHAR(255) NOT NULL DEFAULT '',
  enviado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clave),
  KEY correos_enviados_solicitud_idx (solicitud),
  KEY correos_enviados_fecha_idx (enviado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

async function asegurarTabla() {
  if (tablaVerificada) return true
  await pool.execute(CREAR_TABLA)
  tablaVerificada = true
  console.log('[Correo] tabla correos_enviados lista')
  return true
}

// Si la base no está disponible o el usuario de MySQL no tiene permiso para
// crear tablas, el envío sigue siendo posible: solo se pierde la protección
// contra duplicados dentro de este proceso, y se avisa una vez en el log.
let avisadoDeDedupe = false

async function reservar(clave, aviso) {
  try {
    await asegurarTabla()
    const [resultado] = await pool.execute(
      `INSERT IGNORE INTO correos_enviados (clave, tipo, solicitud, destinatario, asunto)
       VALUES (?, ?, ?, ?, ?)`,
      [clave, aviso.tipo, aviso.solicitud || '', aviso.para, aviso.asunto.slice(0, 255)]
    )
    // affectedRows = 0 → la fila ya existía: este aviso ya salió antes.
    return resultado.affectedRows > 0
  } catch (error) {
    if (!avisadoDeDedupe) {
      avisadoDeDedupe = true
      console.warn(
        '[Correo] no se pudo registrar el envío (se puede repetir):',
        error?.message
      )
    }
    // Sin base de registro no se puede saber si ya se mandó. Se manda antes que
    // dejar al solicitante sin su aviso: el coste de un duplicado es una copia
    // de más en su bandeja, el de perder el aviso es que no se entere.
    return true
  }
}

// Si el envío falla se libera la clave, para que un guardado posterior vuelva a
// intentarlo. Sin esto, un corte de red de treinta segundos convertiría un aviso
// en algo que nunca sale: la fila quedaría reservada para siempre.
async function liberar(clave) {
  if (!tablaVerificada) return
  try {
    await pool.execute('DELETE FROM correos_enviados WHERE clave = ?', [clave])
  } catch {
    // Nada que hacer: si no se puede liberar, el aviso se pierde, no se duplica.
  }
}

// ---------------------------------------------------------------------------
// Plantillas HTML
// ---------------------------------------------------------------------------
const COLOR_PALETA = {
  tinta: '#0A0027',
  pizarra: '#334155',
  tenue: '#64748B',
  borde: '#E2E8F0',
  panel: '#F8FAFC',
  cabecera: '#EAF4F7',
  profundo: '#003B73',
}

function colorPuntaje(p) {
  if (p <= 1) return { bg: '#FEF2F2', borde: '#FCA5A5', texto: '#B91C1C', estrella: '#EF4444' }
  if (p === 2) return { bg: '#FFF7ED', borde: '#FDBA74', texto: '#C2410C', estrella: '#F97316' }
  return { bg: '#F0FDF4', borde: '#86EFAC', texto: '#15803D', estrella: '#22C55E' }
}

function envolver({ degradado, eyebrow, titulo, subtitulo, cuerpo, pie }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid ${COLOR_PALETA.borde};">
    <div style="background:${degradado};padding:26px 28px;color:#FFFFFF;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">${escapar(eyebrow)}</div>
      <div style="font-size:24px;font-weight:900;line-height:1.15;margin-top:6px;">${escapar(titulo)}</div>
      ${subtitulo ? `<div style="font-size:14px;font-weight:700;margin-top:8px;opacity:.95;">${subtitulo}</div>` : ''}
    </div>
    <div style="padding:26px 28px;">
      ${cuerpo}
    </div>
    <div style="background:${COLOR_PALETA.cabecera};padding:16px 28px;font-size:11px;color:#475569;line-height:1.5;">
      ${pie}
    </div>
  </div>
</body>
</html>`
}

// Bloque de datos del pedido: mismo aspecto en los dos correos.
function bloqueDatos(pares) {
  const filas = pares
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(
      ([clave, valor]) => `
        <tr>
          <td style="padding:5px 10px;font-size:11px;font-weight:800;text-transform:uppercase;color:${COLOR_PALETA.tenue};letter-spacing:.03em;white-space:nowrap;width:38%;">
            ${escapar(clave)}
          </td>
          <td style="padding:5px 10px;font-size:13px;color:${COLOR_PALETA.tinta};font-weight:700;">
            ${escapar(valor)}
          </td>
        </tr>`
    )
    .join('')
  return `
    <div style="background:${COLOR_PALETA.panel};border:1px solid ${COLOR_PALETA.borde};border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:10px 14px;background:${COLOR_PALETA.tinta};color:#FFFFFF;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
        Datos del pedido
      </div>
      <table width="100%" style="border-collapse:collapse;padding:6px;">${filas}</table>
    </div>`
}

function datosPedido(solicitud) {
  return bloqueDatos([
    ['Pedido', solicitud.id || '—'],
    ['Cliente', solicitud.cliente || '—'],
    ['Zona', solicitud.zona || '—'],
    ['Factura / Remisión', solicitud.numeroReferencia || '—'],
    ['Conductor', solicitud.conductor || '—'],
    ['Vehículo', solicitud.vehiculo || '—'],
    ['Placa', solicitud.placa || '—'],
  ])
}

// ---------------------------------------------------------------------------
// Aviso 1 · mala calificación
// ---------------------------------------------------------------------------
function htmlMalaCalificacion(solicitud, encuesta) {
  const preguntas = Array.isArray(encuesta?.preguntas) ? encuesta.preguntas : []
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : 0
  const malos = preguntas.filter((p) => Number(p.puntuacion || 0) === 1).length
  const regulares = preguntas.filter((p) => Number(p.puntuacion || 0) === 2).length
  const buenos = preguntas.filter((p) => Number(p.puntuacion || 0) === 3).length
  const bajas = preguntas.filter((p) => Number(p.puntuacion || 0) <= 2)

  const filasTabla = preguntas
    .map((p, i) => {
      const puntaje = Number(p.puntuacion || 0)
      const c = colorPuntaje(puntaje)
      const desc = puntaje ? CALIFICACIONES[puntaje - 1] : 'Sin puntuar'
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR_PALETA.borde};font-size:13px;color:${COLOR_PALETA.tinta};font-weight:600;">
            ${i + 1}. ${escapar(p.pregunta)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR_PALETA.borde};text-align:center;color:${c.estrella};font-size:15px;white-space:nowrap;">
            ${puntaje ? '★'.repeat(puntaje) : '—'}
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid ${COLOR_PALETA.borde};text-align:center;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${c.bg};border:1px solid ${c.borde};color:${c.texto};">
              ${puntaje ? `${puntaje} · ${desc}` : 'Sin puntuar'}
            </span>
          </td>
        </tr>`
    })
    .join('')

  const estadounidense = [
    ['Encuestado', encuesta?.nombreEncuestado || '—'],
    ['Cargo', encuesta?.cargo || '—'],
    ['Correo de quien respondió', encuesta?.correo || '—'],
  ]

  const resumenBajas =
    bajas.length === 0
      ? 'El promedio general quedó por debajo del umbral aunque ninguna pregunta cayó a 1–2 estrellas.'
      : bajas.length === preguntas.length
        ? `Las ${preguntas.length} preguntas de la encuesta fueron calificadas mal (1–2 estrellas): la falla es del servicio general.`
        : `Se detectaron ${bajas.length} de ${preguntas.length} preguntas con calificación baja (1–2 estrellas). Revisar esas razones específicas.`

  return envolver({
    degradado: 'linear-gradient(135deg,#B91C1C 0%,#EF4444 55%,#F97316 100%)',
    eyebrow: 'Alerta automática · Control de calidad',
    titulo: 'MALA CALIFICACIÓN EN ENTREGA',
    subtitulo: `Promedio de la encuesta: ${promedio.toFixed(1)} / 3.00 (umbral ≤ ${UMBRAL_ALERTA_CALIDAD})`,
    cuerpo: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLOR_PALETA.pizarra};">
        Se registró una encuesta de satisfacción con una puntuación
        <strong style="color:#B91C1C;">menor o igual a ${UMBRAL_ALERTA_CALIDAD}</strong> en la recepción de este pedido.
        <strong>Algo está pasando</strong>: hay que revisar por qué ocurrió la mala calificación,
        cuáles fueron las malas calificaciones y las razones, para tomar acciones correctivas.
      </p>

      ${datosPedido(solicitud)}
      ${bloqueDatos(estadounidense)}

      <div style="background:${COLOR_PALETA.panel};border:1px solid ${COLOR_PALETA.borde};border-radius:12px;overflow:hidden;margin-bottom:20px;">
        <div style="padding:10px 14px;background:${COLOR_PALETA.tinta};color:#FFFFFF;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          Calificaciones de la encuesta
        </div>
        <table width="100%" style="border-collapse:collapse;">
          <thead>
            <tr style="background:${COLOR_PALETA.cabecera};">
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;color:${COLOR_PALETA.profundo};">Pregunta</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:${COLOR_PALETA.profundo};">Estrellas</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:${COLOR_PALETA.profundo};">Resultado</th>
            </tr>
          </thead>
          <tbody>${filasTabla}</tbody>
        </table>
      </div>

      <div style="margin-bottom:18px;">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;background:#FEF2F2;border:1px solid #FCA5A5;color:#B91C1C;margin-right:6px;">
          ${malos} Malo${malos === 1 ? '' : 's'} (1★)
        </span>
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;background:#FFF7ED;border:1px solid #FDBA74;color:#C2410C;margin-right:6px;">
          ${regulares} Regulares (2★)
        </span>
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;background:#F0FDF4;border:1px solid #86EFAC;color:#15803D;">
          ${buenos} Buenas (3★)
        </span>
      </div>

      <div style="background:#FFF7ED;border-left:4px solid #F97316;padding:14px 16px;border-radius:8px;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#C2410C;margin-bottom:4px;">
          Razones de la caída
        </div>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#7C2D12;">${escapar(resumenBajas)}</p>
      </div>

      <p style="margin:0;font-size:13px;line-height:1.6;color:${COLOR_PALETA.pizarra};">
        Por favor, coordinar con el cliente y con el equipo para identificar la causa y evitar que se repita.
      </p>`,
    pie: `Correo generado automáticamente desde la plataforma logística de CTP al registrar una encuesta de satisfacción con promedio ≤ ${UMBRAL_ALERTA_CALIDAD} en el pedido <strong>${escapar(solicitud.id || '')}</strong>.`,
  })
}

function asuntoMalaCalificacion(solicitud, encuesta) {
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : 0
  return `ALERTA · Calificación baja (${promedio.toFixed(1)}) en entrega ${solicitud.id || ''}`
}

// ---------------------------------------------------------------------------
// Aviso 2 · retención por cartera
// ---------------------------------------------------------------------------
function htmlRetencionCartera(solicitud, { nota = '', persona = '' } = {}) {
  const motivo = String(nota || '').trim()
  return envolver({
    degradado: 'linear-gradient(135deg,#7F1D1D 0%,#DC2626 60%,#F59E0B 100%)',
    eyebrow: 'Aviso automático · Estado de la solicitud',
    titulo: 'SU SOLICITUD ESTÁ RETENIDA POR CARTERA',
    subtitulo: `Pedido ${solicitud.id || ''} · ${solicitud.cliente || 'sin cliente'}`,
    cuerpo: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLOR_PALETA.pizarra};">
        Estimado(a), su solicitud pasó al estado <strong style="color:#B91C1C;">Retenido por Cartera</strong>.
        Esto significa que el pedido <strong>no puede avanzar</strong> hasta que el área de Cartera
        revise y regularice la cuenta asociada.
      </p>

      ${datosPedido(solicitud)}
      ${bloqueDatos([
        ['Estado anterior', solicitud.estadoAnterior || '—'],
        ['Motivo registrado', motivo || 'No se registró un motivo.'],
        ['Registró el cambio', persona || '—'],
        ['Fecha del cambio', solicitud.fechaEstado || fechaLegible()],
      ])}

      <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px 16px;border-radius:8px;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#B91C1C;margin-bottom:4px;">
          Qué puede hacer
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#7C2D12;">
          Comuníquese con el área de Cartera para conocer el detalle de la retención y regularizar.
          En cuanto se levante la retención, la solicitud continuará su trámite normal
          sin que tenga que crear una nueva.
        </p>
      </div>

      <p style="margin:0;font-size:13px;line-height:1.6;color:${COLOR_PALETA.pizarra};">
        Puede seguir el estado de esta solicitud en cualquier momento desde
        <strong>Mis Solicitudes</strong> en la plataforma logística de CTP.
      </p>`,
    pie: `Aviso generado automáticamente desde la plataforma logística de CTP al cambiar el pedido <strong>${escapar(solicitud.id || '')}</strong> a «${escapar(ESTADO_RETENIDO)}». Si cree que se trata de un error, responda a este correo o comuníquese con su ejecutivo comercial.`,
  })
}

function asuntoRetencionCartera(solicitud) {
  return `AVISO · Solicitud ${solicitud.id || ''} retenida por cartera · ${solicitud.cliente || 'sin cliente'}`
}

// ---------------------------------------------------------------------------
// Decisión: qué avisos hay que mandar
//
// Es una función PURA a propósito — no toca la base ni la red — porque es la que
// decide a quién se le escribe y hay que poder probarla sin SMTP. Recibe lo que
// el request acaba de guardar y devuelve la lista de avisos pendientes; quien
// llama se encarga de despacharlos.
//
// Los tres filtros que se aplican aquí son los que evitan el ruido:
//
//   · solo entradas de historial de tipo 'estado' (las de 'asignado' y
//     'conductor' no llevan encuesta ni cambian de estado),
//   · la encuesta solo cuenta si trae promedio numérico Y está en el umbral,
//   · la retención solo cuenta en una TRANSICIÓN: si el registro ya venía en
//     'Retenido por Cartera' no es un cambio nuevo, es el mismo guardado otra
//     vez.
// ---------------------------------------------------------------------------
function planCorreos({ fila, historial = [] } = {}) {
  const avisos = []
  if (!fila) return avisos

  const solicitud = {
    id: fila.codigo || '',
    cliente: fila.cliente || '',
    zona: fila.zona || '',
    numeroReferencia: fila.numero_referencia || '',
    conductor: fila.conductor || '',
    vehiculo: fila.vehiculo || '',
    placa: fila.placa || '',
  }

  const destinatario = String(fila.solicitante_correo || '').trim().toLowerCase()
  const entradas = Array.isArray(historial) ? historial : []

  for (const entrada of entradas) {
    if (!entrada || entrada.campo !== 'estado' || !entrada.id) continue

    // --- mala calificación -------------------------------------------------
    const encuesta = objetoONull(entrada.encuesta)
    const promedio = encuesta && typeof encuesta.promedio === 'number' ? encuesta.promedio : null
    if (promedio !== null && promedio <= UMBRAL_ALERTA_CALIDAD) {
      avisos.push({
        tipo: 'calificacion',
        clave: `calificacion:${entrada.id}`,
        solicitud: solicitud.id,
        para: destinatario,
        copia: copiaCalidad(),
        asunto: asuntoMalaCalificacion(solicitud, encuesta),
        html: htmlMalaCalificacion(solicitud, encuesta),
        texto: textoMalaCalificacion(solicitud, encuesta),
      })
    }

    // --- retención por cartera --------------------------------------------
    // Solo cuando el estado CAMBIA hacia la retención. Un registro que ya venía
    // en 'Retenido por Cartera' y vuelve a escribirse no es un hecho nuevo: es el
    // mismo guardado repetido (imprimir otra factura, corregir un dato), y sin
    // esta comprobación el solicitante recibiría el aviso otra vez.
    const nuevo = String(entrada.nuevo || '')
    const anterior = String(entrada.anterior || '')
    if (nuevo === ESTADO_RETENIDO && anterior !== ESTADO_RETENIDO) {
      avisos.push({
        tipo: 'cartera',
        clave: `cartera:${entrada.id}`,
        solicitud: solicitud.id,
        para: destinatario,
        copia: copiaCartera(),
        asunto: asuntoRetencionCartera(solicitud),
        html: htmlRetencionCartera(
          {
            ...solicitud,
            estadoAnterior: entrada.anterior || '',
            fechaEstado: [entrada.fecha, entrada.hora].filter(Boolean).join(' '),
          },
          { nota: entrada.nota || '', persona: entrada.persona || '' }
        ),
        texto: textoRetencionCartera(solicitud, entrada),
      })
    }
  }

  return avisos
}

// Versión en texto plano de los dos avisos. Hay muchos lectores que la muestran
// en vez de interpretarla, y es la que se lee en el log cuando algo falla, así
// que sirve de comprobación: si el texto no cuadra con lo que dice el cuerpo,
// el problema no es el transporte.
function textoMalaCalificacion(solicitud, encuesta) {
  const preguntas = Array.isArray(encuesta?.preguntas) ? encuesta.preguntas : []
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : 0
  const lineas = [
    'ALERTA · MALA CALIFICACIÓN EN ENTREGA',
    '',
    `Pedido:     ${solicitud.id || '—'}`,
    `Cliente:    ${solicitud.cliente || '—'}`,
    `Zona:       ${solicitud.zona || '—'}`,
    `Referencia: ${solicitud.numeroReferencia || '—'}`,
    `Conductor:  ${solicitud.conductor || '—'}`,
    '',
    `Promedio: ${promedio.toFixed(1)} / 3.00 (umbral ≤ ${UMBRAL_ALERTA_CALIDAD})`,
    '',
    'Calificaciones:',
    ...preguntas.map(
      (p, i) =>
        `  ${i + 1}. ${p.pregunta}: ${p.puntuacion || 0} ${
          p.puntuacion ? CALIFICACIONES[p.puntuacion - 1] : 'Sin puntuar'
        }`
    ),
    '',
    `Respondió: ${encuesta?.nombreEncuestado || '—'}${encuesta?.cargo ? ` · ${encuesta.cargo}` : ''}`,
  ]
  return lineas.join('\n')
}

function textoRetencionCartera(solicitud, entrada) {
  return [
    'AVISO · SOLICITUD RETENIDA POR CARTERA',
    '',
    `Pedido:  ${solicitud.id || '—'}`,
    `Cliente: ${solicitud.cliente || '—'}`,
    `Zona:    ${solicitud.zona || '—'}`,
    '',
    `Estado anterior: ${entrada?.anterior || '—'}`,
    `Motivo:          ${entrada?.nota || 'No se registró un motivo.'}`,
    `Registró:        ${entrada?.persona || '—'}`,
    '',
    'La solicitud no puede avanzar hasta que Cartera revise la cuenta.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Despacho
//
// Nunca lanza: un aviso que falla se anota en el log y el resto sigue. Quien
// llama ya guardó el cambio en la base, y perder un guardado por un SMTP caído
// sería mucho peor que perder el aviso.
//
// Cada aviso sale en UN solo envío:
//   TO  → el solicitante
//   CC  → solo operaciones@pedro-ctpmedica.com (la casilla operativa)
//
// Las demás áreas internas (almacén, calidad, cotizaciones, etc.) NO reciben
// copia: el usuario indicó que no les llegan o les llegan duplicados.
// ---------------------------------------------------------------------------

// Remitente con nombre, listo para nodemailer.
function remitente() {
  const direccion = String(config.correo.remitente || '').trim()
  const nombre = String(config.correo.nombreRemitente || '').replace(/"/g, '').trim()
  return nombre ? `"${nombre}" <${direccion}>` : direccion
}

// Un envío concreto. Devuelve true si salió.
async function remitir(aviso, { para, copia }) {
  try {
    await obtenerTransporte().sendMail({
      from: remitente(),
      to: para,
      cc: copia.length > 0 ? copia : undefined,
      subject: aviso.asunto,
      html: aviso.html,
      text: aviso.texto,
    })
    console.log(
      `[Correo] enviado (${aviso.tipo}) · «${aviso.asunto}» · para ${para}`
      + (copia.length ? ` · copia: ${copia.join(', ')}` : '')
    )
    return true
  } catch (error) {
    console.error(`[Correo] FALLÓ un envío (${aviso.tipo}) «${aviso.asunto}» a ${para}: ${error?.message}`)
    return false
  }
}

async function despacharUno(aviso) {
  if (!aviso.para) {
    console.warn(`[Correo] aviso de ${aviso.tipo} sin destinatario en ${aviso.solicitud || '(sin código)'}: se omite`)
    return false
  }
  if (!correoConfigurado()) {
    console.warn(
      `[Correo] sin SMTP configurado: se habría enviado «${aviso.asunto}» a ${aviso.para} `
      + `(${aviso.copia.length} en copia)`
    )
    return false
  }

  if (!(await reservar(aviso.clave, aviso))) {
    console.log(`[Correo] ${aviso.clave} ya se había enviado, se omite`)
    return false
  }

  // Un solo envío por aviso:
  //   - calificacion: TO=solicitante, CC=lista de 5 áreas internas
  //   - cartera:    TO=solicitante, CC=vacía
  const ok = await remitir(aviso, {
    para: aviso.para,
    copia: aviso.copia,
  })

  if (!ok) {
    await liberar(aviso.clave)
    console.error(
      `[Correo] ningún envío salió del aviso (${aviso.tipo}) «${aviso.asunto}»: se reintentará en el siguiente guardado`
    )
    return false
  }

  return true
}

// Punto de entrada que usa routes.js. Devuelve cuántos avisos salieron de verdad
// (cada uno puede haber sido uno o dos envíos), para que quien llama lo pueda
// dejar escrito en su propio log.
async function despachar(avisos) {
  const lista = Array.isArray(avisos) ? avisos : []
  let enviados = 0
  for (const aviso of lista) {
    if (await despacharUno(aviso)) enviados += 1
  }
  return enviados
}

module.exports = {
  UMBRAL_ALERTA_CALIDAD,
  ESTADO_RETENIDO,
  CORREOS_ALERTA_CALIDAD,
  CORREOS_REENCION_CARTERA,
  correoConfigurado,
  casillaOperativa,
  copiaCalidad,
  copiaCartera,
  planCorreos,
  despachar,
  htmlMalaCalificacion,
  htmlRetencionCartera,
  // Para las pruebas.
  normalizarCorreos,
  obtenerTransporte,
  usarTransporte,
  asegurarTabla,
}
