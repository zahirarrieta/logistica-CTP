import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdAccessTime,
  MdCalendarToday,
  MdCheckCircle,
  MdCloudUpload,
  MdErrorOutline,
  MdEventAvailable,
  MdEventBusy,
  MdFilterAlt,
  MdInventory,
  MdInventory2,
  MdNavigateBefore,
  MdNavigateNext,
  MdNumbers,
  MdPlace,
  MdRestartAlt,
  MdSchedule,
  MdSearch,
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
import { getBadgeColor, getDotColor } from '../../utils/estadoColors.js'
import {
  badgeRango,
  diasVigencia,
  dotRango,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  formatearFechaHora,
  rangoInventario,
} from '../../utils/inventarioUtils.js'

const POR_PAGINA = 24

const FILTROS_INICIALES = {
  q: '',
  comercial: '',
  tipo: '',
  zona: '',
  bodega: '',
  rangos: [],
  estados: [],
}

// Categorías filtrables por texto (con lista de sugerencias). El estado y el
// rango NO van aquí: para esos ya están las tarjetas del resumen.
const CATEGORIAS = [
  { clave: 'comercial', etiqueta: 'Comercial', campo: 'comercial', placeholder: 'Comercial' },
  { clave: 'tipo', etiqueta: 'Tipo de bodega', campo: 'tipo_bodega', placeholder: 'Tipo de bodega' },
  { clave: 'zona', etiqueta: 'Zona', campo: 'zona', placeholder: 'Zona' },
  { clave: 'bodega', etiqueta: 'Bodega', campo: 'bodega', placeholder: 'Bodega' },
]

// Color del acento lateral y del icono según el rango de rotación.
const ACENTO_RANGO = {
  'Ok Rotación': 'bg-green-500',
  Rotar: 'bg-yellow-500',
  'Rotar con Prioridad': 'bg-orange-500',
  'Rotar urgente': 'bg-red-500',
}

function iconoEstado(estado) {
  if (estado === 'Vencido') return MdEventBusy
  if (estado === 'Próximo a vencer') return MdWarning
  if (estado === 'Vigente') return MdEventAvailable
  return MdInventory2
}

function EstadoBadge({ estado }) {
  if (!estado) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/5 px-2.5 py-1 text-[11px] font-bold text-brand-ink/50">
        Sin fecha
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${getBadgeColor(estado)}`}>
      <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
      {estado}
    </span>
  )
}

function RangoBadge({ rango }) {
  if (!rango) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${badgeRango(rango)}`}>
      <span className={`size-2 rounded-full ${dotRango(rango)}`} />
      {rango}
    </span>
  )
}

// Tarjeta del tablero: número + etiqueta, clicable para filtrar.
function TarjetaResumen({ icon, label, valor, accent, activa, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-2xl p-3 sm:p-4 flex items-center gap-3 text-left transition-all ${
        activa
          ? 'bg-white ring-2 ring-brand-cyan shadow-md'
          : 'bg-white ring-1 ring-brand-ink/10 shadow-sm hover:-translate-y-0.5 hover:ring-brand-cyan/40 hover:shadow-md'
      }`}
    >
      <span className={`grid place-items-center size-10 rounded-xl text-white text-xl shadow-md shrink-0 ${accent}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xl sm:text-2xl font-extrabold text-brand-ink leading-none tabular-nums">{valor}</span>
        <span className="block text-[11px] font-bold text-brand-ink/50 uppercase tracking-wide mt-1 truncate">{label}</span>
      </span>
    </button>
  )
}

// Campo de filtro que se puede escribir: al escribir aparece la lista de
// valores disponibles (datalist) y el texto filtra por coincidencia parcial.
function FiltroBuscable({ clave, etiqueta, value, onChange, opciones, placeholder }) {
  const id = `inv-filtro-${clave}`.replace(/[^a-z0-9-]/gi, '-')
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-ink/45">{etiqueta}</span>
      <input
        type="text"
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-brand-ink/15 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
      />
      <datalist id={id}>
        {opciones.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  )
}

function Dato({ icon, label, valor, alerta }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 rounded-lg bg-brand-ink/[0.04] px-2 py-1">
      <span className="text-brand-cyan text-sm shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-brand-ink/40 leading-none">{label}</span>
        <span className={`block text-[11px] font-bold truncate ${alerta ? 'text-red-600' : 'text-brand-ink'}`}>{valor}</span>
      </span>
    </div>
  )
}

