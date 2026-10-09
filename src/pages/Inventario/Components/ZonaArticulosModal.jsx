import { useMemo, useState } from 'react'
import { MdClose, MdOutlinePlace, MdSearch } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import DetalleFilaModal from './DetalleFilaModal.jsx'
import TablaArticulos, { ListaArticulosMovil } from './TablaArticulos.jsx'
import { colorZona } from '../../../utils/zonasColombia.js'

// Modal derivado del mapa: todos los artículos de una zona, con un buscador
// dinámico que filtra al instante. Usa exactamente la misma tabla y las mismas
// tarjetas que el listado principal del inventario, para que el diseño (colores,
// filas, badges) sea idéntico. Cada fila abre el detalle del artículo.
export default function ZonaArticulosModal({ zona, articulos, onClose }) {
  const [texto, setTexto] = useState('')
  const [filaDetalle, setFilaDetalle] = useState(null)

  const tono = useMemo(() => colorZona(zona), [zona])

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    if (!q) return articulos
    return articulos.filter((f) => {
      const monton = [
        f.numero_articulo, f.descripcion, f.lote, f.proveedor,
        f.grupo_articulos, f.bodega, f.nombre_bodega, f.comercial,
      ]
        .map((v) => String(v ?? ''))
        .join(' ')
        .toLowerCase()
      return monton.includes(q)
    })
  }, [articulos, texto])

  const total = articulos.length

  return (
    <>
      <Modal onClose={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-zona-articulos"
          className="relative bg-white text-brand-ink w-full max-w-[min(95vw,84rem)] rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Encabezado */}
          <div className="relative overflow-hidden px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
            <MdOutlinePlace className="pointer-events-none absolute -right-3 -bottom-7 text-[6rem] text-white/10" />
            <h3
              id="titulo-zona-articulos"
              className="relative text-white font-extrabold text-base sm:text-xl inline-flex items-center gap-2.5 min-w-0"
            >
              <span className="grid place-items-center size-9 shrink-0 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
                <MdOutlinePlace className="text-brand-cyan text-xl" />
              </span>
              <span className="truncate">{zona}</span>
              <span className="size-2.5 rounded-full shrink-0 ring-2 ring-white/40" style={{ backgroundColor: tono }} />
              <span className="rounded-full bg-white/10 ring-1 ring-white/20 text-white text-xs sm:text-sm font-extrabold px-2.5 py-1 tabular-nums whitespace-nowrap">
                {total.toLocaleString('es-CO')} artículo{total === 1 ? '' : 's'}
              </span>
            </h3>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="relative grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
            >
              <MdClose className="text-lg" />
            </button>
          </div>

          {/* Buscador dinámico */}
          <div className="shrink-0 border-b border-brand-ink/10 bg-white px-4 sm:px-8 py-3">
            <label className="relative block max-w-xl">
              <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-brand-ink/40" />
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por artículo, descripción, lote, proveedor, bodega…"
                className="w-full rounded-xl bg-brand-ink/[0.04] ring-1 ring-brand-ink/10 focus:ring-brand-cyan/60 focus:bg-white outline-none pl-10 pr-4 py-2.5 text-sm font-semibold text-brand-ink placeholder:text-brand-ink/40 transition"
              />
            </label>
            <p className="mt-2 text-xs font-bold text-brand-ink/50">
              {filtradas.length.toLocaleString('es-CO')} de {total.toLocaleString('es-CO')} artículo
              {total === 1 ? '' : 's'} en {zona}
            </p>
          </div>

          {filtradas.length === 0 ? (
            <div className="flex-1 grid place-items-center px-6 text-center">
              <div className="space-y-1">
                <MdSearch className="mx-auto text-4xl text-brand-ink/25" />
                <p className="text-sm font-extrabold text-brand-ink/70">No hay artículos que coincidan</p>
                <p className="text-xs font-semibold text-brand-ink/45">Ajusta la búsqueda o cambia los filtros del inventario</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto bg-brand-ink/[0.02] p-4 sm:p-6">
              {/* Tarjetas (móvil) y tabla (pantallas medianas y grandes):
                  mismas piezas que el listado principal del inventario. */}
              <div className="md:hidden">
                <ListaArticulosMovil filas={filtradas} onVer={setFilaDetalle} />
              </div>
              <div className="hidden md:block">
                <TablaArticulos filas={filtradas} onVer={setFilaDetalle} />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <DetalleFilaModal fila={filaDetalle} onClose={() => setFilaDetalle(null)} />
    </>
  )
}
