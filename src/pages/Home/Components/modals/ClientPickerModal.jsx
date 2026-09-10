import { useMemo, useState } from 'react'
import { MdApartment, MdBadge, MdBusiness, MdCheck, MdClose, MdInventory, MdKeyboardArrowDown, MdLocationPin, MdSearch } from 'react-icons/md'
import { CLIENTES } from '../clientesData.js'

const WITH_ICON = 'w-10 h-10 rounded-full bg-brand-mist border border-brand-ink/10 grid place-items-center text-brand-deep'

const ZONAS = ['TODOS', ...[...new Set(CLIENTES.map((c) => c.zona))].sort()]

export default function ClientPickerModal({ open, onClose, onSelect }) {
  const [zona, setZona] = useState('TODOS')
  const [zonaOpen, setZonaOpen] = useState(false)
  const [filter, setFilter] = useState({ nit: '', nombre: '', bodega: '' })

  const filtered = useMemo(() => {
    const q = {
      nit: filter.nit.trim().toLowerCase(),
      nombre: filter.nombre.trim().toLowerCase(),
      bodega: filter.bodega.trim().toLowerCase(),
    }
    return CLIENTES.filter((c) => {
      if (zona !== 'TODOS' && (c.zona || '') !== zona) return false
      if (q.nit && !(c.nit || '').toLowerCase().includes(q.nit)) return false
      if (q.nombre && !(c.cliente || '').toLowerCase().includes(q.nombre)) return false
      if (q.bodega && !(c.bodega || '').toLowerCase().includes(q.bodega)) return false
      return true
    })
  }, [zona, filter])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-5xl rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar cliente"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className={WITH_ICON}>
              <MdApartment className="text-xl" />
            </span>
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

        {/* Filtros */}
        <div className="px-4 sm:px-6 py-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <input
                type="text"
                value={filter.nit}
                onChange={(e) => setFilter((f) => ({ ...f, nit: e.target.value }))}
                placeholder=" "
                className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent"
              />
              <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                filter.nit ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
              } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}>
                <MdBadge className="text-sm text-brand-deep" />
                <span>NIT</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={filter.nombre}
                onChange={(e) => setFilter((f) => ({ ...f, nombre: e.target.value }))}
                placeholder=" "
                className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent"
              />
              <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                filter.nombre ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
              } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}>
                <MdBusiness className="text-sm text-brand-deep" />
                <span>Nombre</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={filter.bodega}
                onChange={(e) => setFilter((f) => ({ ...f, bodega: e.target.value }))}
                placeholder=" "
                className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent"
              />
              <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                filter.bodega ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
              } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}>
                <MdInventory className="text-sm text-brand-deep" />
                <span>Bodega</span>
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-brand-ink/50">
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'} · zona «{zona}»
          </p>
        </div>

        {/* Selector de zona */}
        <div className="px-4 sm:px-6 pb-3 border-b border-brand-ink/10 shrink-0">
          <div className="relative inline-block w-full sm:max-w-xs">
            <button
              type="button"
              onClick={() => setZonaOpen((v) => !v)}
              className="w-full inline-flex items-center justify-between gap-2 rounded-xl bg-white border border-brand-deep/20 px-3 py-2.5 pr-2 text-sm font-semibold text-brand-ink hover:border-brand-deep/60 shadow-sm transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <MdLocationPin className="text-brand-deep" />
                {zona}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-cyan/20 text-brand-deep">
                  {zona === 'TODOS' ? CLIENTES.length : CLIENTES.filter((c) => c.zona === zona).length}
                </span>
              </span>
              <span className="grid place-items-center size-6 rounded-full bg-brand-deep/10">
                <MdKeyboardArrowDown className={`text-brand-deep/70 text-lg transition-transform ${zonaOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {zonaOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setZonaOpen(false)} />
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-brand-deep/20 shadow-2xl max-h-64 overflow-y-auto [scrollbar-width:thin]">
                  <div className="sticky top-0 z-10 bg-brand-mist px-4 py-2 border-b border-brand-deep/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-deep">Zona</span>
                    <span className="text-[10px] font-semibold text-brand-deep/60">{ZONAS.length} zonas</span>
                  </div>
                  <div className="divide-y divide-brand-deep/10">
                    {ZONAS.map((z) => {
                      const count = z === 'TODOS' ? CLIENTES.length : CLIENTES.filter((c) => c.zona === z).length
                      const active = zona === z
                      return (
                        <button
                          key={z}
                          type="button"
                          onClick={() => {
                            setZona(z)
                            setZonaOpen(false)
                          }}
                          className={`w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors ${
                            active ? 'bg-brand-cyan/15 font-bold text-brand-deep' : 'text-brand-ink hover:bg-brand-deep/15'
                          }`}
                        >
                          <span className="capitalize">{z}</span>
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-cyan/20 text-brand-deep">{count}</span>
                            {active && (
                              <span className="grid place-items-center size-5 rounded-full bg-brand-deep text-white">
                                <MdCheck className="text-xs" />
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="overflow-y-auto p-4 sm:p-5">
          {filtered.length === 0 ? (
            <p className="text-center text-brand-ink/50 py-10">Sin resultados para los filtros aplicados</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-brand-ink/15 shadow-sm">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-brand-navy text-white uppercase tracking-wider text-xs">
                    <th className="px-4 py-3 font-bold border-r border-white/15">
                      <span className="inline-flex items-center gap-2">
                        <MdBadge className="text-brand-cyan" />
                        NIT
                      </span>
                    </th>
                    <th className="px-4 py-3 font-bold border-r border-white/15">
                      <span className="inline-flex items-center gap-2">
                        <MdBusiness className="text-brand-cyan" />
                        Nombre
                      </span>
                    </th>
                    <th className="px-4 py-3 font-bold border-r border-white/15">
                      <span className="inline-flex items-center gap-2">
                        <MdInventory className="text-brand-cyan" />
                        Bodega
                      </span>
                    </th>
                    <th className="px-4 py-3 font-bold">
                      <span className="inline-flex items-center gap-2">
                        <MdLocationPin className="text-brand-cyan" />
                        Zona
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.nit + c.cliente}
                      onClick={() => {
                        onSelect?.(c)
                        onClose()
                      }}
                      className={`group cursor-pointer transition-colors hover:bg-brand-deep/20 active:bg-brand-deep/30 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10'}`}
                    >
                      <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{c.nit}</td>
                      <td className="px-4 py-3 font-semibold text-brand-ink border-b border-l border-brand-ink/10">{c.cliente}</td>
                      <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{c.bodega}</td>
                      <td className="px-4 py-3 capitalize text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                        <span className="inline-flex items-center gap-1.5">
                          <MdLocationPin className="text-brand-deep/60" />
                          {c.zona}
                        </span>
                      </td>
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