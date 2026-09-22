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
let sesionDeCorreo = ''

async function liberarSesion() {
  if (supabase && sesion) {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignorar
    }
  }
  sesion = null
  sesionDeCorreo = ''
}

// Cierra la sesión anónima de Supabase y deja la sesión en caché sin uso. Se
// llama al cerrar sesión o cambiar de cuenta para que cada usuario de Microsoft
// obtenga su propio JWT anónimo y Supabase no rechace el del usuario anterior.
export function cerrarSesion() {
  if (!supabase) return Promise.resolve()
  return liberarSesion()
}

export function iniciarSesion() {
  if (!supabase) return Promise.resolve(null)
  const { correo } = datosUsuario()
  // Si ya había una sesión anónima de OTRO usuario, se descarta y se abre una
  // nueva: evita errores de validación del JWT viejo y el cruce de visibilidad
  // entre cuentas por RLS.
  if (sesion && sesionDeCorreo && sesionDeCorreo !== correo) {
    sesion = null
    sesionDeCorreo = ''
    void supabase.auth.signOut().catch(() => {})
  }
  if (!sesion) {
    const { correo: correoSesion, nombre } = datosUsuario()
    sesion = supabase.auth
      .signInAnonymously({ options: { data: { correo: correoSesion, nombre } } })
      .then(({ data, error }) => {
        if (error) throw error
        sesionDeCorreo = correoSesion
        console.info(`[Supabase] sesión abierta como ${correoSesion || nombre}`)
        return data.session
      })
      .catch((error) => {
        sesion = null
        sesionDeCorreo = ''
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
