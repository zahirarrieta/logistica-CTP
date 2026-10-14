import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sileo'
import Loader from './loader/Loader.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { puedeVer, rutaInicial, RUTA_INICIO, puedeRecolectar } from './auth/roles.js'
import { sincronizarInicial, iniciarTiempoReal, detenerTiempoReal } from './store/solicitudesStore.js'
import {
  sincronizarRecolecciones,
  iniciarTiempoRealRecolecciones,
  detenerTiempoRealRecolecciones,
} from './store/recoleccionesStore.js'
import useInactividadSesion from './hooks/useInactividadSesion.js'
import AvisoCierreSesion from './components/AvisoCierreSesion.jsx'
import AvisoNuevaVersion from './components/AvisoNuevaVersion.jsx'
import FloatingChatBotButton from './components/FloatingChatBotButton.jsx'

// Marca guardada en sessionStorage: la primera vez que esta pestaña abre una
// sesión (login nuevo o recarga desde cero) se va al Home; después de ese primer
// acceso se conserva la ruta en la que esté el usuario.
const CLAVE_SESION_INICIO = 'ctp_sesion_inicio'

const Login = lazy(() => import('./pages/Login/Login.jsx'))
const Home = lazy(() => import('./pages/Home/Home.jsx'))
const Solicitudes = lazy(() => import('./pages/Home/Solicitudes.jsx'))
const Administrador = lazy(() => import('./pages/Administrador/Administrador.jsx'))
const Conductor = lazy(() => import('./pages/Conductor/Conductor.jsx'))
const Inventario = lazy(() => import('./pages/Inventario/Inventario.jsx'))

// Bloquea el acceso a módulos que el rol del usuario no tiene permitidos. Para
// los solicitantes la lista de módulos sale del ajuste global (AuthContext).
function Protegida({ path, children }) {
  const { rol, modulosSolicitante } = useAuth()
  if (!puedeVer(rol, path, modulosSolicitante)) return <Navigate to={rutaInicial(rol, modulosSolicitante)} replace />
  return children
}

function Root() {
  const { account, loading, rolListo, logout, rol, configLista, modulosSolicitante } = useAuth()
  const [datosListos, setDatosListos] = useState(false)
  const navigate = useNavigate()

  // Cierre por inactividad. Solo cuenta con la sesión abierta: en el login no hay
  // nada que cerrar y el contador se detendría en el mismo estado al volver a
  // entrar. Solo aplica a SOLICITANTES (admin, superadmin, conductor exentos).
  const cerrarPorInactividad = useCallback(
    () => logout('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar.'),
    [logout]
  )
  const { aviso, restante, seguirTrabajando } = useInactividadSesion({
    activo: Boolean(account),
    alCerrar: cerrarPorInactividad,
    rol,
  })

  // Al abrir una sesión nueva (login reciente o pestaña sin marca de sesión) el
  // usuario siempre inicia en el Home, sin importar en qué módulo estaba quien
  // usó el equipo antes. Al cerrar sesión se limpia la marca.
  useEffect(() => {
    let marca = false
    try {
      marca = sessionStorage.getItem(CLAVE_SESION_INICIO) === '1'
    } catch {
      // sin almacenamiento disponible
    }
    if (account) {
      if (!marca) {
        try {
          sessionStorage.setItem(CLAVE_SESION_INICIO, '1')
        } catch {
          // ignorar
        }
        navigate(RUTA_INICIO, { replace: true })
      }
    } else {
      try {
        sessionStorage.removeItem(CLAVE_SESION_INICIO)
      } catch {
        // ignorar
      }
    }
  }, [account, navigate])

  useEffect(() => {
    if (!account) return
    let activo = true
    iniciarTiempoReal()
    sincronizarInicial().finally(() => {
      if (activo) setDatosListos(true)
    })
    return () => {
      activo = false
      detenerTiempoReal()
    }
  }, [account])

  // Recolecciones: el mismo polling, pero solo para los roles que ven el módulo.
  // Un conductor (o un solicitante con «Recolecciones» apagado) recibiría un 403
  // en cada ciclo, así que ahí no se arranca.
  const veRecolecciones = Boolean(account) && puedeRecolectar(rol, modulosSolicitante)
  useEffect(() => {
    if (!veRecolecciones) return undefined
    iniciarTiempoRealRecolecciones()
    void sincronizarRecolecciones().catch((error) =>
      console.warn('[Recolecciones] carga inicial falló:', error)
    )
    return () => {
      detenerTiempoRealRecolecciones()
    }
  }, [veRecolecciones])

  if (loading || (account && (!datosListos || !rolListo || !configLista))) return <Loader />

  if (!account) {
    return (
      <Suspense fallback={<Loader />}>
        <Login />
      </Suspense>
    )
  }

return (
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Protegida path="/inicio"><Home /></Protegida>} />
          <Route path="/inicio" element={<Protegida path="/inicio"><Home /></Protegida>} />
          <Route path="/solicitudes" element={<Protegida path="/solicitudes"><Solicitudes /></Protegida>} />
          <Route path="/administrador" element={<Protegida path="/administrador"><Administrador /></Protegida>} />
          <Route path="/conductor" element={<Protegida path="/conductor"><Conductor /></Protegida>} />
          <Route path="/inventario" element={<Protegida path="/inventario"><Inventario /></Protegida>} />
        </Routes>
        <AvisoCierreSesion
          abierto={aviso}
          restante={restante}
          onContinuar={seguirTrabajando}
        />
        <FloatingChatBotButton />
      </Suspense>
    )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <AvisoNuevaVersion />
      <Toaster position="top-right" offset={{ top: '5.5rem', right: '0.75rem' }} />
    </AuthProvider>
  )
}
