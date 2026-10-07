import { useEffect, useMemo, useState } from 'react'
import {
  MdAddCircleOutline,
  MdChangeCircle,
  MdClose,
  MdCloudUpload,
  MdEditNote,
  MdEventAvailable,
  MdEventBusy,
  MdHelpOutline,
  MdOutlineContentPaste,
  MdOutlineHistory,
  MdRemoveCircleOutline,
  MdVisibility,
  MdWarning,
} from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import { guardarInventario } from '../../../services/inventarioApi.js'
import { errorInventario, inventarioSubido } from '../../../services/notificaciones.jsx'
import { getBadgeColor, getDotColor } from '../../../utils/estadoColors.js'
import {
  COLUMNAS_ORIGINALES,
  compararInventario,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  formatearFechaHora,
  parsearPegado,
} from '../../../utils/inventarioUtils.js'

const MAX_FILAS = 20000
const PREVIEW_LIMITE = 50
const PREVIEW_ANTERIOR = 30
const LISTA_LIMITE = 40

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
  'Antes de subir revisa los cambios: qué se agrega, qué se elimina y qué se modifica respecto al inventario actual.',
]

const ETIQUETA = Object.fromEntries(COLUMNAS_ORIGINALES.map((c) => [c.key, c.etiqueta]))

function BadgeEstado({ estado }) {
  if (!estado) {
    return (
      <span className="inline-flex items-center rounded-full bg-brand-ink/5 px-2 py-0.5 text-[10px] font-bold text-brand-ink/50">
        Sin fecha
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${getBadgeColor(estado)}`}>
      <span className={`size-1.5 rounded-full ${getDotColor(estado)}`} />
      {estado}
    </span>
  )
}

// Panel del inventario que ya está guardado (la «tabla anterior»).
function InventarioActual({ actuales, actualizadoEn }) {
  const resumen = useMemo(() => {
    let vencidos = 0
    let proximos = 0
    let vigentes = 0
    for (const f of actuales) {
      const e = estadoVencimiento(f.fecha_vencimiento)
      if (e === 'Vencido') vencidos += 1
      else if (e === 'Próximo a vencer') proximos += 1
      else if (e === 'Vigente') vigentes += 1
    }
    return { vencidos, proximos, vigentes }
  }, [actuales])

  const vista = actuales.slice(0, PREVIEW_ANTERIOR)

  return (
    <div className="rounded-2xl border border-brand-ink/15 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-brand-navy text-white px-4 py-2.5 text-xs font-bold">
        <span className="inline-flex items-center gap-1.5">
          <MdOutlineHistory className="text-base" />
          Inventario actual
        </span>
        <span className="text-white/70">{formatearEntero(actuales.length)} fila{actuales.length === 1 ? '' : 's'}</span>
        {actualizadoEn && <span className="text-white/60">Actualizado: {formatearFechaHora(actualizadoEn)}</span>}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 bg-brand-ink/[0.03]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 ring-1 ring-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700">
          <MdEventBusy className="text-sm" /> {formatearEntero(resumen.vencidos)} vencidos
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 ring-1 ring-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-800">
          <MdWarning className="text-sm" /> {formatearEntero(resumen.proximos)} próximos
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 ring-1 ring-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
          <MdEventAvailable className="text-sm" /> {formatearEntero(resumen.vigentes)} vigentes
        </span>
      </div>

      {actuales.length === 0 ? (
        <p className="px-4 pb-4 text-xs font-semibold text-brand-ink/50">
          Todavía no hay inventario guardado. Esta subida será la primera.
        </p>
      ) : (
        <>
          <div className="max-h-52 overflow-auto border-t border-brand-ink/10">
            <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[620px]">
              <thead>
                <tr className="bg-brand-ink/5 uppercase tracking-wider text-brand-ink/60">
                  <th className="sticky top-0 z-10 bg-brand-ink/5 px-2.5 py-2 font-bold whitespace-nowrap border-b border-brand-ink/10">Artículo</th>
                  <th className="sticky top-0 z-10 bg-brand-ink/5 px-2.5 py-2 font-bold border-b border-brand-ink/10">Descripción</th>
                  <th className="sticky top-0 z-10 bg-brand-ink/5 px-2.5 py-2 font-bold whitespace-nowrap border-b border-brand-ink/10">Lote</th>
                  <th className="sticky top-0 z-10 bg-brand-ink/5 px-2.5 py-2 font-bold whitespace-nowrap border-b border-brand-ink/10">Vence</th>
                  <th className="sticky top-0 z-10 bg-brand-ink/5 px-2.5 py-2 font-bold border-b border-brand-ink/10">Estado</th>
                </tr>
              </thead>
              <tbody>
                {vista.map((f, i) => (
                  <tr key={f.id ?? i} className="odd:bg-white even:bg-brand-ink/[0.02]">
                    <td className="px-2.5 py-1.5 font-bold text-brand-deep whitespace-nowrap border-b border-brand-ink/10">{f.numero_articulo || '—'}</td>
                    <td className="px-2.5 py-1.5 text-brand-ink/70 border-b border-brand-ink/10 max-w-[240px] truncate">{f.descripcion || '—'}</td>
                    <td className="px-2.5 py-1.5 text-brand-ink/70 whitespace-nowrap border-b border-brand-ink/10">{f.lote || '—'}</td>
                    <td className="px-2.5 py-1.5 text-brand-ink/70 whitespace-nowrap border-b border-brand-ink/10">{formatearFecha(f.fecha_vencimiento)}</td>
                    <td className="px-2.5 py-1.5 border-b border-brand-ink/10"><BadgeEstado estado={estadoVencimiento(f.fecha_vencimiento)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {actuales.length > PREVIEW_ANTERIOR && (
            <p className="bg-brand-ink/5 px-4 py-2 text-[11px] font-bold text-brand-ink/50">
              Mostrando {PREVIEW_ANTERIOR} de {formatearEntero(actuales.length)} filas actuales.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function FilaCambio({ children }) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-brand-ink/5 last:border-0">
      {children}
    </li>
  )
}

function GrupoCambios({ icon, titulo, color, items, vacio, render }) {
  return (
    <details className="rounded-xl border border-brand-ink/10 overflow-hidden" open={items.length > 0}>
      <summary className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-xs font-extrabold ${color}`}>
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {titulo}
        </span>
        <span className="tabular-nums">{formatearEntero(items.length)}</span>
      </summary>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-[11px] font-semibold text-brand-ink/40 border-t border-brand-ink/5">{vacio}</p>
      ) : (
        <ul className="max-h-44 overflow-auto border-t border-brand-ink/5">
          {items.slice(0, LISTA_LIMITE).map(render)}
          {items.length > LISTA_LIMITE && (
            <li className="px-3 py-1.5 text-[11px] font-bold text-brand-ink/40">
              … y {formatearEntero(items.length - LISTA_LIMITE)} más
            </li>
          )}
        </ul>
      )}
    </details>
  )
}

