import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdAccessTime,
  MdBusiness,
  MdCalendarToday,
  MdCheckCircle,
  MdCloudUpload,
  MdDescription,
  MdErrorOutline,
  MdEventAvailable,
  MdEventBusy,
  MdFilterAlt,
  MdInventory,
  MdInventory2,
  MdLocalShipping,
  MdMap,
  MdNavigateBefore,
  MdNavigateNext,
  MdNumbers,
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
import { esPrivilegiado } from '../../auth/roles.js'
import { listarInventario } from '../../services/inventarioApi.js'
import SubirInventarioModal from './Components/SubirInventarioModal.jsx'
import DetalleFilaModal from './Components/DetalleFilaModal.jsx'
import FiltroBuscable from './Components/FiltroBuscable.jsx'
import LoaderInventario from './Components/LoaderInventario.jsx'
import MapaZonasModal from './Components/MapaZonasModal.jsx'
import {
  MARCA_VENCIDO,
  RANGOS_INVENTARIO,
  badgeRango,
  diasVigencia,
  dotRango,
  estadoVencimiento,
  fondoInventario,
  formatearEntero,
  formatearFecha,
  formatearFechaHora,
  rangoInventario,
} from '../../utils/inventarioUtils.js'

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

// Columnas de la tabla de artículos: solo lo esencial, cada una con su icono.
// Las de número, vencimiento, cantidad y días van centradas.
const COLUMNAS_TABLA = [
  { key: 'numero_articulo', label: 'N° de artículo', icon: <MdNumbers />, centrada: true },
  { key: 'descripcion', label: 'Descripción del artículo', icon: <MdDescription />, clase: 'min-w-[16rem]' },
  { key: 'fecha_vencimiento', label: 'Fecha de vencimiento', icon: <MdCalendarToday />, centrada: true },
  { key: 'cantidad', label: 'Cantidad', icon: <MdInventory2 />, centrada: true },
  { key: 'dias_inventario', label: 'Días de inventario', icon: <MdAccessTime />, centrada: true },
  { key: 'bodega', label: 'Bodega', icon: <MdWarehouse /> },
  { key: 'nombre_bodega', label: 'Nombre de la bodega', icon: <MdStorefront />, clase: 'min-w-[13rem]' },
  { key: 'comercial', label: 'Comercial', icon: <MdBusiness /> },
]

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

