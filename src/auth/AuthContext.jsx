import { createContext, useContext, useEffect, useState } from 'react'
import { getActiveAccount, msalInstance, msalReady } from './msal.js'
import { loginRequest } from './authConfig.js'
import { cargarUsuarioActual } from '../services/solicitudesApi.js'
import { cerrarSesion } from '../services/supabaseClient.js'
import { setRolActual, setUsuarioActual } from '../pages/Home/Components/solicitudesStore.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [rolListo, setRolListo] = useState(false)

  useEffect(() => {
    let cancelled = false

    msalReady
      .then(() => {
        if (cancelled) return
        setAccount(getActiveAccount())
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setAccount(getActiveAccount())
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Carga el rol del usuario actual desde la tabla usuarios (tabla = fuente de
  // verdad; así un admin cambia permisos sin tocar el frontend).
  useEffect(() => {
    if (!account) {
      setUsuario(null)
      setRolListo(false)
      return
    }
    let cancelled = false
    setRolListo(false)
    cargarUsuarioActual()
      .then((u) => {
        if (cancelled) return
        setUsuario(u)
      })
      .catch(() => {
        if (cancelled) return
        setUsuario(null)
      })
      .finally(() => {
        if (!cancelled) setRolListo(true)
      })
    return () => {
      cancelled = true
    }
  }, [account])

  const login = () => msalInstance.loginRedirect(loginRequest)
  const logout = () => {
    try { msalInstance.setActiveAccount(null) } catch { /* noop */ }
    setAccount(null)
    setUsuario(null)
    setRolListo(false)
    void cerrarSesion()
    msalInstance.logoutPopup({ postLogoutRedirectUri: 'about:blank' }).catch(() => {})
  }

  const rol = usuario?.rol || 'solicitante'

  // Mantiene el rol y la identidad del usuario actual en el store (para avisos
  // de solicitudes nuevas, entregas asignadas al conductor y otras reglas que
  // viven fuera de React).
  useEffect(() => {
    setRolActual(usuario?.rol || '')
    setUsuarioActual({
      nombre: usuario?.nombre || account?.name || '',
      correo: usuario?.correo || account?.username || '',
    })
  }, [usuario, account])

  return (
    <AuthContext.Provider value={{ account, loading, login, logout, usuario, rol, rolListo }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)