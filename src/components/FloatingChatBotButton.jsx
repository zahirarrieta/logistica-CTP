import { useState } from 'react'
import { MdClose } from 'react-icons/md'
import ChatBotInventario, { RUTA_MUNECO_CHATBOT } from './ChatBotInventario.jsx'

export default function FloatingChatBotButton() {
  const [chatbotOpen, setChatbotOpen] = useState(false)

  return (
    <>
      <ChatBotInventario open={chatbotOpen} onClose={() => setChatbotOpen(false)} />

      {/* Botón flotante: con el panel cerrado muestra el muñeco sobre blanco y con
          el panel abierto muestra la X, para que sirva de interruptor. Va por
          encima de la zona de clic del portal (z-1000) para seguir siendo usable. */}
      <button
        type="button"
        onClick={() => setChatbotOpen(v => !v)}
        aria-label={chatbotOpen ? 'Cerrar ChatBot Inventario' : 'Abrir ChatBot Inventario'}
        aria-expanded={chatbotOpen}
        title={chatbotOpen ? 'Cerrar ChatBot Inventario' : 'ChatBot Inventario'}
        className={`grid place-items-center rounded-full pointer-events-auto transition-all duration-300 w-[clamp(2.75rem,6vw,3.5rem)] h-[clamp(2.75rem,6vw,3.5rem)] ${
          chatbotOpen
            ? 'bg-brand-navy text-white ring-4 ring-brand-navy/20 shadow-[0_12px_28px_rgba(7,26,61,0.45)] rotate-90'
            : 'bg-white ring-2 ring-brand-cyan/70 shadow-[0_12px_28px_rgba(7,26,61,0.35),0_0_18px_rgba(0,229,255,0.35)] hover:scale-110 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(7,26,61,0.45),0_0_26px_rgba(0,229,255,0.55)]'
        }`}
        style={{
          position: 'fixed',
          right: 'calc(env(safe-area-inset-right, 0px) + clamp(0.5rem, 3vw, 1.5rem))',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + clamp(0.5rem, 3vw, 1.5rem))',
          left: 'auto',
          top: 'auto',
          zIndex: 1001
        }}
      >
        {chatbotOpen ? (
          <MdClose className="text-2xl" />
        ) : (
          <>
            {/* Halo pulsante detrás del muñeco para llamar la atención. */}
            <span className="absolute inset-0 rounded-full bg-brand-cyan opacity-40 animate-ping" />
            <img
              src={RUTA_MUNECO_CHATBOT}
              alt=""
              className="relative w-[80%] h-[80%] object-contain drop-shadow-[0_2px_4px_rgba(7,26,61,0.35)]"
            />
          </>
        )}
      </button>
    </>
  )
}
