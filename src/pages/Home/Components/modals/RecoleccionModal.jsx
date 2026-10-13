import { useEffect, useMemo, useState } from 'react'
import {
  MdClose, MdPerson, MdEmail, MdPlace, MdNotes, MdCloudUpload, MdCancel,
  MdStorefront, MdEvent, MdAccessTime, MdSupportAgent, MdWarehouse, MdBadge,
  MdSearch, MdAssignmentAdd, MdErrorOutline,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import FormField from '../FormField.jsx'
import Loader from '../../../../loader/Loader.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'
import { useAuth } from '../../../../auth/AuthContext.jsx'
import { crearRecoleccion, peekCodigoRecoleccion } from '../../../../services/recoleccionesApi.js'
import { recoleccionCreada, errorRecoleccion } from '../../../../services/notificaciones.jsx'

function formatearBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ahora() {
  const now = new Date()
  return {
    fecha: now.toLocaleDateString('es-CO'),
    hora: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  }
}

const FORM_VACIO = {
  fecha_subida: '',
  hora_subida: '',
  nombre_completo: '',
  correo: '',
  zona: '',
  recoge_cliente: '',
  recoge_nit: '',
  recoge_bodega: '',
  fecha_recoleccion: '',
  hora_recoleccion: '',
  que_recogemos: '',
  observaciones: '',
  persona_contacto: '',
  entrega_cliente: '',
  entrega_nit: '',
  entrega_bodega: '',
}

export default function RecoleccionModal({ open, onClose, onCreated }) {
  const { account } = useAuth()
  const [formData, setFormData] = useState(FORM_VACIO)
  const [archivos, setArchivos] = useState([])
  const [picker, setPicker] = useState(null) // 'recoge' | 'entrega'
  const [errores, setErrores] = useState([])
  const [errorServidor, setErrorServidor] = useState('')
  const [loading, setLoading] = useState(false)
  const [siguiente, setSiguiente] = useState('')

  useEffect(() => {
    if (!open) return
    const { fecha, hora } = ahora()
    setFormData({
      ...FORM_VACIO,
      fecha_subida: fecha,
      hora_subida: hora,
      nombre_completo: account?.name || '',
      correo: account?.username || '',
    })
    setArchivos([])
    setErrores([])
    setErrorServidor('')
    setLoading(false)
    setSiguiente('')
    void peekCodigoRecoleccion().then((c) => setSiguiente(c || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errores.length > 0) setErrores([])
    if (errorServidor) setErrorServidor('')
  }

  const handleSelectCliente = (c) => {
    if (picker === 'recoge') {
      setFormData((prev) => ({
        ...prev,
        recoge_cliente: c.cliente,
        recoge_nit: c.nit,
        recoge_bodega: c.bodega,
        // La zona se autocompleta con la del cliente que se recoge.
        zona: c.zona || prev.zona,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        entrega_cliente: c.cliente,
        entrega_nit: c.nit,
        entrega_bodega: c.bodega,
      }))
    }
    if (errores.length > 0) setErrores([])
  }

  const handleFileChange = (e) => {
    const nuevos = Array.from(e.target.files || [])
    if (archivos.length + nuevos.length > 3) {
      setErrores(['Máximo 3 archivos permitidos'])
      e.target.value = ''
      return
    }
    setArchivos((prev) => [...prev, ...nuevos])
    if (errores.length > 0) setErrores([])
    e.target.value = ''
  }

  const eliminarArchivo = (index) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index))
  }

  const validar = () => {
    const faltan = []
    if (!formData.recoge_cliente.trim()) faltan.push('¿Dónde vamos a recoger?')
    if (!formData.fecha_recoleccion.trim()) faltan.push('Fecha de recolección')
    if (!formData.que_recogemos.trim()) faltan.push('Qué recogemos')
    return faltan
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const faltan = validar()
    if (faltan.length > 0) {
      setErrores(faltan)
      return
    }
    setLoading(true)
    setErrorServidor('')
    const { fecha, hora } = ahora()
    try {
      const data = await crearRecoleccion(
        { ...formData, fecha_subida: fecha, hora_subida: hora },
        archivos
      )
      setLoading(false)
      recoleccionCreada(data)
      onCreated?.(data)
      onClose?.()
    } catch (error) {
      console.error('[Recolección] error creando:', error)
      setErrorServidor(error?.message || 'No se pudo guardar la recolección')
      errorRecoleccion(error?.message)
      setLoading(false)
    }
  }

  const puedeAdjuntar = archivos.length < 3
  const tituloCodigo = useMemo(() => siguiente || 'Automático', [siguiente])

  if (!open) return null

  return (
    <>
      <Modal onClose={loading ? undefined : onClose}>
        <div
          className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Nueva recolección"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
            <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
              <span className="grid place-items-center size-9 rounded-full bg-white/10">
                <MdStorefront className="text-lg" />
              </span>
              NUEVA RECOLECCIÓN
            </h3>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              disabled={loading}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
            >
              <MdClose className="text-lg" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
              {errorServidor && (
                <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
                  <MdErrorOutline className="text-lg shrink-0" />
                  <span className="font-medium">{errorServidor}</span>
                </div>
              )}
              {errores.length > 0 && (
                <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
                  <span className="font-extrabold whitespace-nowrap">Faltan campos obligatorios:</span>
                  <span className="font-medium">{errores.join(' · ')}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label="Id"
                  type="text"
                  name="codigo"
                  value={tituloCodigo}
                  onChange={() => {}}
                  placeholder="Automático"
                  readOnly
                  icon={<MdAssignmentAdd className="text-sm" />}
                />
                <FormField
                  label="Fecha y hora"
                  type="text"
                  name="subida"
                  value={`${formData.fecha_subida} · ${formData.hora_subida}`}
                  onChange={() => {}}
                  placeholder="Automática"
                  readOnly
                  icon={<MdEvent className="text-sm" />}
                />
                <FormField
                  label="Nombre Completo"
                  type="text"
                  name="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={() => {}}
                  placeholder="Nombre completo"
                  readOnly
                  icon={<MdPerson className="text-sm" />}
                />
                <FormField
                  label="Correo"
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={() => {}}
                  placeholder="correo@CTP.com"
                  readOnly
                  icon={<MdEmail className="text-sm" />}
                />
              </div>

              {/* Bloque: dónde recogemos */}
              <div className="rounded-2xl border border-brand-deep/15 bg-brand-mist/30 p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2">
                  <MdStorefront /> Datos de la recolección
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative">
                    <FormField
                      label="¿Dónde vamos a recoger?"
                      type="text"
                      name="recoge_cliente"
                      value={formData.recoge_cliente}
                      onChange={() => {}}
                      placeholder="Selecciona el cliente"
                      required
                      readOnly
                      icon={<MdStorefront className="text-sm" />}
                      invalid={errores.includes('¿Dónde vamos a recoger?')}
                    />
                    <button
                      type="button"
                      onClick={() => setPicker('recoge')}
                      title="Buscar cliente"
                      aria-label="Buscar cliente a recoger"
                      className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                    >
                      <MdSearch className="text-lg" />
                    </button>
                  </div>
                  <FormField
                    label="Zona"
                    type="text"
                    name="zona"
                    value={formData.zona}
                    onChange={() => {}}
                    placeholder="Se completa con el cliente"
                    readOnly
                    icon={<MdPlace className="text-sm" />}
                  />
                  <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                    <FormField
                      label="Fecha de recolección"
                      type="date"
                      name="fecha_recoleccion"
                      value={formData.fecha_recoleccion}
                      onChange={handleChange}
                      icon={<MdEvent className="text-sm" />}
                      invalid={errores.includes('Fecha de recolección')}
                    />
                    <FormField
                      label="Hora de recolección"
                      type="time"
                      name="hora_recoleccion"
                      value={formData.hora_recoleccion}
                      onChange={handleChange}
                      icon={<MdAccessTime className="text-sm" />}
                    />
                  </div>
                  <FormField
                    label="Persona de contacto"
                    type="text"
                    name="persona_contacto"
                    value={formData.persona_contacto}
                    onChange={handleChange}
                    placeholder="Quién nos atiende"
                    icon={<MdSupportAgent className="text-sm" />}
                  />
                </div>

                <div className="relative">
                  <textarea
                    name="que_recogemos"
                    value={formData.que_recogemos}
                    onChange={(e) => handleChange({ target: { name: 'que_recogemos', value: e.target.value } })}
                    rows={3}
                    placeholder=" "
                    className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent resize-y"
                  />
                  <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                    formData.que_recogemos ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
                  } peer-focus:-top-2 text-[0.7rem] peer-focus:text-brand-deep`}>
                    <span className="shrink-0 text-brand-deep"><MdNotes className="text-sm" /></span>
                    <span>Qué recogemos <span className="text-red-500">*</span></span>
                  </label>
                </div>
              </div>

              {/* Bloque: dónde entregamos */}
              <div className="rounded-2xl border border-brand-deep/15 bg-brand-mist/30 p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2">
                  <MdWarehouse /> Dónde entregamos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative">
                    <FormField
                      label="¿Dónde entregamos?"
                      type="text"
                      name="entrega_cliente"
                      value={formData.entrega_cliente}
                      onChange={() => {}}
                      placeholder="Selecciona el cliente"
                      readOnly
                      icon={<MdWarehouse className="text-sm" />}
                    />
                    <button
                      type="button"
                      onClick={() => setPicker('entrega')}
                      title="Buscar cliente"
                      aria-label="Buscar cliente de entrega"
                      className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                    >
                      <MdSearch className="text-lg" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="NIT"
                      type="text"
                      name="entrega_nit"
                      value={formData.entrega_nit}
                      onChange={() => {}}
                      readOnly
                      icon={<MdBadge className="text-sm" />}
                    />
                    <FormField
                      label="Bodega"
                      type="text"
                      name="entrega_bodega"
                      value={formData.entrega_bodega}
                      onChange={() => {}}
                      readOnly
                      icon={<MdWarehouse className="text-sm" />}
                    />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div className="relative">
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => handleChange({ target: { name: 'observaciones', value: e.target.value } })}
                  rows={3}
                  placeholder=" "
                  className="peer w-full px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:shadow-none transition-all text-brand-ink placeholder-transparent resize-y"
                />
                <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
                  formData.observaciones ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
                } peer-focus:-top-2 text-[0.7rem] peer-focus:text-brand-deep`}>
                  <span className="shrink-0 text-brand-deep"><MdNotes className="text-sm" /></span>
                  <span>Instrucción especial / observaciones</span>
                </label>
              </div>

              {/* Adjuntos */}
              <div>
                <label className="block text-sm font-semibold text-brand-deep mb-1.5">
                  Adjuntos{' '}
                  <span className="text-xs font-medium text-brand-ink/50">(opcional)</span>
                  {archivos.length > 0 && <span className="text-brand-cyan"> ({archivos.length}/3)</span>}
                </label>
                {puedeAdjuntar && (
                  <label className="flex flex-col items-center justify-center gap-2 w-full px-4 py-5 border-2 border-dashed border-brand-ink/25 rounded-xl bg-brand-mist/30 text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
                    <MdCloudUpload className="text-3xl text-brand-cyan" />
                    <span className="text-sm font-medium">Haz clic para adjuntar archivos</span>
                    <span className="text-xs text-brand-ink/50">Máximo 3 archivos</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,.pdf,.xls,.xlsx,.doc,.docx"
                    />
                  </label>
                )}
                {archivos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {archivos.map((archivo, i) => (
                      <div
                        key={`${archivo.name}-${archivo.size}-${i}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-brand-mist/50 border border-brand-ink/10"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm text-brand-ink truncate">{archivo.name}</span>
                          <span className="block text-[11px] text-brand-ink/50">{formatearBytes(archivo.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarArchivo(i)}
                          aria-label={`Eliminar ${archivo.name}`}
                          title="Eliminar archivo"
                          className="grid place-items-center size-7 shrink-0 rounded-full text-brand-ink/50 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <MdCancel className="text-lg" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pie */}
            <div className="shrink-0 border-t border-brand-ink/10 px-4 sm:px-6 py-3 flex items-center justify-end gap-2 sm:gap-3 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <MdStorefront className="text-lg" />
                GUARDAR
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {loading && (
        <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
          <Loader />
        </div>
      )}

      <ClientPickerModal
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={handleSelectCliente}
      />
    </>
  )
}
