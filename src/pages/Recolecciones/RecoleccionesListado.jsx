import { useEffect, useMemo, useState } from 'react'
import { MdInbox, MdFilterList } from 'react-icons/md'
import RecoleccionDetalleModal from './Components/modals/RecoleccionDetalleModal.jsx'
import RecoleccionesTable from './Components/RecoleccionesTable.jsx'
import EstadoFilter from '../../components/EstadoFilter.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import { descargarRecolecciones } from '../../services/recoleccionesApi.js'
import { ESTADOS_RECOLECCION } from '../../auth/roles.js'
import { getRecoleccionBadge, getRecoleccionDot } from '../../utils/estadoRecoleccion.js'
import { useAuth } from '../../auth/AuthContext.jsx'

// Caché en memoria de las recolecciones ya cargadas. Al volver a la pestaña se
// pintan al instante (sin loader) y se revalida en segundo plano.
let cacheRecolecciones = null

// Pestaña «Mis recolecciones» dentro de Solicitudes. Lista SOLO las recolecciones
// subidas por el usuario conectado (comparando por su correo), igual que «Mis
// solicitudes», con los MISMOS filtros (estado, cliente y zona) y detalle.
export default function RecoleccionesListado() {
  const { account } = useAuth()
  const [items, setItems] = useState(() => cacheRecolecciones || [])
  const [cargando, setCargando] = useState(!cacheRecolecciones)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')

  const cargar = async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    setError('')
    try {
      const data = await descargarRecolecciones()
      cacheRecolecciones = data
      setItems(data)
    } catch (e) {
      console.error('[Recolecciones] error cargando:', e)
      if (!cacheRecolecciones) setError(e?.message || 'No se pudieron cargar las recolecciones')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar(Boolean(cacheRecolecciones)) }, [])

  // «Mis recolecciones» solo muestra las recolecciones subidas por el usuario
  // conectado (comparando por su correo), igual que «Mis solicitudes».
  const correoActual = (account?.username || '').trim().toLowerCase()
  const mias = useMemo(
    () => items.filter((r) => (r.correo || '').trim().toLowerCase() === correoActual),
    [items, correoActual]
  )

  const filtradas = useMemo(() => {
    const cliente = filtroCliente.toLowerCase()
    const zona = filtroZona.toLowerCase()
    return mias.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (cliente && !(r.recoge_cliente || '').toLowerCase().includes(cliente)) return false
      if (zona && !(r.zona || '').toLowerCase().includes(zona)) return false
      return true
    })
  }, [mias, filtroEstado, filtroCliente, filtroZona])

  const hasFilters = Boolean(filtroEstado || filtroCliente || filtroZona)

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
          onClick={() => cargar()}
          className="mt-2 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      {mias.length > 0 && (
        <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <EstadoFilter
            solicitudes={mias}
            value={filtroEstado}
            onChange={setFiltroEstado}
            estados={ESTADOS_RECOLECCION}
            getBadge={getRecoleccionBadge}
            getDot={getRecoleccionDot}
          />
          <SearchFilters
            cliente={filtroCliente}
            zona={filtroZona}
            onClienteChange={setFiltroCliente}
            onZonaChange={setFiltroZona}
          />
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="grid place-items-center size-16 rounded-full bg-brand-cyan/10 text-brand-deep text-3xl">
            {hasFilters ? <MdFilterList /> : <MdInbox />}
          </span>
          <p className="text-lg font-bold text-brand-ink">
            {hasFilters ? 'No hay recolecciones que coincidan con los filtros' : 'Aún no tienes recolecciones'}
          </p>
          <p className="text-sm text-brand-ink/50">
            {hasFilters
              ? 'Ajusta el estado, cliente o zona seleccionados.'
              : 'Crea tu primera recolección con el botón «Recolección».'}
          </p>
        </div>
      ) : (
        <RecoleccionesTable items={filtradas} onRowClick={setDetalle} />
      )}

      <RecoleccionDetalleModal
        open={detalle !== null}
        recoleccion={detalle}
        onClose={() => setDetalle(null)}
      />
    </div>
  )
}
