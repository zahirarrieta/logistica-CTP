import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login/Login.jsx'
import Home from './pages/Home/Home.jsx'
import Solicitudes from './pages/Home/Solicitudes.jsx'
import Administrador from './pages/Administrador/Administrador.jsx'
import Conductor from './pages/Conductor/Conductor.jsx'
import Loader from './loader/Loader.jsx'

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/administrador" element={<Administrador />} />
        <Route path="/conductor" element={<Conductor />} />
      </Routes>
      {loading && <Loader />}
    </>
  )
}