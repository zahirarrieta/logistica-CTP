import { useState, useEffect, useRef } from 'react'
import { MdClose, MdCheckCircle, MdSwapHoriz, MdTag, MdCheck, MdNotes, MdNumbers, MdCloudUpload, MdInfoOutline } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { ESTADOS, getBadgeColor, getDotColor } from '../../../Home/Components/estadoColors.js'
import { subirFacturaRemisionOneDrive } from '../../../../services/oneDriveApi.js'
import { documentosSubidos, errorSubida as notificarErrorSubida } from '../../../../services/notificaciones.jsx'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

function Requisito({ listo, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
        listo ? 'bg-green-500/15 text-green-700' : 'bg-amber-400/20 text-amber-700'
      }`}
    >
      {listo ? <MdCheckCircle className="text-sm shrink-0" /> : <MdInfoOutline className="text-sm shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

export default function EstadosModal({ solicitud, open, onClose, onUpdate, onAsignarConductorClick, permitidos }) {
  const [estado, setEstado] = useState('Abierto')
  const [nota, setNota] = useState('')
  const [numeroRef, setNumeroRef] = useState('')
  const [adjuntoTramite, setAdjuntoTramite] = useState([])
  const [guardado, setGuardado] = useState(false)
  const [editarFactura, setEditarFactura] = useState(false)
  const [editarConductor, setEditarConductor] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubida, setErrorSubida] = useState('')
  const abiertoRef = useRef(false)

  useEffect(() => {
    if (!open) {
      abiertoRef.current = false
      return
    }
    if (abiertoRef.current || !solicitud) return
    abiertoRef.current = true
    setEstado(solicitud.estado || 'Abierto')
    setNota('')
    setNumeroRef(solicitud.numeroReferencia || '')
    setAdjuntoTramite([])
    setGuardado(false)
    setEditarFactura(false)
    setEditarConductor(false)
    setSubiendo(false)
    setErrorSubida('')
  }, [open, solicitud])

  if (!open || !solicitud) return null

  const listaEstados = permitidos || ESTADOS

  const isCurrent = (e) => e === estado
  const esSeleccionado = estado !== (solicitud.estado || 'Abierto')
  const esTransitoSeleccionado = ESTADOS_TRANSITO.includes(estado)
  const esTransitoActual = ESTADOS_TRANSITO.includes(solicitud.estado || 'Abierto') && !esSeleccionado
  const transporteListo = Boolean(solicitud.conductor && solicitud.vehiculo && solicitud.placa)
  const bloqueadoCerrar = !guardado
  const numeroRefValido = numeroRef.trim().length > 0 && adjuntoTramite.length > 0
  const puedeGuardar =
    !subiendo &&
    (estado === 'En Trámite'
      ? numeroRefValido
      : esSeleccionado
        ? !esTransitoSeleccionado || transporteListo
        : esTransitoActual && transporteListo)

  const handleSelect = (e) => {
    if (isCurrent(e)) return
    setEstado(e)
    setNota('')
    setNumeroRef('')
    setAdjuntoTramite([])
    setErrorSubida('')
  }

  const handleSave = async () => {
    if (!puedeGuardar) return
    setErrorSubida('')
    const updates = { estado, notaEstado: nota.trim() }
    if (estado === 'En Trámite') {
      if (!numeroRef.trim() || adjuntoTramite.length === 0) return
      setSubiendo(true)
      try {
        const subidos = await subirFacturaRemisionOneDrive(adjuntoTramite, numeroRef.trim())
        updates.numeroReferencia = numeroRef.trim()
        updates.adjuntosTramite = adjuntoTramite.map((f) => f.name)
        const urls = subidos.map((s) => s.url).filter(Boolean)
        if (urls.length === 0) {
          throw new Error('OneDrive no devolvió una URL del documento subido')
        }
        updates.nuevaFacturaUrls = urls
        documentosSubidos({ id: solicitud.id, nombres: adjuntoTramite.map((f) => f.name) })
      } catch (err) {
        console.error('[EstadosModal] error subiendo factura a OneDrive:', err)
        setErrorSubida(`No se pudo guardar el documento en OneDrive: ${err.message}`)
        notificarErrorSubida(err.message, solicitud.id)
        setSubiendo(false)
        return
      }
      setSubiendo(false)
    }
    onUpdate(solicitud.id, updates)
    setNota('')
    setNumeroRef('')
    setAdjuntoTramite([])
    setGuardado(true)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={bloqueadoCerrar ? () => {} : onClose}
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
              disabled={bloqueadoCerrar}
              title={bloqueadoCerrar ? 'Debes guardar el cambio de estado para poder cerrar' : 'Cerrar'}
              className={`grid place-items-center size-8 rounded-full bg-white/10 text-white transition ${
                bloqueadoCerrar ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/20'
              }`}
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
              const esTransitoEstado = ESTADOS_TRANSITO.includes(e)
              const mostrarPanel = e === estado && esSeleccionado
              const editarTramiteActual = e === 'En Trámite' && current && editarFactura
              const editarConductorActual = esTransitoEstado && current && editarConductor
              const abrirPanel = mostrarPanel || editarTramiteActual || editarConductorActual
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
                  {current && e === 'En Trámite' && (
                    <button
                      type="button"
                      onClick={() => setEditarFactura((v) => !v)}
                      className={`mt-1 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        editarFactura
                          ? 'bg-brand-deep/10 text-brand-deep'
                          : 'bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/40 hover:bg-brand-cyan/25'
                      }`}
                    >
                      <MdNumbers className="text-sm" />
                      {editarFactura ? 'Ocultar campos de factura' : 'Editar factura o remisión'}
                    </button>
                  )}
                  {current && esTransitoEstado && (
                    <button
                      type="button"
                      onClick={() => setEditarConductor((v) => !v)}
                      className={`mt-1 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        editarConductor
                          ? 'bg-brand-deep/10 text-brand-deep'
                          : 'bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/40 hover:bg-brand-cyan/25'
                      }`}
                    >
                      <RiSteering2Line className="text-sm" />
                      {editarConductor ? 'Ocultar datos del conductor' : 'Editar conductor'}
                    </button>
                  )}
                  {abrirPanel && (
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
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={numeroRef}
                              onChange={(ev) => setNumeroRef(ev.target.value.replace(/\D/g, ''))}
                              placeholder="Ej. 12345678"
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
  accept=".pdf,application/pdf"
  onChange={(ev) => setAdjuntoTramite(Array.from(ev.target.files || []))}
  className="hidden"
/>
                            </label>
                          </div>
                        </div>
                      )}
                      {ESTADOS_TRANSITO.includes(e) && (
                        <div className="mt-2 space-y-2 rounded-xl bg-brand-deep/5 border border-brand-deep/15 p-3 animate-fadeIn">
                          <p className="text-[11px] font-extrabold text-brand-deep uppercase tracking-wide">
                            Pasos antes de guardar el estado
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Requisito
                              listo={Boolean(solicitud.conductor)}
                              label={solicitud.conductor ? `Conductor: ${solicitud.conductor}` : 'Conductor: pendiente'}
                            />
                            <Requisito
                              listo={Boolean(solicitud.vehiculo)}
                              label={solicitud.vehiculo ? `Vehículo: ${solicitud.vehiculo}` : 'Tipo de vehículo: pendiente'}
                            />
                            <Requisito
                              listo={Boolean(solicitud.placa)}
                              label={solicitud.placa ? `Placa: ${solicitud.placa}` : 'Placa: pendiente'}
                            />
                          </div>
                          {onAsignarConductorClick && (
                            <button
                              type="button"
                              onClick={() => onAsignarConductorClick(solicitud)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-all"
                            >
                              <RiSteering2Line className="text-lg" />
                              {solicitud.conductor ? 'Editar conductor' : 'Asignar conductor'}
                            </button>
                          )}
                          {!transporteListo && (
                            <p className="text-[11px] font-semibold text-amber-700 inline-flex items-center gap-1">
                              <MdInfoOutline className="text-sm shrink-0" />
                              Completa conductor, tipo de vehículo y placa para poder guardar el cambio.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Botones */}
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0 space-y-2">
          {errorSubida && (
            <p className="inline-flex items-start gap-1.5 text-xs font-bold text-red-600">
              <MdInfoOutline className="text-base shrink-0" />
              {errorSubida}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {bloqueadoCerrar && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <MdInfoOutline className="text-base shrink-0" />
                {estado === 'En Trámite' && !numeroRefValido
                  ? 'Completa número de factura o remisión y adjúntala para poder guardar'
                  : 'Debes guardar el cambio de estado para poder cerrar'}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!puedeGuardar}
              className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-cyanGlow"
            >
              <span className="grid place-items-center size-6 rounded-full bg-brand-deep/10 text-brand-deep">
                {subiendo ? <MdCloudUpload className="text-base animate-pulse" /> : <MdCheckCircle className="text-base" />}
              </span>
              {subiendo ? 'Subiendo a OneDrive…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}