import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sileo'
import Loader from './loader/Loader.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { sincronizarInicial } from './pages/Home/Components/solicitudesStore.js'

const Login = lazy(() => import('./pages/Login/Login.jsx'))
const Home = lazy(() => import('./pages/Home/Home.jsx'))
const Solicitudes = lazy(() => import('./pages/Home/Solicitudes.jsx'))
const Administrador = lazy(() => import('./pages/Administrador/Administrador.jsx'))
const Conductor = lazy(() => import('./pages/Conductor/Conductor.jsx'))

function Root() {
  const { account, loading } = useAuth()
  const [datosListos, setDatosListos] = useState(false)

  useEffect(() => {
    if (!account) return
    let activo = true
    sincronizarInicial().finally(() => {
      if (activo) setDatosListos(true)
    })
    return () => {
      activo = false
    }
  }, [account])

  if (loading || (account && !datosListos)) return <Loader />

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
        <Route path="/" element={<Home />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/administrador" element={<Administrador />} />
        <Route path="/conductor" element={<Conductor />} />
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
