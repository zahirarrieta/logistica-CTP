import { createClient } from '@supabase/supabase-js'
import { msalInstance } from '../auth/msal.js'
import { shortName } from '../auth/user.js'

const FALLBACK_PUBLISHABLE = {
  url: 'https://glvkvesvbfkeuvavffld.supabase.co',
  key: 'sb_publishable_vMpbLHdHK2dUSrtW0VoEzQ_HtfwGSsJ',
}

const url = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_PUBLISHABLE.url).trim()
const apiKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || FALLBACK_PUBLISHABLE.key
).trim()

export const supabase = url && apiKey
  ? createClient(url, apiKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export const backendActivo = Boolean(supabase)

if (!backendActivo) {
  console.warn(
    '[Supabase] sin VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY: la app guarda solo en el navegador'
  )
}

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
        console.info(`[Supabase] sesión abierta como ${correo || nombre}`)
        return data.session
      })
      .catch((error) => {
        sesion = null
        if (/anonymous/i.test(error?.message || '')) {
          console.error(
            '[Supabase] falta activar Anonymous Sign-Ins: Studio > Authentication > Sign In / Up > Providers'
          )
        }
        throw error
      })
  }
  return sesion
}
