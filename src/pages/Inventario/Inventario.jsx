import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdCloudUpload,
  MdErrorOutline,
  MdInventory,
  MdNavigateBefore,
  MdNavigateNext,
  MdSchedule,
  MdSearch,
} from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { esPrivilegiado, esSuperAdmin, esAdministrador } from '../../auth/roles.js'
import { listarInventario } from '../../services/inventarioApi.js'
import SubirInventarioModal from './Components/SubirInventarioModal.jsx'
import DetalleFilaModal from './Components/DetalleFilaModal.jsx'
import { getBadgeColor, getDotColor, getEstadoBg } from '../../utils/estadoColors.js'
import {
  COLUMNAS_ORIGINALES,
  badgeRango,
  diasVigencia,
  dotRango,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  formatearFechaHora,
  rangoInventario,
} from '../../utils/inventarioUtils.js'

const POR_PAGINA = 25

// Las 12 columnas originales del reporte (pegadas) más las 3 calculadas en el
// navegador, que salen al final con el mismo estilo que el resto.
const COLUMNAS_CALCULADAS = [
  { key: 'estado', etiqueta: 'Estado' },
  { key: 'vigencia', etiqueta: 'Días de vigencia' },
  { key: 'rango', etiqueta: 'Días de inventario por rangos' },
]

const BUSCAR_EN = COLUMNAS_ORIGINALES.map((c) => c.key)

// Mismo badge que EstadoBadge de SolicitudesTable: pastel + punto de color.
function EstadoBadge({ estado }) {
  if (!estado) return <span className="text-brand-ink/40">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${getBadgeColor(estado)}`}>
      <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
      {estado}
    </span>
  )
}

function RangoBadge({ rango }) {
  if (!rango) return <span className="text-brand-ink/40">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${badgeRango(rango)}`}>
      <span className={`size-2 rounded-full ${dotRango(rango)}`} />
      {rango}
    </span>
  )
}

