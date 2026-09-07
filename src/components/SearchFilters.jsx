import { MdPerson, MdBusiness, MdClose } from 'react-icons/md'

export default function SearchFilters({ cliente, zona, onClienteChange, onZonaChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <div className="relative sm:w-56">
        <MdPerson className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40 text-lg" />
        <input
          type="text"
          value={cliente}
          onChange={(e) => onClienteChange(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full rounded-full border-2 border-brand-ink/10 bg-white pl-9 pr-8 py-2 text-sm text-brand-ink placeholder:text-brand-ink/35 focus:outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/30 transition"
        />
        {cliente && (
          <button
            type="button"
            aria-label="Limpiar cliente"
            onClick={() => onClienteChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-6 rounded-full bg-brand-ink/10 text-brand-ink/60 hover:bg-brand-ink/20 transition"
          >
            <MdClose className="text-sm" />
          </button>
        )}
      </div>

      <div className="relative sm:w-56">
        <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40 text-lg" />
        <input
          type="text"
          value={zona}
          onChange={(e) => onZonaChange(e.target.value)}
          placeholder="Buscar zona…"
          className="w-full rounded-full border-2 border-brand-ink/10 bg-white pl-9 pr-8 py-2 text-sm text-brand-ink placeholder:text-brand-ink/35 focus:outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/30 transition"
        />
        {zona && (
          <button
            type="button"
            aria-label="Limpiar zona"
            onClick={() => onZonaChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-6 rounded-full bg-brand-ink/10 text-brand-ink/60 hover:bg-brand-ink/20 transition"
          >
            <MdClose className="text-sm" />
          </button>
        )}
      </div>
    </div>
  )
}