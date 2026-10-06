import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdCloudUpload,
  MdErrorOutline,
  MdInventory,
  MdNavigateBefore,
  MdNavigateNext,
  MdSearch,
} from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { esPrivilegiado } from '../../auth/roles.js'
import { listarInventario } from '../../services/inventarioApi.js'
import SubirInventarioModal from './Components/SubirInventarioModal.jsx'
import {
  COLUMNAS_ORIGINALES,
  claseEstado,
  claseRango,
  diasVigencia,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  rangoInventario,
} from '../../utils/inventarioUtils.js'

const POR_PAGINA = 25

// Columnas calculadas en el navegador (nunca se guardan): son las 12 originales
// más estas tres, que salen en el extremo derecho de la tabla.
const COLUMNAS_CALCULADAS = [
  { key: 'estado', etiqueta: 'Estado' },
  { key: 'vigencia', etiqueta: 'Días de vigencia' },
  { key: 'rango', etiqueta: 'Días de inventario por rangos' },
]

const BUSCAR_EN = COLUMNAS_ORIGINALES.map((c) => c.key)

const BADGE = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 whitespace-nowrap'

export default function Inventario() {
  const { rol } = useAuth()
  const puedeSubir = esPrivilegiado(rol)

  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [subirAbierto, setSubirAbierto] = useState(false)

  const cargar = useCallback(async (esValido = () => true) => {
    setCargando(true)
    setError('')
    try {
      const datos = await listarInventario()
      if (esValido()) setFilas(datos)
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

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-ink">
      <Header />

      <main className="flex-1 py-6 sm:py-10">
        <div className="w-full px-4 sm:px-6">
          {/* Barra superior */}
          <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold text-brand-ink inline-flex items-center gap-3">
                <span className="grid place-items-center size-10 sm:size-12 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30">
                  <MdInventory className="text-2xl sm:text-3xl" />
                </span>
                INVENTARIO
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                Artículos, lotes y vencimientos por bodega
              </p>
            </div>

            {puedeSubir && (
              <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubirAbierto(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-cyan text-brand-ink px-5 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-bold shadow-cyanGlow hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
                >
                  <MdCloudUpload className="text-lg" />
                  Subir información
                </button>
              </div>
            )}
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
              {/* Tabla: 12 columnas originales pegadas + 3 calculadas en el navegador */}
              <div className="overflow-x-auto rounded-2xl border border-brand-ink/15 shadow-sm">
                <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[1750px]">
                  <thead>
                    <tr className="bg-brand-navy text-white text-left uppercase tracking-wider">
                      <th className="px-3 py-4 text-xs font-bold border-r border-white/15 w-12 text-center">N°</th>
                      {COLUMNAS_ORIGINALES.map((c) => (
                        <th key={c.key} className="px-3 py-4 text-xs font-bold border-r border-white/15 whitespace-nowrap">
                          {c.etiqueta}
                        </th>
                      ))}
                      {COLUMNAS_CALCULADAS.map((c, i) => (
                        <th
                          key={c.key}
                          className={`px-3 py-4 text-xs font-bold whitespace-nowrap ${i === 1 ? 'text-right' : ''} ${
                            i === COLUMNAS_CALCULADAS.length - 1 ? '' : 'border-r border-brand-cyan/40'
                          } bg-brand-deep`}
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
                      return (
                        <tr
                          key={f.id ?? `${f.numero_articulo}-${f.lote}-${inicio + i}`}
                          className="transition-colors hover:bg-brand-deep/10 odd:bg-white even:bg-brand-ink/[0.02]"
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
                          <td className="px-3 py-3 text-brand-ink/80 font-mono whitespace-nowrap border-b border-l border-brand-ink/10">
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

                          {/* --- Calculadas en el navegador --- */}
                          <td className="px-3 py-3 border-b border-l border-brand-cyan/30 bg-brand-cyan/5">
                            {estado ? (
                              <span className={`${BADGE} ${claseEstado(estado)}`}>{estado}</span>
                            ) : (
                              <span className="text-brand-ink/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-bold whitespace-nowrap border-b border-l border-brand-cyan/30 bg-brand-cyan/5">
                            {vigencia === null ? (
                              <span className="font-normal text-brand-ink/40">—</span>
                            ) : (
                              <span className={vigencia < 0 ? 'text-red-600' : 'text-brand-ink/80'}>
                                {formatearEntero(vigencia)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 border-b border-l border-brand-cyan/30 bg-brand-cyan/5">
                            {rango ? (
                              <span className={`${BADGE} ${claseRango(rango)}`}>{rango}</span>
                            ) : (
                              <span className="text-brand-ink/40">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
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
                <span className="text-sm font-bold text-brand-ink/70 px-2">
                  Página {paginaSegura} de {totalPaginas}
                </span>
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
    </div>
  )
}
