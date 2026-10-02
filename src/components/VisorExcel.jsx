import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MdClose,
  MdTableChart,
  MdOpenInNew,
  MdDownload,
  MdCloudQueue,
  MdInsertDriveFile,
  MdVisibility,
} from 'react-icons/md'
import { resolverArchivo } from '../services/visorArchivos.js'

// ============================================================================
// VISOR DE HOJAS DE CALCULO - Versión simplificada
// Botones: Descargar, Abrir en otra pestaña, Visualizar (opcional)
// ============================================================================

const TIEMPO_LIMITE_MS = 40000
const MAX_FILAS = 400
const MAX_COLUMNAS = 40

function valorATexto(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? String(v) : v.toLocaleString('es-CO')
  }
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text
    if (typeof v.w === 'string') return v.w
    return ''
  }
  return String(v)
}

function VisualizadorExcel({ libro, xlsx, hojaActiva, setHojaActiva }) {
  const rejilla = useMemo(() => {
    if (!libro || !xlsx || !hojaActiva) return null
    const hoja = libro.Sheets[hojaActiva]
    if (!hoja) return null
    const filas = xlsx.utils.sheet_to_json(hoja, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    })
    let totalFilas = filas.length
    try {
      if (hoja['!ref']) totalFilas = xlsx.utils.decode_range(hoja['!ref']).e.r + 1
    } catch {
      // Un !ref malformado no debe tumbar la vista
    }
    return {
      cabeceras: filas[0] || [],
      filas: filas.slice(1),
      totalFilas,
    }
  }, [libro, xlsx, hojaActiva])

  const visibles = rejilla ? rejilla.filas.slice(0, MAX_FILAS) : []
  const maxLongFilaVisibles = visibles.length > 0
    ? Math.max(...visibles.map((f) => f.length))
    : 0
  const columnas = Math.min(
    Math.max(rejilla ? rejilla.cabeceras.length : 0, maxLongFilaVisibles, 0),
    MAX_COLUMNAS
  )
  const truncada = rejilla ? rejilla.filas.length > MAX_FILAS || columnas >= MAX_COLUMNAS : false

  if (!rejilla) return null

  return (
    <div className="flex-1 min-h-0 bg-white overflow-auto">
      {libro && libro.SheetNames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 sm:px-4 py-2 bg-brand-mist/60 border-b border-brand-ink/10 shrink-0">
          {libro.SheetNames.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setHojaActiva(n)}
              aria-pressed={n === hojaActiva}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                n === hojaActiva
                  ? 'bg-brand-navy text-white'
                  : 'bg-white text-brand-ink/70 ring-1 ring-brand-ink/10 hover:bg-brand-cyan/15'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <table className="text-xs sm:text-[13px] border-collapse w-max min-w-full">
        <thead className="sticky top-0 z-[1]">
          <tr>
            {Array.from({ length: columnas }, (_, c) => (
              <th
                key={`h-${c}`}
                className="border border-brand-ink/15 bg-brand-mist px-2.5 py-2 text-left font-extrabold text-brand-deep whitespace-nowrap"
              >
                {valorATexto(rejilla.cabeceras[c]) || `Columna ${c + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibles.map((fila, i) => (
            <tr key={`f-${i}`} className={i % 2 ? 'bg-brand-deep/[0.03]' : 'bg-white'}>
              {Array.from({ length: columnas }, (_, c) => (
                <td
                  key={`c-${c}`}
                  className="border border-brand-ink/10 px-2.5 py-1.5 text-brand-ink whitespace-nowrap max-w-[18rem] overflow-hidden text-ellipsis"
                >
                  {valorATexto(fila[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="shrink-0 px-4 py-2 bg-brand-mist/60 border-t border-brand-ink/10 text-[11px] font-semibold text-brand-ink/60 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          {hojaActiva} · {Math.min(rejilla.filas.length, MAX_FILAS)} de {rejilla.totalFilas} filas
        </span>
        {columnas >= MAX_COLUMNAS && <span>primeras {MAX_COLUMNAS} columnas</span>}
        {truncada && (
          <span className="text-brand-deep">
            Se muestra un recorte para no bloquear el navegador. Abre o descarga el archivo para ver todo.
          </span>
        )}
      </div>
    </div>
  )
}

export default function VisorExcel({ open, url, onClose, titulo = 'VISTA PREVIA DE LA HOJA DE CÁLCULO' }) {
  const [estado, setEstado] = useState({ cargando: false, error: '', libro: null, xlsx: null, nombre: '', src: '' })
  const [hojaActiva, setHojaActiva] = useState('')
  const [mostrarVisualizador, setMostrarVisualizador] = useState(false)

  useEffect(() => {
    if (!open || !url) return undefined
    let cancelado = false
    setEstado({ cargando: true, error: '', libro: null, xlsx: null, nombre: '', src: '' })
    setHojaActiva('')
    setMostrarVisualizador(false)

    const correr = async () => {
      const res = await resolverArchivo(url)
      if (cancelado) return
      setEstado((e) => ({ ...e, nombre: res.nombre, src: res.src }))

      const tiempoLimite = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Se tardó demasiado en leer la hoja de cálculo')), TIEMPO_LIMITE_MS)
      })
      const [xlsx, datos] = await Promise.race([
        import('xlsx'),
        fetch(res.src).then((r) => {
          if (!r.ok) throw new Error(`El servidor respondió ${r.status} al pedir el archivo`)
          return r.arrayBuffer()
        }),
        tiempoLimite,
      ])

      const libro = xlsx.read(datos, { type: 'array' })
      if (cancelado) return
      if (!libro.SheetNames.length) throw new Error('El archivo no contiene ninguna hoja')
      setEstado({ cargando: false, error: '', libro, xlsx, nombre: res.nombre, src: res.src })
      setHojaActiva(libro.SheetNames[0])
    }

    correr().catch((err) => {
      if (!cancelado) {
        setEstado({
          cargando: false,
          error: err.message || 'No se pudo leer la hoja',
          libro: null,
          xlsx: null,
          nombre: '',
          src: '',
        })
      }
    })

    return () => {
      cancelado = true
    }
  }, [open, url])

  useEffect(() => {
    if (!open) return undefined
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alTeclear = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', alTeclear)
    }
  }, [open, onClose])

  if (!open || !url) return null

  const { libro, xlsx, nombre, src, error, cargando } = estado

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-6xl rounded-2xl shadow-2xl animate-scaleIn h-[88vh] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-green-500/20 ring-1 ring-green-400/40 shrink-0">
              <MdTableChart className="text-green-400 text-lg" />
            </span>
            <span className="truncate">{nombre || titulo}</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {src && !error && (
              <>
                <a
                  href={src}
                  download={nombre || true}
                  className="grid place-items-center size-9 rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 transition"
                  title="Descargar archivo"
                  aria-label="Descargar archivo"
                >
                  <MdDownload className="text-xl" />
                </a>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid place-items-center size-9 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                  title="Abrir en otra pestaña"
                  aria-label="Abrir en otra pestaña"
                >
                  <MdOpenInNew className="text-xl" />
                </a>
                <button
                  type="button"
                  onClick={() => setMostrarVisualizador(!mostrarVisualizador)}
                  className={`grid place-items-center size-9 rounded-full transition ${
                    mostrarVisualizador
                      ? 'bg-purple-500/10 text-purple-600'
                      : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                  }`}
                  title={mostrarVisualizador ? 'Ocultar visualizador' : 'Visualizar hoja'}
                  aria-label={mostrarVisualizador ? 'Ocultar visualizador' : 'Visualizar hoja'}
                >
                  <MdVisibility className="text-xl" />
                </button>
                <a
                  href={src}
                  download={nombre || true}
                  className="grid place-items-center size-9 rounded-full bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 transition"
                  title="Descargar archivo"
                  aria-label="Descargar archivo"
                >
                  <MdDownload className="text-xl" />
                </a>
              </>
            )}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {libro && libro.SheetNames.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 sm:px-4 py-2 bg-brand-mist/60 border-b border-brand-ink/10 shrink-0">
            {libro.SheetNames.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setHojaActiva(n)}
                aria-pressed={n === hojaActiva}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  n === hojaActiva
                    ? 'bg-brand-navy text-white'
                    : 'bg-white text-brand-ink/70 ring-1 ring-brand-ink/10 hover:bg-brand-cyan/15'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1 min-h-0 bg-white overflow-auto">
          {cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-brand-mist/50">
              <MdCloudQueue className="text-4xl text-brand-cyan animate-pulse" />
              <p className="text-sm font-bold text-brand-deep">Leyendo la hoja de cálculo…</p>
              <p className="text-xs font-semibold text-brand-ink/60">La primera vez tarda un poco más</p>
            </div>
          )}

          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
              <MdInsertDriveFile className="text-5xl text-brand-deep/30" />
              <p className="text-sm font-bold text-red-600">{error}</p>
              <p className="text-xs text-brand-ink/60">
                Puede que el archivo ya no esté en el servidor, o que no sea una hoja válida.
              </p>
            </div>
          ) : false}
        </div>

        {mostrarVisualizador && libro && (
          <>
            <div className="shrink-0 px-4 py-2 bg-brand-mist/60 border-t border-brand-ink/10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMostrarVisualizador(false)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition"
              >
                <MdVisibility className="text-lg" />
                Ocultar visualizador
              </button>
              {libro.SheetNames.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto flex-1">
                  {libro.SheetNames.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setHojaActiva(n)}
                      aria-pressed={n === hojaActiva}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                        n === hojaActiva
                          ? 'bg-brand-navy text-white'
                          : 'bg-white text-brand-ink/70 ring-1 ring-brand-ink/10 hover:bg-brand-cyan/15'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <VisualizadorExcel
              libro={libro}
              xlsx={xlsx}
              hojaActiva={hojaActiva}
              setHojaActiva={setHojaActiva}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  )
}