import { obtenerTokenGraph } from './oneDriveApi.js'

// Destinatarios en copia (CC) cuando una entrega recibe una mala calificación.
// El correo se envía AL solicitante (To) con estos 5 en copia:
//   operaciones, logística (almacén), servicio al cliente (x2) y gestión de calidad.
export const CORREOS_ALERTA_CALIDAD = [
  'operaciones@ctpmedica.com',
  'almacen@ctpmedica.com',
  'servicioalcliente2@ctpmedica.com',
  'cotizacionesylicitaciones@ctpmedica.com',
  'gestiondecalidad@ctpmedica.com',
]

// Umbral: promedios menores o iguales a 2.5 disparan la alerta.
export const UMBRAL_ALERTA_CALIDAD = 2.5

const CALIFICACIONES = ['Malo', 'Regular', 'Bueno']

// Evita reenviar la alerta del mismo pedido dos veces en la misma sesión.
const avisados = new Set()

function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function infoPedido(solicitud) {
  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('es-CO')
  const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return [
    ['Pedido', solicitud.id || '—'],
    ['Cliente', solicitud.cliente || '—'],
    ['Zona', solicitud.zona || '—'],
    ['Factura / Remisión', solicitud.numeroReferencia || '—'],
    ['Conductor', solicitud.conductor || '—'],
    ['Vehículo', solicitud.vehiculo || '—'],
    ['Placa', solicitud.placa || '—'],
    ['Fecha de entrega', `${fecha} ${hora}`],
  ]
}

function colorPuntaje(p) {
  if (p <= 1) return { bg: '#FEF2F2', borde: '#FCA5A5', texto: '#B91C1C', estrella: '#EF4444' }
  if (p === 2) return { bg: '#FFF7ED', borde: '#FDBA74', texto: '#C2410C', estrella: '#F97316' }
  return { bg: '#F0FDF4', borde: '#86EFAC', texto: '#15803D', estrella: '#22C55E' }
}

