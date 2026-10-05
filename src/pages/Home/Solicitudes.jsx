import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdInbox, MdFilterList, MdDelete } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudModal from './Components/modals/SolicitudModal.jsx'
import SeguimientoModal from './Components/modals/SeguimientoModal.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import { loadSolicitudes, saveSolicitud, corregirSolicitud, suscribir, removeSolicitud, puedeEliminarSolicitud, restanteEliminar } from '../../store/solicitudesStore.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { solicitudCreada, solicitudCorregida } from '../../services/notificaciones.jsx'

export default function Solicitudes() {
  const { account } = useAuth()
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [modalOpen, setModalOpen] = useState(false)
  const [editarSolicitud, setEditarSolicitud] = useState(null)
  const [detalleSolicitud, setDetalleSolicitud] = useState(null)
  const [plantilla, setPlantilla] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')
  const [porEliminar, setPorEliminar] = useState(null)

  useEffect(() => suscribir(setSolicitudes), [])

  // Si llega un cambio en vivo (Realtime) mientras un modal está abierto,
  // re-apunta el objeto del modal a la versión fresca por id; si la solicitud
  // desapareció, cierra el modal. Así el estado «Entregado» se refleja al
  // instante sin tener que cerrar y volver a abrir.
  useEffect(() => {
    setDetalleSolicitud((prev) =>
      prev ? (solicitudes.find((s) => s.id === prev.id) || null) : prev
    )
    setEditarSolicitud((prev) =>
      prev ? (solicitudes.find((s) => s.id === prev.id) || null) : prev
    )
  }, [solicitudes])

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
      if (cliente && !(s.cliente || '').toLowerCase().includes(cliente)) return false
      if (zona && !(s.zona || '').toLowerCase().includes(zona)) return false
      return true
    })
  }, [mias, filtroCliente, filtroZona])

  const hasFilters = Boolean(filtroCliente || filtroZona)

  const handleNewSolicitud = async (data, idSolicitud) => {
    const siguiente = await saveSolicitud(data, idSolicitud)
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

  const handleNewSolicitudAbierta = (s = null) => {
    setEditarSolicitud(null)
    setDetalleSolicitud(null)
    setPlantilla(s)
    setModalOpen(true)
  }

  // No borra de una vez: abre la confirmación «¿Seguro de eliminar…?». El borrado
  // real ocurre en confirmarEliminar, que vuelve a validar la ventana de 3 min por
  // si expiró mientras el diálogo estaba abierto.
  const handleEliminar = (s) => {
    if (!esMia(s)) return
    if (!puedeEliminarSolicitud(s, correoActual)) return
    setPorEliminar(s)
  }

  const confirmarEliminar = () => {
    const s = porEliminar
    setPorEliminar(null)
    if (!s || !esMia(s)) return
    if (!puedeEliminarSolicitud(s, correoActual)) return
    setSolicitudes(removeSolicitud(s.id))
    setDetalleSolicitud((prev) => (prev?.id === s.id ? null : prev))
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
                <span className="grid place-items-center size-10 sm:size-12 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 overflow-hidden">
                  <img src="/ITitulos/SolicitudI.png" alt="Mis solicitudes" className="size-full object-contain" />
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
            onEliminarClick={handleEliminar}
            puedeEliminar={(s) => puedeEliminarSolicitud(s, correoActual)}
            restanteEliminar={(s) => restanteEliminar(s, correoActual)}
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
        onClose={() => {
          setModalOpen(false)
          setPlantilla(null)
        }}
        onSubmit={handleNewSolicitud}
        plantilla={plantilla}
      />

      <SolicitudModal
        open={editarSolicitud !== null}
        solicitud={editarSolicitud}
        onClose={() => setEditarSolicitud(null)}
        onEditSubmit={handleEditSubmit}
        onCrearNueva={handleNewSolicitudAbierta}
      />

      <SeguimientoModal
        solicitud={detalleSolicitud}
        open={detalleSolicitud !== null}
        onClose={() => setDetalleSolicitud(null)}
        solicitudes={mias}
        onCorregir={handleCorregir}
        onEliminar={handleEliminar}
      />

      {porEliminar && (
        <div
          onClick={() => setPorEliminar(null)}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titulo-eliminar-solicitud"
          className="fixed inset-0 z-[100] grid place-items-center bg-brand-ink/70 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-scaleIn"
          >
            <h4
              id="titulo-eliminar-solicitud"
              className="font-extrabold text-base text-brand-ink inline-flex items-center gap-2"
            >
              <span className="grid place-items-center size-8 rounded-xl bg-red-50 text-red-600">
                <MdDelete className="text-lg" />
              </span>
              ELIMINAR SOLICITUD
            </h4>
            <p className="mt-3 text-sm leading-relaxed text-brand-ink/75">
              ¿Seguro de eliminar la solicitud{' '}
              <span className="font-extrabold text-brand-ink">{porEliminar.id}</span>?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-brand-ink/55">
              Esta acción no se puede deshacer. Solo puedes eliminarla durante los
              3 minutos siguientes a la subida; después únicamente un superadmin.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorEliminar(null)}
                className="rounded-full px-4 py-2 text-xs font-bold text-brand-ink/70 bg-brand-ink/10 hover:bg-brand-ink/20 transition-colors"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <MdDelete className="text-base" />
                ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}