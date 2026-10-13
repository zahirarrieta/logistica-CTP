import { useEffect, useMemo, useState } from 'react'
import { MdInbox, MdFilterList, MdSearch } from 'react-icons/md'
import RecoleccionDetalleModal, { EstadoBadge } from './Components/modals/RecoleccionDetalleModal.jsx'
import { descargarRecolecciones, actualizarRecoleccion } from '../../services/recoleccionesApi.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { esPrivilegiado, ESTADOS_RECOLECCION } from '../../auth/roles.js'
import { estadoActualizado, errorRecoleccion } from '../../services/notificaciones.jsx'

// Pestaña «Mis recolecciones» dentro de Solicitudes. Lista las recolecciones
// visibles para el usuario (las propias o todas, según el rol) con buscador,
// filtro por estado y detalle con cambio de estado.
export default function RecoleccionesListado() {
  const { account, rol } = useAuth()
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const correoActual = (account?.username || '').trim().toLowerCase()

  const cargar = async () => {
    setCargando(true)
    setError('')
    try {
      setItems(await descargarRecolecciones())
    } catch (e) {
      console.error('[Recolecciones] error cargando:', e)
      setError(e?.message || 'No se pudieron cargar las recolecciones')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return items.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (!q) return true
      return [r.codigo, r.recoge_cliente, r.entrega_cliente, r.zona, r.nombre_completo]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [items, filtroEstado, busqueda])

  const puedeEditar = (r) =>
    esPrivilegiado(rol) || (r.correo || '').trim().toLowerCase() === correoActual

  const handleSave = async (codigo, cambios) => {
    try {
      await actualizarRecoleccion(codigo, cambios)
      setItems((prev) => prev.map((r) => (r.codigo === codigo ? { ...r, ...cambios } : r)))
      setDetalle((prev) => (prev && prev.codigo === codigo ? { ...prev, ...cambios } : prev))
      if (cambios.estado) estadoActualizado(codigo, cambios.estado)
    } catch (e) {
      errorRecoleccion(e?.message)
      throw e
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-brand-deep/60">
        <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
        <p className="text-sm font-semibold">Cargando recolecciones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <p className="text-sm font-semibold text-red-600">{error}</p>
        <button
          type="button"
          onClick={cargar}
          className="mt-2 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      {(items.length > 0 || busqueda || filtroEstado) && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-deep/60" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, cliente o zona…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 text-brand-ink"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="sm:max-w-xs px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 text-brand-ink font-medium"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_RECOLECCION.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {(busqueda || filtroEstado) && (
            <button
              type="button"
              onClick={() => { setBusqueda(''); setFiltroEstado('') }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-ink/10 px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="grid place-items-center size-16 rounded-full bg-brand-cyan/10 text-brand-deep text-3xl">
            {busqueda || filtroEstado ? <MdFilterList /> : <MdInbox />}
          </span>
          <p className="text-lg font-bold text-brand-ink">
            {busqueda || filtroEstado ? 'No hay recolecciones que coincidan con los filtros' : 'Aún no hay recolecciones'}
          </p>
          <p className="text-sm text-brand-ink/50">
            {busqueda || filtroEstado
              ? 'Ajusta la búsqueda o el estado seleccionado.'
              : 'Crea la primera recolección con el botón «Recolección».'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-ink/15 shadow-sm">
          <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[720px]">
            <thead>
              <tr className="bg-brand-navy text-white uppercase tracking-wider text-xs">
                <th className="px-4 py-3 font-bold border-r border-white/15">Id</th>
                <th className="px-4 py-3 font-bold border-r border-white/15">Fecha</th>
                <th className="px-4 py-3 font-bold border-r border-white/15">Cliente</th>
                <th className="px-4 py-3 font-bold border-r border-white/15">Zona</th>
                <th className="px-4 py-3 font-bold border-r border-white/15">Recolección</th>
                <th className="px-4 py-3 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r, i) => (
                <tr
                  key={r.codigo}
                  onClick={() => setDetalle(r)}
                  className={`cursor-pointer transition-colors hover:bg-brand-deep/15 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10'}`}
                >
                  <td className="px-4 py-3 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">{r.codigo}</td>
                  <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                    <span className="block">{r.fecha_subida}</span>
                    <span className="block text-[11px] text-brand-ink/50">{r.hora_subida}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-ink border-b border-l border-brand-ink/10">{r.recoge_cliente || '—'}</td>
                  <td className="px-4 py-3 capitalize text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{r.zona || '—'}</td>
                  <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                    {r.fecha_recoleccion || '—'}
                    {r.hora_recoleccion ? ` · ${r.hora_recoleccion}` : ''}
                  </td>
                  <td className="px-4 py-3 border-b border-l border-brand-ink/10">
                    <EstadoBadge estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecoleccionDetalleModal
        open={detalle !== null}
        recoleccion={detalle}
        puedeEditar={detalle ? puedeEditar(detalle) : false}
        onClose={() => setDetalle(null)}
        onSave={handleSave}
      />
    </div>
  )
}
