import { useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdLocalShipping } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import { loadSolicitudes } from '../Home/Components/solicitudesStore.js'

const ESTADO_TRANSITO = 'En Transito'

export default function Conductor() {
  const [solicitudes] = useState(loadSolicitudes())
  const enTransito = solicitudes.filter((s) => (s.estado || 'Abierto') === ESTADO_TRANSITO)

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
            empty={{
              icon: <MdLocalShipping />,
              title: 'No hay solicitudes en tránsito',
              text: 'Cuando una solicitud cambie a estado «En Transito» aparecerá aquí.',
            }}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}