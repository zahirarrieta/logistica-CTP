import { useMemo, useState } from 'react'
import { MdAdminPanelSettings, MdInbox, MdFilterList, MdInsights, MdRestartAlt, MdDescription, MdAssignmentInd } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import EstadoFilter from '../../components/EstadoFilter.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import AsignadoFilter from '../../components/AsignadoFilter.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import EstadosModal from './Components/modals/EstadosModal.jsx'
import { ESTADOS } from '../Home/Components/estadoColors.js'
import AsignarUsuarioModal from './Components/modals/AsignarUsuarioModal.jsx'
import AsignarConductorModal from './Components/modals/AsignarConductorModal.jsx'
import HistorialModal from './Components/modals/HistorialModal.jsx'
import EntregaDetallesModal from './Components/modals/EntregaDetallesModal.jsx'
import ConfirmarEliminarModal from '../../components/ConfirmarEliminarModal.jsx'
import DashboardTab from './Components/DashboardTab.jsx'
import PlanillasTab from './Components/PlanillasTab.jsx'
import { loadSolicitudes, updateSolicitud, removeSolicitud, resetSolicitudes } from '../Home/Components/solicitudesStore.js'
import { estadoActualizado, solicitudAsignada, conductorAsignado, datosReiniciados } from '../../services/notificaciones.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { esSuperAdmin, esAsignadoA } from '../../auth/roles.js'

const TABS_BASE = [
  { id: 'solicitudes', label: 'Solicitudes', Icon: MdInbox },
  { id: 'planillas', label: 'Planillas', Icon: MdDescription },
  { id: 'dashboard', label: 'Dashboard', Icon: MdInsights },
]

const TAB_ASIGNACIONES = { id: 'asignaciones', label: 'Mis asignaciones', Icon: MdAssignmentInd }

