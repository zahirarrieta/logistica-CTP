import { useEffect, useMemo, useRef, useState } from 'react'
import { MdClose, MdSearch, MdSearchOff } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'

const normalizar = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const coincide = (opcion, q) =>
  normalizar(`${opcion.valor} ${opcion.label || ''} ${opcion.sub || ''}`).includes(q)

// Fila de una opción (se reutiliza en el desplegable y en el modal).
function FilaOpcion({ opcion, activo, onClick, onMouseDown }) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-left transition-colors outline-none ${
        activo ? 'bg-brand-cyan/10' : 'hover:bg-brand-deep/10 focus:bg-brand-deep/10'
      }`}
    >
      <span className="block text-sm font-bold text-brand-ink truncate">{opcion.label || opcion.valor}</span>
      {opcion.sub ? (
        <span className="block text-xs text-brand-deep/70 truncate">{opcion.sub}</span>
      ) : (
        <span className="block text-xs text-brand-deep/50 truncate">{opcion.valor}</span>
      )}
    </button>
  )
}

// Filtro que se escribe con lista de sugerencias al teclear (como el cliente en
// «Nueva solicitud») y botón de lupa para abrir el listado completo.
export default function FiltroBuscable({ etiqueta, icono, value, onChange, opciones, placeholder }) {
  const [abierto, setAbierto] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef(null)

  const sugerencias = useMemo(() => {
    const q = normalizar(value).trim()
    const base = q ? opciones.filter((o) => coincide(o, q)) : opciones
    return base.slice(0, 8)
  }, [opciones, value])

  const enModal = useMemo(() => {
    const q = normalizar(busqueda).trim()
    return q ? opciones.filter((o) => coincide(o, q)) : opciones
  }, [opciones, busqueda])

  useEffect(() => {
    const alClicFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [])

  const elegir = (opcion) => {
    onChange(opcion.valor)
    setAbierto(false)
  }

  const seleccionar = (opcion) => {
    onChange(opcion.valor)
    setAbierto(false)
    setModalAbierto(false)
    setBusqueda('')
  }

  return (
    <div className="relative min-w-0" ref={contenedorRef}>
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-brand-ink/45">{etiqueta}</span>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-cyan text-base">{icono}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-brand-ink/15 bg-white py-2.5 pl-9 pr-16 text-sm text-brand-ink placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              setAbierto(true)
            }}
            title="Limpiar"
            aria-label={`Limpiar ${etiqueta}`}
            className="absolute right-9 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-brand-ink/40 transition hover:bg-brand-ink/10"
          >
            <MdClose className="text-base" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          title={`Ver todos: ${etiqueta}`}
          aria-label={`Ver todos los valores de ${etiqueta}`}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-brand-cyan/15 text-brand-deep transition-colors hover:bg-brand-cyan hover:text-brand-ink"
        >
          <MdSearch className="text-lg" />
        </button>
      </div>

      {/* Sugerencias al escribir */}
      {abierto && sugerencias.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-brand-deep/20 bg-white shadow-2xl animate-scaleIn">
          <div className="max-h-56 divide-y divide-brand-deep/10 overflow-y-auto [scrollbar-width:thin]">
            {sugerencias.map((o) => (
              <FilaOpcion
                key={`${etiqueta}-${o.valor}`}
                opcion={o}
                activo={o.valor === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
              />
            ))}
          </div>
        </div>
      )}
      {abierto && value.trim() !== '' && sugerencias.length === 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-xl border border-brand-deep/20 bg-white px-3 py-2.5 text-xs text-brand-ink/70 shadow-2xl">
          Sin coincidencias. Usa la lupa para ver el listado completo.
        </div>
      )}

      {/* Modal con el listado completo */}
      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-brand-ink shadow-2xl animate-scaleIn"
          >
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-navy to-brand-deep px-4 py-3 sm:px-6">
              <h3 className="inline-flex items-center gap-2 text-base font-extrabold text-white">
                <span className="grid size-8 place-items-center rounded-xl bg-brand-cyan/20 text-brand-cyan ring-1 ring-brand-cyan/40">{icono}</span>
                {etiqueta}
              </h3>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setModalAbierto(false)}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <MdClose className="text-lg" />
              </button>
            </div>

            <div className="border-b border-brand-ink/10 p-3 sm:p-4">
              <div className="relative">
                <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/35" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={`Buscar en ${etiqueta.toLowerCase()}…`}
                  autoComplete="off"
                  autoFocus
                  className="w-full rounded-xl border border-brand-ink/15 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25"
                />
              </div>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-brand-ink/40">
                {enModal.length} {enModal.length === 1 ? 'resultado' : 'resultados'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
              {enModal.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-brand-ink/50">
                  <MdSearchOff className="text-3xl" />
                  <p className="text-sm font-semibold">Sin resultados</p>
                </div>
              ) : (
                <div className="divide-y divide-brand-deep/10">
                  {enModal.map((o) => (
                    <FilaOpcion key={`modal-${etiqueta}-${o.valor}`} opcion={o} activo={o.valor === value} onClick={() => seleccionar(o)} />
                  ))}
                </div>
              )}
            </div>

            {value && (
              <div className="flex justify-between gap-2 border-t border-brand-ink/10 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => seleccionar({ valor: '' })}
                  className="rounded-xl px-4 py-2 text-xs font-extrabold text-brand-ink/60 transition hover:bg-brand-ink/5"
                >
                  Quitar filtro
                </button>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="rounded-xl bg-brand-navy px-4 py-2 text-xs font-extrabold text-white transition hover:bg-brand-deep"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}