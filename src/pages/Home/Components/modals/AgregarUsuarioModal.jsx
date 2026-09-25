import { useState } from 'react'
import { MdBadge, MdClose, MdPerson, MdPersonAdd } from 'react-icons/md'

export default function AgregarUsuarioModal({ open, onClose, onSelect }) {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleAgregar = () => {
    const c = cedula.trim()
    const n = nombre.trim().toUpperCase()
    if (!c || !n) {
      setError('Escribe la cédula y el nombre completo del usuario')
      return
    }
    onSelect?.({ cedula: c, cliente: n })
    setCedula('')
    setNombre('')
    setError('')
    onClose()
  }

  const handleClose = () => {
    setCedula('')
    setNombre('')
    setError('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Agregar usuario"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-10 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdPersonAdd className="text-brand-cyan text-xl" />
            </span>
            AGREGAR USUARIO
          </h3>
          <button
            aria-label="Cerrar"
            onClick={handleClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-brand-ink/60 -mt-1">
            Registra los datos del usuario para la solicitud administrativa.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-brand-deep mb-1.5">
              <MdBadge className="text-brand-cyan" />
              Cédula
            </label>
            <input
              type="text"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Número de cédula"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-brand-deep mb-1.5">
              <MdPerson className="text-brand-cyan" />
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="Nombre completo del usuario"
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink uppercase"
            />
          </div>

          <div className="pt-1 flex items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAgregar}
              className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all"
            >
              <MdPersonAdd className="text-lg" />
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}