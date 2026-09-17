import { useCallback, useEffect, useState } from 'react'
import { cargarUsuarios } from '../services/solicitudesApi.js'

export default function useUsuarios(open) {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setCargando(true)
    setError('')
    return cargarUsuarios()
      .then((data) => {
        setUsuarios(data || [])
        return data
      })
      .catch((err) => {
        console.error('[Usuarios] error cargando usuarios:', err)
        setError(err.message || 'Error al cargar usuarios')
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (open) cargar()
  }, [open, cargar])

  return { usuarios, cargando, error, recargar: cargar }
}
