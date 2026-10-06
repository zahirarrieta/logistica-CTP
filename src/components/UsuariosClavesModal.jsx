import { useEffect, useMemo, useState } from 'react'
import {
  MdCheck,
  MdClose,
  MdLockReset,
  MdManageAccounts,
  MdSearch,
  MdVisibility,
  MdVisibilityOff,
  MdWarning,
} from 'react-icons/md'
import Modal from './Modal.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { cargarUsuarios } from '../services/solicitudesApi.js'
import { restablecerClave } from '../services/usuariosApi.js'
import { claveRestablecida, errorClave } from '../services/notificaciones.jsx'

const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-2.5 text-brand-ink ' +
  'placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

const BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait'

const BOTON_PRIMARIO = `${BOTON} bg-brand-cyan text-brand-ink shadow-cyanGlow hover:bg-brand-cyanSoft`
const BOTON_NEUTRO = `${BOTON} bg-brand-ink/10 text-brand-ink hover:bg-brand-ink/15`

const COLOR_ROL = {
  superadmin: 'bg-cyan-100 text-cyan-800',
  administrador: 'bg-blue-100 text-blue-700',
  conductor: 'bg-purple-100 text-purple-700',
  solicitante: 'bg-brand-ink/10 text-brand-ink/70',
}

function iniciales(nombre, correo) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return String(correo || '?').slice(0, 2).toUpperCase()
}

