import { useEffect, useMemo, useState } from 'react'
import { MdClose, MdCloudUpload, MdOutlineContentPaste, MdWarning } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import { guardarInventario } from '../../../services/inventarioApi.js'
import { errorInventario, inventarioSubido } from '../../../services/notificaciones.jsx'
import { COLUMNAS_ORIGINALES, formatearFecha, parsearPegado } from '../../../utils/inventarioUtils.js'

const MAX_FILAS = 20000

const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-brand-ink ' +
  'placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

const BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait'

const BOTON_PRIMARIO = `${BOTON} bg-brand-cyan text-brand-ink shadow-cyanGlow hover:bg-brand-cyanSoft`
const BOTON_NEUTRO = `${BOTON} bg-brand-ink/10 text-brand-ink hover:bg-brand-ink/15`

// Sube el reporte de Excel. El usuario copia las filas en Excel (Ctrl+C) y las
// pega aquí: el portapapeles da tabulación, así que el parser acepta tab, ';' y
// ',' por si viene de un CSV. Cada subida REEMPLAZA el inventario completo.
export default function SubirInventarioModal({ open, onClose, onSubido }) {
  const [texto, setTexto] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // Se analiza lo pegado en vivo para mostrar el conteo antes de subir.
  const previsualizacion = useMemo(() => parsearPegado(texto), [texto])
  const { filas, conEncabezado, fechasInvalidas } = previsualizacion

  useEffect(() => {
    if (!open) return
    setTexto('')
    setErrorForm('')
  }, [open])

  // Escape cierra, salvo que haya una subida en curso.
  useEffect(() => {
    if (!open) return
    const alPulsarTecla = (e) => {
      if (e.key !== 'Escape') return
      if (subiendo) return
      onClose()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [open, subiendo, onClose])

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
          {/* Instrucciones + columnas */}
          <div className="rounded-2xl border border-brand-cyan/35 bg-brand-cyan/5 p-4">
            <p className="text-sm font-semibold text-brand-ink/80 inline-flex items-start gap-2">
              <MdOutlineContentPaste className="text-brand-cyan mt-0.5 shrink-0 text-lg" />
              <span>
                Selecciona las filas del reporte en Excel y cópialas (Ctrl+C). Pégalas
                aquí tal cual: se respeta el orden de las columnas y, si la primera
                línea es el encabezado, se reconoce por su nombre.
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {COLUMNAS_ORIGINALES.map((c) => (
                <span
                  key={c.key}
                  className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-brand-deep ring-1 ring-brand-cyan/30"
                >
                  {c.etiqueta}
                </span>
              ))}
            </div>
          </div>

          {/* Pegar */}
          <div>
            <label htmlFor="pegar-inventario" className="mb-1.5 block text-xs font-bold text-brand-ink/70">
              Filas copiadas de Excel
            </label>
            <textarea
              id="pegar-inventario"
              value={texto}
              onChange={(e) => { setTexto(e.target.value); if (errorForm) setErrorForm('') }}
              placeholder={'Pega aquí las filas del reporte…\nA-001\tCLORO 500ML\tL-2027\t15/01/2027\t120\t120\t1\tPRINCIPAL\tBOGOTA\tSOLUCIONES\tSECA\tSI'}
              spellCheck={false}
              rows={8}
              className={`${CLASES_CAMPO} font-mono text-xs leading-relaxed resize-y min-h-36`}
            />
          </div>

          {/* Vista previa */}
          {filas.length > 0 ? (
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
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-brand-navy text-white uppercase tracking-wider">
                      {COLUMNAS_ORIGINALES.map((c) => (
                        <th key={c.key} className="px-2.5 py-2 font-bold whitespace-nowrap border-r border-white/15">
                          {c.etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.slice(0, 5).map((f, i) => (
                      <tr key={i} className="odd:bg-white even:bg-brand-ink/[0.02]">
                        <td className="px-2.5 py-2 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">{f.numero_articulo || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 border-b border-l border-brand-ink/10">{f.descripcion || '—'}</td>
                        <td className="px-2.5 py-2 text-brand-ink/80 font-mono whitespace-nowrap border-b border-l border-brand-ink/10">{f.lote || '—'}</td>
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
              {filas.length > 5 && (
                <p className="bg-brand-ink/5 px-4 py-2 text-[11px] font-bold text-brand-ink/50">
                  Vista previa de las primeras 5 filas.
                </p>
              )}
            </div>
          ) : texto.trim() ? (
            <p className="text-xs font-semibold text-amber-700">
              No se reconocieron filas. Revisa que hayas copiado las celdas del reporte (se separan con tabulación al copiar de Excel).
            </p>
          ) : null}

          {/* Aviso de reemplazo */}
          <p className="text-xs font-semibold text-brand-ink/60">
            Al subir, este reporte <span className="font-extrabold text-brand-ink">reemplaza por completo</span> el
            inventario actual ({filas.length.toLocaleString('es-CO')} fila{filas.length === 1 ? '' : 's'} se
            guardarán; las que existan ahora desaparecerán).
          </p>

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
      </div>
    </Modal>
  )
}
