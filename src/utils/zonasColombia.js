// ============================================================================
// Zonas de inventario y su ubicación en el mapa
// ============================================================================
// La zona del inventario es texto libre, así que aquí se guardan coordenadas
// aproximadas (lat, lng) de las zonas conocidas para ubicar los pines. Si una
// zona no se reconoce se prueba una coincidencia parcial («BOGOTA NORTE» →
// BOGOTA) y, si tampoco, se devuelve null y la zona se lista aparte.

const ZONAS = {
  BOGOTA: { lat: 4.711, lng: -74.072 },
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
  'ZONA CAFETERA': { lat: 4.813, lng: -75.696, etiqueta: 'Zona Cafetera (Pereira)' },
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

// Coordenadas de una zona, o null si no se reconoce.
export function coordenadasZona(zona) {
  const clave = normalizar(zona)
  if (!clave) return null
  if (ZONAS[clave]) return ZONAS[clave]
  const encontrada = Object.keys(ZONAS).find(
    (k) => clave.includes(k) || k.includes(clave)
  )
  return encontrada ? ZONAS[encontrada] : null
}

// Color estable por zona (mismo texto ⇒ mismo color) para pintar cada pin.
const COLORES = [
  '#003B73', '#00B8D4', '#7C3AED', '#DC2626', '#059669', '#D97706',
  '#DB2777', '#2563EB', '#65A30D', '#9333EA', '#0891B2', '#B45309',
  '#4F46E5', '#CA8A04',
]

export function colorZona(zona) {
  const clave = normalizar(zona)
  let h = 0
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0
  return COLORES[h % COLORES.length]
}
