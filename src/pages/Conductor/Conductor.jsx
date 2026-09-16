import { useEffect, useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdLocalShipping } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import Toast from '../../components/Toast.jsx'
import IndicadorSinConexion from '../../components/IndicadorSinConexion.jsx'
import EntregaConductor from './Components/modals/EntregaConductor.jsx'
import {
  loadSolicitudes,
  updateSolicitud,
  marcarPendienteSync,
  sincronizarPendientes,
} from '../Home/Components/solicitudesStore.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

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
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [editarSolicitud, setEditarSolicitud] = useState(null)
  const [toast, setToast] = useState(null)
  const online = useOnline()
  const enTransito = solicitudes.filter((s) => ESTADOS_TRANSITO.includes(s.estado || 'Abierto'))

  useEffect(() => {
    if (!online) return
    const cantidad = sincronizarPendientes()
    if (cantidad > 0) setToast({ tipo: 'sync', cantidad })
  }, [online])

  const handleUpdateEstado = (id, updates) => {
    let siguiente = updateSolicitud(id, updates)
    if (!navigator.onLine) siguiente = marcarPendienteSync(id)
    setSolicitudes(siguiente)
    setToast({ tipo: 'estado', estado: updates.estado })
  }

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
              CONDUCTOR
            </h1>
            <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
              Solicitudes actualmente en tránsito
            </p>
          </div>

          {enTransito.length > 0 && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-4 py-2 text-sm font-bold">
                <MdLocalShipping className="text-lg" />
                {enTransito.length} solicitud(es) en tránsito
              </span>
            </div>
          )}

          <SolicitudesTable
            items={enTransito}
            onRowClick={(s) => setEditarSolicitud(s)}
            cardActions={(s) => (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditarSolicitud(s) }}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-2 text-xs font-bold w-full"
              >
                <MdLocalShipping className="text-lg" />
                Entregar pedido
              </button>
            )}
            colorRowsPorEstado
            empty={{
              icon: <MdLocalShipping />,
              title: 'No hay solicitudes en tránsito',
              text: 'Cuando una solicitud cambie a estado «En Transto» aparecerá aquí.',
            }}
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

      {toast && (
        <Toast
          tipo={toast.tipo}
          estado={toast.estado}
          cantidad={toast.cantidad}
          onClose={() => setToast(null)}
        />
      )}

      <IndicadorSinConexion />
    </div>
  )
}