import {
  resumen,
  porZona,
  porTipo,
  porDiaSemana,
  porFranja,
  porAsignado,
  porConductor,
  topClientes,
  tiempoPorEstado,
  tiempoEntrega,
  formatHoras,
} from './dashboardUtils.js'
import { ESTADOS } from '../../Home/Components/estadoColors.js'

let libs = null

async function cargarLibs() {
  if (!libs) {
    const [h2c, jspdf] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
    libs = {
      html2canvas: h2c.default || h2c,
      jsPDF: jspdf.jsPDF || jspdf.default,
    }
  }
  return libs
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fechaArchivo() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const d = String(hoy.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function pct(parte, total) {
  return total ? `${Math.round((parte / total) * 100)}%` : '0%'
}

function tablasHtml(secciones) {
  return secciones
    .map(({ titulo, encabezados, filas }) => {
      const filasHtml = filas
        .map((c) => `<tr>${c.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
        .join('')
      return `
      <h3 style="color:#003B73;font-size:14px;margin:18px 0 6px;">${esc(titulo)}</h3>
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:11px;width:100%;">
        <tr style="background:#003B73;color:#fff;font-weight:bold;">
          ${encabezados.map((h) => `<th align="left">${esc(h)}</th>`).join('')}
        </tr>
        ${filasHtml}
      </table>`
    })
    .join('')
}

export function exportarExcel(solicitudes) {
  const r = resumen(solicitudes)
  const cumplimiento = r.total ? Math.round((r.entregados / r.total) * 100) : 0
  const cortar = (list, n = 30) => list.slice(0, n)

  const secciones = []

  secciones.push({
    titulo: 'Resumen general',
    encabezados: ['Concepto', 'Valor'],
    filas: [
      ['Total de pedidos', r.total],
      ['Activos', r.activos],
      ['Entregados', r.entregados],
      ['Entregados parciales', r.entregadosParcial],
      ['En tránsito', r.enTransito],
      ['Pendientes de sincronizar', r.pendientesSync],
      ['Cumplimiento', `${cumplimiento}%`],
      ['Tiempo promedio de entrega', r.tiempos.promedio !== null ? formatHoras(r.tiempos.promedio) : 'Sin entregas'],
      ['Tiempo mediana', r.tiempos.mediana !== null ? formatHoras(r.tiempos.mediana) : 'Sin entregas'],
      ['Tiempo máximo', r.tiempos.max !== null ? formatHoras(r.tiempos.max) : 'Sin entregas'],
      ['Entregas con tiempo medible', r.tiempos.cantidad],
    ],
  })

  secciones.push({
    titulo: 'Pedidos por estado',
    encabezados: ['Estado', 'Cantidad', 'Porcentaje'],
    filas: (r.porEstado.length
      ? r.porEstado
      : ESTADOS.map((estado) => ({ estado, count: 0 }))
    ).map((e) => [e.estado, e.count, pct(e.count, r.total)]),
  })

  secciones.push({
    titulo: 'Pedidos por zona',
    encabezados: ['Zona', 'Cantidad'],
    filas: cortar(porZona(solicitudes)).map((z) => [z.nombre, z.count]),
  })

  secciones.push({
    titulo: 'Pedidos por tipo de solicitud',
    encabezados: ['Tipo de solicitud', 'Cantidad'],
    filas: cortar(porTipo(solicitudes)).map((t) => [t.nombre, t.count]),
  })

  secciones.push({
    titulo: 'Pedidos por día de la semana',
    encabezados: ['Día', 'Cantidad'],
    filas: porDiaSemana(solicitudes).map((d) => [d.nombre, d.count]),
  })

  secciones.push({
    titulo: 'Franja horaria de creación',
    encabezados: ['Franja', 'Rango', 'Cantidad'],
    filas: porFranja(solicitudes).map((f) => [f.label, f.rango, f.count]),
  })

  secciones.push({
    titulo: 'Pedidos por responsable',
    encabezados: ['Responsable', 'Total', 'Activos', 'Entregados'],
    filas: cortar(porAsignado(solicitudes)).map((a) => [a.nombre, a.total, a.activos, a.entregados]),
  })

  secciones.push({
    titulo: 'Carga por conductor',
    encabezados: ['Conductor', 'Total', 'Entregados'],
    filas: cortar(porConductor(solicitudes)).map((c) => [c.nombre, c.total, c.entregados]),
  })

  secciones.push({
    titulo: 'Top clientes',
    encabezados: ['Cliente', 'Pedidos'],
    filas: cortar(topClientes(solicitudes, 15)).map((c) => [c.nombre, c.count]),
  })

  secciones.push({
    titulo: 'Tiempo promedio por etapa',
    encabezados: ['Etapa', 'Promedio', 'Casos'],
    filas: tiempoPorEstado(solicitudes).map((e) => [e.estado, formatHoras(e.promedio), e.n]),
  })

  const detalle = solicitudes
    .map((s) => {
      const t = tiempoEntrega(s)
      return [
        s.id,
        s.fechaSubida,
        s.horaSubida,
        s.cliente,
        s.bodega,
        s.nit,
        s.zona,
        s.tipoSolicitud,
        s.estado,
        s.asignadoA,
        s.conductor,
        s.vehiculo,
        s.placa,
        s.numeroReferencia,
        t ? `${formatHoras(t.horas)} (${t.fechaHora})` : '',
        s.correo,
      ]
    })
    .sort((a, b) => (a[0] > b[0] ? -1 : a[0] < b[0] ? 1 : 0))

  secciones.push({
    titulo: 'Detalle de todos los pedidos',
    encabezados: [
      'ID',
      'Fecha creada',
      'Hora',
      'Cliente',
      'Bodega',
      'NIT',
      'Zona',
      'Tipo de solicitud',
      'Estado',
      'Asignado a',
      'Conductor',
      'Vehículo',
      'Placa',
      'Nº referencia',
      'Tiempo de entrega (inicio → entrega)',
      'Correo',
    ],
    filas: detalle,
  })

  const html = `<!DOCTYPE html>
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>Informe de pedidos</title>
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Informe</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  </head>
  <body>
    <h2 style="color:#003B73;">Informe de pedidos — ${new Date().toLocaleDateString('es-CO')}</h2>
    ${tablasHtml(secciones)}
  </body>
  </html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Informe_pedidos_${fechaArchivo()}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportarPdf(nodo, titulo) {
  if (!nodo) return
  const { html2canvas, jsPDF } = await cargarLibs()
  const pdf = new jsPDF('p', 'mm', 'a4')
  const anchoPagina = pdf.internal.pageSize.getWidth()
  const altoPagina = pdf.internal.pageSize.getHeight()

  const canvas = await html2canvas(nodo, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    windowWidth: nodo.scrollWidth,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const altoImg = (canvas.height * anchoPagina) / canvas.width

  let heightLeft = altoImg
  let position = 0
  pdf.addImage(imgData, 'JPEG', 0, position, anchoPagina, altoImg)
  heightLeft -= altoPagina
  while (heightLeft > 0) {
    position -= altoPagina
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, anchoPagina, altoImg)
    heightLeft -= altoPagina
  }

  pdf.save(`${titulo}_${fechaArchivo()}.pdf`)
}