// Pastilla con el número de días, coloreada por el semáforo de rotación.
function DiasRango({ f }) {
  if (!f._rango) {
    return <span className="tabular-nums text-brand-ink/60">{formatearEntero(f.dias_inventario)}</span>
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${badgeRango(f._rango)}`}>
      <span className={`size-2 rounded-full ${dotRango(f._rango)}`} />
      {formatearEntero(f.dias_inventario)}
    </span>
  )
}

// Dato compacto de la tarjeta del celular.
function DatoMovil({ icon, label, valor }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 rounded-lg bg-white/70 px-2 py-1">
      <span className="text-brand-cyan text-sm shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-brand-ink/40 leading-none">{label}</span>
        <span className="block text-[11px] font-bold truncate text-brand-ink">{valor}</span>
      </span>
    </div>
  )
}

// Tabla de artículos (escritorio). Cada fila abre el modal de detalle y se
// colorea según el rango de los «días de inventario».
function TablaInventario({ filas, onVer }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm">
      <table className="w-full min-w-[1080px] text-sm border-collapse">
        <thead>
          <tr className="bg-brand-navy text-white">
            {COLUMNAS_TABLA.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`border border-brand-navy/40 px-3 py-3 text-[11px] font-extrabold uppercase tracking-wide ${
                  c.centrada ? 'text-center' : 'text-left'
                } ${c.clase || ''}`}
              >
                <span className={`inline-flex items-center gap-1.5 ${c.centrada ? 'justify-center' : ''}`}>
                  <span className="text-brand-cyan text-base">{c.icon}</span>
                  {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const etiqueta = f.numero_articulo || f.descripcion || 'este artículo'
            return (
              <tr
                key={f.id ?? `${f.numero_articulo}-${f.lote}-${i}`}
                onClick={() => onVer(f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onVer(f)
                  }
                }}
                tabIndex={0}
                role="button"
                title={`Ver detalle de ${etiqueta}`}
                className={`cursor-pointer border-t border-brand-ink/15 transition-colors hover:bg-brand-cyan/15 focus:outline-none focus-visible:bg-brand-cyan/20 ${fondoInventario(f)}`}
              >
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-[11px] font-extrabold px-2 py-1">
                    {f.numero_articulo || '—'}
                  </span>
                </td>
                <td className="relative overflow-hidden border border-brand-ink/10 px-3 py-2.5 font-semibold leading-snug text-brand-ink/80">
                  {f._estado === 'Vencido' && (
                    <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.3em] text-red-900/25">
                      {MARCA_VENCIDO}
                    </span>
                  )}
                  <span className="relative">
                    {f.descripcion || <span className="text-brand-ink/40">Sin descripción</span>}
                  </span>
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center align-middle text-brand-ink/70">
                  {f.fecha_vencimiento ? (
                    <span className="whitespace-nowrap">{formatearFecha(f.fecha_vencimiento)}</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-brand-ink/40">Sin fecha de vencimiento</span>
                  )}
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center font-bold tabular-nums text-brand-ink">
                  {String(f.cantidad ?? '').trim() || '—'}
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center">
                  <DiasRango f={f} />
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 whitespace-nowrap text-brand-ink/70">{f.bodega || '—'}</td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-brand-ink/70">{f.nombre_bodega || '—'}</td>
                <td className="border border-brand-ink/10 px-3 py-2.5 whitespace-nowrap text-brand-ink/70">{f.comercial || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Vista de artículos en tarjetas (celular): mismo contenido que la tabla, con
// el color del rango de rotación como fondo.
function TablaInventarioMovil({ filas, onVer }) {
  return (
    <div className="space-y-3">
      {filas.map((f, i) => {
        const etiqueta = f.numero_articulo || f.descripcion || 'este artículo'
        return (
          <button
            key={f.id ?? `${f.numero_articulo}-${f.lote}-${i}`}
            type="button"
            onClick={() => onVer(f)}
            title={`Ver detalle de ${etiqueta}`}
            className={`relative w-full overflow-hidden rounded-2xl text-left ring-1 ring-brand-ink/10 shadow-sm hover:shadow-md transition-all pl-4 pr-3 py-3 ${fondoInventario(f)}`}
          >
            <span className={`absolute left-0 top-0 h-full w-1.5 ${f._estado === 'Vencido' ? 'bg-red-800/60' : dotRango(f._rango)}`} />
            {f._estado === 'Vencido' && (
              <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center px-8 text-center text-[11px] font-extrabold uppercase tracking-[0.25em] text-red-900/25">
                {MARCA_VENCIDO}
              </span>
            )}
            <div className="relative flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-[11px] font-extrabold px-2 py-1 max-w-[60%] truncate">
                  {f.numero_articulo || '—'}
                </span>
                <DiasRango f={f} />
              </div>
              <p className="text-xs font-semibold leading-snug text-brand-ink/80 line-clamp-2">
                {f.descripcion || 'Sin descripción'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <DatoMovil icon={<MdCalendarToday />} label="Vence" valor={f.fecha_vencimiento ? formatearFecha(f.fecha_vencimiento) : 'Sin fecha de vencimiento'} />
                <DatoMovil icon={<MdInventory2 />} label="Cantidad" valor={String(f.cantidad ?? '').trim() || '—'} />
                <DatoMovil icon={<MdWarehouse />} label="Bodega" valor={f.bodega || '—'} />
                <DatoMovil icon={<MdStorefront />} label="Nombre bodega" valor={f.nombre_bodega || '—'} />
                <DatoMovil icon={<MdBusiness />} label="Comercial" valor={f.comercial || '—'} />
              </div>
            </div>
          </button>
        )
      })}
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

// Páginas visibles alrededor de la actual, con «⬦» cuando se salta.
function paginasVisibles(pagina, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cerca = [1, 2, pagina - 1, pagina, pagina + 1, total - 1, total]
    .filter((p) => p >= 1 && p <= total)
    .filter((p, i, a) => a.indexOf(p) === i)
    .sort((a, b) => a - b)
  const salida = []
  let anterior = 0
  for (const p of cerca) {
    if (p - anterior > 1) salida.push('⬦')
    salida.push(p)
    anterior = p
  }
  return salida
}

export default function Inventario() {
  const { rol } = useAuth()
  const puedeSubir = esPrivilegiado(rol)

  const [filas, setFilas] = useState([])
  const [actualizadoEn, setActualizadoEn] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [subirAbierto, setSubirAbierto] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false)
  const [filaDetalle, setFilaDetalle] = useState(null)

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
              {!cargando && filas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMapaAbierto(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-5 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-bold shadow-sm hover:bg-brand-deep hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
                >
                  <MdMap className="text-lg" />
                  Ver artículos en el mapa
                </button>
              )}
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

              {/* Filtros: búsqueda + campos escribibles con lista + activos */}
              <section
                aria-label="Filtros"
                className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-4 sm:p-5 mb-5 space-y-4"
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

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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

              {/* Resultados */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-brand-ink/50">
                  {filtradas.length === filas.length
                    ? `${formatearEntero(filas.length)} artículo${filas.length === 1 ? '' : 's'}`
                    : `${formatearEntero(filtradas.length)} de ${formatearEntero(filas.length)} artículos`}
                </p>
                {filtradas.length === 0 && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <MdFilterAlt className="text-sm" />
                    Ningún artículo coincide con los filtros
                  </p>
                )}
              </div>

              {/* Tabla o tarjetas según el tamaño de pantalla */}
              {filtradas.length > 0 && (
                <>
                  <div className="md:hidden">
                    <TablaInventarioMovil
                      filas={filtradas.slice(inicio, inicio + POR_PAGINA)}
                      onVer={setFilaDetalle}
                    />
                  </div>
                  <div className="hidden md:block">
                    <TablaInventario
                      filas={filtradas.slice(inicio, inicio + POR_PAGINA)}
                      onVer={setFilaDetalle}
                    />
                  </div>
                </>
              )}

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setPagina(Math.max(1, paginaSegura - 1))}
                    disabled={paginaSegura === 1}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MdNavigateBefore className="text-lg" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {paginasVisibles(paginaSegura, totalPaginas).map((p, i) =>
                      p === '⬦' ? (
                        <span key={`gap-${i}`} className="px-1 text-sm font-bold text-brand-ink/40">⬦</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPagina(p)}
                          className={`size-8 sm:size-9 rounded-full font-bold text-sm transition-all ${
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