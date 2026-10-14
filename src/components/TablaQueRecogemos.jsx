import { MdInventory2 } from 'react-icons/md'
import { parsearArticulosQueRecogemos } from '../utils/recoleccionArticulos.js'

// Muestra «Qué recogemos» de una recolección. Si el texto trae artículos en el
// formato del formulario ("cantidad · ARTÍCULO · DESCRIPCIÓN · Lote LOTE") se
// pinta una tabla cómoda; si es texto libre, se muestra tal cual.
export default function TablaQueRecogemos({ texto, compacto = false }) {
  const articulos = parsearArticulosQueRecogemos(texto || '')

  if (articulos.length === 0) {
    return (
      <p className="text-sm text-brand-ink whitespace-pre-wrap break-words">
        {texto ? texto : <span className="text-brand-ink/40">—</span>}
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-brand-cyan/30 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-brand-cyan/10 border-b border-brand-cyan/30">
        <p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-brand-deep inline-flex items-center gap-1.5">
          <MdInventory2 className="text-brand-cyan text-sm" />
          Artículos a recoger ({articulos.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="bg-brand-navy text-white uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-2 py-2 text-left font-extrabold border-r border-white/15">Artículo</th>
              <th className="px-2 py-2 text-left font-extrabold border-r border-white/15">Descripción</th>
              <th className="px-2 py-2 text-center font-extrabold border-r border-white/15 whitespace-nowrap">Lote</th>
              <th className="px-2 py-2 text-right font-extrabold whitespace-nowrap">Cant.</th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((a, i) => (
              <tr
                key={i}
                className={`border-b border-brand-ink/5 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'}`}
              >
                <td className="px-2 py-2 font-bold text-brand-ink whitespace-nowrap">{a.articulo}</td>
                <td className={`px-2 py-2 text-brand-ink/80 ${compacto ? 'truncate max-w-[200px]' : ''}`}>{a.descripcion || '—'}</td>
                <td className="px-2 py-2 text-center text-brand-ink/70 whitespace-nowrap">{a.lote || '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-brand-ink">{a.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