// Card de un artículo (reemplaza la fila de tabla). Compacta para que entren
// dos por fila en el celular y con un icono de marca de agua según el estado.
function InventarioCard({ f, onVer }) {
  const cantidad = String(f.cantidad ?? '').trim()
  const vigencia = f._vigencia
  const Watermark = iconoEstado(f._estado)
  const acento = ACENTO_RANGO[f._rango] || 'bg-brand-deep/20'

  return (
    <button
      type="button"
      onClick={() => onVer(f)}
      title={`Ver detalle de ${f.numero_articulo || f.descripcion || 'este artículo'}`}
      className="group relative overflow-hidden w-full text-left rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm hover:shadow-md hover:ring-brand-cyan/50 hover:-translate-y-0.5 transition-all pl-4 pr-3 py-3"
    >
      {/* Acento lateral por rango de rotación */}
      <span className={`absolute left-0 top-0 h-full w-1.5 ${acento}`} />
      {/* Icono de marca de agua */}
      <Watermark className="pointer-events-none absolute -right-3 -bottom-3 text-[5.5rem] text-brand-deep/[0.06] group-hover:text-brand-cyan/10 transition-colors" />

      <div className="relative flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-[11px] font-extrabold px-2 py-1 max-w-[55%] truncate">
            {f.numero_articulo || '—'}
          </span>
          <EstadoBadge estado={f._estado} />
        </div>

        <p className="text-xs font-semibold leading-snug text-brand-ink/80 line-clamp-2 min-h-[2rem]">
          {f.descripcion || 'Sin descripción'}
        </p>

        {f._rango && <div className="flex"><RangoBadge rango={f._rango} /></div>}

        <div className="grid grid-cols-2 gap-1.5">
          <Dato icon={<MdNumbers />} label="Cantidad" valor={cantidad || '—'} />
          <Dato icon={<MdCalendarToday />} label="Vence" valor={formatearFecha(f.fecha_vencimiento)} />
          <Dato
            icon={<MdAccessTime />}
            label="Vigencia"
            valor={vigencia === null ? '—' : `${formatearEntero(vigencia)} d`}
            alerta={vigencia !== null && vigencia < 0}
          />
          <Dato icon={<MdWarehouse />} label="Bodega" valor={f.bodega || '—'} />
        </div>

        {(f.zona || f.comercial) && (
          <div className="flex items-center gap-3 text-[11px] text-brand-ink/50 min-w-0">
            {f.zona && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MdPlace className="text-sm text-brand-cyan shrink-0" />
                <span className="truncate">{f.zona}</span>
              </span>
            )}
            {f.comercial && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MdInventory2 className="text-sm text-brand-cyan shrink-0" />
                <span className="truncate">{f.comercial}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </button>
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

// Páginas visibles alrededor de la actual, con «…» cuando se salta.
function paginasVisibles(pagina, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cerca = [1, 2, pagina - 1, pagina, pagina + 1, total - 1, total]
    .filter((p) => p >= 1 && p <= total)
    .filter((p, i, a) => a.indexOf(p) === i)
    .sort((a, b) => a - b)
  const salida = []
  let anterior = 0
  for (const p of cerca) {
    if (p - anterior > 1) salida.push('…')
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

  const opciones = useMemo(() => {
    const unicos = (campo) => {
      const s = new Set()
      for (const f of filas) {
        const v = String(f[campo] ?? '').trim()
        if (v) s.add(v)
      }
      return [...s].sort((a, b) => a.localeCompare(b, 'es'))
    }
    return {
      comercial: unicos('comercial'),
      tipo: unicos('tipo_bodega'),
      zona: unicos('zona'),
      bodega: unicos('bodega'),
    }
  }, [filas])

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
    const q = filtros.q.trim().toLowerCase()
    const igual = (valor, filtro) => !filtro || String(valor ?? '').toLowerCase().includes(filtro.trim().toLowerCase())
    return enriquecidas.filter((f) => {
      if (!igual(f.comercial, filtros.comercial)) return false
      if (!igual(f.tipo_bodega, filtros.tipo)) return false
      if (!igual(f.zona, filtros.zona)) return false
      if (!igual(f.bodega, filtros.bodega)) return false
      if (filtros.rangos.length && !filtros.rangos.includes(f._rango)) return false
      if (filtros.estados.length && !filtros.estados.includes(f._estado)) return false
      if (q) {
        const heno = [f.numero_articulo, f.descripcion, f.lote, f.bodega, f.nombre_bodega, f.zona, f.grupo_articulos, f.comercial]
          .join(' ')
          .toLowerCase()
        if (!heno.includes(q)) return false
      }
      return true
    })
  }, [enriquecidas, filtros])

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
              {actualizadoEn && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/5 ring-1 ring-brand-ink/10 px-3 py-1.5 text-xs font-bold text-brand-ink/60">
                  <MdSchedule className="text-sm text-brand-ink/40" />
                  Última actualización: {formatearFechaHora(actualizadoEn)}
                </p>
              )}
            </div>
          </div>

          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-brand-deep/60">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
              <p className="text-sm font-semibold">Cargando inventario…</p>
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
              {/* Tablero: tarjetas clicables que resumen y filtran */}
              <section aria-label="Resumen del inventario" className="space-y-3 sm:space-y-4 mb-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <TarjetaResumen
                    icon={<MdInventory />}
                    accent="bg-gradient-to-br from-brand-navy to-brand-deep"
                    label="Artículos"
                    valor={formatearEntero(resumen.total)}
                    activa={!hayFiltrosActivos}
                    onClick={() => setFiltros(FILTROS_INICIALES)}
                  />
                  <TarjetaResumen
                    icon={<MdEventBusy />}
                    accent="bg-gradient-to-br from-red-500 to-rose-400"
                    label="Vencidos"
                    valor={formatearEntero(resumen.vencidos)}
                    activa={filtros.estados.length === 1 && filtros.estados[0] === 'Vencido'}
                    onClick={() => filtroRapido('estados', 'Vencido')}
                  />
                  <TarjetaResumen
                    icon={<MdWarning />}
                    accent="bg-gradient-to-br from-amber-500 to-yellow-400"
                    label="Próximo a vencer"
                    valor={formatearEntero(resumen.proximos)}
                    activa={filtros.estados.length === 1 && filtros.estados[0] === 'Próximo a vencer'}
                    onClick={() => filtroRapido('estados', 'Próximo a vencer')}
                  />
                  <TarjetaResumen
                    icon={<MdEventAvailable />}
                    accent="bg-gradient-to-br from-green-500 to-emerald-400"
                    label="Vigentes"
                    valor={formatearEntero(resumen.vigentes)}
                    activa={filtros.estados.length === 1 && filtros.estados[0] === 'Vigente'}
                    onClick={() => filtroRapido('estados', 'Vigente')}
                  />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <TarjetaResumen
                    icon={<MdCheckCircle />}
                    accent="bg-gradient-to-br from-green-500 to-emerald-400"
                    label="Ok Rotación"
                    valor={formatearEntero(resumen.ok)}
                    activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Ok Rotación'}
                    onClick={() => filtroRapido('rangos', 'Ok Rotación')}
                  />
                  <TarjetaResumen
                    icon={<MdSwapHoriz />}
                    accent="bg-gradient-to-br from-yellow-500 to-amber-400"
                    label="Rotar"
                    valor={formatearEntero(resumen.rotar)}
                    activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar'}
                    onClick={() => filtroRapido('rangos', 'Rotar')}
                  />
                  <TarjetaResumen
                    icon={<MdSwapHoriz />}
                    accent="bg-gradient-to-br from-orange-500 to-amber-500"
                    label="Rotar con prioridad"
                    valor={formatearEntero(resumen.prioridad)}
                    activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar con Prioridad'}
                    onClick={() => filtroRapido('rangos', 'Rotar con Prioridad')}
                  />
                  <TarjetaResumen
                    icon={<MdWarning />}
                    accent="bg-gradient-to-br from-red-600 to-rose-500"
                    label="Rotar urgente"
                    valor={formatearEntero(resumen.urgente)}
                    activa={filtros.rangos.length === 1 && filtros.rangos[0] === 'Rotar urgente'}
                    onClick={() => filtroRapido('rangos', 'Rotar urgente')}
                  />
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
                    placeholder="Buscar por artículo, descripción, lote, bodega, zona o comercial…"
                    aria-label="Buscar en el inventario"
                    className="w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 pl-11 text-brand-ink placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
                  />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {CATEGORIAS.map((cat) => (
                    <FiltroBuscable
                      key={cat.clave}
                      clave={cat.clave}
                      etiqueta={cat.etiqueta}
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

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filtradas.slice(inicio, inicio + POR_PAGINA).map((f, i) => (
                  <InventarioCard key={f.id ?? `${f.numero_articulo}-${f.lote}-${inicio + i}`} f={f} onVer={setFilaDetalle} />
                ))}
              </div>

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
                      p === '…' ? (
                        <span key={`gap-${i}`} className="px-1 text-sm font-bold text-brand-ink/40">…</span>
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
    </div>
  )
}