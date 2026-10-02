import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { sileo } from 'sileo'
import {
  cerrarSesionLocal,
  guardarSesion,
  getActiveAccount,
  haySesion,
} from './sesion.js'
import { API_URL, apiFetch } from '../services/apiClient.js'
import { setRolActual, setUsuarioActual } from '../store/solicitudesStore.js'

const AuthContext = createContext(null)

const base = API_URL.replace(/\/+$/, '')

// Traduce el fallo de red a un mensaje que diga qué mirar.
//
// Antes salía siempre "no hay conexión, revisa tu internet", y eso era falso:
// cuando la API responde sin cabeceras CORS, el navegador bloquea la respuesta y
// fetch lanza igual que si no hubiera red. El sondeo en `no-cors` sí llega al
// servidor (por eso no puede leer la respuesta) pero falla de verdad cuando el
// dominio no resuelve o no acepta conexiones, y esa diferencia es justo la que
// separa "tu internet" de "el hosting está caído".
async function falloDeRed(ruta) {
  try {
    await fetch(base, { method: 'GET', mode: 'no-cors' })
    return (
      `El navegador bloqueó la respuesta de ${base}${ruta}. Suele significar que la API está ` +
      'caída o que su CORS_ORIGENES no incluye este sitio. No es problema de tu conexión.'
    )
  } catch {
    return (
      `No se pudo contactar con ${base}. El servidor no está disponible. ` +
      'No es problema de tu conexión.'
    )
  }
}

