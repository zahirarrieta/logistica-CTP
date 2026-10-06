import { useEffect, useMemo, useState } from 'react'
import {
  MdClose,
  MdCloudUpload,
  MdEditNote,
  MdHelpOutline,
  MdOutlineContentPaste,
  MdVisibility,
  MdWarning,
} from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import { guardarInventario } from '../../../services/inventarioApi.js'
import { errorInventario, inventarioSubido } from '../../../services/notificaciones.jsx'
import { COLUMNAS_ORIGINALES, formatearFecha, parsearPegado } from '../../../utils/inventarioUtils.js'

const MAX_FILAS = 20000
const PREVIEW_LIMITE = 50

const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-brand-ink ' +
  'placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

const BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait'

const BOTON_PRIMARIO = `${BOTON} bg-brand-cyan text-brand-ink shadow-cyanGlow hover:bg-brand-cyanSoft`
const BOTON_NEUTRO = `${BOTON} bg-brand-ink/10 text-brand-ink hover:bg-brand-ink/15`
const BOTON_AYUDA = `${BOTON} bg-brand-cyan/10 text-brand-deep ring-1 ring-brand-cyan/40 hover:bg-brand-cyan/20`

// Pasos de uso (se muestran en el modal de ayuda, no en el formulario).
const PASOS = [
  'Selecciona las filas del reporte en Excel. Si la primera línea es el encabezado puedes incluirla: se reconoce por su nombre.',
  'Cópialas con Ctrl+C.',
  'Pégalas en el recuadro de texto: al pegar, la tabla aparece de una vez con las filas que se van a subir.',
  'Si algo salió mal, pulsa «Editar texto pegado» y vuelve a pegar.',
]

