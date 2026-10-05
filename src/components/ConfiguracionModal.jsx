// ============================================================================
// CONFIGURACIÓN MODAL
//
// Modal de preferencias del usuario: notificaciones push. Se abre desde el
// Header y se renderiza en un portal sobre body para quedar por encima de todo.
// ============================================================================

import { useEffect, useState } from 'react'
import {
  MdArrowBack,
  MdNotificationsActive,
  MdNotificationsOff,
  MdSend,
  MdPhoneAndroid,
  MdDesktopWindows,
  MdCheckCircle,
  MdErrorOutline,
  MdInfoOutline,
  MdClose,
} from 'react-icons/md'
import { useAuth } from '../auth/AuthContext.jsx'
import { shortName } from '../auth/user.js'
import {
  estado as leerEstado,
  activar,
  desactivarEnEsteEquipo,
  enviarPrueba,
} from '../services/push.js'

// Cómo se ve cada estado. `interruptor` decide si el interruptor se puede tocar:
// en 'sin-claves' o 'no-soportado' tocarlo no haría nada, y un interruptor que
// no responde es peor que uno que explica por qué.
const ESTADOS = {
  activas: {
    titulo: 'Notificaciones activas',
    texto: 'Recibirás avisos aunque no tengas la app abierta.',
    tono: 'ok',
    interruptor: true,
    encendido: true,
  },
  'sin-registrar': {
    titulo: 'Notificaciones desactivadas',
    texto: 'Actívalas para enterarte de las solicitudes aunque no tengas la app abierta.',
    tono: 'neutro',
    interruptor: true,
    encendido: false,
  },
  'sin-permiso': {
    titulo: 'No se concedió el permiso',
    texto: 'El navegador no dio permiso para mostrar notificaciones. Actívalo de nuevo e inténtalo otra vez.',
    tono: 'aviso',
    interruptor: true,
    encendido: false,
  },
  denegadas: {
    titulo: 'Bloqueadas en el navegador',
    texto: 'Has bloqueado las notificaciones para este sitio. Para volver a activarlas tienes que cambiarlo en los ajustes del navegador.',
    tono: 'error',
    interruptor: false,
    encendido: false,
  },
  'requiere-instalar': {
    titulo: 'Falta instalarla en iPhone',
    texto: 'En iPhone, las notificaciones solo funcionan con la app instalada: abre el menú Compartir, elige «Añadir a pantalla de inicio» y entra desde el icono.',
    tono: 'aviso',
    interruptor: false,
    encendido: false,
  },
  'sin-claves': {
    titulo: 'El servidor no tiene claves push',
    texto: 'Mientras se configuren, los avisos solo llegarán con la app abierta. No es un fallo de este equipo.',
    tono: 'aviso',
    interruptor: false,
    encendido: false,
  },
  'sin-servidor': {
    titulo: 'No se pudo contactar al servidor',
    texto: 'Revisa la conexión y vuelve a entrar.',
    tono: 'error',
    interruptor: true,
    encendido: false,
  },
  'sin-sw': {
    titulo: 'El service worker no está listo',
    texto: 'Recarga la página e inténtalo de nuevo.',
    tono: 'aviso',
    interruptor: true,
    encendido: false,
  },
  'no-soportado': {
    titulo: 'Este navegador no las admite',
    texto: 'Chrome, Edge, Firefox y Safari (instalada) sí las admiten.',
    tono: 'aviso',
    interruptor: false,
    encendido: false,
  },
  error: {
    titulo: 'No se pudieron activar',
    texto: 'Prueba de nuevo. Si sigue igual, mira el registro de la API.',
    tono: 'error',
    interruptor: true,
    encendido: false,
  },
}

const TONES = {
  ok: {
    caja: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    Icon: MdCheckCircle,
  },
  neutro: {
    caja: 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan',
    Icon: MdNotificationsOff,
  },
  aviso: {
    caja: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    Icon: MdInfoOutline,
  },
  error: {
    caja: 'border-red-400/30 bg-red-400/10 text-red-200',
    Icon: MdErrorOutline,
  },
}