// Compara el inventario guardado con el pegado y resume qué cambia.
function PanelCambios({ diff }) {
  const { agregadas, modificadas, eliminadas, sinCambios } = diff
  const totalCambios = agregadas.length + modificadas.length + eliminadas.length

  return (
    <div className="rounded-2xl border border-brand-ink/15 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-gradient-to-r from-brand-navy to-brand-deep text-white px-4 py-2.5 text-xs font-bold">
        <span className="inline-flex items-center gap-1.5">
          <MdChangeCircle className="text-base" />
          Cambios detectados
        </span>
        <span className={totalCambios === 0 ? 'text-white/70' : 'text-brand-cyan'}>
          {totalCambios === 0 ? 'Sin cambios respecto al inventario actual' : `${formatearEntero(totalCambios)} cambio${totalCambios === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <GrupoCambios
          icon={<MdAddCircleOutline className="text-sm" />}
          titulo="Nuevas"
          color="text-green-700 bg-green-50"
          items={agregadas}
          vacio="No se agregan artículos nuevos."
          render={(f, i) => (
            <FilaCambio key={`a-${i}`}>
              <span className="font-bold text-brand-deep whitespace-nowrap">{f.numero_articulo || '—'}</span>
              <span className="text-brand-ink/40">· lote {f.lote || '—'}</span>
              <span className="text-brand-ink/70 truncate">{f.descripcion}</span>
            </FilaCambio>
          )}
        />

        <GrupoCambios
          icon={<MdChangeCircle className="text-sm" />}
          titulo="Modificadas"
          color="text-amber-800 bg-amber-50"
          items={modificadas}
          vacio="No se modifica ningún artículo."
          render={(m, i) => (
            <FilaCambio key={`m-${i}`}>
              <div className="min-w-0">
                <span className="font-bold text-brand-deep whitespace-nowrap">{m.fila.numero_articulo || '—'}</span>
                <span className="text-brand-ink/40"> · lote {m.fila.lote || '—'}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {m.campos.map((c) => (
                    <span key={c.key} className="inline-flex items-center gap-1 rounded bg-brand-ink/5 px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink/70">
                      {ETIQUETA[c.key]}: <span className="text-brand-ink/40 line-through">{String(m.anterior[c.key] || '—')}</span>
                      <span className="text-brand-ink/30">→</span>
                      <span className="text-brand-deep">{String(m.fila[c.key] || '—')}</span>
                    </span>
                  ))}
                </span>
              </div>
            </FilaCambio>
          )}
        />

        <GrupoCambios
          icon={<MdRemoveCircleOutline className="text-sm" />}
          titulo="Eliminadas"
          color="text-red-700 bg-red-50"
          items={eliminadas}
          vacio="No desaparece ningún artículo."
          render={(f, i) => (
            <FilaCambio key={`e-${i}`}>
              <span className="font-bold text-brand-deep whitespace-nowrap">{f.numero_articulo || '—'}</span>
              <span className="text-brand-ink/40">· lote {f.lote || '—'}</span>
              <span className="text-brand-ink/70 truncate">{f.descripcion}</span>
            </FilaCambio>
          )}
        />

        {sinCambios > 0 && (
          <p className="px-1 text-[11px] font-semibold text-brand-ink/40">
            {formatearEntero(sinCambios)} fila{sinCambios === 1 ? '' : 's'} sin cambios.
          </p>
        )}
      </div>
    </div>
  )
}

// Sube el reporte de Excel. El usuario copia las filas en Excel (Ctrl+C) y las
// pega aquí: el portapapeles da tabulación, así que el parser acepta tab, ';' y
// ',' por si viene de un CSV. Cada subida REEMPLAZA el inventario completo.
export default function SubirInventarioModal({ open, actuales = [], actualizadoEn = null, onClose, onSubido }) {
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

  // Qué cambia respecto al inventario guardado (solo cuando ya hay filas nuevas).
  const diff = useMemo(
    () => (filas.length > 0 ? compararInventario(actuales, filas) : null),
    [actuales, filas]
  )

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

          {/* Inventario actual (siempre visible para comparar) */}
          <InventarioActual actuales={actuales} actualizadoEn={actualizadoEn} />

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
                    Ver cambios y tabla
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cambios detectados respecto al inventario actual */}
          {viendoTabla && diff && <PanelCambios diff={diff} />}

          {/* Vista previa: tabla con scroll propio (se ve al pegar) */}
          {viendoTabla && (
            <div className="rounded-2xl border border-brand-ink/15 overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-brand-ink/5 px-4 py-2.5 text-xs font-bold text-brand-ink/70">
                <span className="inline-flex items-center gap-1.5">
                  <MdOutlineContentPaste className="text-base" />
                  Nuevo reporte
                </span>
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