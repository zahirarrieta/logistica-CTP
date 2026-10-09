import {
  MdAccessTime,
  MdBusiness,
  MdCalendarToday,
  MdDescription,
  MdInventory2,
  MdNumbers,
  MdStorefront,
  MdWarehouse,
} from 'react-icons/md'
import {
  MARCA_VENCIDO,
  badgeRango,
  dotRango,
  fondoInventario,
  formatearEntero,
  formatearFecha,
} from '../../../utils/inventarioUtils.js'

// Columnas de la tabla de artículos: solo lo esencial, cada una con su icono.
// Las de número, vencimiento, cantidad y días van centradas.
const COLUMNAS_TABLA = [
  { key: 'numero_articulo', label: 'N° de artículo', icon: <MdNumbers />, centrada: true },
  { key: 'descripcion', label: 'Descripción del artículo', icon: <MdDescription />, clase: 'min-w-[16rem]' },
  { key: 'fecha_vencimiento', label: 'Fecha de vencimiento', icon: <MdCalendarToday />, centrada: true },
  { key: 'cantidad', label: 'Cantidad', icon: <MdInventory2 />, centrada: true },
  { key: 'dias_inventario', label: 'Días de inventario', icon: <MdAccessTime />, centrada: true },
  { key: 'bodega', label: 'Bodega', icon: <MdWarehouse /> },
  { key: 'nombre_bodega', label: 'Nombre de la bodega', icon: <MdStorefront />, clase: 'min-w-[13rem]' },
  { key: 'comercial', label: 'Comercial', icon: <MdBusiness /> },
]

// Pastilla con el número de días, coloreada por el semáforo de rotación.
function DiasRango({ f }) {
  if (!f._rango) {
    return <span className="tabular-nums text-brand-ink/60">{formatearEntero(f.dias_inventario)}</span>
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${badgeRango(f._rango)}`}>
      <span className={`size-2 rounded-full ${dotRango(f._rango)}`} />
      {formatearEntero(f.dias_inventario)}
    </span>
  )
}

// Dato compacto de la tarjeta del celular.
function DatoMovil({ icon, label, valor }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 rounded-lg bg-white/70 px-2 py-1">
      <span className="text-brand-cyan text-sm shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-brand-ink/40 leading-none">{label}</span>
        <span className="block text-[11px] font-bold truncate text-brand-ink">{valor}</span>
      </span>
    </div>
  )
}

// Tabla de artículos (escritorio). Cada fila abre el modal de detalle y se
// colorea según el rango de los «días de inventario».
export default function TablaArticulos({ filas, onVer }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm">
      <table className="w-full min-w-[1080px] text-sm border-collapse">
        <thead>
          <tr className="bg-brand-navy text-white">
            {COLUMNAS_TABLA.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`border border-brand-navy/40 px-3 py-3 text-[11px] font-extrabold uppercase tracking-wide ${
                  c.centrada ? 'text-center' : 'text-left'
                } ${c.clase || ''}`}
              >
                <span className={`inline-flex items-center gap-1.5 ${c.centrada ? 'justify-center' : ''}`}>
                  <span className="text-brand-cyan text-base">{c.icon}</span>
                  {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const etiqueta = f.numero_articulo || f.descripcion || 'este artículo'
            return (
              <tr
                key={f.id ?? `${f.numero_articulo}-${f.lote}-${i}`}
                onClick={() => onVer(f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onVer(f)
                  }
                }}
                tabIndex={0}
                role="button"
                title={`Ver detalle de ${etiqueta}`}
                className={`cursor-pointer border-t border-brand-ink/15 transition-colors hover:bg-brand-cyan/15 focus:outline-none focus-visible:bg-brand-cyan/20 ${fondoInventario(f)}`}
              >
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-[11px] font-extrabold px-2 py-1">
                    {f.numero_articulo || '—'}
                  </span>
                </td>
                <td className="relative overflow-hidden border border-brand-ink/10 px-3 py-2.5 font-semibold leading-snug text-brand-ink/80">
                  {f._estado === 'Vencido' && (
                    <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.3em] text-red-900/25">
                      {MARCA_VENCIDO}
                    </span>
                  )}
                  <span className="relative">
                    {f.descripcion || <span className="text-brand-ink/40">Sin descripción</span>}
                  </span>
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center align-middle text-brand-ink/70">
                  {f.fecha_vencimiento ? (
                    <span className="whitespace-nowrap">{formatearFecha(f.fecha_vencimiento)}</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-brand-ink/40">Sin fecha de vencimiento</span>
                  )}
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center font-bold tabular-nums text-brand-ink">
                  {String(f.cantidad ?? '').trim() || '—'}
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-center">
                  <DiasRango f={f} />
                </td>
                <td className="border border-brand-ink/10 px-3 py-2.5 whitespace-nowrap text-brand-ink/70">{f.bodega || '—'}</td>
                <td className="border border-brand-ink/10 px-3 py-2.5 text-brand-ink/70">{f.nombre_bodega || '—'}</td>
                <td className="border border-brand-ink/10 px-3 py-2.5 whitespace-nowrap text-brand-ink/70">{f.comercial || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Vista de artículos en tarjetas (celular): mismo contenido que la tabla, con
// el color del rango de rotación como fondo.
export function ListaArticulosMovil({ filas, onVer }) {
  return (
    <div className="space-y-3">
      {filas.map((f, i) => {
        const etiqueta = f.numero_articulo || f.descripcion || 'este artículo'
        return (
          <button
            key={f.id ?? `${f.numero_articulo}-${f.lote}-${i}`}
            type="button"
            onClick={() => onVer(f)}
            title={`Ver detalle de ${etiqueta}`}
            className={`relative w-full overflow-hidden rounded-2xl text-left ring-1 ring-brand-ink/10 shadow-sm hover:shadow-md transition-all pl-4 pr-3 py-3 ${fondoInventario(f)}`}
          >
            <span className={`absolute left-0 top-0 h-full w-1.5 ${f._estado === 'Vencido' ? 'bg-red-800/60' : dotRango(f._rango)}`} />
            {f._estado === 'Vencido' && (
              <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center px-8 text-center text-[11px] font-extrabold uppercase tracking-[0.25em] text-red-900/25">
                {MARCA_VENCIDO}
              </span>
            )}
            <div className="relative flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center rounded-lg bg-brand-navy text-white text-[11px] font-extrabold px-2 py-1 max-w-[60%] truncate">
                  {f.numero_articulo || '—'}
                </span>
                <DiasRango f={f} />
              </div>
              <p className="text-xs font-semibold leading-snug text-brand-ink/80 line-clamp-2">
                {f.descripcion || 'Sin descripción'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <DatoMovil icon={<MdCalendarToday />} label="Vence" valor={f.fecha_vencimiento ? formatearFecha(f.fecha_vencimiento) : 'Sin fecha de vencimiento'} />
                <DatoMovil icon={<MdInventory2 />} label="Cantidad" valor={String(f.cantidad ?? '').trim() || '—'} />
                <DatoMovil icon={<MdWarehouse />} label="Bodega" valor={f.bodega || '—'} />
                <DatoMovil icon={<MdStorefront />} label="Nombre bodega" valor={f.nombre_bodega || '—'} />
                <DatoMovil icon={<MdBusiness />} label="Comercial" valor={f.comercial || '—'} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
