import { useEffect, useMemo, useState } from 'react'
import {
  MdClose, MdInventory2, MdSearch, MdErrorOutline, MdWarehouse, MdAddTask, MdReportProblem,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import LoaderInventario from '../../../Inventario/Components/LoaderInventario.jsx'
import { listarInventario } from '../../../../services/inventarioApi.js'
import { formatearFecha } from '../../../../utils/inventarioUtils.js'

const WITH_ICON =
  'w-10 h-10 rounded-full bg-brand-mist border border-brand-ink/10 grid place-items-center text-brand-deep'

// La cantidad del inventario es texto libre (puede venir «1.234» o «12,5»), así
// que se interpreta con el mismo criterio del mapa de zonas. Devuelve null si no
// se puede leer: en ese caso no se puede saber si la cantidad pedida se excede.
function disponibleDe(fila) {
  const n = Number(String(fila?.cantidad ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Selector de artículos del inventario filtrados por la bodega de recogida.
// `bodega` es el número de bodega del cliente elegido en «¿Dónde vamos a
// recoger?». Solo se muestran los artículos cuya columna `bodega` coincide.
// Cada fila tiene un campo de cantidad: si es mayor que 0 el artículo queda
// seleccionado. Si la cantidad supera lo que hay en bodega la fila se marca en
// rojo y no se puede confirmar. Al confirmar se devuelve el texto con una línea
// por artículo («cantidad · descripción · Lote lote») para reemplazar «Qué
// recogemos».
export default function ArticulosBodegaModal({ open, onClose, bodega, onConfirm }) {
  const [filas, setFilas] = useState([])
  const [cargado, setCargado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  // Mapa id → cantidad a recoger (solo las cantidades > 0 están seleccionadas).
  const [seleccion, setSeleccion] = useState({})

  const bodegaNorm = String(bodega || '').trim().toLowerCase()

  const cargar = () => {
    setCargando(true)
    setError('')
    listarInventario()
      .then(({ filas: f }) => {
        setFilas(Array.isArray(f) ? f : [])
        setCargado(true)
      })
      .catch((err) => {
        console.error('[Artículos] error cargando inventario:', err)
        setError(err?.message || 'Error al cargar el inventario')
      })
      .finally(() => setCargando(false))
  }

  // El inventario se pide una sola vez mientras el modal esté montado; al abrir
  // se limpia la selección previa y el buscador.
  useEffect(() => {
    if (!open) return
    setSeleccion({})
    setFiltro('')
    if (!cargado && !cargando) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const enBodega = useMemo(
    () => filas.filter((f) => String(f.bodega || '').trim().toLowerCase() === bodegaNorm),
    [filas, bodegaNorm]
  )

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return enBodega
    return enBodega.filter((f) => {
      return (
        (f.descripcion || '').toLowerCase().includes(q) ||
        (f.numero_articulo || '').toLowerCase().includes(q) ||
        (f.lote || '').toLowerCase().includes(q)
      )
    })
  }, [enBodega, filtro])

  const porId = useMemo(
    () => Object.fromEntries(enBodega.map((f) => [String(f.id), f])),
    [enBodega]
  )

  const totalSeleccionados = Object.keys(seleccion).length

  // Ids cuya cantidad pedida supera lo que hay en bodega: no se puede recoger lo
  // que no existe, así que se marcan en rojo y bloquean el botón «Agregar».
  const excedidos = useMemo(() => {
    const s = new Set()
    for (const [id, cant] of Object.entries(seleccion)) {
      const disp = disponibleDe(porId[id])
      if (disp !== null && Number(cant) > disp) s.add(id)
    }
    return s
  }, [seleccion, porId])

  const setCantidad = (id, valor) => {
    const n = Math.max(0, Math.floor(Number(valor) || 0))
    setSeleccion((prev) => {
      const next = { ...prev }
      if (n > 0) next[id] = n
      else delete next[id]
      return next
    })
  }

  const confirmar = () => {
    if (excedidos.size > 0) return
    const lineas = Object.entries(seleccion)
      .filter(([, cant]) => Number(cant) > 0)
      .map(([id, cant]) => {
        const fila = porId[id]
        if (!fila) return null
        const articulo = (fila.numero_articulo || '').trim()
        const desc = (fila.descripcion || '').trim() || articulo || 'Artículo'
        const lote = (fila.lote || '').trim()
        const base = articulo ? `${cant} · ${articulo} · ${desc}` : `${cant} · ${desc}`
        return lote ? `${base} · Lote ${lote}` : base
      })
      .filter(Boolean)
    onConfirm?.(lineas.join('\n'))
    onClose?.()
  }

  if (!open) return null

  return (
    <Modal onClose={onClose}>
      <div
        className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Artículos de la bodega ${bodega}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className={WITH_ICON}>
              <MdInventory2 className="text-xl" />
            </span>
            <span className="truncate">ARTÍCULOS DE LA BODEGA {bodega || '—'}</span>
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-4 sm:px-6 py-3 border-b border-brand-ink/10 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder=" "
              autoComplete="off"
              className="peer w-full px-3 py-2.5 pr-10 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent"
            />
            <label
              className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                filtro ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
              } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}
            >
              <MdSearch className="text-sm text-brand-deep" />
              <span>Buscar por descripción, artículo o lote</span>
            </label>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-deep/40">
              <MdSearch className="text-lg" />
            </span>
          </div>
          <p className="mt-2 text-xs text-brand-ink/50 inline-flex items-center gap-1.5">
            <MdWarehouse className="text-sm text-brand-deep/60" />
            {enBodega.length.toLocaleString('es-CO')} {enBodega.length === 1 ? 'artículo' : 'artículos'} en la bodega
            {filtro.trim() && ` · ${filtradas.length.toLocaleString('es-CO')} coincidencias`}
          </p>
        </div>

        {/* Tabla */}
        <div className="overflow-auto p-4 sm:p-5 min-h-0 flex-1">
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <LoaderInventario />
              <p className="text-sm font-semibold text-brand-deep/60">Cargando inventario…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <p className="text-sm font-semibold text-red-600 inline-flex items-center gap-1.5">
                <MdErrorOutline className="text-lg" /> {error}
              </p>
              <button
                type="button"
                onClick={cargar}
                className="mt-2 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition"
              >
                Reintentar
              </button>
            </div>
          ) : enBodega.length === 0 ? (
            <p className="text-center text-brand-ink/50 py-10">
              No hay artículos registrados en la bodega {bodega || '—'}.
            </p>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-brand-ink/50 py-10">
              Sin resultados para «{filtro.trim()}» en esta bodega.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-brand-ink/15 shadow-sm">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-brand-navy text-white uppercase tracking-wider text-[11px]">
                    <th className="px-3 py-3 font-bold border-r border-white/15 whitespace-nowrap">Cant.</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15 whitespace-nowrap">Artículo</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15">Descripción</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15 whitespace-nowrap">Lote</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15 whitespace-nowrap">Disp.</th>
                    <th className="px-3 py-3 font-bold whitespace-nowrap">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((f, i) => {
                    const id = String(f.id)
                    const cant = seleccion[id] || ''
                    const activa = Boolean(seleccion[id])
                    const disp = disponibleDe(f)
                    const excede = excedidos.has(id)
                    return (
                      <tr
                        key={id}
                        className={`transition-colors ${
                          excede ? 'bg-red-50' : activa ? 'bg-brand-cyan/15' : i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'
                        }`}
                      >
                        <td className="px-2 py-2 border-b border-l border-brand-ink/10 align-middle">
                          <input
                            type="number"
                            min="0"
                            max={disp ?? undefined}
                            inputMode="numeric"
                            value={cant}
                            onChange={(e) => setCantidad(id, e.target.value)}
                            aria-label={`Cantidad a recoger de ${f.descripcion || f.numero_articulo || 'artículo'}`}
                            aria-invalid={excede}
                            placeholder="0"
                            className={`w-16 px-2 py-1.5 rounded-lg border bg-white text-center text-sm font-bold focus:outline-none ${
                              excede
                                ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                : 'border-brand-deep/20 text-brand-ink focus:border-brand-deep/60 focus:ring-2 focus:ring-brand-deep/10'
                            }`}
                          />
                          {excede && (
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-600 inline-flex items-center gap-0.5 leading-tight">
                              <MdReportProblem className="text-xs shrink-0" />
                              Se excede
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">
                          {f.numero_articulo || '—'}
                        </td>
                        <td className="px-3 py-2 text-brand-ink border-b border-l border-brand-ink/10">
                          {f.descripcion || '—'}
                        </td>
                        <td className="px-3 py-2 text-brand-ink/70 whitespace-nowrap border-b border-l border-brand-ink/10">
                          {f.lote || '—'}
                        </td>
                        <td
                          className={`px-3 py-2 whitespace-nowrap border-b border-l border-brand-ink/10 ${
                            excede ? 'font-extrabold text-red-600' : 'text-brand-ink/70'
                          }`}
                        >
                          {f.cantidad || '—'}
                        </td>
                        <td className="px-3 py-2 text-brand-ink/70 whitespace-nowrap border-b border-l border-brand-ink/10">
                          {formatearFecha(f.fecha_vencimiento)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 border-t border-brand-ink/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-white">
          {excedidos.size > 0 ? (
            <p className="text-xs font-bold text-red-600 inline-flex items-center gap-1.5">
              <MdReportProblem className="text-base shrink-0" />
              {excedidos.size === 1
                ? 'La cantidad supera el disponible en bodega.'
                : `${excedidos.size} cantidades superan el disponible en bodega.`}
            </p>
          ) : (
            <p className="text-xs text-brand-ink/60">
              {totalSeleccionados > 0
                ? `${totalSeleccionados} ${totalSeleccionados === 1 ? 'artículo seleccionado' : 'artículos seleccionados'}`
                : 'Escribe la cantidad para seleccionar un artículo.'}
              <span className="hidden sm:inline"> Se reemplazará el texto de «Qué recogemos».</span>
            </p>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={totalSeleccionados === 0 || excedidos.size > 0}
              title={
                excedidos.size > 0
                  ? 'Corrige las cantidades marcadas en rojo: no se puede recoger más de lo que hay en bodega.'
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <MdAddTask className="text-lg" />
              Agregar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
