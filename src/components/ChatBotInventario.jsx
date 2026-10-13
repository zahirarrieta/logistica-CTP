import { useEffect, useRef, useState } from 'react'
import { MdClose, MdSend, MdKeyboardArrowDown } from 'react-icons/md'
import { preguntarInventario } from '../services/chatbotApi.js'
import { createPortal } from 'react-dom'

// Ruta del muñeco asignado al chatbot: la usan el botón flotante, el encabezado
// del panel, el estado vacío y el avatar de las respuestas del bot.
export const RUTA_MUNECO_CHATBOT = '/components/ChatBotI/CHATBOT.png'

const PREGUNTAS_EJEMPLO = [
  '¿Cuántas unidades hay en total?',
  '¿Cuántas unidades hay en Cota?',
  '¿Cuántos artículos hay en zona Bogotá?',
  'Muéstrame los artículos de BMX',
  '¿Qué hay del proveedor CTP?',
  '¿Cuál es el promedio de unidades por artículo?',
]

export default function ChatBotInventario({ open, onClose }) {
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mostrarEjemplos, setMostrarEjemplos] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  // Esc también cierra el panel, igual que hacer clic por fuera.
  useEffect(() => {
    if (!open) return undefined
    const alTeclear = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [open, onClose])

  async function enviar() {
    const texto = input.trim()
    if (!texto || cargando) return

    setInput('')
    setCargando(true)
    setError('')
    setMostrarEjemplos(false)

    const mensajeUsuario = { tipo: 'usuario', texto, fecha: new Date() }
    setMensajes(prev => [...prev, mensajeUsuario])

    try {
      const data = await preguntarInventario(texto)
      const mensajeBot = {
        tipo: 'bot',
        texto: data?.respuesta || 'No pude obtener una respuesta.',
        datos: data?.datos || [],
        analisis: data?.analisis,
        resumen: data?.resumen,
        fecha: new Date()
      }
      setMensajes(prev => [...prev, mensajeBot])
    } catch (e) {
      setError(e.message || 'Error al consultar el inventario')
      setMensajes(prev => [...prev, { tipo: 'bot', texto: '❌ Error al consultar el inventario. Intenta de nuevo.', fecha: new Date() }])
    } finally {
      setCargando(false)
    }
  }

  function usarEjemplo(ejemplo) {
    setInput(ejemplo)
    inputRef.current?.focus()
  }

  function formatearHora(fecha) {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] pointer-events-none"
      role="dialog"
      aria-label="ChatBot Inventario"
    >
      {/* Zona de clic transparente: cierra el panel al pulsar por fuera. No
          oscurece ni desenfoca nada, el resto de la app sigue viéndose igual.
          Necesita pointer-events-auto porque el contenedor los desactiva. */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel flotante, arriba del botón */}
      <div
        className="absolute w-[min(92vw,26rem)] h-[min(72vh,34rem)] bg-white shadow-[0_18px_50px_rgba(7,26,61,0.35)] animate-slideInRight flex flex-col pointer-events-auto rounded-2xl ring-1 ring-brand-ink/15 overflow-hidden"
        style={{
          right: 'calc(env(safe-area-inset-right, 0px) + clamp(0.5rem, 3vw, 1.5rem))',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + clamp(4.75rem, 10vw, 6.25rem))'
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center size-9 rounded-full bg-white ring-2 ring-brand-cyan/60 overflow-hidden shrink-0">
              <img src={RUTA_MUNECO_CHATBOT} alt="" className="size-7 object-contain" />
            </span>
            <div className="min-w-0">
              <h3 className="text-white font-extrabold text-sm leading-tight truncate">ChatBot Inventario</h3>
              <p className="text-brand-cyan/80 text-[11px] font-medium leading-tight truncate">Asistente de inventario CTP</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
          {mensajes.length === 0 && !cargando && (
            <div className="flex flex-col items-center justify-center gap-4 h-full min-h-[200px] text-center">
              <span className="grid place-items-center size-20 rounded-full bg-brand-mist ring-1 ring-brand-cyan/25 overflow-hidden">
                <img src={RUTA_MUNECO_CHATBOT} alt="" className="size-14 object-contain" />
              </span>
              <p className="text-brand-ink/60 font-medium">Pregúntame sobre el inventario</p>
              <p className="text-sm text-brand-ink/40 max-w-xs">Ejemplos: "¿Cuántas unidades en Cota?", "Artículos de marketing", "Total en bodega Principal"</p>
            </div>
          )}

          {mensajes.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.tipo === 'usuario' ? 'flex-row-reverse' : ''}`}>
              <div className={`grid place-items-center size-8 rounded-full shrink-0 overflow-hidden ${msg.tipo === 'usuario' ? 'bg-brand-cyan' : 'bg-white ring-1 ring-brand-ink/15'}`}>
                {msg.tipo === 'usuario' ? (
                  <span className="text-brand-ink text-xs font-extrabold">Tú</span>
                ) : (
                  <img src={RUTA_MUNECO_CHATBOT} alt="" className="size-6 object-contain" />
                )}
              </div>
              <div className={`max-w-[75%] ${msg.tipo === 'usuario' ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-2xl px-4 py-2.5 ${msg.tipo === 'usuario' ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-mist text-brand-ink'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.texto}</p>
                  {msg.datos && msg.datos.length > 0 && msg.tipo === 'bot' && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-bold text-brand-deep/70 hover:text-brand-cyan inline-flex items-center gap-1">
                        <MdKeyboardArrowDown className="text-xs" />
                        Ver detalles ({msg.datos.length})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {msg.datos.map((d, idx) => (
                          <div key={idx} className="text-xs text-brand-ink/70 bg-white/50 rounded p-1.5 border border-brand-ink/10">
                            {d.numero_articulo}: {d.descripcion} — {Number(d.cantidad || 0).toLocaleString('es-CO')} unds ({d.bodega}{d.nombre_bodega ? ` / ${d.nombre_bodega}` : ''}{d.zona ? ` / ${d.zona}` : ''})
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {msg.resumen && msg.tipo === 'bot' && (
                    <p className="mt-1 text-[10px] font-medium text-brand-ink/50">
                      Registros: {msg.resumen.registros} · Total unds: {Number(msg.resumen.total || 0).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
                <p className={`text-[10px] mt-1 ${msg.tipo === 'usuario' ? 'text-brand-cyan/70' : 'text-brand-ink/40'}`}>{formatearHora(msg.fecha)}</p>
              </div>
            </div>
          ))}

          {cargando && (
            <div className="flex gap-3">
              <div className="grid place-items-center size-8 rounded-full bg-white ring-1 ring-brand-ink/15 shrink-0 overflow-hidden animate-pulse">
                <img src={RUTA_MUNECO_CHATBOT} alt="" className="size-6 object-contain" />
              </div>
              <div className="inline-block rounded-2xl bg-brand-mist px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-brand-cyan/50 animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-2 h-2 rounded-full bg-brand-cyan/50 animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-2 h-2 rounded-full bg-brand-cyan/50 animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preguntas de ejemplo */}
        {mostrarEjemplos && mensajes.length === 0 && (
          <div className="px-4 pt-3 pb-3 border-t border-brand-ink/10 shrink-0">
            <p className="text-xs font-bold text-brand-deep/60 uppercase tracking-wider mb-2">Preguntas frecuentes</p>
            <div className="flex flex-wrap gap-2">
              {PREGUNTAS_EJEMPLO.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => usarEjemplo(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-brand-cyan/10 text-brand-deep ring-1 ring-brand-cyan/30 hover:bg-brand-cyan/20 hover:ring-brand-cyan/50 transition-all text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-brand-ink/10 px-4 py-3 bg-white">
          {error && (
            <p className="text-xs font-medium text-red-600 mb-2" role="alert">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
              placeholder="Pregunta sobre el inventario..."
              disabled={cargando}
              className="flex-1 px-3 py-2.5 rounded-xl border border-brand-ink/15 bg-white focus:outline-none focus:border-brand-cyan/70 focus:ring-2 focus:ring-brand-cyan/25 text-sm text-brand-ink placeholder:text-brand-ink/40 disabled:opacity-50"
              aria-label="Pregunta sobre inventario"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={cargando || !input.trim()}
              className="grid place-items-center size-10 rounded-xl bg-brand-cyan text-brand-ink font-extrabold shadow-cyanGlow hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar pregunta"
            >
              <MdSend className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}