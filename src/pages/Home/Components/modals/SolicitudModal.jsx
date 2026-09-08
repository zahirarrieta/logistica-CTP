import { useState } from 'react'
import { MdClose, MdCloudUpload, MdSearch, MdSend, MdTag, MdPerson, MdEmail, MdAssignmentAdd, MdBusiness, MdWarehouse, MdPlace, MdNotes } from 'react-icons/md'
import FormField from '../FormField.jsx'
import Loader from '../../../../loader/Loader.jsx'
import { peekNextId } from '../solicitudesStore.js'
import { useAuth } from '../../../../auth/AuthContext.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'

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

export default function SolicitudModal({ open, onClose, onSubmit }) {
  const { account } = useAuth()
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errores.length > 0) setErrores([])
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({ ...prev, adjuntos: files }))
    if (errores.length > 0) setErrores([])
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
    // Simular envío del formulario
    await new Promise(resolve => setTimeout(resolve, 1200))
    setLoading(false)
    if (onSubmit) {
      onSubmit({ ...formData, adjuntos: formData.adjuntos.map(f => f.name) })
    }
    resetForm()
    onClose()
  }

  if (!open) return null

  const siguienteId = peekNextId()

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
        aria-label="Nueva solicitud"
      >
        {/* Header del modal */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <MdSend className="text-brand-cyan" />
            NUEVA SOLICITUD
          </h3>
          <div className="flex items-center gap-2">
            <span
              title="Número de la siguiente solicitud"
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
              icon={<MdPerson className="text-xs" />}
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
              icon={<MdEmail className="text-xs" />}
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
              icon={<MdAssignmentAdd className="text-xs" />}
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
                icon={<MdBusiness className="text-xs" />}
                invalid={errores.includes('Cliente')}
              />
              <button
                type="button"
                onClick={() => setClientPickerOpen(true)}
                title="Buscar y seleccionar cliente"
                aria-label="Seleccionar cliente"
                className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
              >
                <MdSearch className="text-lg" />
              </button>
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
              icon={<MdWarehouse className="text-xs" />}
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
              icon={<MdTag className="text-xs" />}
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
            icon={<MdPlace className="text-xs" />}
            invalid={errores.includes('Zona')}
          />

          {/* Adjuntos */}
          <div>
            <label className="block text-sm font-semibold text-brand-deep mb-1.5">Adjuntos</label>
            <label className="flex flex-col items-center justify-center gap-2 w-full px-4 py-5 border-2 border-dashed border-brand-ink/25 rounded-xl bg-brand-mist/30 text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
              <MdCloudUpload className="text-3xl text-brand-cyan" />
              <span className="text-sm font-medium">Haz clic para adjuntar archivos</span>
              <span className="text-xs text-brand-ink/50">
                {formData.adjuntos.length > 0
                  ? `${formData.adjuntos.length} archivo(s) seleccionado(s)`
                  : 'PDF, imágenes u otros documentos'}
              </span>
              <input type="file" name="adjuntos" multiple onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {/* Observaciones */}
          <div className="relative">
            <textarea
              name="observaciones"
              value={formData.observaciones}
              onChange={handleInputChange}
              rows={3}
              placeholder=" "
              className="peer w-full px-3 py-2 rounded-md bg-white border border-brand-deep/20 focus:outline-none focus:border-brand-deep/60 focus:ring-2 focus:ring-brand-deep/15 text-brand-ink placeholder-transparent resize-y"
            />
            <label className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
              formData.observaciones ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2 text-[0.78rem] text-brand-ink'
            } peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep`}>
              <span className="shrink-0 text-brand-deep"><MdNotes className="text-xs" /></span>
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
              disabled={loading}
              className="group inline-flex items-center rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <img
                src="/Principal/PRY-590.png"
                alt="Truck"
                className="w-6 h-6 object-contain transition-all duration-500 ease-out group-hover:translate-x-2 group-hover:scale-110 group-hover:drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] group-hover:animate-truckMove"
              />
              <span className="font-bold tracking-wide text-brand-ink">GUARDAR</span>
            </button>
          </div>
        </form>
      </div>
    </div>

      {loading && <Loader />}

      <ClientPickerModal
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        onSelect={handleSelectCliente}
      />
    </>
  )
}