export default function Administrador() {
  const { account, usuario, rol } = useAuth()
  const esSuper = esSuperAdmin(rol)
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [tab, setTab] = useState('solicitudes')
  const [editSolicitud, setEditSolicitud] = useState(null)
  const [asignarSolicitud, setAsignarSolicitud] = useState(null)
  const [asignarConductorSolicitud, setAsignarConductorSolicitud] = useState(null)
  const [historialSolicitud, setHistorialSolicitud] = useState(null)
  const [entregaDetallesSolicitud, setEntregaDetallesSolicitud] = useState(null)
  const [eliminarSolicitud, setEliminarSolicitud] = useState(null)
  const [filterEstado, setFilterEstado] = useState(null)
  const [filtroAsignado, setFiltroAsignado] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')
  const [filtroId, setFiltroId] = useState('')

  // Identidad del admin actual para saber qué solicitudes le pertenecen.
  const misDatos = useMemo(() => ({
    nombre: usuario?.nombre || account?.name || '',
    correo: usuario?.correo || account?.username || '',
  }), [usuario, account])

  // Sin asignar: las que aún no tienen responsable (visibles para todo admin).
  const sinAsignar = useMemo(
    () => solicitudes.filter((s) => !String(s.asignadoA || '').trim()),
    [solicitudes]
  )
  // Mis asignaciones: las que están a mi nombre o correo.
  const misAsignaciones = useMemo(
    () => solicitudes.filter((s) => esAsignadoA(s, misDatos)),
    [solicitudes, misDatos]
  )
  // Universo sobre el que operan Planillas y Dashboard.
  const scope = useMemo(
    () => (esSuper ? solicitudes : [...sinAsignar, ...misAsignaciones]),
    [esSuper, solicitudes, sinAsignar, misAsignaciones]
  )

  const TABS = useMemo(
    () => (esSuper
      ? TABS_BASE
      : [TABS_BASE[0], TAB_ASIGNACIONES, TABS_BASE[1], TABS_BASE[2]]),
    [esSuper]
  )

  // Lista base del tab activo (antes de aplicar los filtros de la barra).
  const baseDelTab = esSuper
    ? (tab === 'asignaciones' ? misAsignaciones : solicitudes)
    : (tab === 'asignaciones' ? misAsignaciones : sinAsignar)

  const filtered = useMemo(() => {
    const cliente = filtroCliente.toLowerCase()
    const zona = filtroZona.toLowerCase()
    const idBuscado = filtroId.trim().toLowerCase()
    return baseDelTab.filter((s) => {
      const e = s.estado || 'Abierto'
      if (filterEstado && e !== filterEstado) return false
      if (filtroAsignado && (s.asignadoA || '') !== filtroAsignado) return false
      if (cliente && !(s.cliente || '').toLowerCase().includes(cliente)) return false
      if (zona && !(s.zona || '').toLowerCase().includes(zona)) return false
      if (idBuscado && !(s.id || '').toLowerCase().includes(idBuscado)) return false
      return true
    })
  }, [baseDelTab, filterEstado, filtroAsignado, filtroCliente, filtroZona, filtroId])

  const hasFilters = Boolean(filterEstado || filtroAsignado || filtroCliente || filtroZona || filtroId.trim())

  const contadorTab = (id) => {
    if (id === 'solicitudes') return esSuper ? solicitudes.length : sinAsignar.length
    if (id === 'asignaciones') return misAsignaciones.length
    return 0
  }

const ESTADOS_ADMIN = ESTADOS.filter((e) => e !== 'Entregado' && e !== 'Entregado Parcial')

  const handleEliminar = (solicitud) => {
    setEliminarSolicitud(solicitud)
  }

  const confirmarEliminar = (solicitud) => {
    const siguiente = removeSolicitud(solicitud.id)
    setSolicitudes(siguiente)
    if (editSolicitud?.id === solicitud.id) setEditSolicitud(null)
    if (asignarSolicitud?.id === solicitud.id) setAsignarSolicitud(null)
    if (asignarConductorSolicitud?.id === solicitud.id) setAsignarConductorSolicitud(null)
    if (historialSolicitud?.id === solicitud.id) setHistorialSolicitud(null)
    if (entregaDetallesSolicitud?.id === solicitud.id) setEntregaDetallesSolicitud(null)
  }

  const handleResetDatos = async () => {
    const confirmado = window.confirm(
      'Vas a eliminar TODAS las solicitudes y reiniciar el contador de IDs. Esta acción no se puede deshacer. ¿Continuar?'
    )
    if (!confirmado) return
    await resetSolicitudes()
    setSolicitudes([])
    setEditSolicitud(null)
    setAsignarSolicitud(null)
    setAsignarConductorSolicitud(null)
    setHistorialSolicitud(null)
    setEntregaDetallesSolicitud(null)
    setEliminarSolicitud(null)
    setFilterEstado(null)
    setFiltroAsignado(null)
    setFiltroCliente('')
    setFiltroZona('')
    setFiltroId('')
    datosReiniciados()
  }

  const handleUpdateEstado = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
    estadoActualizado(id, updates.estado)
  }

  const handleAsignar = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
    solicitudAsignada(id, updates.asignadoA)
  }

  const handleAsignarConductor = (id, updates) => {
    const siguiente = updateSolicitud(id, updates)
    setSolicitudes(siguiente)
    conductorAsignado(id, updates.conductor)
    if (editSolicitud && editSolicitud.id === id) {
      setEditSolicitud(siguiente.find((s) => s.id === id) || null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-ink">
      <Header />

      <main className="flex-1 py-6 sm:py-10">
        <div className="w-full px-4 sm:px-6">
          {/* Barra superior */}
          <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold text-brand-ink inline-flex items-center gap-3">
                <span className="grid place-items-center size-9 sm:size-11 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30">
                  <MdAdminPanelSettings className="text-lg sm:text-2xl" />
                </span>
                {esSuper ? 'SUPER ADMINISTRADOR' : 'ADMINISTRADOR'}
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                {esSuper
                  ? 'Listado de todas las solicitudes registradas'
                  : 'Solicitudes sin asignar y tus propias asignaciones'}
              </p>
            </div>
            {esSuper && (
              <button
                type="button"
                onClick={handleResetDatos}
                className="inline-flex items-center gap-2 self-start rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 hover:border-red-400 transition"
                title="Elimina todas las solicitudes y reinicia el contador (solo pruebas)"
              >
                <MdRestartAlt className="text-base" />
                Restablecer datos de prueba
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mb-6 inline-flex items-center gap-1 rounded-2xl bg-brand-mist/70 ring-1 ring-brand-ink/10 p-1">
            {TABS.map((t) => {
              const Icon = t.Icon
              const active = tab === t.id
              const cuenta = contadorTab(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-sm font-extrabold transition-all ${
                    active
                      ? 'bg-brand-navy text-white shadow-lg'
                      : 'text-brand-ink/60 hover:bg-white/70 hover:text-brand-deep'
                  }`}
                >
                  <Icon className="text-base" />
                  <span>{t.label}</span>
                  {(t.id === 'solicitudes' || t.id === 'asignaciones') && cuenta > 0 && (
                    <span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-[10px] font-extrabold ${active ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-deep/10 text-brand-deep'}`}>
                      {cuenta}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {tab === 'dashboard' ? (
            <DashboardTab solicitudes={scope} />
          ) : tab === 'planillas' ? (
            <PlanillasTab solicitudes={scope} />
          ) : (
            <>
              {baseDelTab.length > 0 && (
                <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <EstadoFilter solicitudes={baseDelTab} value={filterEstado} onChange={setFilterEstado} />
                  {esSuper && (
                    <AsignadoFilter solicitudes={baseDelTab} value={filtroAsignado} onChange={setFiltroAsignado} />
                  )}
                  <SearchFilters
                    cliente={filtroCliente}
                    zona={filtroZona}
                    onClienteChange={setFiltroCliente}
                    onZonaChange={setFiltroZona}
                    id={filtroId}
                    onIdChange={setFiltroId}
                  />
                </div>
              )}

              <SolicitudesTable
                items={filtered}
                onEstadoClick={(s) => setHistorialSolicitud(s)}
                onAsignarClick={(s) => setAsignarSolicitud(s)}
                onCambiarEstadoClick={(s) => setEditSolicitud(s)}
                onAsignarConductorClick={(s) => setAsignarConductorSolicitud(s)}
                onEntregaDetallesClick={(s) => setEntregaDetallesSolicitud(s)}
                onEliminarClick={handleEliminar}
                colorRowsPorEstado
                empty={
                  hasFilters
                    ? {
                        icon: <MdFilterList />,
                        title: 'No hay solicitudes que coincidan con los filtros',
                        text: 'Ajusta el estado, asignado, cliente o zona seleccionados.',
                      }
                    : tab === 'asignaciones'
                      ? {
                          icon: <MdAssignmentInd />,
                          title: 'Aún no tienes solicitudes asignadas',
                          text: 'Cuando te asignen una solicitud aparecerá aquí.',
                        }
                      : {
                          icon: <MdInbox />,
                          title: esSuper ? 'Aún no hay solicitudes registradas' : 'No hay solicitudes sin asignar',
                          text: esSuper
                            ? 'Crea tu primera solicitud desde «MIS SOLICITUDES».'
                            : 'Todas las solicitudes ya están asignadas. Revisa el tab «Mis asignaciones».',
                        }
                }
              />
            </>
          )}
        </div>
      </main>

      <Footer />

      <EstadosModal
        solicitud={editSolicitud}
        open={editSolicitud !== null}
        onClose={() => setEditSolicitud(null)}
        onUpdate={handleUpdateEstado}
        onAsignarConductorClick={(s) => setAsignarConductorSolicitud(s)}
        permitidos={ESTADOS_ADMIN}
      />

      <AsignarUsuarioModal
        solicitud={asignarSolicitud}
        open={asignarSolicitud !== null}
        onClose={() => setAsignarSolicitud(null)}
        onUpdate={handleAsignar}
      />

      <AsignarConductorModal
        solicitud={asignarConductorSolicitud}
        open={asignarConductorSolicitud !== null}
        onClose={() => setAsignarConductorSolicitud(null)}
        onUpdate={handleAsignarConductor}
      />

      <HistorialModal
        solicitud={historialSolicitud}
        open={historialSolicitud !== null}
        onClose={() => setHistorialSolicitud(null)}
      />

      <EntregaDetallesModal
        solicitud={entregaDetallesSolicitud}
        open={entregaDetallesSolicitud !== null}
        onClose={() => setEntregaDetallesSolicitud(null)}
      />

      <ConfirmarEliminarModal
        solicitud={eliminarSolicitud}
        open={eliminarSolicitud !== null}
        onClose={() => setEliminarSolicitud(null)}
        onConfirm={confirmarEliminar}
      />

    </div>
  )
}