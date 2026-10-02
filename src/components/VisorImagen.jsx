import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MdClose,
  MdImage,
  MdOpenInNew,
  MdDownload,
  MdCloudQueue,
  MdBrokenImage,
  MdChevronLeft,
  MdChevronRight,
  MdPhotoLibrary,
} from 'react-icons/md'
import { resolverArchivo } from '../services/visorArchivos.js'

// ============================================================================
// GALERIA DE IMAGENES
// El equivalente al visor de PDF, pero para las fotos de una entrega. Antes solo
// enseñaba una imagen suelta; si la entrega traía varias, había que cerrar el
// visor y abrir la siguiente una a una. Ahora es una galería: se ven todas, una
// grande a la vez, y se pasa de una a otra con las flechas, con el teclado o
// tocando su miniatura.
//
// Hace lo mismo que VisorPdfModal al resolver cada dirección —firmar las rutas
// crudas y avisar si el archivo ya no está— porque las fotos llegan igual que los
// PDF. Si una imagen falla al CARGAR (no al resolver) se avisa en vez de dejar
// el icono de imagen rota del navegador.
//
// Solo se resuelve la imagen visible y sus dos vecinas: así abrir una entrega con
// diez fotos no dispara diez peticiones de golpe.
//
// POR QUÉ SE MONTA CON UN PORTAL — y no es un detalle menor. El visor se pinta con
// `position: fixed`, y un ancestro con `transform`, `filter`, `backdrop-filter`,
// `perspective` o `contain` se convierte en el bloque contenedor de sus descendientes
// fijos: el `fixed` deja de referirse a la pantalla y pasa a referirse a ESA caja.
//
// El caso real era el modal de adjuntos: su tarjeta lleva `animate-scaleIn`, cuya
// animación termina en `transform: scale(1)` y va con `fill-mode: both`, o sea que la
// transform sigue vigente cuando la animación acaba. El visor abría anclado a la
// tarjeta de adjuntos en vez de a la ventana, y por eso quedaba metido dentro del
// modal y recortado. Montarlo en document.body corta la cadena de ancestros y lo
// deja siempre a pantalla completa, se llame desde donde se llame.
// ============================================================================

const TIEMPO_LIMITE_MS = 25000
const TOTAL_MINIATURAS = 40

function sinDuplicados(lista) {
  return [...new Set(lista.filter(Boolean))]
}

