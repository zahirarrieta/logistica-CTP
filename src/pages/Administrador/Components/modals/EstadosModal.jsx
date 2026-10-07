import { useState, useEffect, useRef } from 'react'
import { MdClose, MdCheckCircle, MdSwapHoriz, MdTag, MdCheck, MdNotes, MdNumbers, MdCloudUpload, MdInfoOutline, MdPictureAsPdf, MdVisibility, MdDeleteOutline } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { ESTADOS, getBadgeColor, getDotColor } from '../../../../utils/estadoColors.js'
import { MAXE_PDFS_TRAMITE, pdfsTramite, nombrePdfFromUrl } from '../../../../utils/pdfUtils.js'
import { subirFacturasRemisiones, borrarArchivo } from '../../../../services/archivosApi.js'
import { documentosSubidos, errorSubida as notificarErrorSubida, solicitudDevuelta } from '../../../../services/notificaciones.jsx'
import { CAMPOS_DEVOLUCION, componerMotivoDevolucion, quitarAdjuntoTramite } from '../../../../store/solicitudesStore.js'
import Modal from '../../../../components/Modal.jsx'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']
const ESTADOS_TRAMITE = ['En Trámite', 'En Trámite Parcial']
const ESTADO_DEVOLUCION = 'Devolución a Solicitante'
// Cierre de la solicitud sin entrega: exige observaciones y deja la solicitud
// sin más opciones de cambio (la lista desaparece de la tabla).
const ESTADO_CANCELADO = 'Cancelado'
// «En Trámite» y «En Trámite Parcial» se comportan igual: panel de observaciones,
// factura/remisión opcional y reaplicación sobre el estado actual.
const esTramite = (e) => ESTADOS_TRAMITE.includes(e)

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
  const [camposCorregir, setCamposCorregir] = useState([])
  const [numeroRef, setNumeroRef] = useState('')
  const [adjuntoTramite, setAdjuntoTramite] = useState([])
  const [asignarFactura, setAsignarFactura] = useState(false)
  const [editarConductor, setEditarConductor] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubida, setErrorSubida] = useState('')
  const [previewAbierto, setPreviewAbierto] = useState(null)
  // Borrado de un PDF ya guardado: `borrando` es la ruta que se está eliminando
  // (deshabilita el resto) y `confirmarBorrar` la que espera confirmación, que
  // evita un borrado sin querer con un solo clic.
  const [borrando, setBorrando] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState('')
  const abiertoRef = useRef(false)
  const urlsRef = useRef(new Map())
  const inputRef = useRef(null)

  // Única opción «Cancelado»: caso de una devolución a solicitante con el plazo
  // de corrección vencido (Administrador pasa permitidos={['Cancelado']}).
  const soloCancelar = Array.isArray(permitidos) && permitidos.length === 1 && permitidos[0] === ESTADO_CANCELADO

  useEffect(() => {
    if (!open) {
      abiertoRef.current = false
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlsRef.current.clear()
      setPreviewAbierto(null)
      setBorrando('')
      setConfirmarBorrar('')
      return
    }
    if (abiertoRef.current || !solicitud) return
    abiertoRef.current = true
    // Si la única opción es «Cancelado» (devolución vencida) se preselecciona
    // para que el motivo quede a la vista de una vez.
    setEstado(soloCancelar ? ESTADO_CANCELADO : (solicitud.estado || 'Abierto'))
    setNota('')
    setCamposCorregir([])
    setNumeroRef(solicitud.numeroReferencia || '')
    setAdjuntoTramite([])
    setAsignarFactura(false)
    setEditarConductor(false)
    setSubiendo(false)
    setErrorSubida('')
    setPreviewAbierto(null)
    setBorrando('')
    setConfirmarBorrar('')
  }, [open, solicitud, soloCancelar])

  // Libera las URLs de vista previa al desmontar el modal.
  useEffect(() => () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current.clear()
  }, [])

  if (!open || !solicitud) return null

  const claveArchivo = (f) => `${f.name}|${f.size}|${f.lastModified}`
  // Los PDFs ya guardados en los pasos anteriores por «En Trámite» siguen contando:
  // el tope de 3 es por solicitud, así que cada reimpresión solo admite lo que falte.
  const pdfsPrevios = pdfsTramite(solicitud.historial)
  const cupoRestante = Math.max(MAXE_PDFS_TRAMITE - pdfsPrevios.length - adjuntoTramite.length, 0)
  const totalElegidos = pdfsPrevios.length + adjuntoTramite.length
  const urlPara = (file) => {
    if (!urlsRef.current.has(file)) urlsRef.current.set(file, URL.createObjectURL(file))
    return urlsRef.current.get(file)
  }
  const agregarArchivos = (nuevos) => {
    const lista = Array.from(nuevos || [])
    if (lista.length === 0) return
    // Se acumulan los PDFs elegidos en vez de reemplazarlos: se pueden seleccionar
    // varios de una vez y los que ya estaban en la tanda se conservan.
    const yaElegidos = new Set(adjuntoTramite.map(claveArchivo))
    const nuevosValidos = lista.filter((f) => f && !yaElegidos.has(claveArchivo(f)))
    const aceptados = nuevosValidos.slice(0, cupoRestante)
    if (aceptados.length < nuevosValidos.length) {
      setErrorSubida(
        `Solo caben ${MAXE_PDFS_TRAMITE - totalElegidos} PDF(s) más: esta solicitud admite ${MAXE_PDFS_TRAMITE} en total entre todas sus tandas de trámite.`
      )
    } else {
      setErrorSubida('')
    }
    if (aceptados.length > 0) setAdjuntoTramite((prev) => [...prev, ...aceptados])
    setPreviewAbierto(null)
    if (inputRef.current) inputRef.current.value = ''
  }
  const quitarArchivo = (file) => {
    const url = urlsRef.current.get(file)
    if (url) {
      URL.revokeObjectURL(url)
      urlsRef.current.delete(file)
    }
    setPreviewAbierto((prev) => (prev === file ? null : prev))
    setAdjuntoTramite((prev) => prev.filter((f) => f !== file))
  }
  const formatearBytes = (n) => {
    const kb = (n || 0) / 1024
    return kb < 1024 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`
  }

  // Borra un PDF ya guardado (factura/remisión de una tanda anterior) para que
  // quepa subir el correcto. Primero el servidor —que quita la referencia de la
  // base y el archivo del disco— y después la copia local del store, que es la
  // que impediría que un empuje posterior resucitara la ruta.
  //
  // Los PDFs elegidos pero aún NO guardados (`adjuntoTramite`) se quitan con
  // `quitarArchivo`, que es solo local: estos sí tocan el servidor.
  const borrarPdfGuardado = async (url) => {
    if (borrando || subiendo) return
    if (confirmarBorrar !== url) {
      setConfirmarBorrar(url)
      return
    }
    setConfirmarBorrar('')
    setBorrando(url)
    setErrorSubida('')
    try {
      const datos = await borrarArchivo(url)
      quitarAdjuntoTramite(solicitud.id, url)
      const quitadas = Number(datos?.quitadas || 0)
      if (quitadas === 0) {
        setErrorSubida(
          'La referencia ya no estaba en la base; solo se quitó el archivo si existía.'
        )
      }
    } catch (err) {
      console.error('[EstadosModal] error borrando factura:', err)
      setErrorSubida(`No se pudo eliminar el documento: ${err.message}`)
      notificarErrorSubida(err.message, solicitud.id)
    } finally {
      setBorrando('')
    }
  }

  // Una solicitud cancelada ya está cerrada: el modal no ofrece nada más.
  const solicitudCancelada = (solicitud.estado || '') === ESTADO_CANCELADO
  const listaEstados = solicitudCancelada ? [] : (permitidos || ESTADOS)

  const isCurrent = (e) => e === estado
  const esSeleccionado = estado !== (solicitud.estado || 'Abierto')
  const esTransitoSeleccionado = ESTADOS_TRANSITO.includes(estado)
  const esTransitoActual = ESTADOS_TRANSITO.includes(solicitud.estado || 'Abierto') && !esSeleccionado
  const transporteListo = Boolean(solicitud.conductor && solicitud.vehiculo && solicitud.placa)
  const numeroRefValido = numeroRef.trim().length > 0 && adjuntoTramite.length > 0
  const esDevolucion = estado === ESTADO_DEVOLUCION
  const esCancelado = estado === ESTADO_CANCELADO
  const notaObligatoria = esDevolucion && nota.trim().length > 0
  const camposObligatorios = esDevolucion && camposCorregir.length > 0
  // Cancelar siempre lleva observaciones: es el registro de por qué se cerró
  // el pedido sin entregar.
  const motivoCancelacion = esCancelado && nota.trim().length > 0
  // «En Trámite»/«En Trámite Parcial» se pueden aplicar varias veces: si la
  // solicitud ya está en uno de esos estados, basta abrir el modal y guardar
  // (solo observaciones) sin factura.
  const tramiteReaplicado =
    esTramite(estado) && !esSeleccionado && esTramite(solicitud.estado || 'Abierto')
  const puedeGuardar =
    !subiendo &&
    !borrando &&
    !solicitudCancelada &&
    (esTramite(estado)
      ? asignarFactura
        ? numeroRefValido
        : esSeleccionado || tramiteReaplicado
      : esDevolucion
        ? esSeleccionado && notaObligatoria && camposObligatorios
        : esCancelado
          ? esSeleccionado && motivoCancelacion
          : esSeleccionado
            ? !esTransitoSeleccionado || transporteListo
            : esTransitoActual && transporteListo)

  const handleSelect = (e) => {
    // «En Trámite»/«En Trámite Parcial» se puede volver a aplicar aunque ya sea el estado actual.
    if (isCurrent(e) && !esTramite(e)) return
    setEstado(e)
    setNota('')
    setCamposCorregir([])
    setNumeroRef('')
    setAdjuntoTramite([])
    setAsignarFactura(false)
    setErrorSubida('')
    setConfirmarBorrar('')
  }

  const alternarCampo = (id) => {
    setCamposCorregir((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!puedeGuardar) return
    setErrorSubida('')
    const updates = {
      estado,
      notaEstado: esDevolucion ? componerMotivoDevolucion(camposCorregir, nota.trim()) : nota.trim(),
    }
    if (esTramite(estado) && asignarFactura) {
      if (!numeroRef.trim() || adjuntoTramite.length === 0) return
      setSubiendo(true)
      try {
        const subidos = await subirFacturasRemisiones(adjuntoTramite, numeroRef.trim(), solicitud.id)
        updates.numeroReferencia = numeroRef.trim()
        updates.adjuntosTramite = adjuntoTramite.map((f) => f.name)
        const rutas = subidos.map((s) => s.ruta).filter(Boolean)
        if (rutas.length === 0) {
          throw new Error('El servidor no devolvió la ruta del documento subido')
        }
        updates.nuevaFacturaUrls = rutas
        documentosSubidos({ id: solicitud.id, nombres: adjuntoTramite.map((f) => f.name) })
      } catch (err) {
        console.error('[EstadosModal] error subiendo factura:', err)
        setErrorSubida(`No se pudo guardar el documento: ${err.message}`)
        notificarErrorSubida(err.message, solicitud.id)
        setSubiendo(false)
        return
      }
      setSubiendo(false)
    }
    onUpdate(solicitud.id, updates)
    if (esDevolucion) {
      const motivo = componerMotivoDevolucion(camposCorregir, nota.trim())
      solicitudDevuelta(solicitud.id, motivo)
    }
    setNota('')
    setCamposCorregir([])
    setNumeroRef('')
    setAdjuntoTramite([])
    onClose()
  }

  return (
    <Modal onClose={onClose}>
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
              title="Cerrar"
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Lista de estados */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {solicitudCancelada ? (
            <div className="rounded-xl border border-gray-300 bg-gray-100 p-4 text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gray-100 text-gray-700 ring-1 ring-gray-400/60">
                <span className="size-2 rounded-full bg-gray-500" />
                Cancelado
              </span>
              <p className="text-sm font-semibold text-brand-ink/70">
                La solicitud fue cancelada: ya no admite cambios de estado.
              </p>
              <p className="text-xs font-semibold text-brand-ink/50">
                Revisa el motivo en el historial de cambios.
              </p>
            </div>
          ) : (
            <>
          {soloCancelar && (
            <div className="mb-3 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-3 py-2.5 text-xs font-bold text-fuchsia-700 inline-flex items-start gap-1.5">
              <MdInfoOutline className="text-base shrink-0" />
              <span>
                La devolución venció sin que el solicitante corrigiera. Solo puedes cancelar la solicitud.
              </span>
            </div>
          )}
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
              const tramiteActual = esTramite(solicitud.estado || 'Abierto')
              // El panel de trámite queda abierto aunque sea el estado actual,
              // para poder reaplicarlo o asignar la factura después.
              const mostrarPanel = e === estado && (esSeleccionado || (esTramite(e) && tramiteActual))
              const editarConductorActual = esTransitoEstado && current && editarConductor
              const abrirPanel = mostrarPanel || editarConductorActual
              return (
                <div key={e}>
                  <button
                    type="button"
                    onClick={() => handleSelect(e)}
                    disabled={current && !esTramite(e)}
                    title={current && !esTramite(e) ? 'La solicitud ya está en este estado' : esTramite(e) && current ? 'Reaplicar trámite (puede volver a guardarse sin factura)' : `Cambiar a ${e}`}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-deep transition-all ${
                      current
                        ? 'bg-brand-cyan/15 ring-2 ring-brand-cyan/50 cursor-not-allowed'
                        : 'bg-brand-mist/40 hover:bg-brand-cyan/15 hover:ring-1 hover:ring-brand-cyan/40'
                    } ${current && esTramite(e) ? 'ring-2 ring-brand-cyan/50' : ''}`}
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
                        {e === ESTADO_DEVOLUCION
                          ? 'Motivo de la devolución — qué debe corregir'
                          : e === ESTADO_CANCELADO
                            ? 'Motivo de cancelación — por qué se cierra el pedido'
                            : 'Observaciones del cambio'}
                        {(e === ESTADO_DEVOLUCION || e === ESTADO_CANCELADO) && <span className="text-red-500">*</span>}
                      </label>
                      {e === ESTADO_DEVOLUCION && (
                        <div className="mb-2.5">
                          <p className="text-[11px] font-extrabold text-brand-deep uppercase tracking-wide mb-1.5">
                            Campos que debe corregir el solicitante <span className="text-red-500">*</span>
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {CAMPOS_DEVOLUCION.map((c) => {
                              const marcado = camposCorregir.includes(c.id)
                              return (
                                <label
                                  key={c.id}
                                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all select-none ${
                                    marcado
                                      ? 'border-brand-cyan bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/40'
                                      : 'border-brand-deep/20 bg-white text-brand-ink/70 hover:border-brand-cyan/50 hover:bg-brand-cyan/5'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    onChange={() => alternarCampo(c.id)}
                                    className="size-4 shrink-0 accent-brand-cyan"
                                  />
                                  <span className="truncate">{c.etiqueta}</span>
                                </label>
                              )
                            })}
                          </div>
                          {camposCorregir.length === 0 && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                              <MdInfoOutline className="text-sm shrink-0" />
                              Marca al menos un campo que el solicitante debe corregir.
                            </p>
                          )}
                        </div>
                      )}
                      <textarea
                        value={nota}
                        onChange={(ev) => setNota(ev.target.value.toUpperCase())}
                        rows={3}
                        placeholder={
                          e === ESTADO_DEVOLUCION
                            ? 'ESCRIBE QUÉ ESTÁ MAL Y QUÉ DEBE CORREGIR EL SOLICITANTE…'
                            : e === ESTADO_CANCELADO
                              ? 'ESCRIBE EL MOTIVO POR EL QUE SE CANCELA EL PEDIDO…'
                              : 'ESCRIBE LAS OBSERVACIONES DEL CAMBIO DE ESTADO…'
                        }
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm uppercase text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:ring-4 focus:outline-none transition-all resize-none ${
                          (e === ESTADO_DEVOLUCION || e === ESTADO_CANCELADO) && !nota.trim()
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                            : 'border-brand-deep/20 focus:border-brand-deep/60 focus:ring-brand-deep/10'
                        }`}
                      />
                      {e === ESTADO_DEVOLUCION && !nota.trim() && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                          <MdInfoOutline className="text-sm shrink-0" />
                          Indica el motivo para poder devolver la solicitud al solicitante.
                        </p>
                      )}
                      {e === ESTADO_CANCELADO && !nota.trim() && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                          <MdInfoOutline className="text-sm shrink-0" />
                          Escribe el motivo de la cancelación para poder cerrar la solicitud.
                        </p>
                      )}
                      {esTramite(e) && (
                        <div className="mt-2 space-y-2">
                          <button
                            type="button"
                            onClick={() => setAsignarFactura((v) => !v)}
                            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                              asignarFactura
                                ? 'bg-brand-deep text-white shadow-md'
                                : 'bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/40 hover:bg-brand-cyan/25'
                            }`}
                          >
                            {asignarFactura ? <MdCheck className="text-base" /> : <MdNumbers className="text-base" />}
                            {asignarFactura ? 'Factura o remisión asignada — quitar' : 'Asignar factura o remisión'}
                          </button>
                          {!asignarFactura && (
                            <p className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-brand-ink/60">
                              <MdInfoOutline className="text-sm shrink-0 mt-0.5" />
                              Puedes guardar «{e}» con solo observaciones. Cuando tengas la factura o remisión, actívala aquí para adjuntarla.
                            </p>
                          )}
                          {pdfsPrevios.length > 0 && (
                            <div className="rounded-xl border border-brand-deep/15 bg-white p-2.5 space-y-1.5">
                              <p className="text-[11px] font-extrabold text-brand-deep uppercase tracking-wide inline-flex items-center gap-1.5">
                                <MdPictureAsPdf className="text-sm text-red-500" />
                                PDFs guardados ({pdfsPrevios.length}/{MAXE_PDFS_TRAMITE})
                              </p>
                              <ul className="space-y-1.5">
                                {pdfsPrevios.map((url) => {
                                  const nombre = nombrePdfFromUrl(url, 'Factura o remisión')
                                  const enCurso = borrando === url
                                  const pendiente = confirmarBorrar === url
                                  return (
                                    <li
                                      key={url}
                                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border transition ${
                                        pendiente
                                          ? 'border-red-400 bg-red-50'
                                          : 'border-brand-deep/10 bg-brand-mist/30'
                                      }`}
                                    >
                                      <MdPictureAsPdf className="text-lg text-red-500 shrink-0" />
                                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-brand-ink" title={nombre}>
                                        {nombre}
                                      </span>
                                      {pendiente ? (
                                        <span className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => borrarPdfGuardado(url)}
                                            disabled={Boolean(borrando) || subiendo}
                                            className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-red-700 transition disabled:opacity-40"
                                          >
                                            Sí, borrar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmarBorrar('')}
                                            className="rounded-full bg-brand-ink/10 px-2.5 py-1 text-[10px] font-extrabold text-brand-ink/70 hover:bg-brand-ink/20 transition"
                                          >
                                            No
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => borrarPdfGuardado(url)}
                                          disabled={Boolean(borrando) || subiendo}
                                          title={`Eliminar ${nombre}`}
                                          className="grid place-items-center size-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition shrink-0 disabled:opacity-40"
                                        >
                                          {enCurso ? (
                                            <MdCloudUpload className="text-sm animate-pulse" />
                                          ) : (
                                            <MdDeleteOutline className="text-base" />
                                          )}
                                        </button>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                              <p className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-brand-ink/50">
                                <MdInfoOutline className="text-sm shrink-0 mt-0.5" />
                                Se borran del servidor para dejar sitio a la factura o remisión correcta.
                              </p>
                            </div>
                          )}
                          {asignarFactura && (
                          <div className="rounded-xl border border-brand-cyan/30 bg-brand-mist/30 p-3 space-y-2 animate-fadeIn">
                            <div>
                              <label className="flex items-center gap-2 text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2">
                                <MdNumbers className="text-base text-brand-cyan" />
                                Número de factura o remisión <span className="text-red-500">*</span>
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
                              Adjuntar factura o remisión <span className="text-red-500">*</span>
                            </label>
                            <label className="flex flex-col items-center justify-center gap-1.5 w-full px-3 py-4 border-2 border-dashed border-brand-ink/25 rounded-xl bg-white text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
                              <MdCloudUpload className="text-2xl text-brand-cyan" />
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs font-medium">
                                  {cupoRestante > 0
                                    ? adjuntoTramite.length > 0
                                      ? 'Añadir más PDFs'
                                      : 'Haz clic para adjuntar PDFs'
                                    : 'Límite de 3 PDFs alcanzado'}
                                </span>
                                <span className="text-[11px] font-bold text-brand-ink/50">
                                  {totalElegidos}/{MAXE_PDFS_TRAMITE} en total
                                </span>
                              </div>
                              <input
                                ref={inputRef}
                                type="file"
                                multiple
                                accept=".pdf,application/pdf"
                                onChange={(ev) => agregarArchivos(ev.target.files)}
                                className="hidden"
                                disabled={cupoRestante === 0}
                              />
                            </label>

                            {adjuntoTramite.length > 0 && (
                              <ul className="mt-2 space-y-1.5">
                                {adjuntoTramite.map((f) => {
                                  const abierto = previewAbierto === f
                                  return (
                                    <li key={claveArchivo(f)} className="rounded-xl border border-brand-deep/15 bg-white overflow-hidden">
                                      <div className="flex items-center gap-2 px-2.5 py-2">
                                        <MdPictureAsPdf className="text-xl text-red-500 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-xs font-bold text-brand-ink">{f.name}</span>
                                          <span className="block text-[11px] font-medium text-brand-ink/50">{formatearBytes(f.size)}</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewAbierto(abierto ? null : f)}
                                          title={abierto ? 'Ocultar vista previa' : 'Ver vista previa'}
                                          className="grid place-items-center size-7 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition shrink-0"
                                        >
                                          <MdVisibility className="text-base" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => quitarArchivo(f)}
                                          title="Quitar archivo"
                                          className="grid place-items-center size-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition shrink-0"
                                        >
                                          <MdDeleteOutline className="text-base" />
                                        </button>
                                      </div>
                                      {abierto && (
                                        <object
                                          data={urlPara(f)}
                                          type="application/pdf"
                                          aria-label={`Vista previa de ${f.name}`}
                                          className="w-full h-64 border-t border-brand-deep/15 bg-brand-ink/5"
                                        >
                                          <p className="p-3 text-xs text-brand-ink/60">
                                            Tu navegador no muestra la vista previa.{' '}
                                            <a className="font-bold text-brand-deep underline" href={urlPara(f)} target="_blank" rel="noopener noreferrer">Abrir PDF</a>.
                                          </p>
                                        </object>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                          </div>
                        )}
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
            </>
          )}
        </div>

        {/* Botones */}
        {!solicitudCancelada && (
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0 space-y-2">
          {errorSubida && (
            <p className="inline-flex items-start gap-1.5 text-xs font-bold text-red-600">
              <MdInfoOutline className="text-base shrink-0" />
              {errorSubida}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
          {((esTramite(estado) && asignarFactura && !numeroRefValido) ||
            (esDevolucion && (!notaObligatoria || !camposObligatorios)) ||
            (esCancelado && !motivoCancelacion)) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
              <MdInfoOutline className="text-base shrink-0" />
              {esDevolucion
                ? !notaObligatoria
                  ? 'Escribe el motivo de la devolución para poder guardar'
                  : 'Marca al menos un campo que debe corregir el solicitante'
                : esCancelado
                  ? 'Escribe el motivo de la cancelación para poder guardar'
                  : 'Completa número de factura o remisión y adjúntala para poder guardar'}
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
              {subiendo ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
        )}
      </div>
    </Modal>
  )
}