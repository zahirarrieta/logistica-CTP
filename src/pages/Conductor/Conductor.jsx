import { useEffect, useMemo, useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdLocalShipping, MdPendingActions, MdCheckCircle, MdDateRange, MdClose } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import IndicadorSinConexion from '../../components/IndicadorSinConexion.jsx'
import EntregaConductor from './Components/modals/EntregaConductor.jsx'
import {
  loadSolicitudes,
  updateSolicitud,
  marcarPendienteSync,
  sincronizarPendientes,
  suscribir,
} from '../Home/Components/solicitudesStore.js'
import { estadoActualizado, syncRestablecida } from '../../services/notificaciones.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']
const ESTADOS_ENTREGADOS = ['Entregado', 'Entregado Parcial']

// fechaSubida se guarda con toLocaleDateString('es-CO') → DD/MM/YYYY.
const parsearFechaLocal = (str) => {
  const [d, m, y] = String(str || '').split('/').map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

// Los inputs type="date" entregan YYYY-MM-DD.
const fechaDesdeIso = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const enRangoFechas = (fechaStr, desdeIso, hastaIso) => {
  const f = parsearFechaLocal(fechaStr)
  if (!f) return false
  if (desdeIso) {
    const ini = fechaDesdeIso(desdeIso)
    if (ini && f < ini) return false
  }
  if (hastaIso) {
    const fin = fechaDesdeIso(hastaIso)
    if (fin && f >= new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1)) return false
  }
  return true
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const conectar = () => setOnline(true)
    const desconectar = () => setOnline(false)
    window.addEventListener('online', conectar)
    window.addEventListener('offline', desconectar)
    return () => {
      window.removeEventListener('online', conectar)
      window.removeEventListener('offline', desconectar)
    }
  }, [])
  return online
}

function destinoEntrega(s) {
  return s?.estado === 'En Tránsito Parcial' ? 'Entregado Parcial' : 'Entregado'
}

export default function Conductor() {
  const { account, usuario } = useAuth()
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [editarSolicitud, setEditarSolicitud] = useState(null)
  const [tab, setTab] = useState('pendientes')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const online = useOnline()

  const nombre = (usuario?.nombre || account?.name || '').trim()

  useEffect(() => suscribir(setSolicitudes), [])

  const pendientes = useMemo(
    () => solicitudes.filter((s) => ESTADOS_TRANSITO.includes(s.estado || 'Abierto')),
    [solicitudes]
  )
  const entregados = useMemo(
    () => solicitudes.filter((s) => ESTADOS_ENTREGADOS.includes(s.estado || '')),
    [solicitudes]
  )

  const base = tab === 'entregados' ? entregados : pendientes
  const hayFiltroFecha = Boolean(desde || hasta)
  const filtrados = useMemo(
    () => base.filter((s) => enRangoFechas(s.fechaSubida, desde, hasta)),
    [base, desde, hasta]
  )

  useEffect(() => {
    if (!online) return
    let activo = true
    sincronizarPendientes().then((cantidad) => {
      if (activo && cantidad > 0) syncRestablecida(cantidad)
    })
    return () => {
      activo = false
    }
  }, [online])

  const handleUpdateEstado = (id, updates) => {
    let siguiente = updateSolicitud(id, updates)
    if (!navigator.onLine) siguiente = marcarPendienteSync(id)
    setSolicitudes(siguiente)
    estadoActualizado(id, updates.estado)
  }

  const TABS = [
    { id: 'pendientes', label: 'Entregas pendientes', Icon: MdPendingActions, cuenta: pendientes.length },
    { id: 'entregados', label: 'Entregados', Icon: MdCheckCircle, cuenta: entregados.length },
  ]

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-ink">
      <Header />

      <main className="flex-1 py-6 sm:py-10">
        <div className="w-full px-4 sm:px-6">
          {/* Barra superior */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-extrabold text-brand-ink inline-flex items-center gap-3">
              <span className="grid place-items-center size-9 sm:size-11 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30">
                <RiSteering2Line className="text-lg sm:text-2xl" />
              </span>
              <span>
                CONDUCTOR
                {nombre && (
                  <span className="block text-sm sm:text-base font-extrabold text-brand-deep/80 mt-0.5 tracking-wide">
                    {nombre.toUpperCase()}
                  </span>
                )}
              </span>
            </h1>
            <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
              Solicitudes asignadas para entrega
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-4 -mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-brand-mist/70 ring-1 ring-brand-ink/10 p-1 whitespace-nowrap">
              {TABS.map((t) => {
                const Icon = t.Icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:px-6 sm:text-sm font-extrabold transition-all ${
                      active
                        ? 'bg-brand-navy text-white shadow-lg'
                        : 'text-brand-ink/60 hover:bg-white/70 hover:text-brand-deep'
                    }`}
                  >
                    <Icon className="text-base" />
                    <span>{t.label}</span>
                    <span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-[10px] font-extrabold ${active ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-deep/10 text-brand-deep'}`}>
                      {t.cuenta}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filtro por fechas */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-3 py-2 flex-1 sm:max-w-[200px]">
              <MdDateRange className="text-brand-deep shrink-0" />
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-brand-ink outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-3 py-2 flex-1 sm:max-w-[200px]">
              <MdDateRange className="text-brand-deep shrink-0" />
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-brand-ink outline-none"
              />
            </div>
            {hayFiltroFecha && (
              <button
                type="button"
                onClick={() => { setDesde(''); setHasta('') }}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/10 text-brand-deep hover:bg-brand-ink/20 transition-colors px-3.5 py-2 text-sm font-bold"
              >
                <MdClose className="text-base" />
                Limpiar
              </button>
            )}
          </div>

          {base.length > 0 && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-4 py-2 text-sm font-bold">
                <MdLocalShipping className="text-lg" />
                {filtrados.length} de {base.length} solicitud(es)
                {tab === 'pendientes' ? ' en tránsito' : ' entregada(s)'}
              </span>
            </div>
          )}

          <SolicitudesTable
            items={filtrados}
            onRowClick={tab === 'pendientes' ? (s) => setEditarSolicitud(s) : undefined}
            cardActions={tab === 'pendientes' ? (s) => (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditarSolicitud(s) }}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-2 text-xs font-bold w-full"
              >
                <MdLocalShipping className="text-lg" />
                Entregar pedido
              </button>
            ) : undefined}
            colorRowsPorEstado
            empty={
              hayFiltroFecha
                ? {
                    icon: <MdDateRange />,
                    title: 'No hay solicitudes en esas fechas',
                    text: 'Cambia el rango de fechas o haz clic en «Limpiar».',
                  }
                : tab === 'entregados'
                  ? {
                      icon: <MdCheckCircle />,
                      title: 'Aún no hay entregas realizadas',
                      text: 'Cuando entregues una solicitud aparecerá aquí.',
                    }
                  : {
                      icon: <MdLocalShipping />,
                      title: 'No hay solicitudes en tránsito',
                      text: 'Cuando una solicitud cambie a estado «En Tránsito» aparecerá aquí.',
                    }
            }
          />
        </div>
      </main>

      <Footer />

      <EntregaConductor
        solicitud={editarSolicitud}
        open={editarSolicitud !== null}
        onClose={() => setEditarSolicitud(null)}
        onUpdate={handleUpdateEstado}
        destino={editarSolicitud ? destinoEntrega(editarSolicitud) : undefined}
      />

      <IndicadorSinConexion />
    </div>
  )
}