// Sube el reporte de Excel. El usuario copia las filas en Excel (Ctrl+C) y las
// pega aquí: el portapapeles da tabulación, así que el parser acepta tab, ';' y
// ',' por si viene de un CSV. Cada subida REEMPLAZA el inventario completo.
export default function SubirInventarioModal({ open, onClose, onSubido }) {
  const [texto, setTexto] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  // Al pegar se oculta el recuadro y se ve la tabla directo; con «Editar texto
  // pegado» (o pegando de nuevo) se vuelve al recuadro.
  const [editando, setEditando] = useState(false)

  // Se analiza lo pegado en vivo para mostrar el conteo antes de subir.
  const previsualizacion = useMemo(() => parsearPegado(texto), [texto])
  const { filas, conEncabezado, fechasInvalidas } = previsualizacion

  useEffect(() => {
    if (!open) return
    setTexto('')
    setErrorForm('')
    setAyudaAbierta(false)
    setEditando(false)
  }, [open])

  // Escape cierra: primero el modal de ayuda, luego el principal. Salvo subida.
  useEffect(() => {
    if (!open) return
    const alPulsarTecla = (e) => {
      if (e.key !== 'Escape') return
      if (ayudaAbierta) {
        setAyudaAbierta(false)
        return
      }
      if (subiendo) return
      onClose()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [open, subiendo, ayudaAbierta, onClose])

  const subir = async () => {
    if (subiendo) return
    if (filas.length === 0) {
      setErrorForm('Pega al menos una fila del reporte de Excel.')
      return
    }
    if (filas.length > MAX_FILAS) {
      setErrorForm(`El reporte tiene ${filas.length.toLocaleString('es-CO')} filas; el máximo por subida es ${MAX_FILAS.toLocaleString('es-CO')}.`)
      return
    }
    setSubiendo(true)
    setErrorForm('')
    try {
      const res = await guardarInventario(filas)
      inventarioSubido(res?.total ?? filas.length)
      setTexto('')
      onSubido?.()
      onClose()
    } catch (err) {
      setErrorForm(err.message || 'No se pudo subir el inventario')
      errorInventario(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  if (!open) return null

  const excede = filas.length > MAX_FILAS
  const hayFilas = filas.length > 0
  const viendoTabla = hayFilas && !editando
  const viendoRecuadro = !hayFilas || editando
  const vistaPrevia = filas.slice(0, PREVIEW_LIMITE)

  return (
    <Modal onClose={subiendo ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-subir-inventario"
        className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3
            id="titulo-subir-inventario"
            className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdCloudUpload className="text-brand-cyan text-lg" />
            </span>
            SUBIR INFORMACIÓN
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={subiendo}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Barra: ayuda + volver a editar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setAyudaAbierta(true)} className={BOTON_AYUDA}>
              <MdHelpOutline className="text-base" />
              ¿Cómo pegar el reporte?
            </button>
            {viendoTabla && (
              <button type="button" onClick={() => setEditando(true)} className={BOTON_NEUTRO}>
                <MdEditNote className="text-base" />
                Editar texto pegado
              </button>
            )}
          </div>

          {/* Recuadro de pegar: se ve hasta que se pega (y al volver a editar) */}
          {viendoRecuadro && (
            <div>
              <label htmlFor="pegar-inventario" className="mb-1.5 block text-xs font-bold text-brand-ink/70">
                Filas copiadas de Excel
              </label>
              <textarea
                id="pegar-inventario"
                value={texto}
                onChange={(e) => { setTexto(e.target.value); if (errorForm) setErrorForm('') }}
                onPaste={() => setEditando(false)}
                placeholder="Pega aquí las filas copiadas de Excel…"
                spellCheck={false}
                rows={8}
                className={`${CLASES_CAMPO} text-xs leading-relaxed resize-y min-h-40`}
              />
              {hayFilas && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => setEditando(false)} className={BOTON_PRIMARIO}>
                    <MdVisibility className="text-base" />
                    Ver tabla
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vista previa: tabla con scroll propio (se ve al pegar) */}
          {viendoTabla && (
            <div className="rounded-2xl border border-brand-ink/15 overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-brand-ink/5 px-4 py-2.5 text-xs font-bold text-brand-ink/70">
                <span>{filas.length.toLocaleString('es-CO')} fila{filas.length === 1 ? '' : 's'} reconocida{filas.length === 1 ? '' : 's'}</span>
                <span>{conEncabezado ? 'Encabezado detectado' : 'Sin encabezado: se usa el orden de las columnas'}</span>
                {fechasInvalidas > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <MdWarning className="text-sm" />
                    {fechasInvalidas} fecha{fechasInvalidas === 1 ? '' : 's'} no reconocida{fechasInvalidas === 1 ? '' : 's'} (quedará{fechasInvalidas === 1 ? '' : 'n'} vacía{fechasInvalidas === 1 ? '' : 's'})
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[860px]">
                  <thead>
                    <tr className="bg-brand-navy text-white uppercase tracking-wider">
                      {COLUMNAS_ORIGINALES.map((c) => (
                        <th
                          key={c.key}
                          className="sticky top-0 z-10 bg-brand-navy px-2.5 py-2 font-bold whitespace-nowrap border-r border-white/15"
                        >
                          {c.etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vistaPrevia.map((f, i) => (
                      <tr key={i} className="odd:bg-white even:bg-brand-ink/[0.02]">
                        <td className="px-2.5 py-2 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">{f.numero_articulo || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 border-b border-l border-brand-ink/10">{f.descripcion || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.lote || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{formatearFecha(f.fecha_vencimiento)}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.cantidad || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.dias_inventario || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.bodega || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.nombre_bodega || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.zona || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.grupo_articulos || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.tipo_bodega || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{f.comercial || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filas.length > PREVIEW_LIMITE && (
                <p className="bg-brand-ink/5 px-4 py-2 text-[11px] font-bold text-brand-ink/50">
                  Vista previa de las primeras {PREVIEW_LIMITE} filas; al subir se guardan las {filas.length.toLocaleString('es-CO')}.
                </p>
              )}
            </div>
          )}

          {hayFilas ? (
            /* Aviso de reemplazo */
            <p className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-amber-800">
              Al subir, este reporte <span className="font-extrabold">reemplaza por completo</span> el
              inventario actual ({filas.length.toLocaleString('es-CO')} fila{filas.length === 1 ? '' : 's'} se
              guardarán; las que existan ahora desaparecerán).
            </p>
          ) : texto.trim() ? (
            <p className="text-xs font-semibold text-amber-700">
              No se reconocieron filas. Revisa que hayas copiado las celdas del reporte (se separan con tabulación al copiar de Excel).
            </p>
          ) : null}

          {excede && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              El reporte supera el máximo de {MAX_FILAS.toLocaleString('es-CO')} filas por subida.
            </p>
          )}

          {errorForm ? (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {errorForm}
            </p>
          ) : null}
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={subiendo}
            className={BOTON_NEUTRO}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={subir}
            disabled={subiendo || filas.length === 0 || excede}
            className={BOTON_PRIMARIO}
          >
            <MdCloudUpload className="text-base" />
            {subiendo ? 'SUBIENDO…' : `SUBIR ${filas.length > 0 ? `(${filas.length.toLocaleString('es-CO')})` : ''}`}
          </button>
        </div>

        {/* Modal de ayuda: cómo pegar el reporte */}
        {ayudaAbierta && (
          <div
            className="fixed inset-0 z-[70] bg-brand-ink/60 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setAyudaAbierta(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-ayuda-pegar"
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-scaleIn max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
                <h4
                  id="titulo-ayuda-pegar"
                  className="text-white font-extrabold text-sm sm:text-base inline-flex items-center gap-2"
                >
                  <span className="grid place-items-center size-7 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40">
                    <MdHelpOutline className="text-brand-cyan" />
                  </span>
                  CÓMO PEGAR EL REPORTE
                </h4>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setAyudaAbierta(false)}
                  className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                >
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
                <ol className="space-y-2.5 text-sm text-brand-ink/80 list-decimal list-inside marker:text-brand-cyan marker:font-extrabold marker:text-base">
                  {PASOS.map((paso, i) => (
                    <li key={i} className="pl-1">{paso}</li>
                  ))}
                </ol>
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-brand-ink/50">
                    Orden de las columnas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLUMNAS_ORIGINALES.map((c) => (
                      <span
                        key={c.key}
                        className="rounded-full bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        {c.etiqueta}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="rounded-xl bg-brand-cyan/5 ring-1 ring-brand-cyan/30 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-brand-deep">
                  Recuerda: cada subida <span className="font-extrabold">reemplaza todo</span> el inventario
                  actual, no agrega encima.
                </p>
              </div>
              <div className="flex justify-end px-4 sm:px-5 py-3 border-t border-brand-ink/10 shrink-0">
                <button type="button" onClick={() => setAyudaAbierta(false)} className={BOTON_PRIMARIO}>
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
