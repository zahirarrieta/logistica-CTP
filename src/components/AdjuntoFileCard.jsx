import { useEffect, useState } from 'react'
import {
  MdImage,
  MdPictureAsPdf,
  MdInsertDriveFile,
  MdTableChart,
  MdOpenInNew,
  MdDownload,
  MdVisibility,
  MdCloudQueue,
  MdBrokenImage,
} from 'react-icons/md'
import { esPdfUrl, nombrePdfFromUrl } from '../utils/pdfUtils.js'
import { esImagenUrl, esExcelUrl } from '../utils/tipoArchivo.js'
import { resolverArchivo } from '../services/visorArchivos.js'
import VisorImagen from './VisorImagen.jsx'
import VisorExcel from './VisorExcel.jsx'

function nombreArchivo(url) {
  try {
    // URL firmada: /api/archivos/ver?ruta=... -> extraer nombre de ruta
    const u = new URL(url, 'http://x')
    const ruta = u.searchParams.get('ruta') || ''
    if (ruta) {
      const parts = ruta.split('/').filter(Boolean)
      const ultimo = parts[parts.length - 1]
      if (ultimo) return decodeURIComponent(ultimo)
    }
  } catch {
    // ignorar
  }
  try {
    const path = new URL(url).pathname
    const parts = path.split('/')
    return decodeURIComponent(parts[parts.length - 1] || 'Archivo')
  } catch {
    return String(url || '').split('/').pop() || 'Archivo'
  }
}

function esUrlAbsoluta(url) {
  return /^https?:\/\//i.test(url)
}

