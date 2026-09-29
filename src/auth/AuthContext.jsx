import { createContext, useContext, useEffect, useState } from 'react'
import { getActiveAccount, msalInstance, msalReady } from './msal.js'
import {
  activarRespaldo,
  desactivarRespaldo,
  loginRequest,
  loginRequestRespaldo,
  usarRespaldo,
} from './authConfig.js'
import { cargarUsuarioActual } from '../services/solicitudesApi.js'
import { cerrarSesion } from '../services/apiClient.js'
import { setRolActual, setUsuarioActual } from '../store/solicitudesStore.js'

const AuthContext = createContext(null)

// Traduce los errores de MSAL a algo accionable. Sin esto el usuario solo ve
// que el botón no responde.
function describirError(error) {
  const crudo = String(error?.errorCode || error?.code || '') + ' ' + String(
    error?.errorMessage || error?.message || error || ''
  )
  if (/AADSTS50011|redirect_uri|mismatch/i.test(crudo)) {
    return 'Ese dominio no está autorizado en Microsoft Entra ID. Hay que registrarlo como Redirect URI (sección 6.1 de la guía).'
  }
  if (/AADSTS7000215|invalid_client/i.test(crudo)) {
    return 'Microsoft rechazó la aplicación. Revisa que el Redirect URI coincida exactamente con la dirección del navegador.'
  }
  if (/interaction_in_progress|popup_window_error/i.test(crudo)) {
    return 'Ya hay una autenticación en curso. Espera unos segundos y vuelve a intentar.'
  }
  if (/user_cancelled|cancelled/i.test(crudo)) {
    return ''
  }
  return `No se pudo iniciar sesión: ${error?.errorMessage || error?.message || 'error desconocido'}`
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [rolListo, setRolListo] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [loginEnCurso, setLoginEnCurso] = useState(false)

  // El scope api://<client-id>/access_as_user solo existe si en Entra ID se
  // publicó con "Expose an API". Si no está, Microsoft devuelve AADSTS65001
  // desde la página de login y handleRedirectPromise lo entrega como error:
  // eso es un rechazo de la promesa, no una sesión válida. En ese caso se marca
  // el respaldo para reintentar con permisos de Graph, que el backend sí acepta.
  useEffect(() => {
    let cancelled = false

    msalReady
      .then((respuesta) => {
        if (cancelled) return
        if (respuesta && respuesta.error) {
          const crudo = String(respuesta.errorMessage || respuesta.error || '')
          if (/AADSTS65001|invalid_scope|unauthorized_client/i.test(crudo)) {
            activarRespaldo()
            console.warn('[Auth] el scope de la API no existe en Entra ID; se usará Graph.')
            setAccount(null)
            setLoading(false)
            return
          }
          console.warn('[Auth] error al volver de Microsoft:', crudo)
        }
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

  // Antes devolvía la promesa de loginRedirect sin tocarla: cualquier rechazo
  // (redirect URI no registrado, scope inexistente, popup bloqueado) se
  // consumía como unhandled rejection y el botón no hacía nada visible. Ahora se
  // espera msalReady, se capturan los errores y se reintenta con Graph.
  const login = async () => {
    setErrorLogin('')
    setLoginEnCurso(true)
    try {
      await msalReady
      await msalInstance.loginRedirect(usarRespaldo() ? loginRequestRespaldo : loginRequest)
    } catch (error) {
      const crudo = String(error?.errorMessage || error?.message || error || '')
      if (/AADSTS65001|invalid_scope|unauthorized_client/i.test(crudo)) {
        activarRespaldo()
        try {
          await msalInstance.loginRedirect(loginRequestRespaldo)
        } catch (segundo) {
          setLoginEnCurso(false)
          setErrorLogin(describirError(segundo))
        }
        return
      }
      setLoginEnCurso(false)
      setErrorLogin(describirError(error))
    }
  }
  const logout = () => {
    try { msalInstance.setActiveAccount(null) } catch { /* noop */ }
    desactivarRespaldo()
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
    <AuthContext.Provider value={{ account, loading, login, logout, usuario, rol, rolListo, errorLogin, loginEnCurso }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)