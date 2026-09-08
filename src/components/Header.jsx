import { Link, useLocation } from 'react-router-dom'
import { MdHome, MdFolderOpen, MdSettings, MdLogout } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { useAuth } from '../auth/AuthContext.jsx'
import { shortName } from '../auth/user.js'

const MENU = [
  { to: '/inicio', label: 'Inicio', Icon: MdHome },
  { to: '/solicitudes', label: 'Solicitudes', Icon: MdFolderOpen },
  { to: '/conductor', label: 'Conductor', Icon: RiSteering2Line },
  { to: '/administrador', label: 'Administrador', Icon: MdSettings },
]

export default function Header() {
  const { pathname } = useLocation()
  const { logout, account } = useAuth()

  const greeting = account?.name ? `Hola, ${shortName(account)}` : 'Cerrar sesión'

  return (
    <header className="sticky top-0 z-[100] pointer-events-none pt-3 px-2">
      <nav className="ctp-menu pointer-events-auto" aria-label="Navegación principal">
        <span className="ctp-brand-wrap">
          <Link to="/inicio" className="ctp-brand" aria-label="CTP inicio">
            <img src="/CTP.png" alt="CTP" />
          </Link>
        </span>

        <div className="ctp-links">
          {MENU.map((item) => {
            const Icon = item.Icon
            const isActive = pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to} className={isActive ? 'active' : ''}>
                <Icon />
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
          <MdLogout />
          <span>{greeting}</span>
        </button>
      </nav>
    </header>
  )
}