export default function VisorImagen({ open, url, urls, inicio = 0, onClose, titulo = 'VISTA PREVIA DE LA IMAGEN' }) {
  // Acepta las dos formas: la nueva `urls` (galería) y la antigua `url` (una sola
  // imagen). Así los llamadores que aún no pasan la lista siguen funcionando.
  const lista = useMemo(() => sinDuplicados(urls && urls.length ? urls : url ? [url] : []), [urls, url])

  const [indice, setIndice] = useState(inicio)
  const [porUrl, setPorUrl] = useState({})
  const cache = useRef(new Map())

  const total = lista.length
  const actual = lista[indice] || ''

  // Al abrir con otra foto de entrada se arranca en esa, no en la primera.
  useEffect(() => {
    if (open) setIndice(Math.min(Math.max(inicio, 0), Math.max(lista.length - 1, 0)))
  }, [open, inicio, lista.length])

  // Resuelve una imagen y publica su estado. El tope de espera va AQUÍ y no en el
  // efecto que la dispara, porque es este el que dibuja el spinner: si el reloj
  // venciera sin tocar el estado, la imagen se quedaría con «Cargando…» para
  // siempre en vez de avisar de que no llegó.
  const cargar = useCallback(async (u) => {
    if (!u) return null
    const guardado = cache.current.get(u)
    if (guardado) return guardado

    setPorUrl((prev) => ({ ...prev, [u]: { cargando: true, error: '', src: '', nombre: '' } }))

    const p = new Promise((resolve, reject) => {
      const reloj = setTimeout(() => {
        cache.current.delete(u)
        setPorUrl((prev) => ({
          ...prev,
          [u]: { cargando: false, error: 'Tiempo de espera agotado al cargar la imagen', src: '', nombre: '' },
        }))
        reject(new Error('Tiempo de espera agotado al cargar la imagen'))
      }, TIEMPO_LIMITE_MS)

      resolverArchivo(u).then(
        (res) => {
          clearTimeout(reloj)
          cache.current.set(u, res)
          setPorUrl((prev) => ({ ...prev, [u]: { cargando: false, error: '', ...res } }))
          resolve(res)
        },
        (err) => {
          clearTimeout(reloj)
          // Se saca de la caché: si el fallo se guardara, la imagen ya no volvería
          // a pedirse nunca en la sesión, y hay fallos transitorios reales —la
          // firma de la ruta caduca mientras la pantalla está abierta— que sí se
          // resuelven al reintentar.
          cache.current.delete(u)
          setPorUrl((prev) => ({
            ...prev,
            [u]: { cargando: false, error: err.message || 'No se pudo cargar la imagen', src: '', nombre: '' },
          }))
          reject(err)
        }
      )
    })

    cache.current.set(u, p)
    return p
  }, [])

  // Visible + vecinas. Al llegar al final la lista vuelve a empezar, así que la
  // foto de la última y la primera ya se están trayendo antes de hace falta.
  // El fallo se calla con catch vacío porque el mensaje ya está en pantalla: aquí
  // solo se dispara la carga.
  useEffect(() => {
    if (!open || total === 0) return undefined
    for (const salto of [0, -1, 1]) {
      const i = ((indice + salto) % total + total) % total
      const u = lista[i]
      if (u) cargar(u).catch(() => {})
    }
    return undefined
  }, [open, indice, total, lista, cargar])

  const irA = useCallback(
    (i) => {
      if (total === 0) return
      setIndice(((i % total) + total) % total)
    },
    [total]
  )

  // Flechas del teclado y Escape. Las flechas solo con el visor abierto: si no,
  // interfieren con los campos de texto de debajo.
  useEffect(() => {
    if (!open) return undefined
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alTeclear = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') irA(indice - 1)
      if (e.key === 'ArrowRight') irA(indice + 1)
    }
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', alTeclear)
    }
  }, [open, onClose, indice, irA])

  if (!open || total === 0) return null

  const estado = porUrl[actual] || { cargando: true, src: '', nombre: '', error: '' }
  const hayError = Boolean(estado.error || estado.falloCarga)

  // Fondo, tarjeta y cabecera calcos de VisorPdfModal, para que los tres visores
  // se vean como el mismo componente y no como tres pantallas distintas. El
  // anterior iba con tarjeta azul marino y un halo cian de fondo; aquí es
  // tarjeta blanca y fondo gris claro, como el resto de la aplicación.
  return createPortal(
    <div
      className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        // Altura fija: garantiza que la tarjeta nunca supere la pantalla y, por
        // tanto, que el centrado vertical no recorte nada. Sin min-h-0 en el
        // cuerpo, el hijo con flex-1 no baja de su tamaño de contenido, el scroll
        // interno no se activa y la tarjeta desborda hacia arriba llevándose por
        // delante la cabecera con los botones.
        className="relative bg-white text-brand-ink w-full max-w-7xl rounded-2xl shadow-2xl animate-scaleIn h-[92vh] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Cabecera: misma de VisorPdfModal y VisorExcel */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow shrink-0">
              <MdImage className="text-brand-cyan text-lg" />
            </span>
            <span className="truncate">
              {total > 1 ? (
                <>
                  <span className="block text-[11px] font-bold uppercase tracking-wide leading-none mb-0.5 text-white/70">
                    {titulo}
                  </span>
                  Imagen {indice + 1} de {total}
                </>
              ) : (
                estado.nombre || titulo
              )}
            </span>
          </h3>

          <div className="flex items-center gap-2 shrink-0">
            {estado.src && !hayError && (
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

        {/* Cuerpo: fondo gris claro, como VisorPdfModal y VisorExcel */}
        <div className="relative flex-1 min-h-0 bg-brand-deep/5 p-2 sm:p-3 overflow-hidden grid place-items-center">
          {estado.cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-brand-mist/50">
              <MdCloudQueue className="text-4xl text-brand-cyan animate-pulse" />
              <p className="text-sm font-bold text-brand-deep">Cargando imagen…</p>
            </div>
          )}

          {estado.cargando ? null : hayError ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
              <MdBrokenImage className="text-5xl text-brand-deep/40" />
              <p className="text-sm font-bold text-red-600">{estado.error || 'No se pudo cargar la imagen'}</p>
              <p className="text-xs text-brand-ink/60">
                Puede que la imagen ya no esté en el servidor. Vuelve a adjuntarla para que quede
                disponible.
              </p>
            </div>
          ) : (
            <img
              src={estado.src}
              alt={estado.nombre || `Imagen ${indice + 1} de ${total}`}
              onError={() =>
                setPorUrl((prev) => ({ ...prev, [actual]: { ...prev[actual], falloCarga: true } }))
              }
              className="max-h-full max-w-full object-contain rounded-xl"
            />
          )}

          {/* Flechas de paginación: z-20 para poder cambiar de foto mientras la
              siguiente todavía está cargando. Sobre fondo claro llevan anillo
              oscuro para que se vean contra la imagen. */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => irA(indice - 1)}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-11 sm:size-14 rounded-full bg-white text-brand-deep shadow-lg ring-1 ring-brand-ink/10 hover:bg-brand-cyan transition active:scale-95"
                title="Imagen anterior"
                aria-label="Imagen anterior"
              >
                <MdChevronLeft className="text-2xl sm:text-3xl" />
              </button>
              <button
                type="button"
                onClick={() => irA(indice + 1)}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-11 sm:size-14 rounded-full bg-white text-brand-deep shadow-lg ring-1 ring-brand-ink/10 hover:bg-brand-cyan transition active:scale-95"
                title="Imagen siguiente"
                aria-label="Imagen siguiente"
              >
                <MdChevronRight className="text-2xl sm:text-3xl" />
              </button>
            </>
          )}
        </div>

        {/* Paginación: contador y miniaturas de todas las fotos */}
        {total > 1 && (
          <div className="shrink-0 border-t border-brand-ink/10 bg-brand-mist/60 px-3 sm:px-5 py-2.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink/60 shrink-0">
                <MdPhotoLibrary className="text-base" />
                {indice + 1}/{total}
              </span>

              <div className="flex items-center gap-2 overflow-x-auto py-1 flex-1">
                {lista.slice(0, TOTAL_MINIATURAS).map((u, i) => {
                  const min = porUrl[u]
                  const activo = i === indice
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => irA(i)}
                      aria-label={`Ir a la imagen ${i + 1}`}
                      aria-current={activo ? 'true' : undefined}
                      title={`Imagen ${i + 1}`}
                      className={`relative shrink-0 size-14 sm:size-16 rounded-lg overflow-hidden transition ${
                        activo
                          ? 'ring-2 ring-brand-cyan shadow-cyanGlow'
                          : 'opacity-60 hover:opacity-100 ring-1 ring-brand-ink/10'
                      }`}
                    >
                      {min && min.src ? (
                        <img src={min.src} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="w-full h-full grid place-items-center bg-white ring-1 ring-brand-ink/10">
                          <MdImage className="text-lg text-brand-ink/30" />
                        </span>
                      )}
                      {activo && (
                        <span className="absolute bottom-0 inset-x-0 bg-brand-cyan/80 py-px text-[9px] font-extrabold text-brand-ink text-center">
                          {i + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
                {lista.length > TOTAL_MINIATURAS && (
                  <span className="shrink-0 text-xs font-bold text-brand-ink/50 px-2">
                    +{lista.length - TOTAL_MINIATURAS}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}