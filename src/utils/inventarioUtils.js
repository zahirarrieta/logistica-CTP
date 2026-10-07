// ============================================================================
// Utilidades del módulo Inventario
// ============================================================================
// El backend guarda SOLO las 12 columnas originales del reporte. Las 3
// calculadas (Estado, Días de Vigencia y Días de Inventario por rangos) se
// derivan AQUÍ, en el navegador, al pintar la tabla: así reflejan la fecha de
// hoy sin volver a subir el archivo.
// ============================================================================

// Orden esperado al pegar sin fila de encabezado (copiar desde Excel da tabulación).
export const COLUMNAS_ORIGINALES = [
  { key: 'numero_articulo', etiqueta: 'Número de artículo' },
  { key: 'descripcion', etiqueta: 'Descripción' },
  { key: 'lote', etiqueta: 'Lote' },
  { key: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento' },
  { key: 'cantidad', etiqueta: 'Cantidad' },
  { key: 'dias_inventario', etiqueta: 'Días de inventario' },
  { key: 'bodega', etiqueta: 'Bodega' },
  { key: 'nombre_bodega', etiqueta: 'Nombre bodega' },
  { key: 'zona', etiqueta: 'Zona' },
  { key: 'grupo_articulos', etiqueta: 'Grupo de artículos' },
  { key: 'tipo_bodega', etiqueta: 'Tipo de bodega' },
  { key: 'comercial', etiqueta: 'Comercial' },
]

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------
const normalizar = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Reconoce ISO (aaaa-mm-dd) y lo que exporta Excel en español (dd/mm/aaaa,
// también con . o - y con año de 2 dígitos). Devuelve '' si no es una fecha real.
export function parsearFecha(valor) {
  const s = String(valor ?? '').trim()
  if (!s) return ''
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[ T])/)
  if (m) return construirFecha(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (m) {
    const anio = m[3].length === 2 ? (+m[3] >= 70 ? 1900 + +m[3] : 2000 + +m[3]) : +m[3]
    return construirFecha(anio, +m[2], +m[1]) // día primero: Excel en español
  }
  return ''
}

function construirFecha(anio, mes, dia) {
  if (!(anio >= 1900 && anio <= 2999 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return ''
  const f = new Date(anio, mes - 1, dia)
  if (f.getFullYear() !== anio || f.getMonth() !== mes - 1 || f.getDate() !== dia) return ''
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// 'aaaa-mm-dd' → Date en horario local (sin desfase de zona horaria).
function aFechaLocal(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function hoy() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

export function formatearFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ---------------------------------------------------------------------------
// Fórmulas calculadas (mostradas, nunca guardadas)
// ---------------------------------------------------------------------------
const MS_POR_DIA = 86400000
const DIAS_A_VENCER = 180 // «Próximo a vencer»: fecha de vencimiento a 180 días o menos

// Días restantes hasta el vencimiento (negativos = ya venció).
export function diasVigencia(iso, ref = hoy()) {
  const f = aFechaLocal(iso)
  if (!f) return null
  return Math.round((f - ref) / MS_POR_DIA)
}

// Vencido: ya pasó la fecha. Próximo a vencer: dentro de los próximos 180 días.
// En otra fecha con vencimiento: Vigente. Sin fecha conocida: sin estado.
export function estadoVencimiento(iso, ref = hoy()) {
  const dias = diasVigencia(iso, ref)
  if (dias === null) return ''
  if (dias < 0) return 'Vencido'
  if (dias <= DIAS_A_VENCER) return 'Próximo a vencer'
  return 'Vigente'
}

// Rotación por rangos: mismos colores (y misma estructura de badge) que los
// estados de las demás tablas. La fórmula original no contempla valores menores
// a 90 (ni vacíos), así que ahí no se pone etiqueta.
export function rangoInventario(dias) {
  if (dias === null || dias === undefined || dias === '') return ''
  const n = Math.round(Number(dias))
  if (!Number.isFinite(n) || n < 0) return ''
  if (n <= 90) return 'Ok Rotación'
  if (n <= 120) return 'Rotar'
  if (n <= 240) return 'Rotar con Prioridad'
  return 'Rotar urgente'
}

// Listas de valores calculados, para los filtros del dashboard.
export const RANGOS_INVENTARIO = ['Ok Rotación', 'Rotar', 'Rotar con Prioridad', 'Rotar urgente']
export const ESTADOS_VENCIMIENTO = ['Vencido', 'Próximo a vencer', 'Vigente']

export const RANGO_PASTEL = {
  'Ok Rotación': 'bg-green-100',
  'Rotar': 'bg-yellow-100',
  'Rotar con Prioridad': 'bg-orange-100',
  'Rotar urgente': 'bg-red-100',
}

export const RANGO_BADGE = {
  'Ok Rotación': 'bg-green-100 text-green-700',
  'Rotar': 'bg-yellow-100 text-yellow-800',
  'Rotar con Prioridad': 'bg-orange-100 text-orange-700',
  'Rotar urgente': 'bg-red-100 text-red-700',
}

export const RANGO_DOT = {
  'Ok Rotación': 'bg-green-500',
  'Rotar': 'bg-yellow-500',
  'Rotar con Prioridad': 'bg-orange-500',
  'Rotar urgente': 'bg-red-500',
}

export const badgeRango = (rango) => RANGO_BADGE[rango] || 'bg-brand-ink/10 text-brand-ink/70'
export const dotRango = (rango) => RANGO_DOT[rango] || 'bg-brand-ink/40'
export const pastelRango = (rango) => RANGO_PASTEL[rango] || 'bg-white'

export const formatearEntero = (n) =>
  n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('es-CO').format(Math.round(Number(n)))

// 'YYYY-MM-DDTHH:MM:SS.sssZ' (o lo que devuelva MySQL) → «06/10/2026, 2:32 p. m.».
// Si no se puede interpretar se devuelve el valor tal cual.
export function formatearFechaHora(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return String(valor)
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Pegado de Excel (TSV / CSV)
// ---------------------------------------------------------------------------
const ALIAS_CABECERA = {
  'numero de articulo': 'numero_articulo',
  'numero articulo': 'numero_articulo',
  'n articulo': 'numero_articulo',
  'cod articulo': 'numero_articulo',
  'codigo de articulo': 'numero_articulo',
  'codigo articulo': 'numero_articulo',
  'articulo': 'numero_articulo',
  'codigo': 'numero_articulo',
  'descripcion': 'descripcion',
  'descripcion del articulo': 'descripcion',
  'lote': 'lote',
  'fecha de vencimiento': 'fecha_vencimiento',
  'fecha vencimiento': 'fecha_vencimiento',
  'fecha vto': 'fecha_vencimiento',
  'vencimiento': 'fecha_vencimiento',
  'cantidad': 'cantidad',
  'dias de inventario': 'dias_inventario',
  'dias inventario': 'dias_inventario',
  'bodega': 'bodega',
  'nombre bodega': 'nombre_bodega',
  'nombre de bodega': 'nombre_bodega',
  'zona': 'zona',
  'grupo de articulos': 'grupo_articulos',
  'grupo articulos': 'grupo_articulos',
  'tipo de bodega': 'tipo_bodega',
  'tipo bodega': 'tipo_bodega',
  'comercial': 'comercial',
}

// Si la primera línea parece encabezado (3 o más nombres reconocibles), se usa
// para ubicar las columnas aunque vengan en otro orden; si no, se asume el orden
// de COLUMNAS_ORIGINALES.
function mapearCabecera(celdas) {
  let resueltas = 0
  const porIndice = celdas.map((celda) => {
    const clave = ALIAS_CABECERA[normalizar(celda)]
    if (clave) resueltas++
    return clave || null
  })
  return resueltas >= 3 ? porIndice : null
}

export function parsearPegado(texto) {
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lineas.length === 0) return { filas: [], conEncabezado: false, fechasInvalidas: 0 }

  const primera = lineas[0]
  const separador = primera.includes('\t') ? '\t' : primera.includes(';') ? ';' : ','
  const partir = (linea) => linea.split(separador).map((c) => c.trim())

  const porIndice = mapearCabecera(partir(lineas[0]))
  const conEncabezado = porIndice !== null

  const filas = []
  let fechasInvalidas = 0
  for (let i = conEncabezado ? 1 : 0; i < lineas.length; i++) {
    const celdas = partir(lineas[i])
    const fila = {}
    let alguna = false
    for (let c = 0; c < COLUMNAS_ORIGINALES.length; c++) {
      const { key } = COLUMNAS_ORIGINALES[c]
      const origen = conEncabezado ? porIndice.indexOf(key) : c
      const valor = origen >= 0 ? String(celdas[origen] ?? '').trim() : ''
      fila[key] = valor
      if (valor) alguna = true
    }
    if (!alguna) continue
    const cruda = fila.fecha_vencimiento
    fila.fecha_vencimiento = parsearFecha(cruda)
    if (cruda && !fila.fecha_vencimiento) fechasInvalidas++
    filas.push(fila)
  }
  return { filas, conEncabezado, fechasInvalidas }
}

// ---------------------------------------------------------------------------
// Identidad y comparación (para ver qué cambia antes de subir)
// ---------------------------------------------------------------------------
// El reporte pegado no trae un id estable, así que una fila se identifica por
// artículo + lote + bodega.
export const claveInventario = (f) =>
  [f?.numero_articulo, f?.lote, f?.bodega]
    .map((v) => String(v ?? '').trim().toLowerCase())
    .join('|')

// Compara el inventario guardado con el pegado. Devuelve las filas nuevas,
// eliminadas y modificadas (con los campos que cambiaron) más el conteo de las
// que quedaron igual, para revisarlo antes de reemplazar todo.
export function compararInventario(actuales = [], nuevas = []) {
  const porClave = (arr) => {
    const m = new Map()
    for (const f of arr) m.set(claveInventario(f), f)
    return m
  }
  const actual = porClave(actuales)
  const nuevo = porClave(nuevas)

  const agregadas = []
  const modificadas = []
  let sinCambios = 0
  for (const [clave, fila] of nuevo) {
    const anterior = actual.get(clave)
    if (!anterior) {
      agregadas.push(fila)
      continue
    }
    const campos = COLUMNAS_ORIGINALES.filter(
      (c) => String(anterior[c.key] ?? '') !== String(fila[c.key] ?? '')
    )
    if (campos.length) modificadas.push({ fila, anterior, campos })
    else sinCambios += 1
  }

  const eliminadas = []
  for (const [clave, fila] of actual) {
    if (!nuevo.has(clave)) eliminadas.push(fila)
  }

  return { agregadas, modificadas, eliminadas, sinCambios }
}