// Cuerpo HTML (diseño con colores y tabla) del correo de alerta por mala
// calificación. Devuelve el HTML completo listo para el mensaje.
export function htmlAlertaMalaCalificacion(solicitud, encuesta) {
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
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0A0027;font-weight:600;">
            ${i + 1}. ${escapar(p.pregunta)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:center;color:${c.estrella};font-size:15px;white-space:nowrap;">
            ${puntaje ? '★'.repeat(puntaje) : '—'}
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;text-align:center;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${c.bg};border:1px solid ${c.borde};color:${c.texto};">
              ${puntaje ? `${puntaje} · ${desc}` : 'Sin puntuar'}
            </span>
          </td>
        </tr>`
    })
    .join('')

  const filasInfo = infoPedido(solicitud)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:5px 10px;font-size:11px;font-weight:800;text-transform:uppercase;color:#64748B;letter-spacing:.03em;white-space:nowrap;width:38%;">
            ${k}
          </td>
          <td style="padding:5px 10px;font-size:13px;color:#0A0027;font-weight:700;">
            ${escapar(v)}
          </td>
        </tr>`
    )
    .join('')

  const encuestado = encuesta?.nombreEncuestado
    ? `${escapar(encuesta.nombreEncuestado)}${encuesta?.cargo ? ` · ${escapar(encuesta.cargo)}` : ''}`
    : '—'

  const resumenBajas =
    bajas.length === 0
      ? 'El promedio general quedó por debajo del umbral aunque ninguna pregunta cayó a 1–2 estrellas.'
      : bajas.length === preguntas.length
        ? 'Las 5 preguntas de la encuesta fueron calificadas mal (1–2 estrellas): la falla es del servicio general.'
        : `Se detectaron ${bajas.length} de ${preguntas.length} preguntas con calificación baja (1–2 estrellas). Revisar esas razones específicas.`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:linear-gradient(135deg,#B91C1C 0%,#EF4444 55%,#F97316 100%);padding:26px 28px;color:#FFFFFF;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">Alerta automática · Control de calidad</div>
      <div style="font-size:24px;font-weight:900;line-height:1.15;margin-top:6px;">MALA CALIFICACIÓN EN ENTREGA</div>
      <div style="font-size:14px;font-weight:700;margin-top:8px;opacity:.95;">Promedio de la encuesta: ${promedio.toFixed(1)} / 3.00 (umbral ≤ 2.5)</div>
    </div>

    <div style="padding:26px 28px;">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
        Hola,<br/>
        el cliente calificó la <strong>recepción de un pedido</strong> con una puntuación
        <strong style="color:#B91C1C;">menor o igual a 2.5</strong>.
        <strong>Algo está pasando</strong>: necesitamos revisar por qué ocurrió la mala calificación,
        cuáles fueron las malas calificaciones y las razones, para tomar acciones correctivas.
      </p>

      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
        <div style="padding:10px 14px;background:#0A0027;color:#FFFFFF;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          Datos del pedido
        </div>
        <table width="100%" style="border-collapse:collapse;padding:6px;">
          ${filasInfo}
          <tr>
            <td style="padding:5px 10px;font-size:11px;font-weight:800;text-transform:uppercase;color:#64748B;white-space:nowrap;">Encuestado</td>
            <td style="padding:5px 10px;font-size:13px;color:#0A0027;font-weight:700;">${encuestado || '—'}</td>
          </tr>
        </table>
      </div>

      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
        <div style="padding:10px 14px;background:#0A0027;color:#FFFFFF;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          Calificaciones de la encuesta
        </div>
        <table width="100%" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#EAF4F7;">
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;color:#003B73;">Pregunta</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:#003B73;">Estrellas</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:#003B73;">Resultado</th>
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>
      </div>

      <div style="display:inline-block;margin-bottom:18px;">
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
        <p style="margin:0;font-size:13px;line-height:1.55;color:#7C2D12;">${resumenBajas}</p>
      </div>

      <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">
        Por favor, coordinar con el cliente y con el equipo para identificar la causa y evitar que se repita.
      </p>
    </div>

    <div style="background:#EAF4F7;padding:16px 28px;font-size:11px;color:#475569;line-height:1.5;">
      Este correo se generó automáticamente desde la plataforma logística de CTP al registrar una
      encuesta de satisfacción con promedio ≤ 2.5 en el pedido <strong>${escapar(solicitud.id || '')}</strong>.
    </div>
  </div>
</body>
</html>`
}

export function asuntoAlertaMalaCalificacion(solicitud, encuesta) {
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : 0
  return `ALERTA · Calificación baja (${promedio.toFixed(1)}) en entrega ${solicitud.id || ''}`
}

// Envía el correo de alerta al solicitante (To) con los 5 correos internos en
// copia (CC). Se envía desde la cuenta Microsoft que cierra la entrega
// («me/sendMail», requiere el permiso Mail.Send en el tenant).
export async function enviarAlertaMalaCalificacion(solicitud, encuesta) {
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : 0
  if (promedio > UMBRAL_ALERTA_CALIDAD) return false
  if (!encuesta) return false

  const correoSolicitante = String(solicitud?.correo || '').trim()
  if (!correoSolicitante) {
    console.warn('[Correo alerta] el pedido no tiene correo del solicitante, no se envía la alerta:', solicitud?.id)
    return false
  }

  const clave = `${solicitud.id}:${promedio}`
  if (avisados.has(clave)) return false
  avisados.add(clave)

  const token = await obtenerTokenGraph()
  const cuerpo = {
    message: {
      subject: asuntoAlertaMalaCalificacion(solicitud, encuesta),
      body: { contentType: 'HTML', content: htmlAlertaMalaCalificacion(solicitud, encuesta) },
      toRecipients: [{ emailAddress: { address: correoSolicitante } }],
      ccRecipients: CORREOS_ALERTA_CALIDAD.map((address) => ({ emailAddress: { address } })),
      importance: 'high',
    },
    saveToSentItems: false,
  }
  const resp = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  })
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '')
    throw new Error(`Graph sendMail ${resp.status}${detalle ? ` — ${detalle}` : ''}`)
  }
  console.info(`[Correo alerta] alerta enviada al solicitante (${correoSolicitante}) ${CORREOS_ALERTA_CALIDAD.length} CC · ${solicitud.id}`)
  return true
}