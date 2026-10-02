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
// Cualquier gesto cuenta como «estamos trabajando» para saber cuándo pasó el rato
// de inactividad y toca avisar. PERO en cuanto el aviso está en pantalla deja de
// servir para cancelarlo: la única forma de seguir es el botón. Si no, bastaría con
// mover el mouse un poco y el contador desaparecería sin avisar de nada, que es
// justo lo contrario de lo que se busca.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { sincronizarPendientes } from '../store/solicitudesStore.js'

// Minutos sin actividad antes de que aparezca el aviso.
export const MINUTOS_INACTIVIDAD = 5

// Segundos que dura la cuenta atrás una vez que sale el aviso. Da margen para
// leer el mensaje y volver a tocar algo.
export const SEGUNDOS_AVISO = 60

const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000

// Cuánto se espera a que suban las solicitudes pendientes antes de cerrar sesión
// igual. El store no impone timeout, así que sin esto el contador podría quedarse
// en 00:00 indefinidamente.
const LIMITE_ESPERA_MS = 3000

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

  // Igual que alCerrar: los oyentes de abajo solo se rehacen cuando cambia `activo`,
  // así que necesitan leer si el aviso está abierto por su cuenta.
  const avisoRef = useRef(aviso)
  avisoRef.current = aviso

  const seguirTrabajando = useCallback(() => {
    ultimoUsoRef.current = Date.now()
    setAviso(false)
    setRestante(SEGUNDOS_AVISO)
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
      // Con el aviso en pantalla el gesto NO cancela nada. Solo se anota la hora
      // para que el reloj de inactividad siga siendo exacto.
      if (avisoRef.current) return
      // Los setEstado usan la forma funcional devolviendo el MISMO valor cuando no
      // hay nada que cambiar: React descarta el render solo, así que en uso normal
      // esto no cuesta nada aunque salten cientos de eventos por minuto.
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
    let limite

    // Antes de salir se intenta subir lo que quedara pendiente. Los datos del
    // navegador (ctp_solicitudes) NO se borran al cerrar sesión, así que una
    // solicitud creada sin conexión no se pierde: se sube al volver a entrar.
    //
    // El store no pone timeout a sus peticiones, así que si el servidor no
    // responde la promesa no se resuelve nunca y el contador se quedaría en 00:00
    // para siempre. Por eso se corta la espera: las peticiones que sigan vivas
    // terminan igual por su cuenta (y si fallan al perder el token, la solicitud
    // queda sin confirmar en localStorage y se sube al volver a entrar). Cerrar
    // sesión a los 3 s siempre es mejor que no cerrarla nunca.
    Promise.race([
      sincronizarPendientes().catch(() => {}),
      new Promise((resolver) => {
        limite = setTimeout(resolver, LIMITE_ESPERA_MS)
      }),
    ]).then(
      () => {
        if (cancelado) return
        cancelado = true
        clearTimeout(limite)
        alCerrarRef.current?.()
      },
      () => {}
    )

    return () => {
      cancelado = true
      clearTimeout(limite)
    }
  }, [aviso, restante])

  return { aviso, restante, seguirTrabajando }
}