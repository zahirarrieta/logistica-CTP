import { createContext, useContext, useEffect, useState } from 'react'
import { getActiveAccount, msalInstance, msalReady } from './msal.js'
import { loginRequest } from './authConfig.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)

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

  const login = () => msalInstance.loginRedirect(loginRequest)
  const logout = () => {
    try { msalInstance.setActiveAccount(null) } catch { /* noop */ }
    setAccount(null)
    msalInstance.logoutPopup({ postLogoutRedirectUri: 'about:blank' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ account, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)