export default function ConfiguracionModal({ onClose }) {
  const { account, usuario, rol } = useAuth()
  const [estado, setEstado] = useState({ estado: 'sin-registrar', cargando: true })
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const resultado = await leerEstado()
        if (vivo) setEstado(resultado)
      } catch (error) {
        if (vivo) setEstado({ estado: 'sin-servidor', detalle: error?.message || '' })
      }
    })()
    return () => { vivo = false }
  }, [])

  const info = ESTADOS[estado.estado] || ESTADOS['sin-registrar']
  const tono = TONES[info.tono] || TONES.neutro
  const IconoTono = tono.Icon

  const conInterruptor = async () => {
    if (trabajando) return
    setTrabajando(true)
    setMensaje('')
    try {
      const resultado = info.encendido
        ? await desactivarEnEsteEquipo()
        : await activar()
      setEstado({ ...resultado, cargando: false })
      if (resultado.ok) setMensaje(resultado.detalle || '')
      else if (!info.encendido) setMensaje('')
    } catch (error) {
      setEstado({ estado: 'error', detalle: error?.message || '' })
    } finally {
      setTrabajando(false)
    }
  }

  const probar = async () => {
    if (trabajando) return
    setTrabajando(true)
    setMensaje('')
    try {
      const resultado = await enviarPrueba()
      const equipos = resultado?.destinatarios || 0
      setMensaje(
        equipos === 0
          ? 'No hay ningún equipo suscrito con esta cuenta. Activa las notificaciones primero.'
          : `Aviso enviado a ${equipos} equipo(s). Debería llegar en unos segundos.`,
      )
    } catch (error) {
      setMensaje(error?.message || 'No se pudo enviar la prueba.')
    } finally {
      setTrabajando(false)
    }
  }

  const nombreUsuario = usuario?.nombre || account?.name || ''

  // Prevenir scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="config-titulo">
      <div className="fixed inset-0 bg-black/60 animate-fadeIn" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-brand-ink ring-1 ring-brand-cyan/25 shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-scaleIn">
        {/* Header del modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-cyan/20">
          <h2 id="config-titulo" className="font-display text-xl font-black">Configuración</h2>
          <button
            type="button"
            onClick={onClose}
            className="size-8 shrink-0 flex items-center justify-center rounded-full text-brand-mist hover:bg-brand-navy hover:text-brand-cyan transition-colors"
            aria-label="Cerrar configuración"
          >
            <MdClose className="size-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-brand-mist/60">{shortName({ name: nombreUsuario }) || 'Tu cuenta'}</span>
            {rol && <span className="text-brand-cyan font-bold uppercase">{String(rol).toUpperCase()}</span>}
          </div>

          {/* Push section */}
          <section className="rounded-2xl border border-brand-cyan/15 bg-white/[0.03] backdrop-blur-md p-5">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-cyan/10 ring-1 ring-brand-cyan/30">
                <MdNotificationsActive className="size-6 text-brand-cyan" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold">Avisos aunque la app esté cerrada</h3>
                <p className="mt-1 text-sm text-brand-mist/80">
                  Recibe en el teléfono o en el ordenador los cambios de tus
                  solicitudes, aunque no tengas la app abierta. Funciona con la
                  pantalla bloqueada.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={Boolean(info.encendido)}
                aria-label="Notificaciones con la app cerrada"
                disabled={trabajando || !info.interruptor || estado.cargando}
                onClick={conInterruptor}
                className={[
                  'relative shrink-0 h-7 w-12 rounded-full transition-colors',
                  info.encendido ? 'bg-brand-cyan' : 'bg-brand-mist/25',
                  (trabajando || !info.interruptor || estado.cargando) ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-1 size-5 rounded-full bg-white transition-all',
                    info.encendido ? 'left-6' : 'left-1',
                  ].join(' ')}
                />
              </button>
            </div>

            <div className={`mt-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${tono.caja}`}>
              <IconoTono className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold">{info.titulo}</p>
                <p className="mt-0.5 text-xs opacity-90">
                  {estado.detalle || info.texto}
                </p>
              </div>
            </div>

            {mensaje && (
              <p className="mt-3 flex items-start gap-2 text-xs text-brand-mist/85">
                <MdInfoOutline className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" />
                {mensaje}
              </p>
            )}

            {info.encendido && (
              <button
                type="button"
                onClick={probar}
                disabled={trabajando}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-cyan px-5 py-2.5 text-sm font-extrabold text-brand-ink shadow-cyanGlow transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdSend />
                Enviar un aviso de prueba
              </button>
            )}

            <p className="mt-5 flex items-start gap-2 text-xs text-brand-mist/60">
              <MdPhoneAndroid className="mt-0.5 size-3.5 shrink-0" />
              <span>
                En el <strong className="text-brand-mist">iPhone</strong> esto necesita la app
                instalada: menú Compartir  &gt;  «Añadir a pantalla de inicio», y entrar desde el
                icono. En Windows, Mac y Android funciona sin instalar nada.
              </span>
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs text-brand-mist/60">
              <MdDesktopWindows className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Se activa <strong className="text-brand-mist">por equipo</strong>. Si lo enciendes en
                el móvil y en el portátil, recibirás los avisos en los dos, y apagar en uno no
                afecta al otro.
              </span>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}