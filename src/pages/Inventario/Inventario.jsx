import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdAccessTime,
  MdBusiness,
  MdCheckCircle,
  MdCloudUpload,
  MdErrorOutline,
  MdEventAvailable,
  MdEventBusy,
  MdFileDownload,
  MdFilterAlt,
  MdInventory,
  MdInventory2,
  MdLocalShipping,
  MdNavigateBefore,
  MdNavigateNext,
  MdPlace,
  MdRestartAlt,
  MdSchedule,
  MdSearch,
  MdStorefront,
  MdSwapHoriz,
  MdTune,
  MdWarning,
  MdWarehouse,
} from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { puedeSubirInventario } from '../../auth/roles.js'
import { listarInventario } from '../../services/inventarioApi.js'
import { errorInventario } from '../../services/notificaciones.jsx'
import SubirInventarioModal from './Components/SubirInventarioModal.jsx'
import DetalleFilaModal from './Components/DetalleFilaModal.jsx'
import FiltroBuscable from './Components/FiltroBuscable.jsx'
import LoaderInventario from './Components/LoaderInventario.jsx'
import MapaZonasModal from './Components/MapaZonasModal.jsx'
import MapaZonasPanel from './Components/MapaZonasPanel.jsx'
import TablaArticulos, { ListaArticulosMovil } from './Components/TablaArticulos.jsx'
import {
  RANGOS_INVENTARIO,
  badgeRango,
  diasVigencia,
  dotRango,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  formatearFechaHora,
  rangoInventario,
} from '../../utils/inventarioUtils.js'
import { paginasVisibles } from '../../utils/paginacion.js'

const POR_PAGINA = 24

const FILTROS_INICIALES = {
  q: '',
  articulo: '',
  comercial: '',
  tipo: '',
  zona: '',
  bodega: '',
  proveedor: '',
  rangos: [],
  estados: [],
}

// Filtros que se escriben (con lista de sugerencias) y botón para ver el
// listado completo. El estado y el rango NO van aquí: para esos ya están las
// tarjetas del resumen.
const CATEGORIAS = [
  { clave: 'articulo', etiqueta: 'Artículo', icono: <MdInventory2 className="text-sm" />, placeholder: 'Código o descripción' },
  { clave: 'comercial', etiqueta: 'Comercial', icono: <MdBusiness className="text-sm" />, placeholder: 'Comercial' },
  { clave: 'tipo', etiqueta: 'Tipo de bodega', icono: <MdWarehouse className="text-sm" />, placeholder: 'Tipo de bodega' },
  { clave: 'zona', etiqueta: 'Zona', icono: <MdPlace className="text-sm" />, placeholder: 'Zona' },
  { clave: 'bodega', etiqueta: 'Bodega', icono: <MdStorefront className="text-sm" />, placeholder: 'Bodega' },
  { clave: 'proveedor', etiqueta: 'Proveedor', icono: <MdLocalShipping className="text-sm" />, placeholder: 'Proveedor' },
]

// Campo del artículo por el que filtra cada categoría de texto.
const CAMPO_CATEGORIA = {
  comercial: 'comercial',
  tipo: 'tipo_bodega',
  zona: 'zona',
  bodega: 'bodega',
  proveedor: 'proveedor',
}

// Semáforo de rotación: a qué rango de días corresponde cada color.
const RANGO_DIAS = {
  'Ok Rotación': '0–90 d',
  Rotar: '91–120 d',
  'Rotar con Prioridad': '121–240 d',
  'Rotar urgente': 'más de 240 d',
}

// Tarjeta del tablero: número + etiqueta, clicable para filtrar. Lleva el icono
// en el badge y el mismo icono como marca de agua que se agranda al pasar el
// cursor.
function TarjetaResumen({ icon, label, valor, accent, activa, onClick }) {
  const Icono = icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`group relative overflow-hidden rounded-2xl p-3 sm:p-4 flex items-center gap-3 text-left transition-all ${
        activa
          ? 'bg-white ring-2 ring-brand-cyan shadow-md'
          : 'bg-white ring-1 ring-brand-ink/10 shadow-sm hover:-translate-y-0.5 hover:ring-brand-cyan/40 hover:shadow-md'
      }`}
    >
      <Icono className="pointer-events-none absolute -bottom-4 -right-3 text-[5.5rem] text-brand-deep/20 transition-transform duration-300 ease-out group-hover:scale-125 group-hover:text-brand-deep/35" />
      <span className={`relative grid place-items-center size-10 rounded-xl text-white text-xl shadow-md shrink-0 transition-transform duration-300 group-hover:scale-110 ${accent}`}>
        <Icono />
      </span>
      <span className="relative min-w-0">
        <span className="block text-xl sm:text-2xl font-extrabold text-brand-ink leading-none tabular-nums">{valor}</span>
        <span className="block text-[11px] font-bold text-brand-ink/50 uppercase tracking-wide mt-1 truncate">{label}</span>
      </span>
    </button>
  )
}

