import { useEffect, useRef, useState } from 'react'
import { MdClose, MdCheckCircle, MdNotes, MdPhotoCamera, MdPictureAsPdf, MdPerson, MdWorkOutline, MdEmail, MdHistory } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { FiStar } from 'react-icons/fi'
import StarRating from '../../../../components/StarRating.jsx'
import { subirDocEntregaOneDrive } from '../../../../services/oneDriveApi.js'
import { evidenciaSubida, subidaPendiente } from '../../../../services/notificaciones.jsx'
import {
  guardarBorradorEntrega,
  cargarBorradorEntrega,
  eliminarBorradorEntrega,
  cargarContactosEncuesta,
  guardarContactoEncuesta,
} from '../../../Home/Components/solicitudesStore.js'

function dataUrlABlob(dataUrl) {
  const [cabecera, contenido] = dataUrl.split(',')
  const mime = /data:(.*?)(;|,)/.exec(cabecera)?.[1] || 'image/jpeg'
  const bin = atob(contenido)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const PREGUNTAS = [
  'TIEMPO EN ENTREGA',
  'ESTADO DEL PRODUCTO',
  'DISPONIBILIDAD DE LA INFORMACIÓN',
  'AMABILIDAD Y ACTITUD DEL SERVICIO',
  'ATENCIÓN DE UN RECLAMO (VISITA, SEGUIMIENTO)',
]

const CALIFICACIONES = ['Malo', 'Regular', 'Bueno']

// Máximo de fotos de evidencia por entrega y separador de las URLs resultantes
// (debe coincidir con SEP_EVIDENCIA en solicitudesApi.js).
const MAX_IMAGENES = 3
const SEP_EVIDENCIA = '|'

// La evidencia puede ser una foto (data:image…) o un PDF (data:application/pdf).
const esEvidenciaPdf = (src) => /^data:application\/pdf/i.test(src) || /\.pdf(\?|#|$)/i.test(src)

function formatearBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Tamaño aproximado de un data URL (base64: 3 bytes cada 4 caracteres).
function tamanoDataUrl(dataUrl) {
  const coma = dataUrl.indexOf(',')
  if (coma === -1) return 0
  return Math.floor(((dataUrl.length - coma - 1) * 3) / 4)
}

export default function EntregaConductor({ solicitud, open, onClose, onUpdate, destino }) {
  const [observaciones, setObservaciones] = useState('')
  const [evidencias, setEvidencias] = useState([])
  const [nombreEncuestado, setNombreEncuestado] = useState('')
  const [cargo, setCargo] = useState('')
  const [correo, setCorreo] = useState('')
  const [puntuaciones, setPuntuaciones] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [contactos, setContactos] = useState([])
  const fileRef = useRef(null)
  const pdfRef = useRef(null)
  const abiertoRef = useRef(false)

  const estadoEntrega =
    destino || (solicitud?.estado === 'En Tránsito Parcial' ? 'Entregado Parcial' : 'Entregado')

  useEffect(() => {
    if (!open) {
      abiertoRef.current = false
      return
    }
    if (abiertoRef.current) return
    abiertoRef.current = true
    setGuardando(false)
    const borrador = solicitud ? cargarBorradorEntrega(solicitud.id) : null
    const recientes = cargarContactosEncuesta()
    const ultimo = recientes[0]
    setContactos(recientes)
    setObservaciones(borrador?.observaciones || '')
    setEvidencias(
      Array.isArray(borrador?.evidencias)
        ? borrador.evidencias
        : borrador?.evidencia
          ? [borrador.evidencia]
          : []
    )
    // Si no hay borrador, precarga el último contacto usado para no repetir datos.
    setNombreEncuestado(borrador?.nombreEncuestado || ultimo?.nombre || '')
    setCargo(borrador?.cargo || ultimo?.cargo || '')
    setCorreo(borrador?.correo || ultimo?.correo || '')
    setPuntuaciones(borrador?.puntuaciones || {})
  }, [open, solicitud])

  useEffect(() => {
    if (!open || !solicitud) return
    const timer = setTimeout(() => {
      guardarBorradorEntrega(solicitud.id, {
        observaciones,
        evidencias,
        nombreEncuestado,
        cargo,
        correo,
        puntuaciones,
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [open, solicitud, observaciones, evidencias, nombreEncuestado, cargo, correo, puntuaciones])

  if (!open || !solicitud) return null

  const correoValido = /^\S+@\S+\.\S+$/.test(correo.trim())
  const todasPuntuadas = PREGUNTAS.every((p) => (puntuaciones[p] || 0) >= 1)
  const puedeGuardar =
    observaciones.trim().length > 0 &&
    evidencias.length > 0 &&
    nombreEncuestado.trim().length > 0 &&
    cargo.trim().length > 0 &&
    correoValido &&
    todasPuntuadas

  const faltantes = []
  if (!observaciones.trim()) faltantes.push('observaciones')
  if (evidencias.length === 0) faltantes.push('evidencia (foto o PDF)')
  if (!nombreEncuestado.trim()) faltantes.push('nombre del encuestado')
  if (!cargo.trim()) faltantes.push('cargo')
  if (!correoValido) faltantes.push(correo.trim() ? 'correo con formato válido' : 'correo')
  if (!todasPuntuadas) faltantes.push('preguntas de la encuesta por puntuar')

  const archivoFoto = (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 900
        const escala = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
        setEvidencias((prev) => (prev.length >= MAX_IMAGENES ? prev : [...prev, dataUrl]))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const archivoPdf = (e) => {
    const file = e.target.files?.[0]
    if (pdfRef.current) pdfRef.current.value = ''
    if (!file) return
    // Solo se aceptan PDFs reales (o archivos con extensión .pdf).
    const esPdfReal =
      file.type === 'application/pdf' ||
      /\.pdf$/i.test(file.name) ||
      file.type === '' // algunos dispositivos/Android no reportan el tipo
    if (!esPdfReal) {
      alert('Solo puedes adjuntar archivos PDF.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (dataUrl.length > 12 * 1024 * 1024) {
        alert('El PDF es demasiado grande (máximo 12 MB).')
        return
      }
      setEvidencias((prev) => (prev.length >= MAX_IMAGENES ? prev : [...prev, dataUrl]))
    }
    reader.readAsDataURL(file)
  }

  const quitarEvidencia = (indice) => {
    setEvidencias((prev) => prev.filter((_, i) => i !== indice))
  }

  const handleSave = async () => {
    if (!puedeGuardar || guardando) return
    setGuardando(true)
    const partes = []
    let subioAlguna = false
    let falloAlguna = false
    for (const evidencia of evidencias) {
      if (!evidencia.startsWith('data:')) {
        partes.push(evidencia)
        continue
      }
      try {
        const subida = await subirDocEntregaOneDrive(
          dataUrlABlob(evidencia),
          solicitud.numeroReferencia || solicitud.id,
          solicitud.nombreCompleto,
          solicitud.id
        )
        if (subida?.url) {
          partes.push(subida.url)
          subioAlguna = true
        } else throw new Error('OneDrive no devolvió el enlace del archivo')
      } catch (err) {
        console.warn('[OneDrive] no se pudo subir la evidencia, se guardará localmente:', err)
        partes.push(evidencia)
        falloAlguna = true
      }
    }
    if (subioAlguna) {
      evidenciaSubida({ id: solicitud.id, archivo: solicitud.numeroReferencia || solicitud.id })
    }
    if (falloAlguna) subidaPendiente(undefined, solicitud.id)
    const evidenciaFinal = partes.join(SEP_EVIDENCIA)
    eliminarBorradorEntrega(solicitud.id)
    const preguntas = PREGUNTAS.map((p) => ({ pregunta: p, puntuacion: puntuaciones[p] || 0 }))
    setContactos(
      guardarContactoEncuesta({
        nombre: nombreEncuestado.trim().toUpperCase(),
        cargo: cargo.trim().toUpperCase(),
        correo: correo.trim().toUpperCase(),
      })
    )
    onUpdate(solicitud.id, {
      estado: estadoEntrega,
      notaEstado: observaciones.trim().toUpperCase(),
      evidencia: evidenciaFinal,
      encuesta: {
        nombreEncuestado: nombreEncuestado.trim().toUpperCase(),
        cargo: cargo.trim().toUpperCase(),
        correo: correo.trim().toUpperCase(),
        preguntas,
        promedio: preguntas.reduce((a, b) => a + b.puntuacion, 0) / preguntas.length,
      },
    })
    onClose()
  }

  const estadoClase =
    estadoEntrega === 'Entregado Parcial'
      ? 'bg-yellow-100 text-yellow-800 ring-yellow-500/40'
      : 'bg-green-100 text-green-700 ring-green-500/40'

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Entrega de la solicitud ${solicitud.id}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <RiSteering2Line className="text-brand-cyan text-lg" />
            </span>
            ENTREGA DE MERCANCÍA
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid place-items-center size-8 rounded-full bg-white/10 hover:bg-white/25 transition text-white"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Scrollable */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Estado destino */}
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold ring-1 ${estadoClase}`}>
            <MdCheckCircle className="text-lg" />
            Al guardar se marcará como: {estadoEntrega}
          </div>

          {/* Observaciones */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand-deep uppercase tracking-wide mb-2">
              <MdNotes className="text-sm" /> Observaciones de la entrega
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value.toUpperCase())}
              rows={3}
              placeholder="Describe cómo se realizó la entrega…"
              className="w-full rounded-xl border border-brand-deep/20 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Evidencia de la entrega */}
          <div>
            <label className="flex items-center justify-between gap-1.5 text-[11px] font-extrabold text-brand-deep uppercase tracking-wide mb-2">
              <span className="inline-flex items-center gap-1.5">
                <MdPhotoCamera className="text-sm" /> Evidencia de la entrega
              </span>
              <span className="text-brand-ink/50 tabular-nums">{evidencias.length}/{MAX_IMAGENES}</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={archivoFoto}
              className="hidden"
            />
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              onChange={archivoPdf}
              className="hidden"
            />
            {evidencias.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {evidencias.map((src, i) =>
                  esEvidenciaPdf(src) ? (
                    <div
                      key={`${i}-${src.slice(-16)}`}
                      className="relative col-span-3 flex items-center gap-2.5 rounded-xl border border-brand-deep/20 bg-white px-2.5 py-2"
                    >
                      <MdPictureAsPdf className="text-2xl text-red-500 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-brand-ink">Documento PDF</span>
                        <span className="block text-[11px] font-medium text-brand-ink/50">
                          {esEvidenciaPdf(src) && src.startsWith('data:') ? formatearBytes(tamanoDataUrl(src)) : 'Adjunto'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarEvidencia(i)}
                        aria-label={`Quitar PDF ${i + 1}`}
                        title="Quitar"
                        className="grid place-items-center size-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition shrink-0"
                      >
                        <MdClose className="text-sm" />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={`${i}-${src.slice(-16)}`}
                      className="relative aspect-square rounded-xl overflow-hidden border border-brand-deep/20"
                    >
                      <img src={src} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => quitarEvidencia(i)}
                        aria-label={`Quitar imagen ${i + 1}`}
                        title="Quitar"
                        className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
                      >
                        <MdClose className="text-sm" />
                      </button>
                      <span className="absolute bottom-1 left-1 grid place-items-center size-5 rounded-full bg-black/60 text-green-400">
                        <MdCheckCircle className="text-xs" />
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
            {evidencias.length < MAX_IMAGENES && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-xl border-2 border-dashed border-brand-deep/30 bg-brand-mist/40 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors flex items-center justify-center gap-1.5 px-2 py-3 text-brand-deep"
                >
                  <MdPhotoCamera className="text-xl" />
                  <span className="text-[11px] font-bold">Tomar foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  className="flex-1 rounded-xl border-2 border-dashed border-brand-deep/30 bg-brand-mist/40 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors flex items-center justify-center gap-1.5 px-2 py-3 text-brand-deep"
                >
                  <MdPictureAsPdf className="text-xl" />
                  <span className="text-[11px] font-bold">Subir PDF</span>
                </button>
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-brand-ink/50">
              Puedes agregar hasta {MAX_IMAGENES} elementos, fotos tomadas con la cámara o PDFs. Se guardan en la carpeta de la solicitud.
            </p>
          </div>

          {/* Encuesta */}
          <div className="rounded-2xl border border-brand-cyan/30 bg-brand-mist/30 p-3 sm:p-4 space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-brand-deep inline-flex items-center gap-2">
                <FiStar className="text-brand-cyan" /> Encuesta de satisfacción
              </h4>
              <p className="text-xs text-brand-ink/60 mt-0.5">Los campos con * son obligatorios para finalizar la entrega.</p>
            </div>

            {contactos.length > 0 && (
              <div className="rounded-xl bg-white/70 ring-1 ring-brand-cyan/30 px-3 py-2.5">
                <label
                  htmlFor="contacto-reciente"
                  className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-deep mb-1.5"
                >
                  <MdHistory className="text-sm text-brand-cyan" />
                  Contactos recientes — selecciona para llenar
                </label>
                <select
                  id="contacto-reciente"
                  value=""
                  onChange={(e) => {
                    const persona = contactos.find(
                      (c) => `${c.nombre}|${c.cargo}|${c.correo}` === e.target.value
                    )
                    if (!persona) return
                    setNombreEncuestado(String(persona.nombre || '').toUpperCase())
                    setCargo(String(persona.cargo || '').toUpperCase())
                    setCorreo(String(persona.correo || '').toUpperCase())
                  }}
                  className="w-full rounded-xl border border-brand-deep/20 bg-white px-3 py-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                >
                  <option value="">Seleccionar contacto reciente…</option>
                  {contactos.map((c) => (
                    <option key={`${c.nombre}|${c.cargo}|${c.correo}`} value={`${c.nombre}|${c.cargo}|${c.correo}`}>
                      {c.nombre || c.correo || 'Contacto'}
                      {c.cargo ? ` — ${c.cargo}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-brand-ink/50">
                  Al elegir un contacto se autocompletan nombre, cargo y correo.
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-ink/70 mb-1">Nombre del encuestado *</label>
                <div className="flex items-center gap-2 rounded-xl border border-brand-deep/20 bg-white px-3">
                  <MdPerson className="text-brand-ink/40" />
                  <input
                    value={nombreEncuestado}
                    onChange={(e) => setNombreEncuestado(e.target.value.toUpperCase())}
                    placeholder="Nombre y apellido"
                    className="w-full py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-brand-ink/70 mb-1">Cargo *</label>
                <div className="flex items-center gap-2 rounded-xl border border-brand-deep/20 bg-white px-3">
                  <MdWorkOutline className="text-brand-ink/40" />
                  <input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value.toUpperCase())}
                    placeholder="Ej. Administrador"
                    className="w-full py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-brand-ink/70 mb-1">Correo *</label>
                <div className="flex items-center gap-2 rounded-xl border border-brand-deep/20 bg-white px-3">
                  <MdEmail className="text-brand-ink/40" />
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value.toUpperCase())}
                    placeholder="correo@ejemplo.com"
                    className="w-full py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 bg-transparent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-brand-ink/10 pt-3 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-brand-ink/50 px-0.5">
                <span>1 = Malo</span>
                <span>2 = Regular</span>
                <span>3 = Bueno</span>
              </div>
              {PREGUNTAS.map((p, i) => {
                const rating = puntuaciones[p] || 0
                return (
                  <div key={p} className="space-y-2 flex flex-col items-center">
                    <span className="block text-xs font-semibold text-brand-ink/70 text-center uppercase">
                      {i + 1}. {p} *
                    </span>
                    <StarRating
                      value={rating}
                      max={3}
                      onChange={(n) => setPuntuaciones((prev) => ({ ...prev, [p]: n }))}
                    />
                    <span className="block text-[10px] font-bold text-brand-ink/40 text-center">
                      {rating ? CALIFICACIONES[rating - 1] : 'Sin puntuar'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-brand-ink/10 bg-brand-mist/30 shrink-0 space-y-2">
          {!puedeGuardar && faltantes.length > 0 && (
            <p className="text-[11px] font-semibold text-amber-700 inline-flex items-center gap-1">
              <MdCheckCircle className="text-sm shrink-0" />
              Pendiente: {faltantes.join(', ')}.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-brand-deep border-2 border-brand-deep/20 px-4 py-2 text-sm font-bold hover:bg-brand-deep/10 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!puedeGuardar || guardando}
              className="inline-flex items-center gap-2 rounded-full bg-brand-cyan text-brand-ink px-5 py-2 text-sm font-bold shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <MdCheckCircle className="text-lg" />
              {guardando ? 'Subiendo evidencia…' : 'Finalizar entrega'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}