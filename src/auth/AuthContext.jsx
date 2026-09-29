import { createContext, useContext, useEffect, useState } from 'react'
import { getActiveAccount, msalInstance, msalReady } from './msal.js'
import {
  esErrorDeScope,
  loginRequest,
  loginRequestRespaldo,
} from './authConfig.js'
import { cargarUsuarioActual } from '../services/solicitudesApi.js'
import { cerrarSesion } from '../services/apiClient.js'
import { setRolActual, setUsuarioActual } from '../store/solicitudesStore.js'

const AuthContext = createContext(null)

// Traduce los errores de MSAL a algo accionable. Sin esto el usuario solo ve
// que el botón no responde.
//
// El código de Microsoft va SIEMPRE al principio del mensaje. Ya se confundió
// AADSTS65001 con AADSTS500011 por deducir el error en vez de leerlo, y se
// diagnóstico que adivina el motivo es peor que ninguno.
function describirError(error) {
  const codigo = String(error?.errorCode || error?.code || '').trim()
  const mensaje = String(error?.errorMessage || error?.message || error || '').trim()
  const crudo = `${codigo} ${mensaje}`
  const prefijo = codigo ? `[${codigo}] ` : ''

  if (/AADSTS500011/i.test(crudo)) {
    return `${prefijo}Microsoft no encuentra la API registrada en el tenant. Se reintentó con permisos de Graph; si sigue fallando, publica el scope en Entra ID (sección 6.2 de la guía).`
  }
  if (/AADSTS50011\b|redirect_uri|mismatch/i.test(crudo)) {
    return `${prefijo}Ese dominio no está autorizado en Microsoft Entra ID. La app envía window.location.origin como Redirect URI; debe coincidir carácter a carácter con lo registrado. Revisa también si estás entrando por www.`
  }
  if (/AADSTS7000215|invalid_client/i.test(crudo)) {
    return `${prefijo}Microsoft rechazó la aplicación. Revisa que el Redirect URI coincida exactamente con la dirección del navegador.`
  }
  if (/interaction_in_progress|popup_window_error/i.test(crudo)) {
    return `${prefijo}Ya hay una autenticación en curso. Espera unos segundos y vuelve a intentar.`
  }
  if (/user_cancelled|cancelled/i.test(crudo)) {
    return ''
  }
  return `${prefijo}No se pudo iniciar sesión: ${mensaje || 'error desconocido'}`
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [rolListo, setRolListo] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [loginEnCurso, setLoginEnCurso] = useState(false)

  // El scope api://<client-id>/access_as_user solo existe si en Entra ID se
  // publicó con "Expose an API". Si no está, Microsoft rechaza la autenticación
  // y handleRedirectPromise lo entrega como error: eso es un rechazo de la
  // promesa, no una sesión válida. Se marca el respaldo para reintentar con
  // permisos de Graph, que el backend sí acepta. La lista de códigos está
  // centralizada en esErrorDeScope.
  // Red de seguridad. Solo se activa si VITE_USAR_SCOPE_API=1 y aun así el
  // scope no estuviera publicado en Entra ID: el fallo llega aquí, en
  // handleRedirectPromise, no en el clic, así que el catch de login() no lo ve.
  useEffect(() => {
    let cancelled = false

    msalReady
      .then((respuesta) => {
        if (cancelled) return
        if (respuesta && respuesta.error) {
          const crudo = String(respuesta.errorMessage || respuesta.error || '')
          if (esErrorDeScope(crudo)) {
            console.warn('[Auth] el scope de la API no existe en Entra ID; se reintenta con Graph.')
            setAccount(null)
            setLoading(false)
            msalInstance
              .loginRedirect(loginRequestRespaldo)
              .catch((e) => console.error('[Auth] falló el reintento con Graph:', e?.message))
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
  // espera msalReady y se capturan los errores.
  const login = async () => {
    setErrorLogin('')
    setLoginEnCurso(true)
    try {
      await msalReady
      await msalInstance.loginRedirect(loginRequest)
    } catch (error) {
      const crudo = String(error?.errorMessage || error?.message || error || '')
      if (esErrorDeScope(crudo)) {
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