// Parseo/serialización del texto de «Qué recogemos» de una recolección.
// Formato esperado: "cantidad · ARTÍCULO · DESCRIPCIÓN · Lote LOTE" (una línea
// por artículo), tal como lo escribe la mini tabla del formulario.

export function parsearArticulosQueRecogemos(texto) {
  if (!texto || !texto.trim()) return []
  const lineas = texto.trim().split('\n')
  const articulos = []
  for (const linea of lineas) {
    const partes = linea.split(' · ')
    if (partes.length >= 2) {
      const cantidad = parseInt(partes[0].trim(), 10)
      const articulo = partes[1].trim()
      const descripcion = partes.length >= 3 ? partes[2].trim() : ''
      const lote = partes.length >= 4 ? partes[3].trim() : ''
      if (!isNaN(cantidad) && cantidad > 0 && articulo) {
        articulos.push({ cantidad, articulo, descripcion, lote })
      }
    }
  }
  return articulos
}

export function serializarArticulosQueRecogemos(articulos) {
  return articulos
    .map((a) => {
      const base = `${a.cantidad} · ${a.articulo}`
      const conDesc = a.descripcion ? `${base} · ${a.descripcion}` : base
      return a.lote ? `${conDesc} · Lote ${a.lote}` : conDesc
    })
    .join('\n')
}
