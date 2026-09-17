import { createClient } from '@supabase/supabase-js'
import { msalInstance } from '../auth/msal.js'
import { shortName } from '../auth/user.js'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const apiKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ''
).trim()

export const supabase = url && apiKey
  ? createClient(url, apiKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export const backendActivo = Boolean(supabase)

export function datosUsuario() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  const correo = (account?.username || account?.idTokenClaims?.email || '').toLowerCase().trim()
  return { correo, nombre: account?.name?.trim() || shortName(account) }
}

let sesion = null

export function iniciarSesion() {
  if (!supabase) return Promise.resolve(null)
  if (!sesion) {
    const { correo, nombre } = datosUsuario()
    sesion = supabase.auth
      .signInAnonymously({ options: { data: { correo, nombre } } })
      .then(({ data, error }) => {
        if (error) throw error
        return data.session
      })
      .catch((error) => {
        sesion = null
        throw error
      })
  }
  return sesion
}
