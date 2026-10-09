import { useEffect } from 'react'
import {
  MdAccessTime,
  MdClose,
  MdInventory2,
  MdOutlineInfo,
  MdPlace,
  MdSchedule,
} from 'react-icons/md'
import { FaTemperatureQuarter } from 'react-icons/fa6'
import Modal from '../../../components/Modal.jsx'
import { getBadgeColor, getDotColor } from '../../../utils/estadoColors.js'
import {
  badgeRango,
  diasVigencia,
  dotRango,
  estadoVencimiento,
  formatearEntero,
  formatearFecha,
  pastelRango,
  rangoInventario,
} from '../../../utils/inventarioUtils.js'

const BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40'
const BOTON_PRIMARIO = `${BOTON} bg-brand-cyan text-brand-ink shadow-cyanGlow hover:bg-brand-cyanSoft`

function TituloSeccion({ icono, children }) {
  return (
    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-ink/45">
      <span className="text-brand-cyan text-sm">{icono}</span>
      {children}
    </p>
  )
}

function Dato({ etiqueta, valor, className = '' }) {
  const vacio = !valor || valor === '—'
  return (
    <div className={`rounded-xl bg-brand-ink/[0.04] ring-1 ring-brand-ink/10 px-3.5 py-2.5 ${className}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-ink/45">{etiqueta}</p>
      <p className={`mt-0.5 text-sm font-bold break-words ${vacio ? 'text-brand-ink/40' : 'text-brand-ink'}`}>
        {valor || '—'}
      </p>
    </div>
  )
}

// Métrica destacada: número grande con su icono, opcionalmente coloreada por el
// rango de rotación (días de inventario). El icono se repite como marca de agua.
function Metrica({ icono, etiqueta, valor, fondo, valorClase }) {
  return (
    <div className={`relative overflow-hidden rounded-xl px-3 py-2.5 ring-1 ring-brand-ink/10 ${fondo || 'bg-brand-ink/[0.04]'}`}>
      <span className="pointer-events-none absolute -right-1 -bottom-2 text-4xl text-brand-deep/10">{icono}</span>
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-ink/50">
          <span className="text-brand-cyan text-sm">{icono}</span>
          {etiqueta}
        </p>
        <p className={`mt-1 text-lg font-extrabold leading-none tabular-nums ${valorClase || 'text-brand-ink'}`}>
          {valor}
        </p>
      </div>
    </div>
  )
}

// Detallado de una fila del inventario: encabezado coloreado por la rotación,
// métricas clave y luego ubicación y datos del artículo.
export default function DetalleFilaModal({ fila, onClose }) {
  useEffect(() => {
    if (!fila) return
    const alPulsarTecla = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [fila, onClose])

  if (!fila) return null

  const estado = estadoVencimiento(fila.fecha_vencimiento)
  const vigencia = diasVigencia(fila.fecha_vencimiento)
  const rango = rangoInventario(fila.dias_inventario)

  return (
    <Modal onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-inventario"
        className="relative bg-white text-brand-ink w-full max-w-2xl rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="relative overflow-hidden px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <MdInventory2 className="pointer-events-none absolute -right-3 -bottom-7 text-[6rem] text-white/10" />
          <h3
            id="titulo-detalle-inventario"
            className="relative text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdInventory2 className="text-brand-cyan text-lg" />
            </span>
            <span className="truncate max-w-[60vw] sm:max-w-none">
              {fila.numero_articulo || 'ARTÍCULO'} — Detalle
            </span>
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="relative grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {/* Encabezado del artículo, teñido con el color del rango de rotación */}
          <div className={`relative overflow-hidden rounded-2xl ring-1 ring-brand-ink/10 ${rango ? pastelRango(rango) : 'bg-brand-ink/[0.04]'}`}>
            <span className={`absolute left-0 top-0 h-full w-1.5 ${rango ? dotRango(rango) : 'bg-brand-deep/30'}`} />
            <FaTemperatureQuarter className="pointer-events-none absolute -right-2 -bottom-4 text-[5rem] text-brand-deep/10" />
            <div className="relative pl-5 pr-4 py-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-xs font-extrabold px-2.5 py-1.5 shrink-0 mt-0.5">
                  {fila.numero_articulo || '—'}
                </span>
                <p className="text-sm font-bold leading-snug text-brand-ink">
                  {fila.descripcion || <span className="text-brand-ink/40">Sin descripción</span>}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {estado ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${getBadgeColor(estado)}`}>
                    <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
                    {estado}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-brand-ink/40">Sin fecha de vencimiento</span>
                )}
                {rango && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${badgeRango(rango)}`}>
                    <span className={`size-2 rounded-full ${dotRango(rango)}`} />
                    {rango}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Métricas clave */}
          <div>
            <TituloSeccion icono={<MdOutlineInfo className="text-sm" />}>Resumen</TituloSeccion>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Metrica
                icono={<MdInventory2 />}
                etiqueta="Cantidad"
                valor={String(fila.cantidad ?? '').trim() || '—'}
              />
              <Metrica
                icono={<MdAccessTime />}
                etiqueta="Días de inventario"
                valor={formatearEntero(fila.dias_inventario)}
              />
              <Metrica
                icono={<MdSchedule />}
                etiqueta="Días de vigencia"
                valor={vigencia === null ? '—' : `${formatearEntero(vigencia)} d`}
                valorClase={vigencia !== null && vigencia < 0 ? 'text-red-600' : undefined}
              />
            </div>
          </div>

          {/* Ubicación: dónde está */}
          <div className="relative overflow-hidden rounded-2xl bg-brand-ink/[0.03] ring-1 ring-brand-ink/10 px-3.5 py-3 sm:px-4 sm:py-3.5">
            <MdPlace className="pointer-events-none absolute -right-2 -bottom-5 text-[5rem] text-brand-deep/15" />
            <div className="relative">
              <TituloSeccion icono={<MdPlace className="text-sm" />}>Ubicación</TituloSeccion>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Dato etiqueta="Bodega" valor={fila.bodega} />
                <Dato etiqueta="Nombre de la bodega" valor={fila.nombre_bodega} />
                <Dato etiqueta="Zona" valor={fila.zona} />
                <Dato etiqueta="Tipo de bodega" valor={fila.tipo_bodega} />
              </div>
            </div>
          </div>

          {/* Detalle del artículo */}
          <div className="relative overflow-hidden rounded-2xl bg-brand-ink/[0.03] ring-1 ring-brand-ink/10 px-3.5 py-3 sm:px-4 sm:py-3.5">
            <MdOutlineInfo className="pointer-events-none absolute -right-2 -bottom-5 text-[5rem] text-brand-deep/15" />
            <div className="relative">
              <TituloSeccion icono={<MdOutlineInfo className="text-sm" />}>Detalle del artículo</TituloSeccion>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Dato etiqueta="Lote" valor={fila.lote} />
                <Dato etiqueta="Fecha de vencimiento" valor={formatearFecha(fila.fecha_vencimiento)} />
                <Dato etiqueta="Grupo de artículos" valor={fila.grupo_articulos} />
                <Dato etiqueta="Proveedor" valor={fila.proveedor} />
                <Dato etiqueta="Comercial" valor={fila.comercial} />
              </div>
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0">
          <button type="button" onClick={onClose} className={BOTON_PRIMARIO}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}