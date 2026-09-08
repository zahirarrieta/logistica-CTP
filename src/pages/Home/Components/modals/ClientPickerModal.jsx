import { useMemo, useState } from 'react'
import { MdClose, MdSearch, MdWarehouse } from 'react-icons/md'
import { CLIENTES } from '../clientesData.js'

export default function ClientPickerModal({ open, onClose, onSelect }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CLIENTES
    return CLIENTES.filter((c) =>
      [c.cliente, c.bodega, c.nit].some((v) => (v || '').toLowerCase().includes(q))
    )
  }, [search])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-2xl rounded-2xl shadow-2xl animate-scaleIn max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar cliente"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <MdWarehouse className="text-brand-cyan" />
            SELECCIONAR CLIENTE
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="p-4 sm:p-5 border-b border-brand-ink/10 shrink-0">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40 text-xl" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, bodega o NIT"
              className="w-full ps-10 pe-3 py-2 rounded-md bg-white border-2 border-brand-ink/10 focus:outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/30 text-brand-ink placeholder-brand-ink/40"
            />
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="overflow-y-auto p-4 sm:p-5">
          {filtered.length === 0 ? (
            <p className="text-center text-brand-ink/50 py-10">Sin resultados para «{search}»</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-brand-ink/15 shadow-sm">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-brand-navy text-white uppercase tracking-wider text-xs">
                    <th className="px-3 py-3 font-bold border-r border-white/15">Bodega</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15">NIT</th>
                    <th className="px-3 py-3 font-bold border-r border-white/15">Cliente</th>
                    <th className="px-3 py-3 font-bold">Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.nit}
                      onClick={() => {
                        onSelect?.(c)
                        onClose()
                      }}
                      className={`group cursor-pointer transition-colors hover:bg-brand-deep/20 active:bg-brand-deep/30 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10'}`}
                    >
                      <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{c.bodega}</td>
                      <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{c.nit}</td>
                      <td className="px-3 py-3 font-semibold text-brand-ink border-b border-l border-brand-ink/10">{c.cliente}</td>
                      <td className="px-3 py-3 capitalize text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{c.zona}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}