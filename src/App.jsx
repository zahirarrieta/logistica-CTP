import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login/Login.jsx'
import Home from './pages/Home/Home.jsx'
import Solicitudes from './pages/Home/Solicitudes.jsx'
import Administrador from './pages/Administrador/Administrador.jsx'
import Conductor from './pages/Conductor/Conductor.jsx'
import Loader from './loader/Loader.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'

function Root() {
  const { account, loading } = useAuth()
  const [bootLoading, setBootLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setBootLoading(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  if (bootLoading || loading) return <Loader />

  if (!account) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/inicio" element={<Home />} />
      <Route path="/solicitudes" element={<Solicitudes />} />
      <Route path="/administrador" element={<Administrador />} />
      <Route path="/conductor" element={<Conductor />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}