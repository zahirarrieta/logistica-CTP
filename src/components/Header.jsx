import { useRef, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdHome, MdFolderOpen, MdSettings, MdLogout, MdLockReset, MdExpandMore } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { useAuth } from '../auth/AuthContext.jsx'
import { shortName } from '../auth/user.js'
import { puedeVer } from '../auth/roles.js'
import CambiarClaveModal from './CambiarClaveModal.jsx'
import { createPortal } from 'react-dom'

const MENU = [
  { to: '/inicio', label: 'Inicio', Icon: MdHome },
  { to: '/solicitudes', label: 'Solicitudes', Icon: MdFolderOpen },
  { to: '/conductor', label: 'Conductor', Icon: RiSteering2Line },
  { to: '/administrador', label: 'Administrador', Icon: MdSettings },
]

export default function Header() {
  const { pathname } = useLocation()
  const { logout, account, rol, usuario } = useAuth()
  const [abrirMenu, setAbrirMenu] = useState(false)
  const [cambiarClave, setCambiarClave] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const clicFuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setAbrirMenu(false)
    }
    document.addEventListener('mousedown', clicFuera)
    return () => document.removeEventListener('mousedown', clicFuera)
  }, [])

  const nombreUsuario = usuario?.nombre || account?.name || ''
  const greeting = nombreUsuario ? `Hola, ${shortName({ name: nombreUsuario })}` : 'Cerrar sesión'
  const enlaces = MENU.filter((item) => puedeVer(rol, item.to))

  const modal = cambiarClave ? createPortal(
    <CambiarClaveModal onClose={() => setCambiarClave(false)} />,
    document.body
  ) : null

  return (
    <header className="sticky top-0 z-[100] pointer-events-none pt-3 px-2">
      <nav className="ctp-menu pointer-events-auto" aria-label="Navegación principal" ref={menuRef}>
        <span className="ctp-brand-wrap">
          <Link to="/inicio" className="ctp-brand" aria-label="CTP inicio">
            <img src="/CTP.png" alt="CTP" />
          </Link>
        </span>

        <div className="ctp-links">
          {enlaces.map((item) => {
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

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            className="ctp-logout flex items-center gap-1.5"
            onClick={() => setAbrirMenu(!abrirMenu)}
            aria-expanded={abrirMenu}
            aria-haspopup="true"
            aria-label="Opciones de usuario"
          >
            <MdLogout />
            <span>{greeting}</span>
            <MdExpandMore className={`size-4 transition-transform ${abrirMenu ? 'rotate-180' : ''}`} />
          </button>

          {abrirMenu && (
            <div
              className="absolute right-0 top-full mt-3 w-40 origin-top-right rounded-xl bg-brand-ink ring-1 ring-brand-cyan/25 shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-scaleIn py-2 z-[200]"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { setCambiarClave(true); setAbrirMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-brand-mist hover:bg-brand-navy hover:text-brand-cyan transition-colors"
              >
                <MdLockReset className="size-5" />
                Cambiar clave
              </button>
              <hr className="my-1 border-brand-cyan/20" />
              <button
                type="button"
                role="menuitem"
                onClick={() => logout()}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-300 hover:bg-red-950/30 hover:text-red-200 transition-colors"
              >
                <MdLogout className="size-5" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </nav>

      {modal}
    </header>
  )
}