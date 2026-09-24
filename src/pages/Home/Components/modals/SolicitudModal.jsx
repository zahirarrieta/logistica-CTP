import { useState, useEffect, useRef } from 'react'
import { MdClose, MdCloudUpload, MdSearch, MdSend, MdTag, MdPerson, MdEmail, MdAssignmentAdd, MdBusiness, MdWarehouse, MdPlace, MdNotes, MdInsertDriveFile, MdPictureAsPdf, MdTableChart, MdImage, MdCancel, MdVisibility, MdAssignmentReturn, MdOpenInNew, MdCheck, MdAddCircleOutline } from 'react-icons/md'
import FormField from '../FormField.jsx'
import Loader from '../../../../loader/Loader.jsx'
import { peekNextId, refrescarProximoCodigo, reservarProximoCodigo, buscarDevolucion, parsearMotivoDevolucion, CAMPOS_DEVOLUCION, restanteDevolucion } from '../solicitudesStore.js'
import CuentaRegresivaDevolucion from '../../../../components/CuentaRegresivaDevolucion.jsx'
import { nombrePdfFromUrl } from '../../../../components/pdfUtils.js'
import { useAuth } from '../../../../auth/AuthContext.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'
import { subirAdjuntosOneDrive } from '../../../../services/oneDriveApi.js'
import { documentosSubidos, errorSubida as notificarErrorSubida } from '../../../../services/notificaciones.jsx'

const TIPO_SOLICITUD_OPTIONS = [
  { value: 'EMERGENCIA / 2 Horas', label: 'EMERGENCIA / 2 Horas' },
  { value: 'ENVÍO REPOSICIÓN - CONSIGNACIÓN / Ventana de Pedido', label: 'ENVÍO REPOSICIÓN - CONSIGNACIÓN / Ventana de Pedido' },
  { value: 'OPORTUNIDAD DE VENTA / 8 Horas', label: 'OPORTUNIDAD DE VENTA / 8 Horas' },
  { value: 'PROCEDIMIENTO ESPECIAL - CLIENTE TEMPORAL / Ventana', label: 'PROCEDIMIENTO ESPECIAL - CLIENTE TEMPORAL / Ventana' },
  { value: 'URGENCIA / 4 Horas', label: 'URGENCIA / 4 Horas' },
  { value: 'VENTA DIRECTA', label: 'VENTA DIRECTA' },
  { value: 'ADMINISTRATIVA', label: 'ADMINISTRATIVA' },
  { value: 'RECOLECCIÓN DE DISPOSITIVOS', label: 'RECOLECCIÓN DE DISPOSITIVOS' },
]

function nombreAdjunto(item) {
  if (typeof item === 'string') return nombrePdfFromUrl(item, 'Adjunto')
  return item?.name || ''
}

function esUrlAdjunto(item) {
  return typeof item === 'string'
}

function iconoArchivo(archivo) {
  const nombre = nombreAdjunto(archivo)
  const tipo = esUrlAdjunto(archivo) ? '' : archivo.type || ''
  if (tipo.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(nombre)) {
    return <MdImage className="text-blue-500" />
  }
  if (tipo === 'application/pdf' || /\.pdf$/i.test(nombre)) {
    return <MdPictureAsPdf className="text-red-500" />
  }
  if (/\.xlsx?$/.test(nombre) || tipo.includes('spreadsheet') || tipo.includes('excel')) {
    return <MdTableChart className="text-green-600" />
  }
  return <MdInsertDriveFile className="text-gray-500" />
}

function esImagen(archivo) {
  const tipo = esUrlAdjunto(archivo) ? '' : archivo.type || ''
  const nombre = nombreAdjunto(archivo)
  return tipo.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(nombre)
}

function esPdf(archivo) {
  const tipo = esUrlAdjunto(archivo) ? '' : archivo.type || ''
  const nombre = nombreAdjunto(archivo)
  return tipo === 'application/pdf' || /\.pdf$/i.test(nombre)
}

function formatearBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SolicitudModal({ open, onClose, onSubmit, solicitud = null, onEditSubmit, onCrearNueva }) {
  const { account } = useAuth()
  const modoEdicion = Boolean(solicitud)
  const devolucion = modoEdicion ? buscarDevolucion(solicitud) : null
  const { campos: camposCorregir, texto: textoMotivo } = parsearMotivoDevolucion(devolucion?.nota)
  const etiquetasCorregir = camposCorregir
    .map((id) => CAMPOS_DEVOLUCION.find((c) => c.id === id)?.etiqueta)
    .filter(Boolean)
  const corregirCliente = camposCorregir.includes('cliente')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [formData, setFormData] = useState({
    nombreCompleto: account?.name || '',
    correo: account?.username || '',
    tipoSolicitud: '',
    cliente: '',
    bodega: '',
    nit: '',
    zona: '',
    adjuntos: [],
    observaciones: '',
  })
  const [loading, setLoading] = useState(false)
  const [errores, setErrores] = useState([])
  const [subiendoMsg, setSubiendoMsg] = useState('')
  const [previewAbierto, setPreviewAbierto] = useState(null)
  const [siguiente, setSiguiente] = useState(peekNextId())
  const urlsRef = useRef(new Map())
  const [ahora, setAhora] = useState(() => Date.now())

  // Mientras se edita una solicitud devuelta, mantiene la hora al día para
  // calcular la cuenta regresiva de los 5 minutos.
  const enDevolucion = modoEdicion && Boolean(devolucion)
  useEffect(() => {
    if (!open || !enDevolucion) return undefined
    setAhora(Date.now())
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open, enDevolucion])

  const restante = enDevolucion ? restanteDevolucion(solicitud, ahora) : null
  const vencida = restante !== null && restante === 0

  // Libera las URLs de vista previa al desmontar el modal.
  useEffect(() => () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current.clear()
  }, [])

  const urlPara = (file) => {
    if (!urlsRef.current.has(file)) urlsRef.current.set(file, URL.createObjectURL(file))
    return urlsRef.current.get(file)
  }

  const liberarUrl = (file) => {
    const url = urlsRef.current.get(file)
    if (url) {
      URL.revokeObjectURL(url)
      urlsRef.current.delete(file)
    }
  }

  // Al abrir el modal: en edición precarga los datos de la solicitud devuelta;
  // en creación deja el formulario en blanco con los datos del usuario.
  useEffect(() => {
    if (!open) return
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current.clear()
    setPreviewAbierto(null)
    setErrores([])
    setLoading(false)
    setSubiendoMsg('')
    if (solicitud) {
      setFormData({
        nombreCompleto: solicitud.nombreCompleto || account?.name || '',
        correo: solicitud.correo || account?.username || '',
        tipoSolicitud: solicitud.tipoSolicitud || '',
        cliente: solicitud.cliente || '',
        bodega: solicitud.bodega || '',
        nit: solicitud.nit || '',
        zona: solicitud.zona || '',
        adjuntos: Array.isArray(solicitud.adjuntos) ? [...solicitud.adjuntos] : [],
        observaciones: solicitud.observaciones || '',
      })
    } else {
      setFormData({
        nombreCompleto: account?.name || '',
        correo: account?.username || '',
        tipoSolicitud: '',
        cliente: '',
        bodega: '',
        nit: '',
        zona: '',
        adjuntos: [],
        observaciones: '',
      })
    }
    // Al abrir en creación se "mira" el próximo código global SIN consumirlo
    // (la secuencia solo avanza al crear la solicitud).
    setSiguiente(peekNextId())
    if (!solicitud) {
      void refrescarProximoCodigo().then((c) => {
        if (c) setSiguiente(c)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solicitud])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errores.length > 0) setErrores([])
  }

  const handleFileChange = (e) => {
    const nuevos = Array.from(e.target.files || [])
    const total = formData.adjuntos.length + nuevos.length
    
    if (total > 3) {
      setErrores(['Máximo 3 archivos permitidos'])
      e.target.value = ''
      return
    }
    
    setFormData(prev => ({ ...prev, adjuntos: [...prev.adjuntos, ...nuevos] }))
    if (errores.length > 0) setErrores([])
    e.target.value = ''
  }

  const eliminarArchivo = (index) => {
    const archivo = formData.adjuntos[index]
    if (archivo) liberarUrl(archivo)
    setPreviewAbierto((prev) => (prev === archivo ? null : prev))
    setFormData(prev => ({
      ...prev,
      adjuntos: prev.adjuntos.filter((_, i) => i !== index),
    }))
  }

  const handleSelectCliente = (c) => {
    setFormData(prev => ({
      ...prev,
      cliente: c.cliente,
      bodega: c.bodega,
      nit: c.nit,
      zona: c.zona,
    }))
    setClientPickerOpen(false)
    if (errores.length > 0) setErrores([])
  }

  const resetForm = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current.clear()
    setPreviewAbierto(null)
    setFormData({
      nombreCompleto: account?.name || '',
      correo: account?.username || '',
      tipoSolicitud: '',
      cliente: '',
      bodega: '',
      nit: '',
      zona: '',
      adjuntos: [],
      observaciones: '',
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (vencida) {
      setErrores(['El tiempo de 5 minutos para corregir esta solicitud venció. Debes crear una solicitud nueva.'])
      return
    }

    const obligatorios = [
      { campo: 'nombreCompleto', etiqueta: 'Nombre completo' },
      { campo: 'correo', etiqueta: 'Correo' },
      { campo: 'tipoSolicitud', etiqueta: 'Tipo de solicitud' },
      { campo: 'cliente', etiqueta: 'Cliente' },
      { campo: 'bodega', etiqueta: 'Bodega' },
      { campo: 'nit', etiqueta: 'NIT' },
      { campo: 'zona', etiqueta: 'Zona' },
      { campo: 'adjuntos', etiqueta: 'Adjuntos' },
    ]

    const faltantes = obligatorios
      .filter((f) => {
        const v = formData[f.campo]
        if (Array.isArray(v)) return v.length === 0
        return !v || `${v}`.trim() === ''
      })
      .map((f) => f.etiqueta)

    if (faltantes.length > 0) {
      setErrores(faltantes)
      return
    }

    setErrores([])
    setLoading(true)

    if (modoEdicion) {
      // En edición los adjuntos pueden ser URLs ya subidas (string) y/o archivos
      // nuevos (File). Solo se suben a OneDrive los archivos nuevos.
      const existentes = formData.adjuntos.filter((a) => esUrlAdjunto(a))
      const nuevos = formData.adjuntos.filter((a) => !esUrlAdjunto(a))
      let urlsNuevas = []
      if (nuevos.length > 0) {
        try {
          setSubiendoMsg(`Subiendo ${nuevos.length} archivo(s) a OneDrive…`)
          const subidos = await subirAdjuntosOneDrive(nuevos, formData.nombreCompleto, solicitud.id)
          urlsNuevas = subidos.map((s) => s.url).filter(Boolean)
          documentosSubidos({ id: solicitud.id, nombres: nuevos.map((f) => f.name) })
          setSubiendoMsg('')
        } catch (err) {
          console.error('[SolicitudModal] error subiendo a OneDrive (edición):', err)
          setSubiendoMsg('')
          setLoading(false)
          setErrores([`Error subiendo archivos: ${err.message}`])
          notificarErrorSubida(err.message, solicitud.id)
          return
        }
      }
      if (onEditSubmit) {
        onEditSubmit(solicitud.id, {
          tipoSolicitud: formData.tipoSolicitud,
          observaciones: formData.observaciones,
          adjuntos: [...existentes, ...urlsNuevas],
          ...(corregirCliente
            ? {
                cliente: formData.cliente,
                bodega: formData.bodega,
                nit: formData.nit,
                zona: formData.zona,
              }
            : {}),
        })
      }
      resetForm()
      onClose()
      return
    }

    // Se reserva el código ahora (avanza la secuencia una sola vez): es el ID
    // autoritativo que usan OneDrive y el guardado final. Sin backend/conexión
    // se usa el número visible (derivación local).
    const idSolicitud = (await reservarProximoCodigo()) || siguiente
    let adjuntosUrls = []

    try {
      setSubiendoMsg(`Subiendo ${formData.adjuntos.length} archivo(s) a OneDrive…`)
      const subidos = await subirAdjuntosOneDrive(
        formData.adjuntos,
        formData.nombreCompleto,
        idSolicitud,
      )
      adjuntosUrls = subidos.map((s) => s.url).filter(Boolean)
      documentosSubidos({ id: idSolicitud, nombres: formData.adjuntos.map((f) => f.name) })
      setSubiendoMsg('')
    } catch (err) {
      console.error('[SolicitudModal] error subiendo a OneDrive:', err)
      setSubiendoMsg('')
      setLoading(false)
      setErrores([`Error subiendo archivos: ${err.message}`])
      notificarErrorSubida(err.message, idSolicitud)
      return
    }

    if (onSubmit) {
      onSubmit({ ...formData, adjuntos: adjuntosUrls }, idSolicitud)
    }
    resetForm()
    onClose()
  }

  if (!open) return null

  const siguienteId = modoEdicion ? solicitud.id : siguiente

  return (
    <>
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-2xl rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={modoEdicion ? 'Editar solicitud' : 'Nueva solicitud'}
      >
        {/* Header del modal */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <MdSend className="text-brand-cyan" />
            {modoEdicion ? 'EDITAR SOLICITUD' : 'NUEVA SOLICITUD'}
          </h3>
          <div className="flex items-center gap-2">
            <span
              title={modoEdicion ? 'Número de la solicitud' : 'Número de la siguiente solicitud'}
              className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
              <MdTag className="text-xs sm:text-sm" />
              {siguienteId}
            </span>
            <button
              aria-label="Cerrar"
              onClick={handleClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Cuerpo del formulario */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {modoEdicion && vencida ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-800">
              <p className="inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-[11px] text-red-700">
                <MdCancel className="text-base" />
                Tiempo de corrección vencido
              </p>
              <p className="mt-1 font-medium text-red-800/90">
                Pasaron los 5 minutos para corregir esta solicitud. Ya no se puede editar:
                debes montar una solicitud nueva.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onCrearNueva) onCrearNueva()
                  handleClose()
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-red-700 hover:-translate-y-0.5 transition-all"
              >
                <MdAddCircleOutline className="text-lg" />
                Crear solicitud nueva
              </button>
            </div>
          ) : modoEdicion && (
            <div className="rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-3 py-2.5 text-sm text-fuchsia-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-[11px]">
                  <MdAssignmentReturn className="text-base" />
                  Solicitud devuelta — corrige y reenvía
                </p>
                <CuentaRegresivaDevolucion solicitud={solicitud} ahora={ahora} />
              </div>
              {etiquetasCorregir.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-fuchsia-700/80">
                    Debes corregir:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {etiquetasCorregir.map((et) => (
                      <span
                        key={et}
                        className="inline-flex items-center gap-1 rounded-full bg-fuchsia-600/15 ring-1 ring-fuchsia-400/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-fuchsia-800"
                      >
                        <MdCheck className="text-sm" />
                        {et}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {textoMotivo ? (
                <p className="mt-1.5 font-semibold">Motivo: {textoMotivo}</p>
              ) : (
                <p className="mt-1 font-medium text-fuchsia-700/80">Revisa los datos y vuelve a enviar la solicitud.</p>
              )}
              <p className="mt-1 text-xs text-fuchsia-700/70">
                {corregirCliente
                  ? 'Puedes editar el cliente, el tipo de solicitud, las observaciones y los adjuntos. Al guardar volverá a estado Abierto.'
                  : 'Puedes editar el tipo de solicitud, las observaciones y los adjuntos. Al guardar volverá a estado Abierto.'}
              </p>
            </div>
          )}
          {errores.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2"
            >
              <span className="font-extrabold whitespace-nowrap">Faltan campos obligatorios:</span>
              <span className="font-medium">{errores.join(' · ')}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField
              label="Nombre Completo"
              type="text"
              name="nombreCompleto"
              value={formData.nombreCompleto}
              onChange={handleInputChange}
              placeholder="Nombre completo"
              required
              readOnly
              icon={<MdPerson className="text-sm" />}
            />
            <FormField
              label="Correo"
              type="email"
              name="correo"
              value={formData.correo}
              onChange={handleInputChange}
              placeholder="correo@CTP.com"
              required
              readOnly
              icon={<MdEmail className="text-sm" />}
            />
            <FormField
              label="Tipo de solicitud"
              type="select"
              name="tipoSolicitud"
              value={formData.tipoSolicitud}
              onChange={handleInputChange}
              placeholder="Tipo"
              options={TIPO_SOLICITUD_OPTIONS}
              required
              icon={<MdAssignmentAdd className="text-sm" />}
              invalid={errores.includes('Tipo de solicitud')}
            />
            <div className="relative">
              <FormField
                label="Cliente"
                type="text"
                name="cliente"
                value={formData.cliente}
                onChange={handleInputChange}
                placeholder="Nombre del cliente"
                required
                readOnly
                icon={<MdBusiness className="text-sm" />}
                invalid={errores.includes('Cliente')}
              />
              {(!modoEdicion || corregirCliente) && (
                <button
                  type="button"
                  onClick={() => setClientPickerOpen(true)}
                  title="Buscar y seleccionar cliente"
                  aria-label="Seleccionar cliente"
                  className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                >
                  <MdSearch className="text-lg" />
                </button>
              )}
            </div>
            <FormField
              label="Bodega"
              type="text"
              name="bodega"
              value={formData.bodega}
              onChange={handleInputChange}
              placeholder="Bodega del cliente"
              required
              readOnly
              icon={<MdWarehouse className="text-sm" />}
              invalid={errores.includes('Bodega')}
            />
            <FormField
              label="NIT"
              type="text"
              name="nit"
              value={formData.nit}
              onChange={handleInputChange}
              placeholder="NIT del cliente"
              required
              readOnly
              icon={<MdTag className="text-sm" />}
              invalid={errores.includes('NIT')}
            />
          </div>

          <FormField
            label="Zona"
            type="text"
            name="zona"
            value={formData.zona}
            onChange={handleInputChange}
            placeholder="Zona (se llena al seleccionar el cliente)"
            required
            readOnly
            icon={<MdPlace className="text-sm" />}
            invalid={errores.includes('Zona')}
          />

          {/* Adjuntos */}
          <div>
            <label className="block text-sm font-semibold text-brand-deep mb-1.5">
              Adjuntos {formData.adjuntos.length > 0 && <span className="text-brand-cyan">({formData.adjuntos.length}/3)</span>}
            </label>
            {formData.adjuntos.length < 3 && (
              <label className="flex flex-col items-center justify-center gap-2 w-full px-4 py-5 border-2 border-dashed border-brand-ink/25 rounded-xl bg-brand-mist/30 text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
                <MdCloudUpload className="text-3xl text-brand-cyan" />
                <span className="text-sm font-medium">Haz clic para adjuntar archivos</span>
                <span className="text-xs text-brand-ink/50">PDF, imágenes, Excel — mínimo 1, máximo 3 archivos</span>
                <input type="file" name="adjuntos" multiple onChange={handleFileChange} className="hidden" accept="image/*,.pdf,.xls,.xlsx,.doc,.docx" />
              </label>
            )}

            {formData.adjuntos.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.adjuntos.map((archivo, i) => {
                  const esUrl = esUrlAdjunto(archivo)
                  const nombre = nombreAdjunto(archivo)
                  const abierto = previewAbierto === archivo
                  const puedePrevisualizar = !esUrl && (esImagen(archivo) || esPdf(archivo))
                  return (
                    <div key={i} className="rounded-lg bg-brand-mist/50 border border-brand-ink/10 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{iconoArchivo(archivo)}</span>
                          <span className="min-w-0">
                            <span className="block text-sm text-brand-ink truncate">{nombre}</span>
                            <span className="block text-[11px] text-brand-ink/50">
                              {esUrl ? 'Ya subido a OneDrive' : formatearBytes(archivo.size)}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {esUrl ? (
                            <a
                              href={archivo}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${nombre}`}
                              title="Abrir archivo"
                              className="grid place-items-center size-7 rounded-full text-brand-deep bg-brand-cyan/15 hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                            >
                              <MdOpenInNew className="text-lg" />
                            </a>
                          ) : (
                            puedePrevisualizar && (
                              <button
                                type="button"
                                onClick={() => setPreviewAbierto(abierto ? null : archivo)}
                                aria-label={abierto ? `Ocultar vista previa de ${nombre}` : `Ver vista previa de ${nombre}`}
                                title={abierto ? 'Ocultar vista previa' : 'Ver vista previa'}
                                className="grid place-items-center size-7 rounded-full text-brand-deep bg-brand-cyan/15 hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                              >
                                <MdVisibility className="text-lg" />
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => eliminarArchivo(i)}
                            aria-label={`Eliminar ${nombre}`}
                            title="Eliminar archivo"
                            className="grid place-items-center size-7 rounded-full text-brand-ink/50 hover:bg-red-100 hover:text-red-600 transition-colors"
                          >
                            <MdCancel className="text-lg" />
                          </button>
                        </div>
                      </div>
                      {abierto && puedePrevisualizar && (
                        esImagen(archivo) ? (
                          <img
                            src={urlPara(archivo)}
                            alt={`Vista previa de ${nombre}`}
                            className="w-full max-h-72 object-contain border-t border-brand-ink/10 bg-brand-ink/5"
                          />
                        ) : (
                          <object
                            data={urlPara(archivo)}
                            type="application/pdf"
                            aria-label={`Vista previa de ${nombre}`}
                            className="w-full h-64 border-t border-brand-ink/10 bg-brand-ink/5"
                          >
                            <p className="p-3 text-xs text-brand-ink/60">
                              Tu navegador no muestra la vista previa.{' '}
                              <a className="font-bold text-brand-deep underline" href={urlPara(archivo)} target="_blank" rel="noopener noreferrer">Abrir PDF</a>.
                            </p>
                          </object>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="relative">
            <textarea
              name="observaciones"
              value={formData.observaciones}
              onChange={(e) =>
                handleInputChange({
                  target: { name: 'observaciones', value: e.target.value.toUpperCase() },
                })
              }
              rows={3}
              placeholder=" "
              className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent resize-y uppercase"
            />
            <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
              formData.observaciones ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
            } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}>
              <span className="shrink-0 text-brand-deep"><MdNotes className="text-sm" /></span>
              <span>Observaciones</span>
            </label>
          </div>

          {/* Pie del modal */}
          <div className="pt-1 flex items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || vencida}
              className="group inline-flex items-center rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <img
                src="/Principal/PRY-590.png"
                alt="Truck"
                className="w-6 h-6 object-contain transition-all duration-500 ease-out group-hover:translate-x-2 group-hover:scale-110 group-hover:drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] group-hover:animate-truckMove"
              />
              <span className="font-bold tracking-wide text-brand-ink">{modoEdicion ? 'GUARDAR CAMBIOS' : 'GUARDAR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

      {loading && (
        <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
          <Loader />
          {subiendoMsg && (
            <p className="text-white text-sm font-semibold animate-pulse">{subiendoMsg}</p>
          )}
        </div>
      )}

      <ClientPickerModal
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        onSelect={handleSelectCliente}
      />
    </>
  )
}
