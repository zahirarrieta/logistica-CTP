import { useEffect, useState } from 'react'
import {
  MdClose,
  MdHistory,
  MdChevronRight,
  MdArrowBack,
  MdCheckCircle,
  MdAssignmentInd,
  MdAddCircle,
  MdLocalShipping,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'

const TIPO_META = {
  estado: { label: 'Estado', icon: MdCheckCircle, clase: 'bg-brand-cyan/15 text-brand-deep ring-brand-cyan/30' },
  asignado: { label: 'Asignación', icon: MdAssignmentInd, clase: 'bg-purple-500/15 text-purple-700 ring-purple-500/30' },
  conductor: { label: 'Conductor', icon: MdLocalShipping, clase: 'bg-amber-500/15 text-amber-700 ring-amber-500/30' },
  creacion: { label: 'Creación', icon: MdAddCircle, clase: 'bg-green-500/15 text-green-700 ring-green-500/30' },
}

const RESUMEN = [
  { key: 'total', label: 'Acciones', clase: 'bg-brand-deep/10 text-brand-deep' },
  { key: 'estados', label: 'Estados', clase: 'bg-brand-cyan/15 text-brand-deep' },
  { key: 'asignaciones', label: 'Asignaciones', clase: 'bg-purple-500/15 text-purple-700' },
  { key: 'creaciones', label: 'Creadas', clase: 'bg-green-500/15 text-green-700' },
]

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase()
}

function textoAccion(a) {
  if (a.tipo === 'creacion') return 'Creó la solicitud'
  const flecha = a.anterior && a.nuevo ? `${a.anterior} → ${a.nuevo}` : a.nuevo || a.anterior || '—'
  if (a.tipo === 'estado') return `Estado: ${flecha}`
  if (a.tipo === 'conductor') return `Conductor: ${flecha}`
  return `Responsable: ${flecha}`
}

function ListaUsuarios({ items, onClick }) {
  if (items.length === 0) return <p className="py-10 text-center text-sm text-brand-ink/50">Sin usuarios</p>
  const max = Math.max(1, ...items.map((u) => u.total))
  return (
    <div className="space-y-1.5">
      {items.map((u) => (
        <button
          key={u.clave}
          type="button"
          onClick={() => onClick(u)}
          title={`Ver la actividad de ${u.nombre}`}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-brand-cyan/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        >
          <span className="grid place-items-center size-9 shrink-0 rounded-full bg-brand-deep/10 text-[11px] font-extrabold text-brand-deep">
            {iniciales(u.nombre)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-bold text-brand-deep">{u.nombre}</span>
              {u.rol ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-brand-ink/40">{u.rol}</span>
              ) : null}
            </span>
            <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
              <span className="h-full bg-brand-cyan" style={{ width: `${(u.estados / max) * 100}%` }} />
              <span className="h-full bg-purple-500" style={{ width: `${(u.asignaciones / max) * 100}%` }} />
              <span className="h-full bg-green-500" style={{ width: `${(u.creaciones / max) * 100}%` }} />
            </span>
          </span>
          <span className="hidden shrink-0 flex-col items-end text-[10px] font-bold leading-tight text-brand-ink/50 sm:flex">
            <span>{u.estados} estados · {u.asignaciones} asign.</span>
            <span>{u.creaciones} creadas</span>
          </span>
          <span className="w-10 shrink-0 text-right text-lg font-extrabold text-brand-ink tabular-nums">{u.total}</span>
          <MdChevronRight className="shrink-0 text-brand-deep/40" />
        </button>
      ))}
    </div>
  )
}

