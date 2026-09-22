import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sileo'
import Loader from './loader/Loader.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { puedeVer, rutaInicial } from './auth/roles.js'
import { sincronizarInicial, iniciarTiempoReal, detenerTiempoReal } from './pages/Home/Components/solicitudesStore.js'

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