// Lista de usuarios con la potestad de restablecer contraseñas: «Restablecer»
// deja la clave predeterminada del servidor (una sola pulsación con confirmación)
// y «Cambiar clave» fija una nueva escrita por el usuario de sistemas.
// Solo abre este modal la cuenta de sistemas (el menú del Header no lo muestra
// a nadie más) y, aunque alguien lo montara, el backend devuelve 403.
export default function UsuariosClavesModal({ onClose }) {
  const { usuario } = useAuth()
  const miCorreo = String(usuario?.correo || '').toLowerCase()

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [confirmando, setConfirmando] = useState(null) // correo en confirmación
  const [editando, setEditando] = useState(null) // correo con formulario abierto
  const [claveNueva, setClaveNueva] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [errorForma, setErrorForma] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exitos, setExitos] = useState({}) // correo → true tras cambiarla bien

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError('')
    cargarUsuarios()
      .then((data) => { if (vivo) setUsuarios(data || []) })
      .catch((e) => { if (vivo) setError(e.message || 'No se pudo cargar la lista de usuarios') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  // Escape cierra el modal (salvo mientras guarda): primero el formulario
  // abierto, luego la confirmación, y al final el modal entero.
  useEffect(() => {
    const alPulsarTecla = (e) => {
      if (e.key !== 'Escape' || guardando) return
      if (editando) {
        setEditando(null)
        setClaveNueva('')
        setVerClave(false)
        setErrorForma('')
        return
      }
      if (confirmando) {
        setConfirmando(null)
        return
      }
      onClose?.()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [guardando, editando, confirmando, onClose])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter((u) =>
      [u.nombre, u.correo, u.rol].some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [usuarios, busqueda])

  function cancelarEdicion() {
    setEditando(null)
    setClaveNueva('')
    setVerClave(false)
    setErrorForma('')
  }

  async function aplicar(correo, contrasena) {
    if (guardando) return
    if (contrasena && contrasena.length < 8) {
      setErrorForma('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setGuardando(true)
    setErrorForma('')
    try {
      const res = await restablecerClave(correo, contrasena)
      claveRestablecida(correo, Boolean(res?.predeterminada))
      setExitos((prev) => ({ ...prev, [correo]: true }))
      setConfirmando(null)
      cancelarEdicion()
    } catch (e) {
      // El 403 del backend (alguien que no es sistemas) llega aquí como toast.
      errorClave(e.message)
      if (editando) setErrorForma(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={guardando ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-usuarios-claves"
        className="relative bg-white text-brand-ink w-full max-w-3xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3
            id="titulo-usuarios-claves"
            className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdManageAccounts className="text-brand-cyan text-lg" />
            </span>
            USUARIOS Y CLAVES
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={guardando}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Ayuda */}
          <div className="rounded-2xl border border-brand-cyan/35 bg-brand-cyan/5 p-4">
            <p className="font-extrabold text-sm text-brand-deep inline-flex items-center gap-2">
              <MdLockReset className="text-brand-cyan text-lg" />
              Contraseña olvidada
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-brand-ink/75 list-disc list-inside marker:text-brand-cyan marker:font-extrabold">
              <li>
                <span className="font-bold text-brand-ink">Restablecer</span> deja la clave
                predeterminada del sistema; el usuario entra con ella y puede cambiarla después
                desde «Cambiar clave».
              </li>
              <li>
                <span className="font-bold text-brand-ink">Cambiar clave</span> fija una contraseña
                nueva escrita por ti (mínimo 8 caracteres).
              </li>
              <li>Nadie más tiene acceso a esta pantalla.</li>
            </ul>
          </div>

          {/* Buscador */}
          {!cargando && !error && usuarios.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/35 text-lg" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, correo o rol…"
                  aria-label="Buscar usuarios"
                  className={`${CLASES_CAMPO} py-3 pl-11`}
                />
              </div>
              <p className="text-xs font-bold text-brand-ink/50 sm:ml-auto">
                {filtrados.length === usuarios.length
                  ? `${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`
                  : `${filtrados.length} de ${usuarios.length} usuarios`}
              </p>
            </div>
          )}

          {/* Cargando / error / lista */}
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-brand-deep/60">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
              <p className="text-sm font-semibold">Cargando usuarios…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MdWarning className="text-4xl text-red-400" />
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-brand-ink/60">
              {usuarios.length === 0 ? 'No hay usuarios.' : `Nadie coincide con «${busqueda.trim()}».`}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtrados.map((u) => {
                const correo = String(u.correo || '').toLowerCase()
                const esYo = correo === miCorreo
                const confirmar = confirmando === correo
                const editandoEste = editando === correo
                return (
                  <li
                    key={correo}
                    className="rounded-2xl ring-1 ring-brand-ink/10 px-3 sm:px-4 py-3 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`grid place-items-center size-10 rounded-full text-xs font-extrabold shrink-0 ${
                          exitos[correo] ? 'bg-green-500 text-white' : 'bg-brand-navy text-white'
                        }`}
                      >
                        {exitos[correo] ? <MdCheck className="text-lg" /> : iniciales(u.nombre, correo)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-brand-ink truncate inline-flex items-center gap-2">
                          {u.nombre || correo}
                          {esYo && (
                            <span className="rounded-full bg-brand-cyan/20 text-brand-deep px-2 py-0.5 text-[10px] font-extrabold ring-1 ring-brand-cyan/50">
                              TÚ
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-brand-ink/50 truncate">{correo}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-extrabold capitalize shrink-0 ${
                          COLOR_ROL[u.rol] || COLOR_ROL.solicitante
                        }`}
                      >
                        {u.rol}
                      </span>
                      {!confirmar && !editandoEste && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => { cancelarEdicion(); setConfirmando(correo) }}
                            disabled={guardando}
                            className={BOTON_NEUTRO}
                          >
                            Restablecer
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmando(null); setEditando(correo); setClaveNueva(''); setErrorForma('') }}
                            disabled={guardando}
                            className={`${BOTON} bg-brand-navy text-white hover:bg-brand-deep`}
                          >
                            Cambiar clave
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Confirmación de restablecer (clave predeterminada) */}
                    {confirmar && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5">
                        <span className="text-xs font-extrabold text-amber-800 inline-flex items-center gap-1.5">
                          <MdWarning className="text-sm" />
                          ¿Dejar la clave predeterminada para {correo}?
                        </span>
                        <button
                          type="button"
                          onClick={() => aplicar(correo, '')}
                          disabled={guardando}
                          className={`${BOTON_PRIMARIO} py-2`}
                        >
                          {guardando ? 'Guardando…' : 'Sí, restablecer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          disabled={guardando}
                          className={`${BOTON_NEUTRO} py-2`}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Formulario de contraseña nueva */}
                    {editandoEste && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-56">
                          <label
                            htmlFor={`clave-${correo}`}
                            className="mb-1 block text-xs font-bold text-brand-ink/70"
                          >
                            Nueva contraseña para {correo}
                          </label>
                          <div className="relative">
                            <input
                              id={`clave-${correo}`}
                              type={verClave ? 'text' : 'password'}
                              value={claveNueva}
                              onChange={(e) => { setClaveNueva(e.target.value); setErrorForma('') }}
                              placeholder="Mínimo 8 caracteres"
                              autoFocus
                              className={`${CLASES_CAMPO} pr-11`}
                            />
                            <button
                              type="button"
                              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              onClick={() => setVerClave((v) => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-lg text-brand-ink/50 hover:bg-brand-ink/10 transition"
                            >
                              {verClave ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => aplicar(correo, claveNueva)}
                          disabled={guardando || !claveNueva}
                          className={BOTON_PRIMARIO}
                        >
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicion}
                          disabled={guardando}
                          className={BOTON_NEUTRO}
                        >
                          Cancelar
                        </button>
                        {errorForma && (
                          <p role="alert" className="w-full text-xs font-semibold text-red-600">
                            {errorForma}
                          </p>
                        )}
                      </div>
                    )}

                    {exitos[correo] && !confirmar && !editandoEste && (
                      <p className="text-xs font-bold text-green-700 inline-flex items-center gap-1.5">
                        <MdCheck className="text-sm" />
                        Contraseña actualizada para {correo}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Pie */}
        <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0">
          <button type="button" onClick={onClose} disabled={guardando} className={BOTON_NEUTRO}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
