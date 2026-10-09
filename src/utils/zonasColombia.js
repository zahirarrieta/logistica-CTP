// ============================================================================
// Zonas de inventario y su ubicación en el mapa
// ============================================================================
// La zona del inventario es texto libre, así que aquí se guardan coordenadas
// aproximadas (lat, lng) de las zonas conocidas para ubicar los pines. Si una
// zona no se reconoce se prueba una coincidencia parcial («BOGOTA NORTE» →
// BOGOTA) y, si tampoco, se devuelve null y la zona se lista aparte.

const ZONAS = {
  BOGOTA: { lat: 4.711, lng: -74.072 },
  COTA: { lat: 4.809, lng: -74.099, etiqueta: 'Cota (Cundinamarca)' },
  PRINCIPAL: { lat: 4.752, lng: -74.055, etiqueta: 'Principal (Bogotá)' },
  BOYACA: { lat: 5.535, lng: -73.367, etiqueta: 'Boyacá (Tunja)' },
  TUNJA: { lat: 5.535, lng: -73.367, etiqueta: 'Boyacá (Tunja)' },
  BUCARAMANGA: { lat: 7.119, lng: -73.122, etiqueta: 'Bucaramanga (Santander)' },
  CALI: { lat: 3.451, lng: -76.532, etiqueta: 'Cali (Valle del Cauca)' },
  COSTA: { lat: 10.968, lng: -74.781, etiqueta: 'Costa (Barranquilla)' },
  BARRANQUILLA: { lat: 10.968, lng: -74.781 },
  CARTAGENA: { lat: 10.391, lng: -75.479 },
  'SANTA MARTA': { lat: 11.24, lng: -74.199 },
  IBAGUE: { lat: 4.438, lng: -75.232, etiqueta: 'Ibagué (Tolima)' },
  MEDELLIN: { lat: 6.244, lng: -75.581, etiqueta: 'Medellín (Antioquia)' },
  NEIVA: { lat: 2.927, lng: -75.281, etiqueta: 'Neiva (Huila)' },
  PASTO: { lat: 1.214, lng: -77.278, etiqueta: 'Pasto (Nariño)' },
  VILLAVICENCIO: { lat: 4.142, lng: -73.626, etiqueta: 'Villavicencio (Meta)' },
  'ZONA CAFETERA': { lat: 4.801, lng: -75.599, etiqueta: 'Zona Cafetera (Armenia y Manizales)' },
  'EJE CAFETERO': { lat: 4.801, lng: -75.599, etiqueta: 'Eje Cafetero (Armenia y Manizales)' },
  PEREIRA: { lat: 4.813, lng: -75.696 },
  MANIZALES: { lat: 5.068, lng: -75.517 },
  ARMENIA: { lat: 4.533, lng: -75.681 },
  POPAYAN: { lat: 2.444, lng: -76.614 },
  MONTERIA: { lat: 8.748, lng: -75.881 },
  SINCELEJO: { lat: 9.304, lng: -75.398 },
  VALLEDUPAR: { lat: 10.463, lng: -73.253 },
  CUCUTA: { lat: 7.889, lng: -72.496 },
  QUIBDO: { lat: 5.694, lng: -76.661 },
  RIOHACHA: { lat: 11.544, lng: -72.907 },
}

const normalizar = (t) =>
  String(t ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

// Clave de ZONAS que corresponde a un texto de zona (exacta o por coincidencia
// parcial), o null si no se reconoce.
function claveZona(zona) {
  const clave = normalizar(zona)
  if (!clave) return null
  if (ZONAS[clave]) return clave
  return Object.keys(ZONAS).find((k) => clave.includes(k) || k.includes(clave)) || null
}

// Coordenadas de una zona, o null si no se reconoce.
export function coordenadasZona(zona) {
  const k = claveZona(zona)
  return k ? ZONAS[k] : null
}

// Un color por UBICACIÓN distinta: las zonas que comparten coordenadas (p. ej.
// Boyacá/Tunja, Eje Cafetero/Zona Cafetera o Costa/Barranquilla) comparten
// color. Los tonos se reparten por toda la rueda de color y se alternan en
// claridad para que dos zonas cualesquiera se distingan bien (antes muchos
// colores se parecían).
const COLOR_POR_UBICACION = new Map()
for (const k of Object.keys(ZONAS)) {
  const { lat, lng } = ZONAS[k]
  const ubicacion = `${lat},${lng}`
  if (!COLOR_POR_UBICACION.has(ubicacion)) {
    COLOR_POR_UBICACION.set(ubicacion, COLOR_POR_UBICACION.size)
  }
}
const TOTAL_UBICACIONES = COLOR_POR_UBICACION.size
const COLORES = [...COLOR_POR_UBICACION.values()].map((i) => {
  const tono = (i * 360) / TOTAL_UBICACIONES
  const luz = i % 2 === 0 ? 48 : 38
  return `hsl(${tono.toFixed(1)}, 68%, ${luz}%)`
})

export function colorZona(zona) {
  const k = claveZona(zona)
  if (k) {
    const { lat, lng } = ZONAS[k]
    return COLORES[COLOR_POR_UBICACION.get(`${lat},${lng}`)]
  }
  // Zona no reconocida: color estable derivado del texto.
  const clave = normalizar(zona)
  let h = 0
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 55%, 45%)`
}
