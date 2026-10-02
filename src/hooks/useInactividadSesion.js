// ============================================================================
// CIERRE DE SESIÓN POR INACTIVIDAD
// Si el usuario pasa cinco minutos sin trabajar, aparece una cuenta atrás y la
// sesión se cierra al llegar a cero. El aviso va con contador para que no lo
// agarre desprevenido.
//
// OJO, esto NO cambia la caducidad del token. El JWT sigue siendo absoluto desde
// el login (SESSION_TTL, 8 horas por defecto); esto es una segunda barrera,
// únicamente en el navegador. El backend no participa: cerrar sesión aquí es
// olvidar el token en localStorage.
//
// Cualquier gesto durante el aviso cuenta como «sigo aquí»: se cierra el modal y
// el contador vuelve a empezar. Por eso hace falta un botón explícito, pero
// tocar la pantalla ya basta.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { sincronizarPendientes } from '../store/solicitudesStore.js'

// Minutos sin actividad antes de que aparezca el aviso.
export const MINUTOS_INACTIVIDAD = 5

// Segundos que dura la cuenta atrás una vez que sale el aviso. Da margen para
// leer el mensaje y volver a tocar algo.
export const SEGUNDOS_AVISO = 60

const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000

// Gestos que cuentan como «estamos trabajando». `pointermove` está porque es lo
// más habitual de quien está leyendo una tabla, pero se limita a uno por segundo:
// si no, mover el mouse ratón mantienen la sesión abierta sin que nadie esté
// haciendo nada, que es justo lo contrario de lo que se busca.
const EVENTOS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'pointermove']
const INTERVALO_PUNTERO_MS = 1000

export default function useInactividadSesion({ activo, alCerrar }) {
  const [aviso, setAviso] = useState(false)
  const [restante, setRestante] = useState(SEGUNDOS_AVISO)
  const ultimoUsoRef = useRef(Date.now())

  // alCerrar suele ser una función nueva en cada render (va definida en App.jsx).
  // Se guarda en un ref para no reconstruir los oyentes en cada render.
  const alCerrarRef = useRef(alCerrar)
  alCerrarRef.current = alCerrar

  const seguirTrabajando = useCallback(() => {
    ultimoUsoRef.current = Date.now()
    setAviso((abierto) => (abierto ? false : abierto))
    setRestante((s) => (s === SEGUNDOS_AVISO ? s : SEGUNDOS_AVISO))
  }, [])

  // Marca de tiempo. No lleva estado: si no, cada pulsación y cada movimiento de
  // mouse provocarían un render de toda la app.
  useEffect(() => {
    if (!activo) {
      setAviso(false)
      return undefined
    }
    ultimoUsoRef.current = Date.now()
    let ultimoPuntero = 0

    const registrar = (e) => {
      if (e?.type === 'pointermove') {
        const ahora = Date.now()
        if (ahora - ultimoPuntero < INTERVALO_PUNTERO_MS) return
        ultimoPuntero = ahora
      }
      ultimoUsoRef.current = Date.now()
      // Los setEstado usan la forma funcional devolviendo el MISMO valor cuando no
      // hay nada que cambiar: React descarta el render solo, así que en uso normal
      // esto no cuesta nada aunque salten cientos de eventos por minuto.
      setAviso((abierto) => (abierto ? false : abierto))
      setRestante((s) => (s === SEGUNDOS_AVISO ? s : SEGUNDOS_AVISO))
    }

    EVENTOS.forEach((ev) => window.addEventListener(ev, registrar, { passive: true }))
    return () => EVENTOS.forEach((ev) => window.removeEventListener(ev, registrar))
  }, [activo])

  // Un solo reloj de un segundo hace todo: mira cuándo se cumplirán los minutos
  // y, si el aviso ya está abierto, baja el contador. Un temporizador en vez de
  // dos evita tener que coordinarlos.
  useEffect(() => {
    if (!activo) return undefined
    const id = setInterval(() => {
      if (!aviso && Date.now() - ultimoUsoRef.current >= MS_INACTIVIDAD) {
        setAviso(true)
        setRestante(SEGUNDOS_AVISO)
        return
      }
      if (aviso) setRestante((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [activo, aviso])

  // Al llegar a cero se cierra la sesión.
  useEffect(() => {
    if (!aviso || restante > 0) return undefined
    let cancelado = false
    // Antes de salir se intenta subir lo que quedara pendiente. Los datos del
    // navegador (ctp_solicitudes) NO se borran al cerrar sesión, así que una
    // solicitud creada sin conexión no se pierde: se sube al volver a entrar. El
    // intento solo evita que se quede esperando.
    void sincronizarPendientes()
      .catch(() => {})
      .finally(() => {
        if (!cancelado) alCerrarRef.current?.()
      })
    return () => {
      cancelado = true
    }
  }, [aviso, restante])

  return { aviso, restante, seguirTrabajando }
}