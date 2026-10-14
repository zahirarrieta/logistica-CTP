import { useEffect, useMemo, useState } from 'react'
import {
  MdClose, MdPerson, MdEmail, MdPlace, MdNotes, MdCloudUpload, MdCancel,
  MdStorefront, MdEvent, MdAccessTime, MdSupportAgent, MdWarehouse, MdCategory,
  MdSearch, MdPhone, MdTag, MdErrorOutline, MdBusiness, MdInventory2, MdFactCheck,
  MdLocalShipping, MdDelete, MdAssignmentInd, MdPersonAdd,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import FormField from '../FormField.jsx'
import Loader from '../../../../loader/Loader.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'
import ArticulosBodegaModal from './ArticulosBodegaModal.jsx'
import AsignarUsuarioModal from '../../../Administrador/Components/modals/AsignarUsuarioModal.jsx'
import { useAuth } from '../../../../auth/AuthContext.jsx'
import { crearRecoleccion, peekCodigoRecoleccion, peekCodigoRecoleccionSync } from '../../../../services/recoleccionesApi.js'
import { cargarClientes } from '../../../../services/solicitudesApi.js'
import { recoleccionCreada, errorRecoleccion } from '../../../../services/notificaciones.jsx'
import { registrarRecoleccionCreada } from '../../../../store/recoleccionesStore.js'

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

// Zona del servicio y sus tipos. La zona es manual (BOGOTÁ / NACIONAL) y decide
// qué tipos de servicio se pueden elegir; al cambiar de zona se limpia el tipo.
const OPCIONES_ZONA = [
  { value: 'BOGOTÁ', label: 'BOGOTÁ' },
  { value: 'NACIONAL', label: 'NACIONAL' },
]

const TIPOS_POR_ZONA = {
  BOGOTÁ: ['MARKETING', 'MALETAS', 'ESPECIAL', 'DISPOSITIVOS'],
  NACIONAL: ['24-HORAS', 'ESPECIAL', 'AEROPUERTO', 'TERMINAL', 'MARKETING'],
}

// Texto del error de la casilla del Reglamento: se compara por igualdad en el
// bloque de la declaración para pintarlo en rojo.
const FALTA_DECLARACION = 'Debes aceptar la declaración del Reglamento Interno'

// Error del responsable: es obligatorio, se elige con el modal «Asignar a».
const FALTA_RESPONSABLE = 'Debes asignar un responsable a la recolección'

// Etiquetas de los campos obligatorios, agrupadas por bloque y en el orden en
// que aparecen en el formulario. Sirven a la vez para validar, para el listado
// de errores del encabezado y para pintar en rojo cada campo y su bloque.
const CAMPOS_SOLICITANTE = ['Nombre del solicitante', 'Correo del solicitante']
const CAMPOS_RECOGIDA = [
  '¿Dónde vamos a recoger?',
  'Bodega de recogida',
  'Zona',
  'Tipo de Servicio',
  'Fecha de recolección',
  'Hora de recolección',
  'Persona de contacto',
  'Teléfono de contacto',
  'Qué recogemos',
]
const CAMPOS_ENTREGA = ['¿Dónde entregamos?', 'Bodega de entrega']
const CAMPOS_OBSERVACIONES = ['Observaciones']

// Todo es obligatorio hasta «Observaciones»; los adjuntos no lo son.
const CAMPOS_OBLIGATORIOS = [
  ...CAMPOS_SOLICITANTE,
  ...CAMPOS_RECOGIDA,
  ...CAMPOS_ENTREGA,
  ...CAMPOS_OBSERVACIONES,
]

// Parsear el texto de «Qué recogemos» a array de artículos.
// Formato esperado: "cantidad · ARTÍCULO · DESCRIPCIÓN · Lote LOTE" (una línea por artículo)
function parsearArticulosQueRecogemos(texto) {
  if (!texto || !texto.trim()) return []
  const lineas = texto.trim().split('\n')
  const articulos = []
  for (const linea of lineas) {
    const partes = linea.split(' · ')
    if (partes.length >= 2) {
      const cantidad = parseInt(partes[0].trim(), 10)
      const articulo = partes[1].trim()
      const descripcion = partes.length >= 3 ? partes[2].trim() : ''
      const lote = partes.length >= 4 ? partes[3].trim() : ''
      if (!isNaN(cantidad) && cantidad > 0 && articulo) {
        articulos.push({ cantidad, articulo, descripcion, lote })
      }
    }
  }
  return articulos
}

// Serializar array de artículos al formato de texto para el backend.
function serializarArticulosQueRecogemos(articulos) {
  return articulos
    .map((a) => {
      const base = `${a.cantidad} · ${a.articulo}`
      const conDesc = a.descripcion ? `${base} · ${a.descripcion}` : base
      return a.lote ? `${conDesc} · Lote ${a.lote}` : conDesc
    })
    .join('\n')
}

// Mini tabla de artículos seleccionados en «Qué recogemos».
function TablaArticulosQueRecogemos({ articulos, onEliminar }) {
  if (!articulos.length) return null
  return (
    <div className="mt-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 overflow-hidden">
      <div className="px-3 py-2 bg-brand-cyan/15 border-b border-brand-cyan/30">
        <p className="text-xs font-extrabold uppercase tracking-wide text-brand-deep inline-flex items-center gap-1.5">
          <MdInventory2 className="text-brand-cyan text-sm" />
          Artículos seleccionados ({articulos.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-brand-navy text-white uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-2 py-1.5 text-left font-extrabold border-r border-white/15">Artículo</th>
              <th className="px-2 py-1.5 text-left font-extrabold border-r border-white/15">Descripción</th>
              <th className="px-2 py-1.5 text-center font-extrabold border-r border-white/15 whitespace-nowrap">Lote</th>
              <th className="px-2 py-1.5 text-right font-extrabold border-r border-white/15 whitespace-nowrap">Cant.</th>
              <th className="px-2 py-1.5 text-center font-extrabold whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((a, i) => (
              <tr key={i} className={`border-b border-brand-ink/5 hover:bg-brand-cyan/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'}`}>
                <td className="px-2 py-1.5 font-bold text-brand-ink whitespace-nowrap">{a.articulo}</td>
                <td className="px-2 py-1.5 text-brand-ink/80 truncate max-w-[200px]">{a.descripcion || '—'}</td>
                <td className="px-2 py-1.5 text-center text-brand-ink/70 whitespace-nowrap">{a.lote || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-bold text-brand-ink">{a.cantidad}</td>
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onEliminar(i)}
                    title="Eliminar"
                    className="grid place-items-center size-6 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"
                  >
                    <MdDelete className="text-xs" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const FORM_VACIO = {
  fecha_subida: '',
  hora_subida: '',
  nombre_completo: '',
  correo: '',
  zona: '',
  tipo_servicio: '',
  recoge_cliente: '',
  recoge_nit: '',
  recoge_bodega: '',
  fecha_recoleccion: '',
  hora_recoleccion: '',
  que_recogemos: '',
  observaciones: '',
  persona_contacto: '',
  telefono_contacto: '',
  entrega_cliente: '',
  entrega_nit: '',
  entrega_bodega: '',
  asignado_a: '',
  asignado_correo: '',
}

// Tarjeta con encabezado e ícono que agrupa los campos de una etapa del
// formulario (Solicitante, Recogida, Entrega…). `invalid` la pinta en rojo
// cuando falta algo obligatorio de ese bloque.
function Bloque({ titulo, icono, opcional = false, requerido = false, invalid = false, children }) {
  return (
    <section
      className={`rounded-2xl border p-4 space-y-3.5 ${
        invalid ? 'border-red-300 bg-red-50' : 'border-brand-deep/15 bg-brand-mist/30'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-brand-deep/10 pb-2.5">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2 min-w-0">
          <span
            className={`grid place-items-center size-7 rounded-lg shrink-0 ${
              invalid ? 'bg-red-100 text-red-600' : 'bg-brand-cyan/15 text-brand-deep'
            }`}
          >
            {icono}
          </span>
          <span className="truncate">
            {titulo}
            {requerido && <span className="text-red-500 ml-1">*</span>}
          </span>
        </h4>
        {opcional && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-ink/45 shrink-0">
            Opcional
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

// Área de texto con la misma etiqueta flotante de FormField (que solo cubre
// inputs), para «Qué recogemos» y «Observaciones».
function AreaTexto({ label, name, value, onChange, filas = 3, required = false, invalid = false, pista }) {
  return (
    <div className="relative">
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={filas}
        placeholder=" "
        className={`peer w-full px-3 py-2.5 rounded-xl bg-white border shadow-sm focus:outline-none focus:ring-4 focus:shadow-none transition-all text-brand-ink placeholder-transparent resize-y ${
          invalid
            ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
            : 'border-brand-deep/20 focus:border-brand-deep/60 focus:ring-brand-deep/10'
        }`}
      />
      <label
        className={`pointer-events-none absolute left-2 bg-white px-1 rounded transition-all inline-flex items-center gap-1 ${
          value ? '-top-2 text-[0.7rem] text-brand-ink' : 'top-2.5 text-[0.78rem] text-brand-ink'
        } peer-focus:-top-2 text-[0.7rem] peer-focus:text-brand-deep`}
      >
        <span className="shrink-0 text-brand-deep"><MdNotes className="text-sm" /></span>
        <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      </label>
      {pista && <p className="mt-1 text-[11px] text-brand-ink/50">{pista}</p>}
    </div>
  )
}

export default function RecoleccionModal({ open, onClose, onCreated }) {
  const { account } = useAuth()
  const [formData, setFormData] = useState(FORM_VACIO)
  const [archivos, setArchivos] = useState([])
  const [picker, setPicker] = useState(null) // 'recoge' | 'entrega'
  const [errores, setErrores] = useState([])
  const [errorServidor, setErrorServidor] = useState('')
  const [loading, setLoading] = useState(false)
  const [siguiente, setSiguiente] = useState(() => peekCodigoRecoleccionSync() || '')
  // Catálogo de clientes para el autocompletado de «¿Dónde vamos a recoger?».
  const [catalogoClientes, setCatalogoClientes] = useState([])
  const [listaAbierta, setListaAbierta] = useState(false)
  const [listaAbiertaEntrega, setListaAbiertaEntrega] = useState(false)
  const [articulosOpen, setArticulosOpen] = useState(false)
  // Artículos parseados de «Qué recogemos» (para la mini tabla).
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([])
  // Casilla obligatoria: declaración de aceptación del Reglamento Interno.
  const [aceptaReglamento, setAceptaReglamento] = useState(false)
  // El responsable se elige con el MISMO modal de «Asignar a» que usa el
  // administrador (que para recolecciones ya muestra solo los cuatro nombres del
  // listado cerrado). No se duplica la lista aquí.
  const [asignarOpen, setAsignarOpen] = useState(false)

  // Precarga el próximo código al montar (el modal siempre está montado, aunque
  // cerrado) para que la caché ya esté caliente cuando el usuario lo abra: así el
  // badge muestra el número real de inmediato, igual que en Nueva Solicitud, en
  // vez de un marcador mientras llega la respuesta.
  useEffect(() => {
    void peekCodigoRecoleccion().then((c) => { if (c) setSiguiente(c) })
  }, [])

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
    setAceptaReglamento(false)
    setAsignarOpen(false)
    // Parsear artículos existentes en «Qué recogemos» al abrir.
    setArticulosSeleccionados(parsearArticulosQueRecogemos(formData.que_recogemos || ''))
    // Muestra al instante el último código conocido y lo refresca del servidor.
    setSiguiente(peekCodigoRecoleccionSync() || '')
    void peekCodigoRecoleccion().then((c) => setSiguiente(c || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // El catálogo de clientes se pide una vez por apertura para el autocompletado.
  // Si falla, el campo sigue siendo utilizable: se puede escribir a mano y el
  // botón de la lupa abre el selector completo.
  useEffect(() => {
    if (!open || catalogoClientes.length > 0) return undefined
    let cancelado = false
    cargarClientes()
      .then((data) => {
        if (!cancelado) setCatalogoClientes(data || [])
      })
      .catch((err) => {
        console.error('[Recolección] no se pudo cargar el catálogo de clientes:', err)
      })
    return () => { cancelado = true }
  }, [open, catalogoClientes.length])

  // Sugerencias del cliente mientras se escribe. Se busca en nombre, NIT y
  // bodega porque quien teclea puede usar cualquiera de los tres.
  const sugerencias = useMemo(() => {
    const q = formData.recoge_cliente.trim().toLowerCase()
    if (!q || catalogoClientes.length === 0) return []
    const coincide = (c) =>
      (c.cliente || '').toLowerCase().includes(q) ||
      (c.nit || '').toLowerCase().includes(q) ||
      (c.bodega || '').toLowerCase().includes(q)
    return catalogoClientes.filter(coincide).slice(0, 8)
  }, [catalogoClientes, formData.recoge_cliente])

  // Sugerencias para el cliente de entrega (misma lógica que recogida)
  const sugerenciasEntrega = useMemo(() => {
    const q = formData.entrega_cliente.trim().toLowerCase()
    if (!q || catalogoClientes.length === 0) return []
    const coincide = (c) =>
      (c.cliente || '').toLowerCase().includes(q) ||
      (c.nit || '').toLowerCase().includes(q) ||
      (c.bodega || '').toLowerCase().includes(q)
    return catalogoClientes.filter(coincide).slice(0, 8)
  }, [catalogoClientes, formData.entrega_cliente])

  const handleChange = (e) => {
    const { name, value } = e.target
    // Persona de contacto, teléfono, zona, qué recogemos y observaciones en mayúscula
    const mayusculas = ['persona_contacto', 'telefono_contacto', 'zona', 'que_recogemos', 'observaciones']
    const valor = mayusculas.includes(name) ? value.toUpperCase() : value
    setFormData((prev) => {
      const next = { ...prev, [name]: valor }
      // Al cambiar la zona, el tipo de servicio ya no es válido: se limpia.
      if (name === 'zona' && valor !== prev.zona) next.tipo_servicio = ''
      // Al escribir a mano el cliente de recogida, el NIT y la bodega de la
      // selección anterior dejan de corresponder: se limpian para que el botón
      // «Seleccionar artículos» no filtre por una bodega equivocada.
      if (name === 'recoge_cliente' && valor !== prev.recoge_cliente) {
        next.recoge_nit = ''
        next.recoge_bodega = ''
      }
      // Al escribir a mano el cliente de entrega, limpiar NIT y bodega.
      if (name === 'entrega_cliente' && valor !== prev.entrega_cliente) {
        next.entrega_nit = ''
        next.entrega_bodega = ''
      }
      return next
    })
    // Si se edita manualmente «Qué recogemos» y no hay artículos en la tabla,
    // parsear para mantener la tabla sincronizada.
    if (name === 'que_recogemos' && !articulosSeleccionados.length) {
      setArticulosSeleccionados(parsearArticulosQueRecogemos(valor))
    }
    if (errores.length > 0) setErrores([])
    if (errorServidor) setErrorServidor('')
  }

  // Handler para la mini tabla de artículos: solo eliminar.
  const eliminarArticulo = (index) => {
    setArticulosSeleccionados((prev) => prev.filter((_, i) => i !== index))
  }

  // Sincronizar formData.que_recogemos cuando cambian los artículos de la tabla.
  useEffect(() => {
    if (articulosSeleccionados.length > 0) {
      setFormData((prev) => ({
        ...prev,
        que_recogemos: serializarArticulosQueRecogemos(articulosSeleccionados)
      }))
    }
  }, [articulosSeleccionados])

  const handleSelectCliente = (c) => {
    if (picker === 'recoge') {
      setFormData((prev) => ({
        ...prev,
        recoge_cliente: c.cliente,
        recoge_nit: c.nit,
        recoge_bodega: c.bodega,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        entrega_cliente: c.cliente,
        entrega_nit: c.nit,
        entrega_bodega: c.bodega,
      }))
    }
    setListaAbierta(false)
    if (errores.length > 0) setErrores([])
  }

  // Elegir una sugerencia del autocompletado: completa cliente, NIT y bodega.
  const elegirSugerencia = (c) => {
    setFormData((prev) => ({
      ...prev,
      recoge_cliente: c.cliente,
      recoge_nit: c.nit,
      recoge_bodega: c.bodega,
    }))
    setListaAbierta(false)
    if (errores.length > 0) setErrores([])
  }

  // Elegir sugerencia de entrega: completa cliente, NIT y bodega.
  const elegirSugerenciaEntrega = (c) => {
    setFormData((prev) => ({
      ...prev,
      entrega_cliente: c.cliente,
      entrega_nit: c.nit,
      entrega_bodega: c.bodega,
    }))
    setListaAbiertaEntrega(false)
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

  // El modal de «Asignar a» devuelve nombre y correo del responsable elegido.
  const handleAsignarUpdate = (_id, cambios) => {
    setFormData((prev) => ({
      ...prev,
      asignado_a: cambios?.asignadoA || '',
      asignado_correo: cambios?.asignadoCorreo || '',
    }))
  }

  const validar = () => {
    const valores = {
      'Nombre del solicitante': formData.nombre_completo,
      'Correo del solicitante': formData.correo,
      '¿Dónde vamos a recoger?': formData.recoge_cliente,
      'Bodega de recogida': formData.recoge_bodega,
      'Zona': formData.zona,
      'Tipo de Servicio': formData.tipo_servicio,
      'Fecha de recolección': formData.fecha_recoleccion,
      'Hora de recolección': formData.hora_recoleccion,
      'Persona de contacto': formData.persona_contacto,
      'Teléfono de contacto': formData.telefono_contacto,
      'Qué recogemos': formData.que_recogemos,
      '¿Dónde entregamos?': formData.entrega_cliente,
      'Bodega de entrega': formData.entrega_bodega,
      'Observaciones': formData.observaciones,
    }
    const faltan = CAMPOS_OBLIGATORIOS.filter((campo) => !String(valores[campo] ?? '').trim())
    if (!String(formData.asignado_correo || '').trim()) faltan.push(FALTA_RESPONSABLE)
    if (!aceptaReglamento) faltan.push(FALTA_DECLARACION)
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
      // Refresca el store y marca la nueva como eco propio: así aparece al once
      // en «Mis recolecciones» y en el tab del Administrador sin que el actor
      // reciba también el aviso de «recolección nueva».
      void registrarRecoleccionCreada(data?.codigo).catch((e) =>
        console.warn('[Recolección] no se pudo refrescar el store:', e)
      )
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
  const tituloCodigo = siguiente.toUpperCase()
  const opcionesTipoServicio = useMemo(
    () => (TIPOS_POR_ZONA[formData.zona] || []).map((t) => ({ value: t, label: t })),
    [formData.zona]
  )
  // Los campos se pintan en rojo solo después de intentar guardar.
  const falta = (campo) => errores.includes(campo)
  const faltanEn = (campos) => campos.some(falta)

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
            <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-9 rounded-full bg-white/10 shrink-0">
                <MdStorefront className="text-lg" />
              </span>
              <span className="truncate">NUEVA RECOLECCIÓN</span>
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span
                title="Número de la siguiente recolección"
                className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]"
              >
                <MdTag className="text-xs sm:text-sm" />
                {tituloCodigo || (
                  <span className="inline-flex items-center gap-0.5" aria-label="Cargando código">
                    <span className="size-1 rounded-full bg-brand-cyan animate-pulse" />
                    <span className="size-1 rounded-full bg-brand-cyan animate-pulse [animation-delay:150ms]" />
                    <span className="size-1 rounded-full bg-brand-cyan animate-pulse [animation-delay:300ms]" />
                  </span>
                )}
              </span>
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
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
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

              {/* Bloque: solicitante (datos de la sesión, no se editan) */}
              <Bloque
                titulo="Solicitante"
                icono={<MdPerson className="text-base" />}
                invalid={faltanEn(CAMPOS_SOLICITANTE)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Nombre Completo"
                    type="text"
                    name="nombre_completo"
                    value={formData.nombre_completo}
                    onChange={() => {}}
                    placeholder="Nombre completo"
                    readOnly
                    required
                    icon={<MdPerson className="text-sm" />}
                    invalid={falta('Nombre del solicitante')}
                  />
                  <FormField
                    label="Correo"
                    type="email"
                    name="correo"
                    value={formData.correo}
                    onChange={() => {}}
                    placeholder="correo@CTP.com"
                    readOnly
                    required
                    icon={<MdEmail className="text-sm" />}
                    invalid={falta('Correo del solicitante')}
                  />
                </div>
              </Bloque>

              {/* Bloque: recogida */}
              <Bloque
                titulo="Recogida"
                icono={<MdStorefront className="text-base" />}
                invalid={faltanEn(CAMPOS_RECOGIDA)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative" onBlur={() => setListaAbierta(false)}>
                    <FormField
                      label="¿Dónde vamos a recoger?"
                      type="text"
                      name="recoge_cliente"
                      value={formData.recoge_cliente}
                      onChange={handleChange}
                      onFocus={() => setListaAbierta(true)}
                      placeholder="Escribe el nombre, NIT o bodega"
                      autoComplete="off"
                      required
                      icon={<MdBusiness className="text-sm" />}
                      invalid={falta('¿Dónde vamos a recoger?')}
                    />
                    <button
                      type="button"
                      onClick={() => setPicker('recoge')}
                      title="Buscar y seleccionar cliente"
                      aria-label="Buscar cliente a recoger"
                      className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                    >
                      <MdSearch className="text-lg" />
                    </button>

                    {/* Sugerencias mientras se escribe. Cada opción usa onMouseDown
                        con preventDefault, que se dispara ANTES que el blur del
                        contenedor: así la lista no se cierra antes del click. */}
                    {listaAbierta && sugerencias.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] rounded-xl border border-brand-deep/20 bg-white shadow-2xl overflow-hidden animate-scaleIn">
                        <div className="max-h-56 overflow-y-auto divide-y divide-brand-deep/10 [scrollbar-width:thin]">
                          {sugerencias.map((c) => (
                            <button
                              key={c.id ?? `${c.nit}-${c.bodega}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => elegirSugerencia(c)}
                              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-brand-deep/10 focus:bg-brand-deep/10 outline-none"
                            >
                              <span className="block text-sm font-bold text-brand-ink truncate">
                                {c.cliente}
                              </span>
                              <span className="block text-xs text-brand-deep/70 truncate">
                                NIT {c.nit} · Bodega {c.bodega}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="bg-brand-mist/70 px-3 py-1.5 text-[0.65rem] text-brand-deep/70">
                          {sugerencias.length === 8
                            ? 'Mostrando los primeros 8. Usa la lupa para ver todos.'
                            : 'Toca uno para completar la bodega.'}
                        </div>
                      </div>
                    )}

                    {listaAbierta && sugerencias.length === 0 &&
                      catalogoClientes.length > 0 &&
                      formData.recoge_cliente.trim() !== '' && (
                        <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] rounded-xl border border-brand-deep/20 bg-white shadow-2xl px-3 py-2.5 text-xs text-brand-ink/70">
                          Sin coincidencias. Escribe el nombre, el NIT o la bodega, o
                          usa la lupa para ver el catálogo completo.
                        </div>
                      )}
                  </div>
                  <FormField
                    label="Bodega"
                    type="text"
                    name="recoge_bodega"
                    value={formData.recoge_bodega}
                    onChange={() => {}}
                    placeholder="Se completa con el cliente"
                    readOnly
                    required
                    icon={<MdWarehouse className="text-sm" />}
                    invalid={falta('Bodega de recogida')}
                  />
                  <FormField
                    label="Zona"
                    type="select"
                    name="zona"
                    value={formData.zona}
                    onChange={handleChange}
                    options={OPCIONES_ZONA}
                    placeholder="Seleccionar zona…"
                    required
                    icon={<MdPlace className="text-sm" />}
                    invalid={falta('Zona')}
                  />
                  <FormField
                    label="Tipo de Servicio"
                    type="select"
                    name="tipo_servicio"
                    value={formData.tipo_servicio}
                    onChange={handleChange}
                    options={opcionesTipoServicio}
                    placeholder={formData.zona ? 'Seleccionar tipo…' : 'Primero selecciona la zona'}
                    required
                    disabled={!formData.zona}
                    icon={<MdCategory className="text-sm" />}
                    invalid={falta('Tipo de Servicio')}
                  />
                  <FormField
                    label="Fecha de recolección"
                    type="date"
                    name="fecha_recoleccion"
                    value={formData.fecha_recoleccion}
                    onChange={handleChange}
                    required
                    icon={<MdEvent className="text-sm" />}
                    invalid={falta('Fecha de recolección')}
                  />
                  <FormField
                    label="Hora de recolección"
                    type="time"
                    name="hora_recoleccion"
                    value={formData.hora_recoleccion}
                    onChange={handleChange}
                    required
                    icon={<MdAccessTime className="text-sm" />}
                    invalid={falta('Hora de recolección')}
                  />
                  <FormField
                    label="Persona de contacto"
                    type="text"
                    name="persona_contacto"
                    value={formData.persona_contacto}
                    onChange={handleChange}
                    placeholder="Quién nos atiende"
                    required
                    icon={<MdSupportAgent className="text-sm" />}
                    invalid={falta('Persona de contacto')}
                  />
                  <FormField
                    label="Teléfono de contacto"
                    type="text"
                    name="telefono_contacto"
                    value={formData.telefono_contacto}
                    onChange={handleChange}
                    placeholder="Número de contacto"
                    required
                    icon={<MdPhone className="text-sm" />}
                    invalid={falta('Teléfono de contacto')}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-brand-ink/60 inline-flex items-center gap-1 min-w-0">
                      <MdWarehouse className="text-sm text-brand-deep/60 shrink-0" />
                      <span className="truncate">
                        {formData.recoge_bodega.trim()
                          ? `Artículos de la bodega ${formData.recoge_bodega.trim()}`
                          : 'Selecciona el cliente para filtrar los artículos por su bodega'}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setArticulosOpen(true)}
                      disabled={!formData.recoge_bodega.trim()}
                      title={
                        formData.recoge_bodega.trim()
                          ? `Seleccionar artículos de la bodega ${formData.recoge_bodega.trim()}`
                          : 'Primero selecciona el cliente de recogida'
                      }
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 px-3 py-1.5 text-xs font-bold text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdInventory2 className="text-base" />
                      Seleccionar artículos
                    </button>
                  </div>
                  <TablaArticulosQueRecogemos
                    articulos={articulosSeleccionados}
                    onEliminar={eliminarArticulo}
                  />
                  <AreaTexto
                    label="Qué recogemos"
                    name="que_recogemos"
                    value={formData.que_recogemos}
                    onChange={(e) => handleChange({ target: { name: 'que_recogemos', value: e.target.value } })}
                    required
                    invalid={falta('Qué recogemos')}
                    pista="Puedes escribirlo a mano o tomarlo del inventario con «Seleccionar artículos»."
                  />
                </div>
              </Bloque>

              {/* Bloque: entrega */}
              <Bloque
                titulo="Entrega"
                icono={<MdLocalShipping className="text-base" />}
                invalid={faltanEn(CAMPOS_ENTREGA)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative" onBlur={() => setListaAbiertaEntrega(false)}>
                    <FormField
                      label="¿Dónde entregamos?"
                      type="text"
                      name="entrega_cliente"
                      value={formData.entrega_cliente}
                      onChange={handleChange}
                      onFocus={() => setListaAbiertaEntrega(true)}
                      placeholder="Escribe el nombre, NIT o bodega"
                      autoComplete="off"
                      required
                      icon={<MdBusiness className="text-sm" />}
                      invalid={falta('¿Dónde entregamos?')}
                    />
                    <button
                      type="button"
                      onClick={() => setPicker('entrega')}
                      title="Buscar y seleccionar cliente"
                      aria-label="Buscar cliente de entrega"
                      className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                    >
                      <MdSearch className="text-lg" />
                    </button>

                    {/* Sugerencias mientras se escribe. */}
                    {listaAbiertaEntrega && sugerenciasEntrega.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] rounded-xl border border-brand-deep/20 bg-white shadow-2xl overflow-hidden animate-scaleIn">
                        <div className="max-h-56 overflow-y-auto divide-y divide-brand-deep/10 [scrollbar-width:thin]">
                          {sugerenciasEntrega.map((c) => (
                            <button
                              key={c.id ?? `${c.nit}-${c.bodega}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => elegirSugerenciaEntrega(c)}
                              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-brand-deep/10 focus:bg-brand-deep/10 outline-none"
                            >
                              <span className="block text-sm font-bold text-brand-ink truncate">
                                {c.cliente}
                              </span>
                              <span className="block text-xs text-brand-deep/70 truncate">
                                NIT {c.nit} · Bodega {c.bodega}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="bg-brand-mist/70 px-3 py-1.5 text-[0.65rem] text-brand-deep/70">
                          {sugerenciasEntrega.length === 8
                            ? 'Mostrando los primeros 8. Usa la lupa para ver todos.'
                            : 'Toca uno para completar la bodega.'}
                        </div>
                      </div>
                    )}

                    {listaAbiertaEntrega && sugerenciasEntrega.length === 0 &&
                      catalogoClientes.length > 0 &&
                      formData.entrega_cliente.trim() !== '' && (
                        <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] rounded-xl border border-brand-deep/20 bg-white shadow-2xl px-3 py-2.5 text-xs text-brand-ink/70">
                          Sin coincidencias. Escribe el nombre, el NIT o la bodega, o
                          usa la lupa para ver el catálogo completo.
                        </div>
                      )}
                  </div>
                  <FormField
                    label="Bodega"
                    type="text"
                    name="entrega_bodega"
                    value={formData.entrega_bodega}
                    onChange={() => {}}
                    placeholder="Se completa con el cliente"
                    readOnly
                    required
                    icon={<MdWarehouse className="text-sm" />}
                    invalid={falta('Bodega de entrega')}
                  />
                </div>
              </Bloque>

              {/* Bloque: responsable de la recolección (obligatorio). Se elige con el
                  mismo modal de «Asignar a» del administrador, que para recolecciones
                  muestra solo los cuatro nombres del listado cerrado. */}
              <Bloque
                titulo="Responsable"
                icono={<MdAssignmentInd className="text-base" />}
                requerido
                invalid={falta(FALTA_RESPONSABLE)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {formData.asignado_a ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 px-3 py-1.5 text-sm font-bold text-brand-deep max-w-full">
                        <MdAssignmentInd className="text-base shrink-0" />
                        <span className="truncate">{formData.asignado_a}</span>
                      </span>
                    ) : (
                      <p className="text-[11px] text-brand-ink/60">
                        Pulsa «Asignar a» y elige el responsable de la recolección.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAsignarOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 px-3 py-1.5 text-xs font-bold text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition shrink-0"
                  >
                    <MdPersonAdd className="text-base" />
                    Asignar a
                  </button>
                </div>
              </Bloque>

              {/* Bloque: observaciones */}
              <Bloque
                titulo="Observaciones"
                icono={<MdNotes className="text-base" />}
                invalid={faltanEn(CAMPOS_OBSERVACIONES)}
              >
                <AreaTexto
                  label="Instrucción especial / observaciones"
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={(e) =>
                    handleChange({
                      target: { name: 'observaciones', value: e.target.value.toUpperCase() },
                    })
                  }
                  required
                  invalid={falta('Observaciones')}
                  pista="Si no hay ninguna instrucción especial, escribe N/A."
                />
              </Bloque>

              {/* Bloque: adjuntos (opcionales) */}
              <Bloque titulo="Adjuntos" icono={<MdCloudUpload className="text-base" />} opcional>
                <div>
                  {puedeAdjuntar && (
                    <label className="flex flex-col items-center justify-center gap-2 w-full px-4 py-5 border-2 border-dashed border-brand-ink/25 rounded-xl bg-white/70 text-brand-ink/70 cursor-pointer hover:border-brand-cyan hover:bg-brand-mist/50 transition-colors">
                      <MdCloudUpload className="text-3xl text-brand-cyan" />
                      <span className="text-sm font-medium">Haz clic para adjuntar archivos</span>
                      <span className="text-xs text-brand-ink/50">
                        Máximo 3 archivos{archivos.length > 0 && ` · ${archivos.length}/3 usados`}
                      </span>
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
                    <div className={`${puedeAdjuntar ? 'mt-3 ' : ''}space-y-2`}>
                      {archivos.map((archivo, i) => (
                        <div
                          key={`${archivo.name}-${archivo.size}-${i}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/70 border border-brand-ink/10"
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
              </Bloque>

              {/* Bloque: declaración obligatoria del Reglamento Interno */}
              <Bloque
                titulo="Declaración"
                icono={<MdFactCheck className="text-base" />}
                requerido
                invalid={falta(FALTA_DECLARACION)}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceptaReglamento}
                    onChange={(e) => {
                      setAceptaReglamento(e.target.checked)
                      if (errores.length > 0) setErrores([])
                    }}
                    aria-required="true"
                    className="mt-0.5 size-5 shrink-0 rounded border-brand-deep/40 accent-brand-cyan cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm leading-relaxed text-brand-ink">
                    Declaro que he leído y acepto las disposiciones del Reglamento Interno de
                    Trabajo de CTP MÉDICA, especialmente las obligaciones establecidas en el
                    Artículo 79, relacionadas con la custodia, el cuidado, la integridad, la
                    trazabilidad y la devolución de los dispositivos médicos y demás bienes bajo
                    mi responsabilidad.
                  </span>
                </label>
                <p className="text-[11px] text-brand-ink/50">
                  Debes marcarla para poder guardar la recolección.
                </p>
              </Bloque>
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

      {/* Mismo modal de asignar del administrador, adaptado a recolección: con la
          bandera `_esRecoleccion` muestra solo los cuatro responsables del listado. */}
      <AsignarUsuarioModal
        open={asignarOpen}
        solicitud={{
          id: tituloCodigo || 'NUEVA',
          _esRecoleccion: true,
          estado: 'Abierto',
          asignadoA: formData.asignado_a,
          asignadoCorreo: formData.asignado_correo,
        }}
        onClose={() => setAsignarOpen(false)}
        onUpdate={handleAsignarUpdate}
      />

      <ArticulosBodegaModal
        open={articulosOpen}
        bodega={formData.recoge_bodega}
        valorActual={formData.que_recogemos}
        onClose={() => setArticulosOpen(false)}
        onConfirm={(texto) => {
          const nuevosArticulos = parsearArticulosQueRecogemos(texto)
          setArticulosSeleccionados(nuevosArticulos)
          setFormData((prev) => ({ ...prev, que_recogemos: texto }))
          if (errores.length > 0) setErrores([])
        }}
      />
    </>
  )
}
