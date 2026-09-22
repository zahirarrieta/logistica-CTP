import { useEffect, useState } from 'react'
import { MdClose, MdCheckCircle, MdAssignmentInd, MdTag, MdPersonAdd, MdCheck } from 'react-icons/md'
import { nombreDeAsignado } from '../../../Home/Components/solicitudesStore.js'
import useUsuarios from '../../../../hooks/useUsuarios.js'
import { esConductorUsuario } from '../../../../auth/roles.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AsignarUsuarioModal({ solicitud, open, onClose, onUpdate }) {
  const asignadoA = nombreDeAsignado(solicitud?.asignadoA)
  const asignadoCorreoActual = String(solicitud?.asignadoCorreo || '').trim().toLowerCase()
  const [seleccion, setSeleccion] = useState('')
  const { usuarios, cargando, error, recargar } = useUsuarios(open)

  useEffect(() => {
    if (open) setSeleccion(asignadoCorreoActual)
  }, [open, asignadoCorreoActual])

  if (!open || !solicitud) return null

  const enTransito = ESTADOS_TRANSITO.includes(solicitud.estado)
  const asignados = usuarios.filter((u) => u.rol === 'administrador' || u.rol === 'superadmin')
  const conductores = usuarios.filter(esConductorUsuario)
  const lista = enTransito ? conductores : asignados

  const correoDe = (u) => String(u.correo || '').trim().toLowerCase()
  // Un usuario es el asignado actual si coincide su correo, o (registros antiguos
  // sin correo) si coincide su nombre.
  const esActual = (u) =>
    asignadoCorreoActual
      ? correoDe(u) === asignadoCorreoActual
      : Boolean(asignadoA) && u.nombre === asignadoA
  const isSeleccion = (u) => correoDe(u) === seleccion

  const handleSelect = (u) => {
    const correo = correoDe(u)
    if (!correo || correo === asignadoCorreoActual) return
    setSeleccion(correo)
  }

  const handleSave = () => {
    const elegido = lista.find((u) => correoDe(u) === seleccion)
    if (!elegido || esActual(elegido)) return
    onUpdate(solicitud.id, {
      asignadoA: elegido.nombre,
      asignadoCorreo: elegido.correo || '',
    })
    onClose()
  }

  const guardado = Boolean(seleccion) && seleccion !== asignadoCorreoActual

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Asignar usuario"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdAssignmentInd className="text-brand-cyan text-lg" />
            </span>
            ASIGNAR USUARIO
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
              <MdTag className="text-xs sm:text-sm" />
              {solicitud.id}
            </span>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Lista de usuarios */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <p className="text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-3">
            {enTransito ? 'Selecciona el conductor' : 'Selecciona el usuario a asignar'}
          </p>
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-brand-deep/60">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
              <p className="text-sm font-semibold">Cargando usuarios…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                type="button"
                onClick={recargar}
                className="mt-2 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition"
              >
                Reintentar
              </button>
            </div>
          ) : lista.length === 0 ? (
            <p className="text-center text-brand-ink/50 py-8">
              No hay {enTransito ? 'conductores' : 'usuarios'} disponibles
            </p>
          ) : (
            <div className="space-y-1.5">
              {lista.map((u) => {
                const n = u.nombre
                const actual = esActual(u)
                const sel = isSeleccion(u)
                return (
                  <button
                    key={correoDe(u) || n}
                    type="button"
                    onClick={() => handleSelect(u)}
                    disabled={actual}
                    title={actual ? 'Esta persona ya está asignada' : `Asignar a ${n}`}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-deep transition-all ${
                      actual
                        ? 'bg-brand-cyan/15 ring-1 ring-brand-cyan/50 cursor-not-allowed'
                        : sel
                          ? 'bg-brand-cyan/20 ring-2 ring-brand-cyan/60'
                          : 'bg-brand-mist/40 hover:bg-brand-cyan/15 hover:ring-1 hover:ring-brand-cyan/40'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <span className="grid place-items-center size-8 shrink-0 rounded-full bg-brand-deep text-white text-xs font-extrabold">
                        {initials(n)}
                      </span>
                      <span className="grid min-w-0 text-left">
                        <span className="truncate">{n}</span>
                        {u.correo && (
                          <span className="truncate text-[11px] font-medium normal-case text-brand-ink/50">{u.correo}</span>
                        )}
                      </span>
                    </span>
                    {actual ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-deep">
                        <MdCheck className="text-brand-cyan" /> Asignado
                      </span>
                    ) : (
                      <MdPersonAdd className="text-brand-cyan/60 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0 flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!guardado}
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span className="grid place-items-center size-6 rounded-full bg-brand-deep/10 text-brand-deep">
              <MdCheckCircle className="text-base" />
            </span>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}