import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { shortName } from '../auth/user.js'
import { puedeVer } from '../auth/roles.js'

const MENU = [
  { to: '/inicio', label: 'Inicio', src: '/ImagHeader/inicio.png' },
  { to: '/solicitudes', label: 'Solicitudes', src: '/ImagHeader/SolicitudI.png' },
  { to: '/conductor', label: 'Conductor', src: '/ImagHeader/ConductorI.png' },
  { to: '/administrador', label: 'Administrador', src: '/ImagHeader/AdministradorI.png' },
]

export default function Header() {
  const { pathname } = useLocation()
  const { logout, account, rol } = useAuth()

  const greeting = account?.name ? `Hola, ${shortName(account)}` : 'Cerrar sesión'
  const enlaces = MENU.filter((item) => puedeVer(rol, item.to))

  return (
    <header className="sticky top-0 z-[100] pointer-events-none pt-3 px-2">
      <nav className="ctp-menu pointer-events-auto" aria-label="Navegación principal">
        <span className="ctp-brand-wrap">
          <Link to="/inicio" className="ctp-brand" aria-label="CTP inicio">
            <img src="/CTP.png" alt="CTP" />
          </Link>
        </span>

        <div className="ctp-links">
          {enlaces.map((item) => {
            const isActive = pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to} className={isActive ? 'active' : ''}>
                <img src={item.src} alt={item.label} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        <button
          type="button"
          className="ctp-logout"
          onClick={logout}
          aria-label="Cerrar sesión"
          title={greeting}
        >
          <img src="/ImagHeader/Salida.png" alt="Salida" />
          <span>{greeting}</span>
        </button>
      </nav>
    </header>
  )
}