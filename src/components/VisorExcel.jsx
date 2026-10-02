import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MdClose,
  MdTableChart,
  MdOpenInNew,
  MdDownload,
  MdCloudQueue,
  MdInsertDriveFile,
} from 'react-icons/md'
import { resolverArchivo } from '../services/visorArchivos.js'

// ============================================================================
// VISOR DE HOJAS DE CALCULO
// El equivalente al visor de PDF y al de imágenes, pero para .xlsx y .xls.
// Muestra la rejilla dentro de la aplicación en vez de tener que abrir el archivo.
//
// Un .xlsx NO se puede pintar con una etiqueta del navegador: es un ZIP con XML
// dentro. Por eso se trae la librería «xlsx» (SheetJS) para descomprimirlo y
// extraer los valores.
//
// SEGURIDAD — dos cosas deliberadas:
//   1. Las celdas se pintan como TEXTO plano, nunca con dangerouslySetInnerHTML.
//      Una hoja de cálculo es un archivo que sube el usuario y sus celdas pueden
//      traer HTML con scripts; renderizarlo como HTML sería una vía de XSS
//      guardada en el historial de la solicitud.
//   2. La librería se trae con import() dinámico para que su peso (~400 kB) solo
//      se descargue cuando alguien abre de verdad una hoja, no al entrar en la app.
//      npm solo tiene la 0.18.5, con avisos de seguridad sin parchear, así que se
//      instala el paquete oficial 0.20.3 del CDN de SheetJS, que sí los corrige.
// ============================================================================

const TIEMPO_LIMITE_MS = 40000

// Límite de filas y columnas que se pintan. Una hoja real puede traer cientos de
// miles de filas: pintarlas todas congela el navegador, sobre todo en un móvil,
// que es desde donde se revisan las entregas. Es un tope de VISTA, no de lectura:
// el archivo se sigue descargando entero para poder abrirlo y descargarlo bien.
const MAX_FILAS = 400
const MAX_COLUMNAS = 40

function valorATexto(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? String(v) : v.toLocaleString('es-CO')
  }
  if (typeof v === 'object') {
    // Los hipervínculos y las celdas con formatotraen objetos. Se interested el
    // texto, no el objeto.
    if (typeof v.text === 'string') return v.text
    if (typeof v.w === 'string') return v.w
    return ''
  }
  return String(v)
}

export default function VisorExcel({ open, url, onClose, titulo = 'VISTA PREVIA DE LA HOJA DE CÁLCULO' }) {
  const [estado, setEstado] = useState({ cargando: false, error: '', libro: null, xlsx: null, nombre: '', src: '' })
  const [hojaActiva, setHojaActiva] = useState('')

  useEffect(() => {
    if (!open || !url) return undefined
    let cancelado = false
    setEstado({ cargando: true, error: '', libro: null, xlsx: null, nombre: '', src: '' })
    setHojaActiva('')

    const correr = async () => {
      const res = await resolverArchivo(url)
      if (cancelado) return
      setEstado((e) => ({ ...e, nombre: res.nombre, src: res.src }))

      const tiempoLimite = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Se tardó demasiado en leer la hoja de cálculo')), TIEMPO_LIMITE_MS)
      })
      // El import y la lectura compiten contra el reloj: si el archivo es enorme
      // o la red falla, el usuario recibe un mensaje en vez de un spinner eterno.
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
      // La librería también se guarda: hace falta para convertir la hoja a filas y
      // eso pasa en el useMemo, fuera de este efecto.
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

  // Esc cierra y el fondo no se desplaza mientras está abierto.
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

  const { libro, xlsx } = estado

  // La rejilla depende de la hoja elegida, así que solo se calcula esa: cambiar de
  // pestaña no vuelve a recorrer el archivo entero.
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
      // Un !ref malformado no debe tumbar la vista: se cae al conteo de filas.
    }
    return {
      cabeceras: filas[0] || [],
      filas: filas.slice(1),
      totalFilas,
    }
  }, [libro, xlsx, hojaActiva])

  if (!open || !url) return null

  const visibles = rejilla ? rejilla.filas.slice(0, MAX_FILAS) : []
  const maxLongFilaVisibles = visibles.length > 0
    ? Math.max(...visibles.map((f) => f.length))
    : 0
  const columnas = Math.min(
    Math.max(rejilla ? rejilla.cabeceras.length : 0, maxLongFilaVisibles, 0),
    MAX_COLUMNAS
  )
  const truncada = rejilla ? rejilla.filas.length > MAX_FILAS || columnas >= MAX_COLUMNAS : false

  // Portal por el mismo motivo que en VisorImagen: esta tarjeta se pinta con
  // `fixed`, y si vive dentro de una caja con `transform` —como la tarjeta de
  // adjuntos, que lleva `animate-scaleIn`— el `fixed` se ancla a esa caja y el
  // visor sale encogido y recortado. Montarlo en document.body lo evita siempre.
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
            <span className="truncate">{estado.nombre || titulo}</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {estado.src && !estado.error && (
              <>
                <a
                  href={estado.src}
                  download={estado.nombre || true}
                  className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Descargar"
                  aria-label="Descargar"
                >
                  <MdDownload className="text-lg" />
                </a>
                <a
                  href={estado.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Abrir en otra pestaña"
                  aria-label="Abrir en otra pestaña"
                >
                  <MdOpenInNew className="text-lg" />
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
          {estado.cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-brand-mist/50">
              <MdCloudQueue className="text-4xl text-brand-cyan animate-pulse" />
              <p className="text-sm font-bold text-brand-deep">Leyendo la hoja de cálculo…</p>
              <p className="text-xs font-semibold text-brand-ink/60">La primera vez tarda un poco más</p>
            </div>
          )}

          {estado.error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
              <MdInsertDriveFile className="text-5xl text-brand-deep/30" />
              <p className="text-sm font-bold text-red-600">{estado.error}</p>
              <p className="text-xs text-brand-ink/60">
                Puede que el archivo ya no esté en el servidor, o que no sea una hoja válida.
              </p>
            </div>
          ) : rejilla ? (
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
          ) : !estado.cargando ? (
            <div className="h-full flex items-center justify-center px-6 py-10 text-sm font-bold text-brand-ink/60">
              La hoja está vacía
            </div>
          ) : null}
        </div>

        {rejilla && (
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
        )}
      </div>
    </div>,
    document.body
  )
}