// Resuelve la URL en el momento del clic y navega/descarga. Necesario para
// Excel: los enlaces «Abrir» y «Descargar» usaban `url` directo, y si la
// URL firmada caducó (24 h) el navegador muestra «Enlace inválido o vencido».
// Imágenes y PDFs no tienen este problema porque sus visores llaman a
// resolverArchivo antes de pintar.
async function abrirResuelto(url, modo) {
  try {
    const res = await resolverArchivo(url)
    const a = document.createElement('a')
    a.href = res.src
    if (modo === 'nueva') {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
    } else {
      a.download = res.nombre || true
    }
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (err) {
    console.error('[AdjuntoFileCard] no se pudo abrir el archivo:', err?.message)
    alert(err?.message || 'No se pudo abrir el archivo')
  }
}

function iconoDe(url) {
  if (esImagenUrl(url)) return <MdImage className="text-blue-500 text-xl shrink-0" />
  if (esPdfUrl(url)) return <MdPictureAsPdf className="text-red-500 text-xl shrink-0" />
  if (esExcelUrl(url)) return <MdTableChart className="text-green-600 text-xl shrink-0" />
  return <MdInsertDriveFile className="text-brand-deep text-xl shrink-0" />
}

export default function AdjuntoFileCard({ url, index, onVerPdf, urlsImagenes, onVerImagen }) {
  const [verImagen, setVerImagen] = useState(false)
  const [verHoja, setVerHoja] = useState(false)
  const [miniatura, setMiniatura] = useState({ cargando: true, src: '', error: '' })

  // Si quien lista los adjuntos tiene su propio visor (el modal de adjuntos), se le
  // avisa a él y esta tarjeta no monta el suyo. Motivo: el visor de cada tarjeta
  // queda dentro de la tarjeta, que al llevar `animate-scaleIn` se convierte en el
  // bloque contenedor del `fixed` y el visor se abre encogido dentro del modal, sin
  // caber y recortado. Con un único visor del modal, además, no se acumulan.
  const abrirImagen = onVerImagen ? () => onVerImagen(url) : () => setVerImagen(true)

  const nombre = nombreArchivo(url) || nombrePdfFromUrl(url)
  const esPdf = esPdfUrl(url)
  const esImg = esImagenUrl(url)
  const esHoja = esExcelUrl(url)

  // Miniatura para que se vea de qué archivo se trata sin abrir nada. Antes solo
  // había un enlace «Abrir»: no se distinguía una foto de un PDF ni se veía la
  // imagen. Se resuelve con el mismo resolverArchivo que el visor, que firma las
  // rutas crudas y avisa si el archivo ya no está.
  //
  // Con una URL ya firmada esto NO hace red: resolverArchivo la devuelve tal cual.
  // Solo consulta al backend cuando la ruta viene sin firmar.
  useEffect(() => {
    if (!esImg) return undefined
    let cancelado = false
    setMiniatura({ cargando: true, src: '', error: '' })
    resolverArchivo(url)
      .then((res) => {
        if (!cancelado) setMiniatura({ cargando: false, src: res.src, error: '' })
      })
      .catch((err) => {
        if (!cancelado) {
          setMiniatura({ cargando: false, src: '', error: err.message || 'No se pudo cargar la imagen' })
        }
      })
    return () => {
      cancelado = true
    }
  }, [url, esImg])

  return (
    <>
      <div className="rounded-xl border border-brand-ink/15 overflow-hidden bg-white shadow-sm">
        {/* Miniatura: solo para imágenes */}
        {esImg && (
          <button
            type="button"
            onClick={abrirImagen}
            title="Ver la imagen en grande"
            aria-label={`Ver la imagen ${nombre} en grande`}
            className="block w-full bg-brand-deep/5 border-b border-brand-ink/10 cursor-zoom-in hover:bg-brand-cyan/10 transition-colors"
          >
            {miniatura.cargando ? (
              <span className="flex items-center justify-center gap-2 h-28 text-xs font-bold text-brand-deep">
                <MdCloudQueue className="text-lg text-brand-cyan animate-pulse" />
                Cargando miniatura…
              </span>
            ) : miniatura.src ? (
              <img
                src={miniatura.src}
                alt={nombre}
                loading="lazy"
                className="block h-28 w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center justify-center gap-1 h-28 px-4 text-center text-xs font-bold text-brand-ink/60">
                <MdBrokenImage className="text-2xl text-brand-deep/40" />
                {miniatura.error}
              </span>
            )}
          </button>
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-mist/50 border-b border-brand-ink/10">
          <div className="flex items-center gap-2 min-w-0">
            {iconoDe(url)}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-brand-ink truncate">{nombre}</span>
              {typeof index === 'number' && <span className="text-[10px] text-brand-ink/50">Archivo {index + 1}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {esPdf && onVerPdf && (
              <button
                type="button"
                onClick={() => onVerPdf(url)}
                className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 hover:bg-red-600 hover:text-white transition-colors px-3 py-1.5 text-xs font-bold"
              >
                <MdVisibility className="text-sm" />
                Ver PDF
              </button>
            )}
            {esImg && (
              <button
                type="button"
                onClick={abrirImagen}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors px-3 py-1.5 text-xs font-bold"
              >
                <MdVisibility className="text-sm" />
                Ver imagen
              </button>
            )}
            {esHoja && (
              <>
                <button
                  type="button"
                  onClick={() => setVerHoja(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 hover:bg-green-600 hover:text-white transition-colors px-3 py-1.5 text-xs font-bold"
                >
                  <MdVisibility className="text-sm" />
                  Ver hoja
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); abrirResuelto(url, 'nueva') }}
                  className="inline-flex items-center gap-1 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors px-3 py-1.5 text-xs font-bold"
                >
                  <MdOpenInNew className="text-sm" />
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); abrirResuelto(url, 'descarga') }}
                  className="inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-700 hover:bg-green-500 hover:text-white transition-colors px-3 py-1.5 text-xs font-bold"
                >
                  <MdDownload className="text-sm" />
                  Descargar
                </button>
              </>
            )}
            {/* Para imágenes y hojas no sale el enlace «Abrir»: los visualizadores ya
                traen «Abrir en otra pestaña» y «Descargar» en su cabecera, así que
                dejarlo aquí solo llenaba la tarjeta y llevaba a una pestaña suelta
                sin contexto. */}
            {esUrlAbsoluta(url) && !esImg && !esHoja && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white hover:bg-brand-deep transition-colors px-3 py-1.5 text-xs font-bold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MdOpenInNew className="text-sm" />
                  Abrir
                </a>
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-1.5 text-xs font-bold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MdDownload className="text-sm" />
                  Descargar
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Solo si nadie trae visor propio. El de la tarjeta queda dentro de la tarjeta,
          y dentro de una tarjeta con `animate-scaleIn` el `fixed` se ancla a la
          tarjeta en vez de a la pantalla: se abre encogido y recortado.
          Quien lista los adjuntos puede montar uno suyo con `onVerImagen`. */}
      {!onVerImagen && (
        <VisorImagen
          open={verImagen}
          url={url}
          urls={esImg ? urlsImagenes : undefined}
          inicio={esImg ? urlsImagenes?.indexOf(url) ?? 0 : 0}
          onClose={() => setVerImagen(false)}
          titulo="VISTA PREVIA DE LA IMAGEN"
        />
      )}

      <VisorExcel
        open={verHoja}
        url={url}
        onClose={() => setVerHoja(false)}
        titulo="VISTA PREVIA DE LA HOJA DE CÁLCULO"
      />
    </>
  )
}