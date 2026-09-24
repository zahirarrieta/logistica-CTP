import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sileo'
import Loader from './loader/Loader.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { puedeVer, rutaInicial, RUTA_INICIO } from './auth/roles.js'
import { sincronizarInicial, iniciarTiempoReal, detenerTiempoReal } from './pages/Home/Components/solicitudesStore.js'

// Marca guardada en sessionStorage: la primera vez que esta pestaña abre una
// sesión (login nuevo o recarga desde cero) se va al Home; después de ese primer
// acceso se conserva la ruta en la que esté el usuario.
const CLAVE_SESION_INICIO = 'ctp_sesion_inicio'

const Login = lazy(() => import('./pages/Login/Login.jsx'))
const Home = lazy(() => import('./pages/Home/Home.jsx'))
const Solicitudes = lazy(() => import('./pages/Home/Solicitudes.jsx'))
const Administrador = lazy(() => import('./pages/Administrador/Administrador.jsx'))
const Conductor = lazy(() => import('./pages/Conductor/Conductor.jsx'))

// Bloquea el acceso a módulos que el rol del usuario no tiene permitidos.
function Protegida({ path, children }) {
  const { rol } = useAuth()
  if (!puedeVer(rol, path)) return <Navigate to={rutaInicial(rol)} replace />
  return children
}

function Root() {
  const { account, loading, rolListo } = useAuth()
  const [datosListos, setDatosListos] = useState(false)
  const navigate = useNavigate()

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

  if (loading || (account && (!datosListos || !rolListo))) return <Loader />

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
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <Toaster position="top-right" offset={{ top: '5.5rem', right: '0.75rem' }} />
    </AuthProvider>
  )
}
