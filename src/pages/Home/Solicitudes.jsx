import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdAssignmentAdd, MdInbox, MdFilterList } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudModal from './Components/modals/SolicitudModal.jsx'
import SeguimientoModal from './Components/modals/SeguimientoModal.jsx'
import EstadoFilter from '../../components/EstadoFilter.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import { loadSolicitudes, saveSolicitud, corregirSolicitud, suscribir } from './Components/solicitudesStore.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { solicitudCreada, solicitudCorregida } from '../../services/notificaciones.jsx'

export default function Solicitudes() {
  const { account } = useAuth()
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [modalOpen, setModalOpen] = useState(false)
  const [editarSolicitud, setEditarSolicitud] = useState(null)
  const [detalleSolicitud, setDetalleSolicitud] = useState(null)
  const [filterEstado, setFilterEstado] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')

  useEffect(() => suscribir(setSolicitudes), [])

  // «MIS SOLICITUDES» solo muestra las solicitudes creadas por el usuario
  // conectado (comparando por su correo). Los admin/superadmin ven el total
  // únicamente en el módulo Administrador.
  const correoActual = (account?.username || '').trim().toLowerCase()
  const mias = useMemo(
    () => solicitudes.filter((s) => (s.correo || '').trim().toLowerCase() === correoActual),
    [solicitudes, correoActual]
  )

  const filtered = useMemo(() => {
    const cliente = filtroCliente.toLowerCase()
    const zona = filtroZona.toLowerCase()
    return mias.filter((s) => {
      const e = s.estado || 'Abierto'
      if (filterEstado && e !== filterEstado) return false
      if (cliente && !(s.cliente || '').toLowerCase().includes(cliente)) return false
      if (zona && !(s.zona || '').toLowerCase().includes(zona)) return false
      return true
    })
  }, [mias, filterEstado, filtroCliente, filtroZona])

  const hasFilters = Boolean(filterEstado || filtroCliente || filtroZona)

  const handleNewSolicitud = async (data) => {
    const siguiente = await saveSolicitud(data)
    setSolicitudes(siguiente)
    solicitudCreada(siguiente[0])
    setModalOpen(false)
  }

  const esMia = (s) => Boolean(correoActual) && (s.correo || '').trim().toLowerCase() === correoActual

  const handleCorregir = (s) => {
    if (!esMia(s)) return
    setDetalleSolicitud(null)
    setEditarSolicitud(s)
  }

  const handleEditSubmit = (id, datos) => {
    const siguiente = corregirSolicitud(id, datos)
    setSolicitudes(siguiente)
    setEditarSolicitud(null)
    solicitudCorregida(id)
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
                  <MdAssignmentAdd className="text-lg sm:text-2xl" />
                </span>
                MIS SOLICITUDES
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                Listado de tus solicitudes registradas
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-cyan text-brand-ink px-5 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-bold shadow-cyanGlow hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
              >
                <MdAdd className="text-lg" />
                Nueva solicitud
              </button>
            </div>
          </div>

          {mias.length > 0 && (
            <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <EstadoFilter solicitudes={mias} value={filterEstado} onChange={setFilterEstado} />
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
            onRowClick={(s) => setDetalleSolicitud(s)}
            onSeguimientoClick={(s) => setDetalleSolicitud(s)}
            onCorregirClick={handleCorregir}
            empty={
              hasFilters
                ? {
                    icon: <MdFilterList />,
                    title: 'No hay solicitudes que coincidan con los filtros',
                    text: 'Ajusta el estado, cliente o zona seleccionados.',
                  }
                : {
                    icon: <MdInbox />,
                    title: 'Aún no tienes solicitudes',
                    text: 'Crea tu primera solicitud con el botón «Nueva solicitud».',
                  }
            }
          />
        </div>
      </main>

      <Footer />

      <SolicitudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleNewSolicitud}
      />

      <SolicitudModal
        open={editarSolicitud !== null}
        solicitud={editarSolicitud}
        onClose={() => setEditarSolicitud(null)}
        onEditSubmit={handleEditSubmit}
      />

      <SeguimientoModal
        solicitud={detalleSolicitud}
        open={detalleSolicitud !== null}
        onClose={() => setDetalleSolicitud(null)}
        solicitudes={mias}
        onCorregir={handleCorregir}
      />
    </div>
  )
}