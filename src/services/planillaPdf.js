let libs = null

async function cargarLibs() {
  if (!libs) {
    const [h2c, jspdf] = await Promise.all([import('html2canvas'), import('jspdf')])
    libs = {
      html2canvas: h2c.default || h2c,
      jsPDF: jspdf.jsPDF || jspdf.default,
    }
  }
  return libs
}

function nombreArchivo(conductor, fecha) {
  const sufijo = String(conductor || 'conductor').replace(/[^\w-]+/g, '_')
  const dia = fecha || new Date().toISOString().slice(0, 10)
  return `planilla-${sufijo}-${dia}.pdf`
}

export async function descargarPlanillaPdf({ elemento, conductor, fecha }) {
  if (!elemento) throw new Error('No se encontró la planilla para exportar.')

  const { html2canvas, jsPDF } = await cargarLibs()

  const canvas = await html2canvas(elemento, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: elemento.scrollWidth,
  })

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const margen = 8
  const anchoUtil = anchoPagina - margen * 2
  const altoUtil = altoPagina - margen * 2

  const ratio = anchoUtil / canvas.width
  const altoTotal = canvas.height * ratio

  if (altoTotal <= altoUtil) {
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', margen, margen, anchoUtil, altoTotal)
  } else {
    const altoPaginaPx = Math.floor(altoUtil / ratio)
    let y = 0
    let pagina = 0
    while (y < canvas.height) {
      const alto = Math.min(altoPaginaPx, canvas.height - y)
      const trozo = document.createElement('canvas')
      trozo.width = canvas.width
      trozo.height = alto
      const ctx = trozo.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, trozo.width, trozo.height)
      ctx.drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto)
      if (pagina > 0) doc.addPage()
      doc.addImage(trozo.toDataURL('image/png'), 'PNG', margen, margen, anchoUtil, alto * ratio)
      y += alto
      pagina += 1
    }
  }

  doc.save(nombreArchivo(conductor, fecha))
}