function DetalleUsuario({ usuario, onVerPedido }) {
  const acciones = usuario.acciones || []
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
        {RESUMEN.map((r) => (
          <div key={r.key} className={`rounded-xl px-3 py-2 ${r.clase}`}>
            <span className="block text-xl font-extrabold tabular-nums">{usuario[r.key]}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">{r.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto p-3 sm:p-4">
        {acciones.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-ink/50">
            Esta persona no ha registrado ninguna acción todavía.
          </p>
        ) : (
          <div className="space-y-1.5">
            {acciones.map((a, i) => {
              const meta = TIPO_META[a.tipo] || TIPO_META.estado
              const Icono = meta.icon
              return (
                <button
                  key={`${a.solicitud}-${a.tipo}-${a.fecha}-${a.hora}-${i}`}
                  type="button"
                  onClick={() => onVerPedido?.(a.solicitud)}
                  className="flex w-full items-center gap-3 rounded-xl bg-brand-mist/50 ring-1 ring-brand-ink/5 px-3 py-2.5 text-left text-sm hover:bg-brand-cyan/10 transition-colors"
                  title={`Ver detalle de ${a.solicitud}`}
                >
                  <span className="shrink-0 font-extrabold text-brand-deep">{a.solicitud}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${meta.clase}`}>
                    <Icono className="text-xs" />
                    <span className="hidden sm:inline">{meta.label}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                    {textoAccion(a)}
                    {a.nota ? <span className="text-brand-ink/40"> · {a.nota}</span> : null}
                  </span>
                  <span className="hidden md:inline-block shrink-0 text-[11px] font-bold text-brand-ink/40 tabular-nums">
                    {`${a.fecha || ''} ${a.hora || ''}`.trim()}
                  </span>
                  <MdChevronRight className="shrink-0 text-brand-deep/40" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// Modal de actividad por usuario. El superadmin ve la lista de administradores,
// superadmins y conductores (incluidos los que no han hecho nada) y puede entrar
// al detalle de cualquiera; un administrador o conductor solo ve su propia
// actividad. Cada acción abre el pedido correspondiente.
export default function ActividadUsuariosModal({
  usuarios = [],
  open,
  onClose,
  onVerPedido,
  puedeVerTodos = false,
  usuarioActual = null,
}) {
  const [seleccionado, setSeleccionado] = useState(null)

  useEffect(() => {
    if (open) setSeleccionado(null)
  }, [open])

  if (!open) return null

  const correoActual = String(usuarioActual?.correo || '').trim().toLowerCase()
  const mio = usuarios.find((u) => String(u.correo || '').toLowerCase() === correoActual)
  const miVacio = {
    clave: 'yo',
    correo: correoActual,
    nombre: usuarioActual?.nombre || 'Mi actividad',
    rol: usuarioActual?.rol || '',
    estados: 0,
    asignaciones: 0,
    creaciones: 0,
    total: 0,
    acciones: [],
  }
  const detalle = puedeVerTodos ? seleccionado : mio || miVacio
  const conVolver = puedeVerTodos && Boolean(seleccionado)

  const cerrar = () => {
    setSeleccionado(null)
    onClose?.()
  }

  return (
    <Modal onClose={cerrar}>
      <div
        className="relative bg-white text-brand-ink w-full max-w-2xl rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Actividad por usuario"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            {conVolver ? (
              <button
                type="button"
                aria-label="Volver"
                onClick={() => setSeleccionado(null)}
                className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <MdArrowBack className="text-lg" />
              </button>
            ) : (
              <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow shrink-0">
                <MdHistory className="text-brand-cyan text-lg" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate">
                {detalle ? detalle.nombre : 'Actividad por usuario'}
                {detalle?.rol ? <span className="text-white/60 font-bold"> · {detalle.rol}</span> : null}
              </span>
              <span className="block text-[11px] font-bold text-white/70 -mt-0.5">
                {detalle
                  ? `${detalle.total} ${detalle.total === 1 ? 'acción' : 'acciones'}`
                  : `${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'}`}
              </span>
            </span>
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {detalle ? (
          <DetalleUsuario usuario={detalle} onVerPedido={onVerPedido} />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
              {[
                ['Estados', 'bg-brand-cyan'],
                ['Asignaciones', 'bg-purple-500'],
                ['Creadas', 'bg-green-500'],
              ].map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-ink/50">
                  <span className={`size-2 rounded-full ${color}`} /> {label}
                </span>
              ))}
            </div>
            <div className="overflow-y-auto p-3 sm:p-4">
              <ListaUsuarios items={usuarios} onClick={setSeleccionado} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
