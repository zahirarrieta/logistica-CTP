import { MdVerified, MdDoneAll, MdEvent, MdTag } from 'react-icons/md'
import { getSoftColor } from '../utils/estadoColors.js'
import { safeText } from '../store/solicitudesStore.js'
import EntregaInfo from './EntregaInfo.jsx'

// Una solicitud puede tener varias entregas registradas: la «Entrega parcial»
// (estado Entregado Parcial) y, cuando se completa, la «Entrega final» (estado
// Entregado). Este componente las muestra TODAS, cada una con su cabecera de
// estado, fecha y remisión, y su propio detalle (evidencia y encuesta), para que
// se vean juntas la parcial ya registrada y la final.
export default function EntregasLista({ solicitud, entregas, mostrarEncuesta = true }) {
  const total = entregas.length

  return (
    <div className="space-y-6">
      {entregas.map((entrega, i) => {
        const estado = entrega?.nuevo || 'Entregado'
        const esParcial = estado === 'Entregado Parcial'
        const etiqueta = esParcial ? 'Entrega parcial' : 'Entrega final'
        return (
          <section
            key={entrega?.id || `${estado}-${i}`}
            className={
              total > 1
                ? 'space-y-4 rounded-2xl border border-brand-ink/10 bg-white p-3 sm:p-4 shadow-sm'
                : 'space-y-5'
            }
          >
            {/* Cabecera de esta entrega */}
            <div
              className={`rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${getSoftColor(estado)}`}
            >
              <span className="grid place-items-center size-11 shrink-0 rounded-full bg-white shadow-sm">
                {esParcial ? (
                  <MdDoneAll className="text-2xl text-orange-500" />
                ) : (
                  <MdVerified className="text-2xl text-green-600" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight flex flex-wrap items-center gap-2">
                  {etiqueta}
                  {total > 1 && (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-brand-ink/10">
                      {i + 1}ª de {total}
                    </span>
                  )}
                </p>
                <p className="text-xs font-semibold opacity-80 flex items-center gap-1">
                  <MdEvent className="text-sm" />
                  {safeText(entrega?.fecha)} · {safeText(entrega?.hora) || '—'}
                </p>
              </div>
              <span className="sm:ml-auto shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold shadow-sm flex items-center gap-1">
                <MdTag className="text-brand-cyan" />
                {safeText(entrega?.referencia) || 'Sin remisión'}
              </span>
            </div>

            <EntregaInfo solicitud={solicitud} entrega={entrega} mostrarEncuesta={mostrarEncuesta} />
          </section>
        )
      })}
    </div>
  )
}