// Espacio que explica qué significa cada color de los «días de rotación».
function LeyendaRotacion() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-ink/45">
        <MdAccessTime className="text-sm text-brand-cyan" />
        Días de rotación
      </span>
      {RANGOS_INVENTARIO.map((rango) => (
        <span
          key={rango}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${badgeRango(rango)}`}
        >
          <span className={`size-2 rounded-full ${dotRango(rango)}`} />
          {rango}
          <span className="font-semibold opacity-70">{RANGO_DIAS[rango]}</span>
        </span>
      ))}
    </div>
  )
}

// Chip de un filtro activo, con botón para quitarlo.
function ChipActivo({ children, onQuitar }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white pl-3 pr-1.5 py-1 text-[11px] font-bold">
      {children}
      <button
        type="button"
        onClick={onQuitar}
        aria-label="Quitar filtro"
        className="grid place-items-center size-4 rounded-full bg-white/20 hover:bg-white/35 transition"
      >
        <span className="text-xs leading-none">×</span>
      </button>
    </span>
  )
}

export default function Inventario() {
  const { rol, usuario, account } = useAuth()
  const correoSesion = usuario?.correo || account?.username || ''
  const puedeSubir = puedeSubirInventario(rol, correoSesion)

  const [filas, setFilas] = useState([])
  const [actualizadoEn, setActualizadoEn] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [subirAbierto, setSubirAbierto] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false)
  const [filaDetalle, setFilaDetalle] = useState(null)
  const [exportando, setExportando] = useState(false)

  const cargar = useCallback(async (esValido = () => true) => {
    setCargando(true)
    setError('')
    try {
      const datos = await listarInventario()
      if (esValido()) {
        setFilas(datos.filas)
        setActualizadoEn(datos.actualizadoEn)
      }
    } catch (e) {
      if (esValido()) setError(e.message || 'No se pudo cargar el inventario')
    } finally {
      if (esValido()) setCargando(false)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    cargar(() => vivo)
    return () => { vivo = false }
  }, [cargar])

  const enriquecidas = useMemo(
    () =>
      filas.map((f) => ({
        ...f,
        _estado: estadoVencimiento(f.fecha_vencimiento),
        _rango: rangoInventario(f.dias_inventario),
        _vigencia: diasVigencia(f.fecha_vencimiento),
      })),
    [filas]
  )

  // ¿La fila pasa todos los filtros activos? `excepto` deja fuera la dimensión
  // indicada para poder calcular los valores disponibles de un desplegable sin
  // que su propio filtro los oculte.
  const pasaFiltros = useCallback(
    (f, excepto = '') => {
      const q = filtros.q.trim().toLowerCase()
      const art = filtros.articulo.trim().toLowerCase()
      if (excepto !== 'articulo' && art) {
        const heno = `${f.numero_articulo ?? ''} ${f.descripcion ?? ''}`.toLowerCase()
        if (!heno.includes(art)) return false
      }
      for (const [clave, campo] of Object.entries(CAMPO_CATEGORIA)) {
        if (clave === excepto) continue
        const filtro = filtros[clave].trim().toLowerCase()
        if (filtro && !String(f[campo] ?? '').toLowerCase().includes(filtro)) return false
      }
      if (excepto !== 'rangos' && filtros.rangos.length && !filtros.rangos.includes(f._rango)) return false
      if (excepto !== 'estados' && filtros.estados.length && !filtros.estados.includes(f._estado)) return false
      if (q) {
        const heno = [f.numero_articulo, f.descripcion, f.lote, f.bodega, f.nombre_bodega, f.zona, f.grupo_articulos, f.proveedor, f.comercial]
          .join(' ')
          .toLowerCase()
        if (!heno.includes(q)) return false
      }
      return true
    },
    [filtros]
  )

  // Opciones de cada desplegable calculadas sobre lo que queda tras los demás
  // filtros y las tarjetas clicables: si filtras por bodega, «Comercial» solo
  // ofrece los comerciales que quedan. El valor elegido se conserva aunque deje
  // de aparecer, para no perder la selección.
  const opciones = useMemo(() => {
    const conSeleccion = (lista, valor) =>
      valor && !lista.some((o) => o.valor === valor) ? [{ valor, label: valor }, ...lista] : lista
    const unicos = (campo, excepto, valorElegido) => {
      const s = new Set()
      for (const f of enriquecidas) {
        if (!pasaFiltros(f, excepto)) continue
        const v = String(f[campo] ?? '').trim()
        if (v) s.add(v)
      }
      const lista = [...s].sort((a, b) => a.localeCompare(b, 'es')).map((v) => ({ valor: v, label: v }))
      return conSeleccion(lista, valorElegido)
    }
    // Un solo registro por artículo (código + descripción), sin repetir lotes.
    const porArticulo = new Map()
    for (const f of enriquecidas) {
      if (!pasaFiltros(f, 'articulo')) continue
      const codigo = String(f.numero_articulo ?? '').trim()
      const desc = String(f.descripcion ?? '').trim()
      const clave = codigo || desc
      if (!clave || porArticulo.has(clave)) continue
      porArticulo.set(clave, {
        valor: codigo || desc,
        label: desc || codigo,
        sub: codigo ? `Art. ${codigo}` : '',
      })
    }
    const articulos = [...porArticulo.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
    return {
      articulo: conSeleccion(articulos, filtros.articulo),
      comercial: unicos('comercial', 'comercial', filtros.comercial),
      tipo: unicos('tipo_bodega', 'tipo', filtros.tipo),
      zona: unicos('zona', 'zona', filtros.zona),
      bodega: unicos('bodega', 'bodega', filtros.bodega),
      proveedor: unicos('proveedor', 'proveedor', filtros.proveedor),
    }
  }, [enriquecidas, filtros, pasaFiltros])

  const resumen = useMemo(() => {
    let vencidos = 0
    let proximos = 0
    let vigentes = 0
    let ok = 0
    let rotar = 0
    let prioridad = 0
    let urgente = 0
    for (const f of enriquecidas) {
      if (f._estado === 'Vencido') vencidos += 1
      else if (f._estado === 'Próximo a vencer') proximos += 1
      else if (f._estado === 'Vigente') vigentes += 1
      if (f._rango === 'Ok Rotación') ok += 1
      else if (f._rango === 'Rotar') rotar += 1
      else if (f._rango === 'Rotar con Prioridad') prioridad += 1
      else if (f._rango === 'Rotar urgente') urgente += 1
    }
    return { total: enriquecidas.length, vencidos, proximos, vigentes, ok, rotar, prioridad, urgente }
  }, [enriquecidas])

  const filtradas = useMemo(() => {
    const resultado = enriquecidas.filter((f) => pasaFiltros(f))
    // Orden por defecto: por fecha de vencimiento, del más próximo a vencer al
    // más vencido. Los ya vencidos van al final y, entre ellos, el más vencido
    // queda último. Las filas sin fecha de vencimiento cierran la lista.
    return resultado.sort((a, b) => {
      const va = a._vigencia
      const vb = b._vigencia
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      const aVencido = va < 0
      const bVencido = vb < 0
      if (aVencido !== bVencido) return aVencido ? 1 : -1
      return aVencido ? vb - va : va - vb
    })
  }, [enriquecidas, pasaFiltros])

  useEffect(() => setPagina(1), [filtros])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const inicio = (paginaSegura - 1) * POR_PAGINA

  const filtroRapido = (clave, valor) =>
    setFiltros((prev) => {
      const activa = prev[clave].length === 1 && prev[clave][0] === valor
      return { ...prev, [clave]: activa ? [] : [valor] }
    })

  // Filtros aplicados, mostrados como lista de chips removibles.
  const chips = []
  if (filtros.q.trim()) {
        chips.push({ id: 'q', texto: `“${filtros.q.trim()}”`, onQuitar: () => setFiltros((p) => ({ ...p, q: '' })) })
  }
  for (const cat of CATEGORIAS) {
    if (filtros[cat.clave]) {
      chips.push({
        id: `${cat.clave}-${filtros[cat.clave]}`,
        texto: `${cat.etiqueta}: ${filtros[cat.clave]}`,
        onQuitar: () => setFiltros((p) => ({ ...p, [cat.clave]: '' })),
      })
    }
  }
  for (const e of filtros.estados) {
    chips.push({ id: `estado-${e}`, texto: e, onQuitar: () => setFiltros((p) => ({ ...p, estados: p.estados.filter((v) => v !== e) })) })
  }
  for (const r of filtros.rangos) {
    chips.push({ id: `rango-${r}`, texto: r, onQuitar: () => setFiltros((p) => ({ ...p, rangos: p.rangos.filter((v) => v !== r) })) })
  }

  const hayFiltrosActivos = chips.length > 0

  // Exporta a Excel los artículos que se están viendo (con los filtros activos,
  // todas las páginas) con el diseño de la marca: título navy, subtítulo azul,
  // encabezados cian, filas cebra y semáforo de colores en la fecha de
  // vencimiento y en los días de inventario. `xlsx` (el visor) no permite
  // estilos, por eso se usa exceljs solo para escribir.
  const exportarExcel = async () => {
    if (exportando || filtradas.length === 0) return
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const CABECERAS = [
        ['N° de artículo', 16],
        ['Descripción del artículo', 46],
        ['Lote', 14],
        ['Fecha de vencimiento', 19],
        ['Cantidad', 12],
        ['Días de inventario', 15],
        ['Bodega', 12],
        ['Nombre de la bodega', 26],
        ['Zona', 16],
        ['Grupo de artículos', 22],
        ['Proveedor', 26],
        ['Tipo de bodega', 16],
        ['Comercial', 20],
      ]
      const NC = CABECERAS.length
      const BORDE = { style: 'thin', color: { argb: 'FFB9CFE0' } }
      const bordeCompleto = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE }
      const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

      // Colores de semáforo, mismos estados y rangos que los filtros del módulo.
      const ESTADO_ESTILO = {
        Vencido: { fg: 'FFFADBD8', letra: 'FF922B21' },
        'Próximo a vencer': { fg: 'FFFDEBD0', letra: 'FF9C6400' },
        Vigente: { fg: 'FFD5F5E3', letra: 'FF1E8449' },
      }
      const RANGO_ESTILO = {
        'Ok Rotación': { fg: 'FFD5F5E3', letra: 'FF1E8449' },
        Rotar: { fg: 'FFFCF3CF', letra: 'FF9C6400' },
        'Rotar con Prioridad': { fg: 'FFFDEBD0', letra: 'FFAF6017' },
        'Rotar urgente': { fg: 'FFFADBD8', letra: 'FF922B21' },
      }

      const libro = new ExcelJS.Workbook()
      libro.creator = 'Logística CTP'
      libro.created = new Date()
      const hoja = libro.addWorksheet('Artículos', {
        views: [{ state: 'frozen', ySplit: 4 }],
      })

      CABECERAS.forEach(([texto, ancho], i) => {
        hoja.getColumn(i + 1).width = ancho
        hoja.getCell(4, i + 1).value = texto
      })

      // Fila 1: título con el navy de la marca
      hoja.mergeCells(1, 1, 1, NC)
      const titulo = hoja.getCell(1, 1)
      titulo.value = 'INVENTARIO CTP MÉDICA · ARTÍCULOS'
      titulo.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
      titulo.fill = relleno('FF071A3D')
      titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      hoja.getRow(1).height = 30

      // Fila 2: fecha del reporte y cuántos artículos lleva
      hoja.mergeCells(2, 1, 2, NC)
      const subtitulo = hoja.getCell(2, 1)
      subtitulo.value = `Exportado el ${new Date().toLocaleString('es-CO')} · ${filtradas.length.toLocaleString('es-CO')} artículo(s) con los filtros activos`
      subtitulo.font = { size: 10, italic: true, color: { argb: 'FFFFFFFF' } }
      subtitulo.fill = relleno('FF003B73')
      subtitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      hoja.getRow(2).height = 20

      hoja.getRow(3).height = 6

      // Fila 4: encabezados cian, congelados junto con el título
      const filaCabecera = hoja.getRow(4)
      filaCabecera.height = 24
      filaCabecera.eachCell((celda) => {
        celda.font = { bold: true, size: 10, color: { argb: 'FF0A0027' } }
        celda.fill = relleno('FF00E5FF')
        celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        celda.border = bordeCompleto
      })

      filtradas.forEach((f, i) => {
        const fila = hoja.addRow([
          f.numero_articulo ?? '',
          f.descripcion ?? '',
          f.lote ?? '',
          f.fecha_vencimiento ? formatearFecha(f.fecha_vencimiento) : '',
          f.cantidad ?? '',
          f.dias_inventario ?? '',
          f.bodega ?? '',
          f.nombre_bodega ?? '',
          f.zona ?? '',
          f.grupo_articulos ?? '',
          f.proveedor ?? '',
          f.tipo_bodega ?? '',
          f.comercial ?? '',
        ])
        const cebra = i % 2 === 1
        fila.eachCell({ includeEmpty: true }, (celda, col) => {
          celda.font = { size: 10, color: { argb: 'FF1B2A41' } }
          celda.fill = relleno(cebra ? 'FFEAF4F7' : 'FFFFFFFF')
          celda.border = bordeCompleto
          celda.alignment = {
            vertical: 'middle',
            horizontal: col === 2 || col === 8 || col === 10 || col === 11 || col === 13 ? 'left' : 'center',
            wrapText: col === 2,
          }
        })
        const estiloEstado = ESTADO_ESTILO[f._estado]
        if (estiloEstado) {
          const celda = fila.getCell(4)
          celda.fill = relleno(estiloEstado.fg)
          celda.font = { size: 10, bold: true, color: { argb: estiloEstado.letra } }
        }
        const estiloRango = RANGO_ESTILO[f._rango]
        if (estiloRango) {
          const celda = fila.getCell(6)
          celda.fill = relleno(estiloRango.fg)
          celda.font = { size: 10, bold: true, color: { argb: estiloRango.letra } }
        }
      })

      hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filtradas.length, column: NC } }

      // Pie con la leyenda de los colores
      const filaPie = 4 + filtradas.length + 2
      hoja.mergeCells(filaPie, 1, filaPie, NC)
      const pie = hoja.getCell(filaPie, 1)
      pie.value =
        'Generado por Logística CTP · el color de «Fecha de vencimiento» indica el estado y el de «Días de inventario» la rotación'
      pie.font = { size: 9, italic: true, color: { argb: 'FF6B7A8F' } }
      pie.alignment = { horizontal: 'left', indent: 1 }

      const buffer = await libro.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `inventario-articulos-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[Inventario] error exportando a Excel:', e)
      errorInventario(e?.message || 'No se pudo exportar a Excel')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-ink">
      <Header />

      <main className="flex-1 py-6 sm:py-10">
        <div className="w-full px-4 sm:px-6">
          {/* Barra superior */}
          <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold text-brand-ink inline-flex items-center gap-3">
                <span className="grid place-items-center size-10 sm:size-12 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 overflow-hidden">
                  <img
                    src="/ITitulos/IInventario.png"
                    alt="Inventario de artículos"
                    className="size-full object-contain"
                  />
                </span>
                INVENTARIO DE ARTÍCULOS
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                Artículos, lotes y vencimientos por bodega
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {puedeSubir && (
                  <button
                    type="button"
                    onClick={() => setSubirAbierto(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-cyan text-brand-ink px-5 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-bold shadow-cyanGlow hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
                  >
                    <MdCloudUpload className="text-lg" />
                    Subir información
                  </button>
                )}
              </div>
              {actualizadoEn && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/5 ring-1 ring-brand-ink/10 px-3 py-1.5 text-xs font-bold text-brand-ink/60">
                  <MdSchedule className="text-sm text-brand-ink/40" />
                  Última actualización: {formatearFechaHora(actualizadoEn)}
                </p>
              )}
            </div>
          </div>

          {cargando ? (
            <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4">
              <LoaderInventario />
              <p className="text-sm font-extrabold uppercase tracking-wider text-brand-deep">
                Cargando inventario…
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <MdErrorOutline className="text-4xl text-red-400" />
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => cargar()}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-ink/10 px-4 py-2.5 text-xs font-extrabold text-brand-ink hover:bg-brand-ink/15 transition"
              >
                Reintentar
              </button>
            </div>
          ) : filas.length === 0 ? (
            <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-16 text-center">
              <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-4">
                <MdInventory className="text-3xl" />
              </div>
              <p className="text-lg font-extrabold text-brand-ink">Aún no hay inventario</p>
              <p className="text-sm text-brand-ink/50 mt-1">
                {puedeSubir
                  ? 'Usa «Subir información» para cargar el reporte de Excel.'
                  : 'El administrador aún no ha subido el inventario.'}
              </p>
            </div>
          ) : (
            <>
              {/* Leyenda del semáforo de rotación: debajo del título y encima
                  de las tarjetas clicables. */}
              <div className="mb-5 rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-3 sm:px-4 py-3">
                <LeyendaRotacion />
              </div>

              {/* Tablero: tarjetas clicables que resumen y filtran */}
              <section aria-label="Resumen del inventario" className="space-y-5 sm:space-y-6 mb-5">
                <div>
                  <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
                    <MdEventBusy className="text-brand-cyan text-lg" />
                    Estado de vencimiento
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <TarjetaResumen
                      icon={MdInventory}
                      accent="bg-gradient-to-br from-brand-navy to-brand-deep"
                      label="Artículos"
                      valor={formatearEntero(resumen.total)}
                      activa={!hayFiltrosActivos}
                      onClick={() => setFiltros(FILTROS_INICIALES)}
                    />
                    <TarjetaResumen
                      icon={MdEventBusy}
                      accent="bg-gradient-to-br from-red-500 to-rose-400"
                      label="Vencidos"
                      valor={formatearEntero(resumen.vencidos)}
                      activa={filtros.estados.length === 1 && filtros.estados[0] === 'Vencido'}
                      onClick={() => filtroRapido('estados', 'Vencido')}
                    />
                    <TarjetaResumen
                      icon={MdWarning}
                      accent="bg-gradient-to-br from-amber-500 to-yellow-400"
                      label="Próximo a vencer"
                      valor={formatearEntero(resumen.proximos)}
                      activa={filtros.estados.length === 1 && filtros.estados[0] === 'Próximo a vencer'}
                      onClick={() => filtroRapido('estados', 'Próximo a vencer')}
                    />
                    <TarjetaResumen
                      icon={MdEventAvailable}
                      accent="bg-gradient-to-br from-green-500 to-emerald-400"
                      label="Vigentes"
                      valor={formatearEntero(resumen.vigentes)}
                      activa={filtros.estados.length === 1 && filtros.estados[0] === 'Vigente'}
                      onClick={() => filtroRapido('estados', 'Vigente')}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
                    <MdAccessTime className="text-brand-cyan text-lg" />
                    Días de rotación
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <TarjetaResumen
                      icon={MdCheckCircle}
                      accent="bg-gradient-to-br from-green-500 to-emerald-400"
                      label="Ok Rotación"
                      valor={formatearEntero(resumen.ok)}
                      activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Ok Rotación'}
                      onClick={() => filtroRapido('rangos', 'Ok Rotación')}
                    />
                    <TarjetaResumen
                      icon={MdSwapHoriz}
                      accent="bg-gradient-to-br from-yellow-500 to-amber-400"
                      label="Rotar"
                      valor={formatearEntero(resumen.rotar)}
                      activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar'}
                      onClick={() => filtroRapido('rangos', 'Rotar')}
                    />
                    <TarjetaResumen
                      icon={MdSwapHoriz}
                      accent="bg-gradient-to-br from-orange-500 to-amber-500"
                      label="Rotar con prioridad"
                      valor={formatearEntero(resumen.prioridad)}
                      activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar con Prioridad'}
                      onClick={() => filtroRapido('rangos', 'Rotar con Prioridad')}
                    />
                    <TarjetaResumen
                      icon={MdWarning}
                      accent="bg-gradient-to-br from-red-600 to-rose-500"
                      label="Rotar urgente"
                      valor={formatearEntero(resumen.urgente)}
                      activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar urgente'}
                      onClick={() => filtroRapido('rangos', 'Rotar urgente')}
                    />
                  </div>
                </div>
              </section>

              {/* Filtros + mapa: el card de filtros a la izquierda y el mapa de
                  zonas a la derecha (en celular, el mapa debajo de los filtros). */}
              <div className="grid gap-4 md:grid-cols-2 items-stretch mb-5">
                <section
                  aria-label="Filtros"
                  className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-4 sm:p-5 space-y-4"
                >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
                    <MdTune className="text-brand-cyan text-lg" />
                    Filtros
                  </h2>
                  {hayFiltrosActivos && (
                    <button
                      type="button"
                      onClick={() => setFiltros(FILTROS_INICIALES)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/5 px-3 py-1.5 text-xs font-bold text-brand-ink/70 hover:bg-brand-ink/10 transition"
                    >
                      <MdRestartAlt className="text-sm" />
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/35 text-lg" />
                  <input
                    type="search"
                    value={filtros.q}
                    onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))}
                    placeholder="Buscar en todo el inventario…"
                    aria-label="Buscar en el inventario"
                    className="w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 pl-11 text-brand-ink placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIAS.map((cat) => (
                    <FiltroBuscable
                      key={cat.clave}
                      etiqueta={cat.etiqueta}
                      icono={cat.icono}
                      value={filtros[cat.clave]}
                      onChange={(v) => setFiltros((p) => ({ ...p, [cat.clave]: v }))}
                      opciones={opciones[cat.clave]}
                      placeholder={cat.placeholder}
                    />
                  ))}
                </div>

                {hayFiltrosActivos && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-ink/10">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-ink/45">
                      <MdFilterAlt className="text-sm text-brand-cyan" />
                      Activos
                    </span>
                    {chips.map((c) => (
                      <ChipActivo key={c.id} onQuitar={c.onQuitar}>
                        {c.texto}
                      </ChipActivo>
                    ))}
                  </div>
                )}
                </section>

                <div className="relative z-0 rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-2 sm:p-3 min-h-[360px] flex">
                  <MapaZonasPanel filas={filtradas} onAbrir={() => setMapaAbierto(true)} />
                </div>
              </div>

              {/* Resultados */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-brand-ink/50">
                  {filtradas.length === filas.length
                    ? `${formatearEntero(filas.length)} artículo${filas.length === 1 ? '' : 's'}`
                    : `${formatearEntero(filtradas.length)} de ${formatearEntero(filas.length)} artículos`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {filtradas.length === 0 && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                      <MdFilterAlt className="text-sm" />
                      Ningún artículo coincide con los filtros
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={exportarExcel}
                    disabled={exportando || filtradas.length === 0}
                    title="Exportar a Excel los artículos listados (con los filtros activos)"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy text-white px-4 py-2 text-xs font-bold hover:bg-brand-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdFileDownload className="text-base" />
                    {exportando ? 'Exportando…' : 'Exportar a Excel'}
                  </button>
                </div>
              </div>

              {/* Tabla o tarjetas según el tamaño de pantalla */}
              {filtradas.length > 0 && (
                <>
                  <div className="md:hidden">
                    <ListaArticulosMovil
                      filas={filtradas.slice(inicio, inicio + POR_PAGINA)}
                      onVer={setFilaDetalle}
                    />
                  </div>
                  <div className="hidden md:block">
                    <TablaArticulos
                      filas={filtradas.slice(inicio, inicio + POR_PAGINA)}
                      onVer={setFilaDetalle}
                    />
                  </div>
                </>
              )}

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6 w-full max-w-full">
                  <button
                    type="button"
                    onClick={() => setPagina(Math.max(1, paginaSegura - 1))}
                    disabled={paginaSegura === 1}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MdNavigateBefore className="text-lg" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 max-w-full min-w-0">
                    {paginasVisibles(paginaSegura, totalPaginas).map((p, i) =>
                      p === '⬦' ? (
                        <span key={`gap-${i}`} className="px-1 text-sm font-bold text-brand-ink/40">⬦</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPagina(p)}
                          className={`size-8 sm:size-9 shrink-0 rounded-full font-bold text-sm transition-all ${
                            paginaSegura === p
                              ? 'bg-brand-cyan text-brand-ink shadow-cyanGlow'
                              : 'bg-white text-brand-ink border border-brand-ink/15 hover:bg-brand-deep/10'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagina(Math.min(totalPaginas, paginaSegura + 1))}
                    disabled={paginaSegura === totalPaginas}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <MdNavigateNext className="text-lg" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      <SubirInventarioModal
        open={subirAbierto}
        actuales={filas}
        actualizadoEn={actualizadoEn}
        onClose={() => setSubirAbierto(false)}
        onSubido={() => cargar()}
      />

      <DetalleFilaModal fila={filaDetalle} onClose={() => setFilaDetalle(null)} />

      <MapaZonasModal open={mapaAbierto} onClose={() => setMapaAbierto(false)} filas={filtradas} />
    </div>
  )
}