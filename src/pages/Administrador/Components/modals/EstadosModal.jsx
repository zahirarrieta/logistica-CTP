import { useState, useEffect } from 'react'
import { MdClose, MdCheckCircle, MdSwapHoriz, MdTag, MdCheck, MdNotes, MdNumbers, MdCloudUpload } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { ESTADOS, getBadgeColor, getDotColor } from '../../../Home/Components/estadoColors.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export default function EstadosModal({ solicitud, open, onClose, onUpdate, onAsignarConductorClick, permitidos }) {
  const [estado, setEstado] = useState('Abierto')
  const [nota, setNota] = useState('')
  const [numeroRef, setNumeroRef] = useState('')
  const [adjuntoTramite, setAdjuntoTramite] = useState([])

  useEffect(() => {
    if (solicitud) {
      setEstado(solicitud.estado || 'Abierto')
      setNota('')
      setNumeroRef('')
      setAdjuntoTramite([])
    }
  }, [solicitud])

  if (!open || !solicitud) return null

  const listaEstados = permitidos || ESTADOS

  const isCurrent = (e) => e === estado
  const esSeleccionado = estado !== (solicitud.estado || 'Abierto')

  const handleSelect = (e) => {
    if (isCurrent(e)) return
    setEstado(e)
    setNota('')
    setNumeroRef('')
    setAdjuntoTramite([])
  }

  const handleSave = () => {
    const updates = { estado, notaEstado: nota.trim() }
    if (estado === 'En Trámite') {
      updates.numeroReferencia = numeroRef.trim()
      updates.adjuntosTramite = adjuntoTramite.map((f) => f.name)
    }
    onUpdate(solicitud.id, updates)
    setNota('')
    setNumeroRef('')
    setAdjuntoTramite([])
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar estado de solicitud"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdSwapHoriz className="text-brand-cyan text-lg" />
            </span>
            CAMBIAR ESTADO
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
              <MdTag className="text-xs sm:text-sm" />
              {solicitud.id}
            </span>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Lista de estados */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <label className="block text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-3 inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-brand-ink/10 text-brand-ink/70">
              <span className="size-2 rounded-full bg-brand-ink/40" />
              {solicitud.estado || 'Abierto'}
            </span>
            <span className="uppercase text-brand-deep">cambia a</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(estado)}`}>
              <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
              {estado}
            </span>
            {isCurrent(solicitud.estado || 'Abierto') && (
              <span className="normal-case text-brand-ink/50 font-semibold">(sin cambios)</span>
            )}
          </label>
          <div className="space-y-1.5">
            {listaEstados.map((e) => {
              const current = isCurrent(e)
              const sel = current && esSeleccionado
              return (
                <div key={e}>
                  <button
                    type="button"
                    onClick={() => handleSelect(e)}
                    disabled={current}
                    title={current ? 'La solicitud ya está en este estado' : `Cambiar a ${e}`}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-deep transition-all ${
                      current
                        ? 'bg-brand-cyan/15 ring-2 ring-brand-cyan/50 cursor-not-allowed'
                        : 'bg-brand-mist/40 hover:bg-brand-cyan/15 hover:ring-1 hover:ring-brand-cyan/40'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <span className={`size-2.5 rounded-full shrink-0 ${getDotColor(e)}`} />
                      <span className="truncate">{e}</span>
                    </span>
                    {current ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-deep">
                        <MdCheck className="text-brand-cyan" /> Actual
                      </span>
                    ) : (
                      <MdSwapHoriz className="text-brand-cyan/60 shrink-0" />
                    )}
                  </button>
                  {sel && (
                    <div className="mt-1.5 rounded-xl bg-brand-ink/5 border border-brand-cyan/30 p-3 animate-fadeIn">
                      <label className="flex items-center gap-2 text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2">
                        <MdNotes className="text-base text-brand-cyan" />
                        Observaciones del cambio
                      </label>
                      <textarea
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        rows={3}
                        placeholder="Escribe las observaciones del cambio de estado…"
                        className="w-full rounded-xl border border-brand-deep/20 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all resize-none"
                      />
                      {e === 'En Trámite' && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="flex items-center gap-2 text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2">
                              <MdNumbers className="text-base text-brand-cyan" />
                              Número de factura o remisión
                            </label>
                            <input
                              type="text"
                              value={numeroRef}
                              onChange={(ev) => setNumeroRef(ev.target.value)}
                              placeholder="Ej. 1234-5678"
                              className="w-full rounded-xl border border-brand-deep/20 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2">
                              <MdCloudUpload className="text-base text-brand-cyan" />
                              Adjuntar factura o remisión
                            </label>
                            <label className="flex flex-col items-center justify-center gap-1.5 w-full px-3 py-4 border-2 border-dashed border-brand-ink/25 rounded-xl bg-white text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
                              <MdCloudUpload className="text-2xl text-brand-cyan" />
                              <span className="text-xs font-medium">
                                {adjuntoTramite.length > 0
                                  ? `${adjuntoTramite.length} archivo(s) seleccionado(s)`
                                  : 'Haz clic para adjuntar el documento'}
                              </span>
                              <input
                                type="file"
                                multiple
                                onChange={(ev) => setAdjuntoTramite(Array.from(ev.target.files || []))}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      {ESTADOS_TRANSITO.includes(e) && onAsignarConductorClick && (
                        <button
                          type="button"
                          onClick={() => onAsignarConductorClick(solicitud)}
                          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-all"
                        >
                          <RiSteering2Line className="text-lg" />
                          Asignar conductor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Botones */}
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0 flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all"
          >
            <span className="grid place-items-center size-6 rounded-full bg-brand-deep/10 text-brand-deep">
              <MdCheckCircle className="text-base" />
            </span>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}