// Páginas visibles alrededor de la actual (con «…» cuando se salta): mismo
// estilo de botones circulares que SolicitudesTable, pero acotado para que un
// inventario de miles de filas no pinte cientos de círculos.
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
  const [busqueda, setBusqueda] = useState('')
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

  useEffect(() => setPagina(1), [busqueda])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) => BUSCAR_EN.some((k) => String(f[k] ?? '').toLowerCase().includes(q)))
  }, [filas, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const inicio = (paginaSegura - 1) * POR_PAGINA
  const filasPagina = visibles.slice(inicio, inicio + POR_PAGINA)

  // Mismo fondo de fila que las demás tablas: pastel por estado (vista con
  // colores) y, sin estado conocido, alternado como en las vistas simples.
  const estiloFila = (estado, i) =>
    estado ? getEstadoBg(estado) : (i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10')

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
                    src={
                      esSuperAdmin(rol)
                        ? '/ITitulos/Superadmin.png'
                        : esAdministrador(rol)
                          ? '/ITitulos/AdminI.png'
                          : '/ITitulos/IInventario.png'
                    }
                    alt={
                      esSuperAdmin(rol)
                        ? 'Super administrador'
                        : esAdministrador(rol)
                          ? 'Administrador'
                          : 'Inventario de artículos'
                    }
                    className="size-full object-contain"
                  />
                </span>
                INVENTARIO DE ARTÍCULOS
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                Artículos, lotes y vencimientos por bodega
              </p>
            </div>

            {/* Esquina superior derecha: subir + última actualización */}
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

          {/* Buscador */}
          {!cargando && !error && filas.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-xl">
                <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/35 text-lg" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por artículo, descripción, lote, bodega o zona…"
                  aria-label="Buscar en el inventario"
                  className="w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 pl-11 text-brand-ink placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
                />
              </div>
              <p className="text-xs font-bold text-brand-ink/50 sm:ml-auto">
                {visibles.length === filas.length
                  ? `${filas.length} artículo${filas.length === 1 ? '' : 's'}`
                  : `${visibles.length} de ${filas.length} artículos`}
              </p>
            </div>
          )}

          {/* Contenido */}
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
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <MdInventory className="text-4xl text-brand-ink/20" />
              <p className="font-extrabold text-brand-ink">
                {filas.length === 0 ? 'Aún no hay inventario' : 'Ningún artículo coincide con la búsqueda'}
              </p>
              <p className="text-sm text-brand-ink/60 max-w-md">
                {filas.length === 0
                  ? puedeSubir
                    ? 'Sube el reporte de Excel con el botón «Subir información».'
                    : 'El administrador aún no ha publicado el reporte de inventario.'
                  : `No hay resultados para «${busqueda.trim()}».`}
              </p>
            </div>
          ) : (
            <>
              {/* Tabla: mismo estilo que SolicitudesTable (encabezado navy,
                  tipografía text-sm, filas en pastel por estado) */}
              <div className="overflow-x-auto rounded-2xl border border-brand-ink/15 shadow-sm">
                <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[1750px]">
                  <thead>
                    <tr className="bg-brand-navy text-white text-left uppercase tracking-wider">
                      <th className="px-3 py-4 text-xs font-bold border-r border-white/15 w-14 text-center">N°</th>
                      {COLUMNAS_ORIGINALES.map((c) => (
                        <th key={c.key} className="px-3 py-4 text-xs font-bold border-r border-white/15 whitespace-nowrap">
                          {c.etiqueta}
                        </th>
                      ))}
                      {COLUMNAS_CALCULADAS.map((c, i) => (
                        <th
                          key={c.key}
                          className={`px-3 py-4 text-xs font-bold whitespace-nowrap ${
                            i < COLUMNAS_CALCULADAS.length - 1 ? 'border-r border-white/15' : ''
                          } ${i === 1 ? 'text-right' : ''}`}
                        >
                          {c.etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasPagina.map((f, i) => {
                      const estado = estadoVencimiento(f.fecha_vencimiento)
                      const vigencia = diasVigencia(f.fecha_vencimiento)
                      const rango = rangoInventario(f.dias_inventario)
                      const fondo = estiloFila(estado, i)
                      return (
                        <tr
                          key={f.id ?? `${f.numero_articulo}-${f.lote}-${inicio + i}`}
                          onClick={() => setFilaDetalle(f)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setFilaDetalle(f)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          title="Clic para ver el detalle del artículo"
                          aria-label={`Ver detalle de ${f.numero_articulo || f.descripcion || 'este artículo'}`}
                          className={`transition-colors hover:bg-brand-deep/20 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-cyan ${fondo}`}
                        >
                          <td className="px-3 py-3 text-center border-b border-l border-brand-ink/10">
                            <span className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-extrabold ${i % 2 === 0 ? 'bg-brand-navy text-white' : 'bg-brand-deep text-white'}`}>
                              {inicio + i + 1}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.numero_articulo || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 min-w-[240px] border-b border-l border-brand-ink/10">
                            <span className="block truncate whitespace-nowrap" title={f.descripcion || ''}>
                              {f.descripcion || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.lote || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {formatearFecha(f.fecha_vencimiento)}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 text-right whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.cantidad || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 text-right whitespace-nowrap border-b border-l border-brand-ink/10">
                            {formatearEntero(f.dias_inventario)}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.bodega || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.nombre_bodega || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.zona || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.grupo_articulos || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.tipo_bodega || '—'}
                          </td>
                          <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                            {f.comercial || '—'}
                          </td>

                          {/* Calculadas: mismo estilo de celda que el resto */}
                          <td className="px-3 py-3 border-b border-l border-brand-ink/10">
                            <EstadoBadge estado={estado} />
                          </td>
                          <td className="px-3 py-3 text-right font-bold whitespace-nowrap border-b border-l border-brand-ink/10">
                            {vigencia === null ? (
                              <span className="font-normal text-brand-ink/40">—</span>
                            ) : (
                              <span className={vigencia < 0 ? 'text-red-600' : 'text-brand-ink/80'}>
                                {formatearEntero(vigencia)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 border-b border-l border-brand-ink/10">
                            <RangoBadge rango={rango} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación: mismos botones que SolicitudesTable */}
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
                      <span key={`gap-${i}`} className="px-1 text-sm font-bold text-brand-ink/40">
                        …
                      </span>
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
            </>
          )}
        </div>
      </main>

      <Footer />

      <SubirInventarioModal
        open={subirAbierto}
        onClose={() => setSubirAbierto(false)}
        onSubido={() => cargar()}
      />

      <DetalleFilaModal fila={filaDetalle} onClose={() => setFilaDetalle(null)} />
    </div>
  )
}
