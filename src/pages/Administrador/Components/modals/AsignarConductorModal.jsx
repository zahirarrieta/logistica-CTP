import { useEffect, useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdClose, MdCheckCircle, MdTag, MdCheck, MdLocalShipping, MdEdit, MdTwoWheeler, MdDirectionsCar, MdNumbers, MdDirectionsBus, MdLock } from 'react-icons/md'
import { nombreDeAsignado } from '../../../Home/Components/solicitudesStore.js'
import useUsuarios from '../../../../hooks/useUsuarios.js'
import { esConductorUsuario } from '../../../../auth/roles.js'

const OPCION_OTRO = 'Otro'

const EXTRAS_CONDUCTOR = ['Elite']

const VEHICULOS = ['Moto', 'Carro', 'Camioneta']

const VEHICULO_ICONOS = {
  Moto: <MdTwoWheeler />,
  Carro: <MdDirectionsCar />,
  Camioneta: <MdDirectionsBus />,
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AsignarConductorModal({ solicitud, open, onClose, onUpdate }) {
  const conductor = nombreDeAsignado(solicitud?.conductor)
  const [seleccion, setSeleccion] = useState('')
  const [otroNombre, setOtroNombre] = useState('')
  const [vehiculo, setVehiculo] = useState('')
  const [placa, setPlaca] = useState('')
  const { usuarios, cargando, error, recargar } = useUsuarios(open)

  useEffect(() => {
    if (open) {
      setSeleccion(conductor)
      setVehiculo(conductor === 'Elite' ? 'Camioneta' : solicitud?.vehiculo || '')
      setPlaca(solicitud?.placa || '')
    }
  }, [open, conductor, solicitud])

  if (!open || !solicitud) return null

  const conductores = [
    ...usuarios
      .filter(esConductorUsuario)
      .map((u) => ({
        nombre: u.nombre,
        correo: u.correo,
        vehiculo: u.vehiculo || '',
        placa: u.placa || '',
      })),
    ...EXTRAS_CONDUCTOR.map((nombre) => ({ nombre, correo: '', vehiculo: 'Camioneta', placa: '' })),
    { nombre: OPCION_OTRO, correo: '', vehiculo: '', placa: '' },
  ]

  const isConductorActualmente = (n) => n === conductor
  const isSeleccion = (n) => n === seleccion
  const enTransitoParcial = solicitud.estado === 'En Tránsito Parcial'
  const enTransito = solicitud.estado === 'En Tránsito'
  const nombreColor = enTransitoParcial ? 'bg-amber-500 text-amber-950' : enTransito ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
  const iconoColor = enTransitoParcial ? 'text-amber-500' : enTransito ? 'text-purple-500' : 'text-indigo-400'
  const esOtro = seleccion === OPCION_OTRO
  const esElite = seleccion === 'Elite'
  const nombreFinal = esOtro && otroNombre.trim() ? otroNombre.trim() : seleccion

  // Si el conductor seleccionado ya tiene vehículo y placa registrados, esos
  // datos son la fuente de verdad: se bloquean los campos para no sobrescribirlos.
  const seleccionado = conductores.find((c) => c.nombre === seleccion)
  const vehiculoConocido = Boolean(seleccionado?.vehiculo && seleccionado?.placa)
  const vehiculoEfectivo = vehiculoConocido ? seleccionado.vehiculo : vehiculo
  const placaEfectiva = vehiculoConocido ? seleccionado.placa : placa

  const puedeGuardar =
    !!seleccion &&
    !(esOtro && !otroNombre.trim()) &&
    VEHICULOS.includes(vehiculoEfectivo) &&
    placaEfectiva.trim().length > 0

  // Al seleccionar un conductor conocido ya traemos su vehículo y placa, así la
  // información queda guardada automáticamente sin tener que digitarla.
  const handleSelect = (u) => {
    const n = u.nombre
    setSeleccion(n)
    if (n !== OPCION_OTRO) setOtroNombre('')
    if (n === OPCION_OTRO) {
      setVehiculo('')
      setPlaca('')
      return
    }
    if (n === 'Elite') {
      setVehiculo('Camioneta')
      setPlaca(u.placa || '')
      return
    }
    if (u.vehiculo) setVehiculo(u.vehiculo)
    if (u.placa) setPlaca(u.placa)
  }

  const handleSave = () => {
    if (!puedeGuardar) return
    onUpdate(solicitud.id, { conductor: nombreFinal, vehiculo: vehiculoEfectivo, placa: placaEfectiva.trim().toUpperCase() })
    onClose()
  }

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
        aria-label="Asignar conductor"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <RiSteering2Line className="text-brand-cyan text-lg" />
            </span>
            ASIGNAR CONDUCTOR
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

        {/* Lista de conductores */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <p className="text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-3">
            Selecciona el conductor para la entrega
          </p>
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-brand-deep/60">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
              <p className="text-sm font-semibold">Cargando conductores…</p>
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
          ) : (
            <div className="space-y-1.5">
              {conductores.map((u) => {
                const n = u.nombre
                const actual = isConductorActualmente(n)
                const sel = isSeleccion(n)
                const esOtro = n === OPCION_OTRO
                return (
                  <div key={u.correo || n}>
                    <button
                      type="button"
                      onClick={() => handleSelect(u)}
                      title={sel ? 'Conductor seleccionado' : `Asignar a ${n}`}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-deep transition-all ${
                        sel
                          ? 'bg-indigo-100 ring-2 ring-indigo-400/60'
                          : 'bg-brand-mist/40 hover:bg-indigo-100/70 hover:ring-1 hover:ring-indigo-400/40'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5 min-w-0">
                        <span className={`grid place-items-center size-8 shrink-0 rounded-full ${nombreColor} text-xs font-extrabold`}>
                          {esOtro ? <MdEdit /> : initials(n)}
                        </span>
                        <span className="grid min-w-0 text-left">
                          <span className="truncate capitalize">{n}</span>
                          {u.correo && (
                            <span className="truncate text-[11px] font-medium normal-case text-brand-ink/50">{u.correo}</span>
                          )}
                          {u.vehiculo && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold normal-case text-indigo-600">
                              {VEHICULO_ICONOS[u.vehiculo] || <MdLocalShipping />}
                              {u.vehiculo}{u.placa ? ` · ${u.placa}` : ''}
                            </span>
                          )}
                        </span>
                      </span>
                      {actual ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
                          <MdCheck className="text-indigo-500" /> Conductor
                        </span>
                      ) : (
                        <MdLocalShipping className={`shrink-0 ${iconoColor}`} />
                      )}
                    </button>
                    {esOtro && sel && (
                      <div className="mt-1.5 rounded-xl bg-indigo-50/80 border border-indigo-300/50 p-3 animate-fadeIn">
                        <label className="block text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide mb-2">
                          Nombre del conductor que va
                        </label>
                        <input
                          type="text"
                          value={otroNombre}
                          onChange={(e) => setOtroNombre(e.target.value)}
                          placeholder="Escribe el nombre del conductor…"
                          className="w-full rounded-xl border border-indigo-300/60 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide mb-2">
                Tipo de vehículo
              </label>
              {vehiculoConocido || esElite ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-bold shadow">
                  <span className="text-lg">{VEHICULO_ICONOS[vehiculoEfectivo] || VEHICULO_ICONOS['Camioneta']}</span>
                  {vehiculoEfectivo || 'Camioneta'}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white ring-1 ring-indigo-300/60">
                  {VEHICULOS.map((v) => {
                    const selV = v === vehiculo
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVehiculo(v)}
                        className={`inline-flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-bold transition-all ${
                          selV
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-indigo-900/60 hover:bg-indigo-100'
                        }`}
                      >
                        <span className="text-base">{VEHICULO_ICONOS[v]}</span>
                        {v}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide mb-2">
                <MdNumbers className="text-sm" />
                Placa del vehículo
              </label>
              <input
                type="text"
                value={vehiculoConocido ? placaEfectiva : placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                readOnly={vehiculoConocido}
                placeholder="Ej. ABC-123"
                className={`w-full rounded-xl border border-indigo-300/60 bg-white px-3 py-2.5 text-sm font-semibold text-brand-ink placeholder:text-brand-ink/40 shadow-sm transition-all ${
                  vehiculoConocido
                    ? 'bg-indigo-50 text-indigo-900 cursor-not-allowed'
                    : 'focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none'
                }`}
              />
              {vehiculoConocido && (
                <p className="mt-1.5 text-[11px] font-semibold text-indigo-700 inline-flex items-center gap-1">
                  <MdLock className="text-sm shrink-0" />
                  El vehículo y la placa ya están registrados para este conductor y no se pueden editar.
                </p>
              )}
            </div>
          </div>
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
            disabled={!puedeGuardar}
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