// Llama a /api/auth/* SIN el token: son las rutas que crean la sesión, no hay
// nada que mandar todavía. Por eso van por fetch directo y no por apiFetch, que
// exige sesión y rechazaría la llamada con 401.
async function llamarAuth(ruta, cuerpo) {
  let resp
  try {
    resp = await fetch(`${base}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    throw new Error(await falloDeRed(ruta))
  }

  let datos = null
  try {
    datos = await resp.json()
  } catch {
    datos = null
  }

  if (!resp.ok) {
    throw new Error(datos?.error || `Error ${resp.status} del servidor`)
  }
  return datos
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(() => getActiveAccount())
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [rolListo, setRolListo] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [loginEnCurso, setLoginEnCurso] = useState(false)
  const [sesionCaducada, setSesionCaducada] = useState('')

  // Al abrir la app se comprueba que el token guardado SIGA valiendo. Que exista
  // en localStorage no dice nada: pudo pasar SESSION_TTL, o el servidor pudo
  // reiniciarse con otro SESSION_SECRET.
  //
  // Esta única llamada hace de las dos cosas: validar el token Y traer la fila del
  // usuario. Antes se hacía además un /api/usuarios/yo para sacar el rol, lo que
  // duplicaba las peticiones en cada carga de página sin ganar nada: /api/auth/yo
  // ya devuelve correo, nombre, rol y activo.
  useEffect(() => {
    let cancelado = false

    if (!haySesion()) {
      setAccount(null)
      setUsuario(null)
      setLoading(false)
      return undefined
    }

    apiFetch('/api/auth/yo')
      .then((fila) => {
        if (cancelado) return
        if (!fila) {
          // La cuenta ya no está en la tabla. apiFetch no limpia la sesión en un
          // 404 (solo en 401), así que se limpia aquí: si no, el token se queda
          // para siempre en localStorage y cada recarga repite el mismo intento.
          cerrarSesionLocal()
          setAccount(null)
          setUsuario(null)
          return
        }
        // El servidor es la fuente cierta del nombre y del rol: lo guardado en el
        // navegador puede haber cambiado, y el rol es el que decide qué se ve.
        setUsuario(fila)
        setAccount({
          ...getActiveAccount(),
          name: fila.nombre || getActiveAccount()?.name || '',
        })
        setSesionCaducada('')
      })
      .catch(() => {
        if (cancelado) return
        // 401: apiFetch ya limpió el token y avisó con el evento. Aquí solo se
        // suelta el estado de React para que aparezca el login.
        setAccount(null)
        setUsuario(null)
      })
      .finally(() => {
        if (!cancelado) {
          setLoading(false)
          setRolListo(true)
        }
      })

    return () => {
      cancelado = true
    }
  }, [])

  // apiFetch avisa con este evento cuando el backend rechaza el token a
  // mitad de una operación. Se corta la sesión ahí mismo para que la pantalla
  // de login aparezca con el motivo, en vez de dejar al usuario en un módulo
  // medio cargado.
  useEffect(() => {
    const alCaducar = () => {
      setSesionCaducada('Tu sesión expiró. Vuelve a iniciar sesión para continuar.')
      cerrarSesionLocal()
      setAccount(null)
      setUsuario(null)
      setLoading(false)
    }
    window.addEventListener('ctp:sesion-caducada', alCaducar)
    return () => window.removeEventListener('ctp:sesion-caducada', alCaducar)
  }, [])

  const login = useCallback(async ({ correo, contrasena }) => {
    // Validación client-side: campos obligatorios
    if (!correo?.trim()) {
      const msg = 'Escribe tu usuario'
      setErrorLogin(msg)
      sileo.warning({ duration: 4000, sound: 'default', fill: '#071A3D', title: 'Campo obligatorio', description: msg })
      return
    }
    if (!contrasena) {
      const msg = 'Escribe tu contraseña'
      setErrorLogin(msg)
      sileo.warning({ duration: 4000, sound: 'default', fill: '#071A3D', title: 'Campo obligatorio', description: msg })
      return
    }

    setErrorLogin('')
    setLoginEnCurso(true)
    try {
      const datos = await llamarAuth('/api/auth/login', { correo, contrasena })
      setAccount(guardarSesion(datos))
      // El backend ya devuelve la fila del usuario en la respuesta del login, así
      // que el rol está disponible de inmediato: sin este set, la pantalla de
      // loading se quedaría esperando a una petición que ya se hizo.
      setUsuario(datos.usuario || null)
      setRolListo(true)
      setSesionCaducada('')
    } catch (error) {
      const mensaje = error.message
      setErrorLogin(mensaje)
      // Notificación tipo toast con sonido (como el resto de avisos del sistema).
      // `fill` obligatorio: sileo.error() trae fondo blanco por defecto.
      sileo.error({
        duration: 5000,
        sound: 'default',
        fill: '#071A3D',
        title: 'Error de acceso',
        description: mensaje,
      })
    } finally {
      setLoginEnCurso(false)
    }
  }, [])

  const registro = useCallback(async ({ nombre, correo, contrasena }) => {
    // Validación client-side: campos obligatorios
    if (!nombre?.trim()) {
      const msg = 'Escribe tu nombre completo'
      setErrorLogin(msg)
      sileo.warning({ duration: 4000, sound: 'default', fill: '#071A3D', title: 'Campo obligatorio', description: msg })
      return
    }
    if (!correo?.trim()) {
      const msg = 'Escribe tu usuario'
      setErrorLogin(msg)
      sileo.warning({ duration: 4000, sound: 'default', fill: '#071A3D', title: 'Campo obligatorio', description: msg })
      return
    }
    if (!contrasena) {
      const msg = 'Escribe tu contraseña'
      setErrorLogin(msg)
      sileo.warning({ duration: 4000, sound: 'default', fill: '#071A3D', title: 'Campo obligatorio', description: msg })
      return
    }

    setErrorLogin('')
    setLoginEnCurso(true)
    try {
      // El registro devuelve la sesión ya abierta, así que tras registrarse el
      // usuario entra directo: no tiene que volver a escribir su contraseña.
      const datos = await llamarAuth('/api/auth/registro', { nombre, correo, contrasena })
      setAccount(guardarSesion(datos))
      setUsuario(datos.usuario || null)
      setRolListo(true)
      setSesionCaducada('')
    } catch (error) {
      setErrorLogin(error.message)
      // Si es error de validación del backend (ej. correo duplicado), usamos warning
      const esValidacion = error.message?.includes('ya está registrado') || error.message?.includes('mínimo 8')
      sileo[esValidacion ? 'warning' : 'error']({
        duration: 5000,
        sound: 'default',
        fill: '#071A3D',
        title: esValidacion ? 'No se pudo registrar' : 'Error de registro',
        description: error.message,
      })
    } finally {
      setLoginEnCurso(false)
    }
  }, [])

  // A diferencia de login y registro, aquí NO se toca errorLogin: ese estado es
  // de la pantalla de entrada y esta llamada solo puede salir de dentro de la app,
  // con la sesión ya abierta. El error lo pinta el propio modal, así que se
  // propaga con throw en vez de guardarse.
  const cambiarClave = useCallback(async ({ contrasenaActual, contrasenaNueva }) => {
    await apiFetch('/api/auth/cambiar-clave', {
      method: 'POST',
      body: { contrasenaActual, contrasenaNueva },
    })
  }, [])

// `motivo` es opcional y explica en el login por qué se cortó la sesión (cierre
// por inactividad, token caducado). Se filtra a string a propósito: el botón del
// Header hace onClick={logout}, así que sin este chequeo el evento de React
// acabaría impreso en la pantalla de login.
const logout = useCallback((motivo = '') => {
  cerrarSesionLocal()
  setAccount(null)
  setUsuario(null)
  setRolListo(true)
  setErrorLogin('')
  setSesionCaducada(typeof motivo === 'string' ? motivo : '')
}, [])

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
    <AuthContext.Provider
      value={{
        account,
        loading,
        login,
        registro,
        cambiarClave,
        logout,
        usuario,
        rol,
        rolListo,
        errorLogin,
        loginEnCurso,
        sesionCaducada,
        // Borra los dos avisos a la vez. Antes solo quitaba el de sesión caducada,
        // así que escribir para corregir un login fallido no lo despejaba.
        limpiarAviso: () => {
          setErrorLogin('')
          setSesionCaducada('')
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
