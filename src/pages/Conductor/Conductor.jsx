import { useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdLocalShipping } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import Toast from '../../components/Toast.jsx'
import EstadosModal from '../Administrador/Components/modals/EstadosModal.jsx'
import { loadSolicitudes, updateSolicitud } from '../Home/Components/solicitudesStore.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

function estadosConductor(s) {
  const actual = s.estado || 'Abierto'
  if (actual === 'En Tránsito') return ['Entregado']
  if (actual === 'En Tránsito Parcial') return ['Entregado Parcial']
  return ['Entregado', 'Entregado Parcial']
}

export default function Conductor() {
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [editarSolicitud, setEditarSolicitud] = useState(null)
  const [toast, setToast] = useState(null)
  const enTransito = solicitudes.filter((s) => ESTADOS_TRANSITO.includes(s.estado || 'Abierto'))

  const handleUpdateEstado = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
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
            onCambiarEstadoClick={(s) => setEditarSolicitud(s)}
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

      <EstadosModal
        solicitud={editarSolicitud}
        open={editarSolicitud !== null}
        onClose={() => setEditarSolicitud(null)}
        onUpdate={handleUpdateEstado}
        permitidos={editarSolicitud ? estadosConductor(editarSolicitud) : undefined}
      />

      {toast && (
        <Toast
          tipo={toast.tipo}
          estado={toast.estado}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}