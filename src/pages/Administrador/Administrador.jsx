import { useState } from 'react'
import { MdAdminPanelSettings, MdDeleteSweep, MdEdit, MdInbox, MdFilterList } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import EstadoFilter from '../../components/EstadoFilter.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import AsignadoFilter from '../../components/AsignadoFilter.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import Toast from '../../components/Toast.jsx'
import EstadosModal from './Components/modals/EstadosModal.jsx'
import HistorialModal from './Components/modals/HistorialModal.jsx'
import { loadSolicitudes, updateSolicitud, clearSolicitudes } from '../Home/Components/solicitudesStore.js'

export default function Administrador() {
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [editSolicitud, setEditSolicitud] = useState(null)
  const [historialSolicitud, setHistorialSolicitud] = useState(null)
  const [toast, setToast] = useState(null)
  const [filterEstado, setFilterEstado] = useState(null)
  const [filtroAsignado, setFiltroAsignado] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')

  const filtered = solicitudes.filter((s) => {
    const e = s.estado || 'Abierto'
    if (filterEstado && e !== filterEstado) return false
    if (filtroAsignado && (s.asignadoA || '') !== filtroAsignado) return false
    if (filtroCliente && !(s.cliente || '').toLowerCase().includes(filtroCliente.toLowerCase())) return false
    if (filtroZona && !(s.zona || '').toLowerCase().includes(filtroZona.toLowerCase())) return false
    return true
  })

  const hasFilters = Boolean(filterEstado || filtroAsignado || filtroCliente || filtroZona)

  const handleClearAll = () => {
    if (window.confirm('¿Seguro que deseas eliminar todas las solicitudes? Esta acción no se puede deshacer.')) {
      setSolicitudes(clearSolicitudes())
      setEditSolicitud(null)
      setFilterEstado(null)
      setFiltroAsignado(null)
      setFiltroCliente('')
      setFiltroZona('')
    }
  }

  const handleUpdateEstado = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
    setToast({ estado: updates.estado })
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
                ADMINISTRADOR
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                Listado de todas las solicitudes registradas
              </p>
            </div>
            {solicitudes.length > 0 && (
              <div className="flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-2 rounded-full bg-red-50 text-red-600 border-2 border-red-200 px-5 py-2 text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  <MdDeleteSweep className="text-lg" />
                  Borrar todo
                </button>
              </div>
            )}
          </div>

          {solicitudes.length > 0 && (
            <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <EstadoFilter solicitudes={solicitudes} value={filterEstado} onChange={setFilterEstado} />
              <AsignadoFilter solicitudes={solicitudes} value={filtroAsignado} onChange={setFiltroAsignado} />
              <SearchFilters
                cliente={filtroCliente}
                zona={filtroZona}
                onClienteChange={setFiltroCliente}
                onZonaChange={setFiltroZona}
              />
            </div>
          )}

          <SolicitudesTable
            items={filtered}
            onRowClick={(s) => setEditSolicitud(s)}
            onEstadoClick={(s) => setHistorialSolicitud(s)}
            cardActions={(s) => (
              <button
                type="button"
                onClick={() => setEditSolicitud(s)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-all"
              >
                <MdEdit className="text-lg" />
                Cambiar estado
              </button>
            )}
            empty={
              hasFilters
                ? {
                    icon: <MdFilterList />,
                    title: 'No hay solicitudes que coincidan con los filtros',
                    text: 'Ajusta el estado, asignado, cliente o zona seleccionados.',
                  }
                : {
                    icon: <MdInbox />,
                    title: 'Aún no hay solicitudes registradas',
                    text: 'Crea tu primera solicitud desde «MIS SOLICITUDES».',
                  }
            }
          />
        </div>
      </main>

      <Footer />

      <EstadosModal
        solicitud={editSolicitud}
        open={editSolicitud !== null}
        onClose={() => setEditSolicitud(null)}
        onUpdate={handleUpdateEstado}
      />

      <HistorialModal
        solicitud={historialSolicitud}
        open={historialSolicitud !== null}
        onClose={() => setHistorialSolicitud(null)}
      />

      {toast && (
        <Toast
          estado={toast.estado}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}