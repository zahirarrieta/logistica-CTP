// Selector segmentado que alterna entre las dos vistas del tab «Dashboard»:
// pedidos (solicitudes) y recolecciones. Solo cambia lo que se pinta dentro del
// tab, sin tocar la barra de pestañas principal.
export default function DashboardVistaToggle({ vista, onChange, opciones }) {
  if (!opciones || opciones.length < 2) return null
  return (
    <div className="mb-4 inline-flex items-center gap-1 rounded-2xl bg-brand-mist/70 ring-1 ring-brand-ink/10 p-1">
      {opciones.map((o) => {
        const Icon = o.Icon
        const active = vista === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:px-5 sm:text-sm font-extrabold transition-all ${
              active
                ? 'bg-brand-navy text-white shadow-lg'
                : 'text-brand-ink/60 hover:bg-white/70 hover:text-brand-deep'
            }`}
          >
            {Icon && <Icon className="text-base" />}
            <span>{o.label}</span>
            {typeof o.cuenta === 'number' && o.cuenta > 0 && (
              <span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-[10px] font-extrabold ${active ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-deep/10 text-brand-deep'}`}>
                {o.cuenta}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
