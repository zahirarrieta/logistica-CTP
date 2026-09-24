import { useEffect, useMemo, useState } from 'react'
import {
  MdPictureAsPdf,
  MdPhotoCamera,
  MdVerified,
  MdCloudQueue,
  MdClose,
  MdOpenInNew,
  MdDownload,
  MdZoomIn,
  MdChevronLeft,
  MdChevronRight,
} from 'react-icons/md'
import { esUrlOneDrive, resolverArchivoOneDrive } from '../services/oneDriveVisor.js'

const CARPETA = 'solicitudes/DocEntregas'

const esPdf = (url) => /^data:application\/pdf/i.test(url) || /\.pdf(\?|#|$)/i.test(url)

export default function EvidenciaVisor({ urls }) {
  // Un carrusel: muestra una foto a la vez y, en «ver en grande», todas con
  // navegación. `urls` puede traer 1..N imágenes de la entrega.
  const lista = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean) : []), [urls])
  const total = lista.length
  const [indice, setIndice] = useState(0)
  const [estados, setEstados] = useState([])
  const [ampliado, setAmpliado] = useState(false)

  const clave = lista.join('|')
  useEffect(() => {
    setIndice(0)
    setEstados([])
    // Solo `clave` (estable): así el carrusel no se reinicia con cada re-render
    // del padre (Realtime en el dashboard reinicia el componente de todas formas).
  }, [clave])

  // Resuelve todas las imágenes (OneDrive → blob) de una vez; al ser máximo 3
  // no pesa y evita re-resolver al navegar por el carrusel.
  useEffect(() => {
    setEstados(lista.map((u) => ({ src: '', abrir: u, cargando: true, esPdf: esPdf(u), error: '' })))
    if (!lista.some((u) => esUrlOneDrive(u))) {
      setEstados(
        lista.map((u) => ({ src: u, abrir: u, cargando: false, esPdf: esPdf(u), error: '' }))
      )
      return
    }
    let cancelado = false
    const objetos = []
    Promise.allSettled(
      lista.map((u) =>
        esUrlOneDrive(u)
          ? resolverArchivoOneDrive(u, { carpeta: CARPETA }).then((res) => {
              if (res.src.startsWith('blob:')) objetos.push(res.src)
              return res
            })
          : Promise.resolve({ src: u, abrir: u })
      )
    ).then((resultados) => {
      if (cancelado) return
      setEstados(
        lista.map((u, i) => {
          const res = resultados[i]
          const cargado = res.status === 'fulfilled' && res.value?.src
          return {
            src: cargado ? res.value.src : '',
            abrir: cargado && res.value.abrir ? res.value.abrir : u,
            cargando: false,
            esPdf: esPdf(u),
            error: cargado ? '' : (res.reason?.message || 'No se pudo cargar la evidencia'),
          }
        })
      )
    })
    return () => {
      cancelado = true
      objetos.forEach((o) => URL.revokeObjectURL(o))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const irA = (n) => setIndice(Math.min(Math.max(n, 0), total - 1))

  useEffect(() => {
    if (!ampliado) return
    const alTeclear = (e) => {
      if (e.key === 'Escape') setAmpliado(false)
      if (e.key === 'ArrowLeft') irA(indice - 1)
      if (e.key === 'ArrowRight') irA(indice + 1)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ampliado, indice])

  if (total === 0) return null

  const actual = estados[indice] || { src: '', abrir: lista[indice], cargando: true }

  const enlacePdfCard = (estado, urlBase) => (
    <a
      href={estado.abrir || urlBase}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3.5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors"
    >
      <MdPictureAsPdf className="text-3xl text-red-600 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-brand-deep">Documento PDF de la entrega</span>
        <span className="block text-xs text-brand-ink/60">Clic para abrir en una nueva pestaña</span>
      </span>
    </a>
  )

  const tarjetaCarga = () => (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-8 text-sm font-bold text-brand-deep">
      <MdCloudQueue className="text-xl text-brand-cyan animate-pulse" />
      Cargando evidencia…
    </div>
  )

  const tarjetaError = (estado, urlBase) => (
    <a
      href={estado.abrir || urlBase}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3.5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors"
    >
      <MdPhotoCamera className="text-3xl text-brand-deep shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-brand-deep">Evidencia de la entrega</span>
        <span className="block text-xs text-brand-ink/60">Clic para abrirla en una nueva pestaña</span>
      </span>
    </a>
  )

  return (
    <>
      {/* Carrusel: se muestra UNA foto a la vez con flechas y contador */}
      <div className="relative">
        {actual.esPdf ? (
          enlacePdfCard(actual, lista[indice])
        ) : actual.cargando ? (
          tarjetaCarga()
        ) : actual.error || !actual.src ? (
          tarjetaError(actual, lista[indice])
        ) : (
          <button
            type="button"
            onClick={() => setAmpliado(true)}
            title="Ver la evidencia en grande"
            className="group relative block w-full rounded-xl overflow-hidden border border-brand-ink/10 bg-brand-ink/5 cursor-zoom-in"
          >
            <img
              src={actual.src}
              alt={`Evidencia de la entrega ${indice + 1}`}
              className="w-full max-h-72 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-3 py-1 text-[11px] font-bold">
              <MdVerified className="text-sm text-green-400" /> Foto de la entrega
            </span>
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-3 py-1 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              <MdZoomIn className="text-sm" /> Ver en grande
            </span>
          </button>
        )}

        {total > 1 && !actual.esPdf && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); irA(indice - 1) }}
              disabled={indice === 0}
              aria-label="Foto anterior"
              title="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition"
            >
              <MdChevronLeft className="text-xl" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); irA(indice + 1) }}
              disabled={indice >= total - 1}
              aria-label="Foto siguiente"
              title="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition"
            >
              <MdChevronRight className="text-xl" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white px-2.5 py-1 text-[11px] font-extrabold">
              {indice + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Miniaturas para saltar entre fotos */}
      {total > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {estados.map((e, i) => (
            <button
              key={`${i}-${lista[i]}`}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Foto ${i + 1}`}
              title={`Ver foto ${i + 1}`}
              className={`relative shrink-0 size-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === indice ? 'border-brand-cyan ring-2 ring-brand-cyan/30' : 'border-brand-ink/10 opacity-60 hover:opacity-100'
              }`}
            >
              {e.esPdf ? (
                <span className="grid place-items-center w-full h-full bg-red-50 text-red-600">
                  <MdPictureAsPdf className="text-xl" />
                </span>
              ) : e.src ? (
                <img src={e.src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <span className="grid place-items-center w-full h-full bg-brand-ink/10 text-brand-deep">
                  <MdPhotoCamera className="text-lg" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Ver en grande: TODAS las fotos con navegación */}
      {ampliado && (
        <div
          className="fixed inset-0 z-[1300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setAmpliado(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Evidencia de la entrega"
        >
          <div
            className="relative w-full max-w-6xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <h3 className="text-white font-extrabold text-sm sm:text-base inline-flex items-center gap-2 min-w-0">
                <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shrink-0">
                  <MdPhotoCamera className="text-brand-cyan text-lg" />
                </span>
                <span className="truncate">
                  EVIDENCIA DE LA ENTREGA{total > 1 ? ` · ${indice + 1}/${total}` : ''}
                </span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={actual.src}
                  download
                  className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Descargar"
                  aria-label="Descargar"
                >
                  <MdDownload className="text-lg" />
                </a>
                {actual.abrir && (
                  <a
                    href={actual.abrir}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                    title="Abrir en otra pestaña"
                    aria-label="Abrir en otra pestaña"
                  >
                    <MdOpenInNew className="text-lg" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setAmpliado(false)}
                  className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Cerrar"
                  aria-label="Cerrar"
                >
                  <MdClose className="text-lg" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-0">
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => irA(indice - 1)}
                    disabled={indice === 0}
                    className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 grid place-items-center size-10 sm:size-12 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-30 transition"
                    aria-label="Foto anterior"
                  >
                    <MdChevronLeft className="text-2xl" />
                  </button>
                  <button
                    type="button"
                    onClick={() => irA(indice + 1)}
                    disabled={indice >= total - 1}
                    className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10 grid place-items-center size-10 sm:size-12 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-30 transition"
                    aria-label="Foto siguiente"
                  >
                    <MdChevronRight className="text-2xl" />
                  </button>
                </>
              )}
              {actual.esPdf ? (
                enlacePdfCard(actual, lista[indice])
              ) : actual.src ? (
                <img
                  src={actual.src}
                  alt={`Evidencia de la entrega ${indice + 1}`}
                  className="w-full max-h-[68vh] object-contain rounded-xl bg-white/5"
                />
              ) : (
                <div className="flex items-center justify-center rounded-xl bg-white/5 h-[40vh] text-sm font-bold text-white/70">
                  No se pudo cargar esta imagen
                </div>
              )}
            </div>

            {total > 1 && (
              <div className="flex items-center justify-center gap-2 overflow-x-auto pt-3 pb-1">
                {estados.map((e, i) => (
                  <button
                    key={`${i}-${lista[i]}`}
                    type="button"
                    onClick={() => setIndice(i)}
                    aria-label={`Foto ${i + 1}`}
                    title={`Ver foto ${i + 1}`}
                    className={`relative shrink-0 size-14 sm:size-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === indice ? 'border-brand-cyan ring-2 ring-brand-cyan/40' : 'border-white/20 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {e.esPdf ? (
                      <span className="grid place-items-center w-full h-full bg-red-50 text-red-600">
                        <MdPictureAsPdf className="text-xl" />
                      </span>
                    ) : e.src ? (
                      <img src={e.src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="grid place-items-center w-full h-full bg-white/10 text-white/60">
                        <MdPhotoCamera className="text-lg" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}