let libs = null

async function cargarLibs() {
  if (!libs) {
    const [jspdf, autotable] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    libs = { jsPDF: jspdf.jsPDF, autoTable: autotable.default || autotable.autoTable }
  }
  return libs
}

const NAVY = [7, 26, 61]
const DEEP = [0, 59, 115]
const CYAN = [0, 229, 255]
const INK = [10, 0, 39]
const GRIS = [100, 116, 139]

function fechaLarga(iso) {
  if (!iso) return new Date().toLocaleDateString('es-CO')
  const partes = String(iso).split('-').map(Number)
  const dt = partes.length === 3 && partes.every(Boolean)
    ? new Date(partes[0], partes[1] - 1, partes[2])
    : new Date(iso)
  if (Number.isNaN(dt.getTime())) return String(iso)
  return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function textoPlano(valor, fallback = '—') {
  const t = String(valor ?? '').trim()
  return t || fallback
}

export async function construirPlanillaPdf({ conductor, vehiculo, placa, fecha, filas = [], observaciones = '' }) {
  const { jsPDF, autoTable } = await cargarLibs()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 12

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, ancho, 26, 'F')
  doc.setFillColor(...CYAN)
  doc.rect(0, 26, ancho, 1.4, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('PLANILLA DE SALIDA', margen, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...CYAN)
  doc.text('CTP LOGÍSTICA · CONTROL DE ENTREGAS', margen, 18.5)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(fechaLarga(fecha), ancho - margen, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`${filas.length} ${filas.length === 1 ? 'pedido' : 'pedidos'}`, ancho - margen, 18.5, { align: 'right' })

  const infoY = 34
  const cajaAncho = ancho - margen * 2
  doc.setDrawColor(220, 228, 235)
  doc.setFillColor(248, 251, 252)
  doc.roundedRect(margen, infoY, cajaAncho, 24, 2, 2, 'FD')

  const campos = [
    ['CONDUCTOR', textoPlano(conductor)],
    ['VEHÍCULO / TIPO', textoPlano(vehiculo)],
    ['PLACA', textoPlano(placa)],
    ['FECHA', fechaLarga(fecha)],
  ]
  const colAncho = cajaAncho / 4
  campos.forEach(([etiqueta, valor], i) => {
    const x = margen + 4 + i * colAncho
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...GRIS)
    doc.text(etiqueta, x, infoY + 8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(valor, colAncho - 8), x, infoY + 15)
  })

  autoTable(doc, {
    startY: infoY + 30,
    margin: { left: margen, right: margen, bottom: 20 },
    head: [['#', 'ID', 'Cliente', 'Zona', 'Tipo de solicitud', 'Observaciones']],
    body: filas.map((f, i) => [
      i + 1,
      textoPlano(f.id, ''),
      textoPlano(f.cliente, ''),
      textoPlano(f.zona, ''),
      textoPlano(f.tipoSolicitud, ''),
      textoPlano(f.observaciones, ''),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: INK,
      lineColor: [225, 232, 238],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: DEEP,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [245, 249, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 42 },
      3: { cellWidth: 26 },
      4: { cellWidth: 30 },
      5: { cellWidth: 'auto' },
    },
    didDrawPage: () => {
      const pagina = doc.internal.getNumberOfPages()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRIS)
      doc.text(`CTP Logística · Planilla de salida · ${conductor || ''}`.trim(), margen, alto - 8)
      doc.text(`Página ${pagina}`, ancho - margen, alto - 8, { align: 'right' })
    },
  })

  let cursorY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : infoY + 40

  if (cursorY + 40 > alto - 12) {
    doc.addPage()
    cursorY = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DEEP)
  doc.text('OBSERVACIONES', margen, cursorY)
  doc.setDrawColor(...CYAN)
  doc.line(margen, cursorY + 1.5, margen + 30, cursorY + 1.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const obs = observaciones && String(observaciones).trim() ? String(observaciones) : 'Sin observaciones.'
  doc.text(doc.splitTextToSize(obs, ancho - margen * 2), margen, cursorY + 7)

  const firmaY = alto - 28
  doc.setDrawColor(120, 130, 145)
  doc.line(margen, firmaY, margen + 70, firmaY)
  doc.line(ancho - margen - 70, firmaY, ancho - margen, firmaY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS)
  doc.text('Firma del conductor', margen, firmaY + 5)
  doc.text(textoPlano(conductor), margen, firmaY + 10)
  doc.text('Firma despacho / coordinación', ancho - margen - 70, firmaY + 5)

  return doc
}

export async function descargarPlanillaPdf(datos) {
  const doc = await construirPlanillaPdf(datos)
  const sufijo = String(datos?.conductor || 'conductor').replace(/[^\w-]+/g, '_')
  const fecha = datos?.fecha || new Date().toISOString().slice(0, 10)
  doc.save(`planilla-${sufijo}-${fecha}.pdf`)
}
