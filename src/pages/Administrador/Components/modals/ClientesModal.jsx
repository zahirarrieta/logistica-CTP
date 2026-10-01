import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MdApartment,
  MdClose,
  MdDelete,
  MdEdit,
  MdPersonAdd,
  MdSave,
  MdSearch,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import {
  actualizarCliente,
  crearCliente,
  eliminarCliente,
  listarClientes,
} from '../../../../services/clientesApi.js'
import {
  clienteActualizado,
  clienteCreado,
  clienteEliminado,
  errorClientes,
} from '../../../../services/notificaciones.jsx'

// Mismos estilos de campo que el resto de modales blancos del módulo.
const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-brand-ink ' +
  'placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

const BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait'

const BOTON_PRIMARIO = `${BOTON} bg-brand-cyan text-brand-ink shadow-cyanGlow hover:bg-brand-cyanSoft`
const BOTON_NEUTRO = `${BOTON} bg-brand-ink/10 text-brand-ink hover:bg-brand-ink/15`
const BOTON_PELIGRO = `${BOTON} bg-red-600 text-white hover:bg-red-700`

const CLIENTE_VACIO = { nit: '', nombre: '', bodega: '', zona: '' }

const CAMPOS = [
  { key: 'nit', label: 'NIT', placeholder: '900123456', required: true, autoComplete: 'off' },
  { key: 'nombre', label: 'Nombre o razón social', placeholder: 'Nombre del cliente', required: true, autoComplete: 'off' },
  { key: 'bodega', label: 'Bodega', placeholder: 'Bodega o sede', autoComplete: 'off' },
  { key: 'zona', label: 'Zona', placeholder: 'Ciudad o zona', autoComplete: 'off' },
]

export default function ClientesModal({ open, onClose }) {
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // `null` = solo viendo la lista. Un objeto = formulario abierto (con `id` si
  // se está editando). Guardar el id dentro del propio objeto evita un segundo
  // estado que se desincronizaría de este.
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // Cliente señalado para borrar, a la espera de confirmación.
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const primerCampoRef = useRef(null)
  const buscadorRef = useRef(null)

  // `esValido` permite que quien lanza la carga decida si el resultado sigue
  // interesando: al cerrar el modal mientras volaba la petición, el estado ya
  // no se toca y no se pisa con la respuesta de una apertura anterior.
  const cargar = useCallback(async (esValido = () => true) => {
    setCargando(true)
    setError('')
    try {
      const filas = await listarClientes()
      if (esValido()) setClientes(filas)
    } catch (e) {
      if (esValido()) setError(e.message || 'No se pudo cargar el catálogo de clientes')
    } finally {
      if (esValido()) setCargando(false)
    }
  }, [])

  // Se carga al abrir, no al montar: el componente siempre está en el árbol y
  // solo se pinta cuando `open` es true.
  useEffect(() => {
    if (!open) return
    let cancelado = false
    setBusqueda('')
    setEditando(null)
    setPorBorrar(null)
    setErrorForm('')
    cargar(() => !cancelado)
    return () => { cancelado = true }
  }, [open, cargar])

  // Escape cierra, salvo que haya un guardado o un borrado en curso.
  useEffect(() => {
    if (!open) return
    const alPulsarTecla = (e) => {
      if (e.key !== 'Escape') return
      if (guardando || borrando) return
      onClose()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [open, guardando, borrando, onClose])

  // Al abrir el formulario el foco va al primer campo, que es lo que se espera
  // de un formulario en vez de tener que cazarlo con el ratón.
  useEffect(() => {
    if (editando) primerCampoRef.current?.focus()
  }, [editando])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) =>
      [c.nit, c.nombre, c.bodega, c.zona]
        .some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [clientes, busqueda])

  const escribir = (campo) => (e) => {
    const valor = e.target.value
    setEditando((f) => (f ? { ...f, [campo]: valor } : f))
    if (errorForm) setErrorForm('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando || !editando) return
    const cliente = {
      nit: editando.nit.trim(),
      nombre: editando.nombre.trim(),
      bodega: editando.bodega.trim(),
      zona: editando.zona.trim(),
    }
    if (!cliente.nit) return setErrorForm('Escribe el NIT del cliente')
    if (!cliente.nombre) return setErrorForm('Escribe el nombre o razón social')

    setGuardando(true)
    setErrorForm('')
    try {
      if (editando.id) {
        await actualizarCliente(editando.id, cliente)
        clienteActualizado(cliente)
      } else {
        await crearCliente(cliente)
        clienteCreado(cliente)
      }
      setEditando(null)
      await cargar()
    } catch (err) {
      setErrorForm(err.message || 'No se pudo guardar el cliente')
      errorClientes(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarBorrado = async () => {
    if (!porBorrar || borrando) return
    setBorrando(true)
    try {
      await eliminarCliente(porBorrar.id)
      clienteEliminado(porBorrar)
      setPorBorrar(null)
      // Si se estaba editando justo el cliente que se borra, se cierra el
      // formulario: si no, se quedaría Guardando sobre una fila que ya no está.
      setEditando((f) => (f && f.id === porBorrar.id ? null : f))
      await cargar()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el cliente')
      errorClientes(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const abrirNuevo = () => {
    setPorBorrar(null)
    setErrorForm('')
    setEditando({ ...CLIENTE_VACIO })
  }

  const abrirEdicion = (cliente) => {
    setPorBorrar(null)
    setErrorForm('')
    setEditando({ ...cliente })
  }

  if (!open) return null

  return (
    <Modal onClose={guardando || borrando ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-clientes"
        className="relative bg-white text-brand-ink w-full max-w-3xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3
            id="titulo-clientes"
            className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdApartment className="text-brand-cyan text-lg" />
            </span>
            CLIENTES
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={guardando || borrando}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Buscador + alta */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <MdSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/35 text-lg" />
            <input
              ref={buscadorRef}
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por NIT, nombre, bodega o zona"
              aria-label="Buscar clientes"
              className={`${CLASES_CAMPO} pl-11`}
            />
          </div>
          <button type="button" onClick={abrirNuevo} className={BOTON_PRIMARIO}>
            <MdPersonAdd className="text-base" />
            Nuevo cliente
          </button>
        </div>

        {/* Formulario de alta / edición */}
        {editando ? (
          <form
            onSubmit={guardar}
            className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-brand-cyan/35 bg-brand-cyan/5 p-4 shrink-0"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="font-extrabold text-sm text-brand-deep inline-flex items-center gap-2">
                {editando.id ? <MdEdit className="text-brand-cyan" /> : <MdPersonAdd className="text-brand-cyan" />}
                {editando.id ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}
              </h4>
              <button
                type="button"
                onClick={() => setEditando(null)}
                disabled={guardando}
                className="text-xs font-bold text-brand-ink/50 hover:text-brand-ink transition disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((campo, i) => (
                <div key={campo.key} className={campo.key === 'nombre' ? 'sm:col-span-2' : ''}>
                  <label
                    htmlFor={`cliente-${campo.key}`}
                    className="mb-1.5 block text-xs font-bold text-brand-ink/70"
                  >
                    {campo.label}
                    {campo.required ? <span className="text-red-500"> *</span> : null}
                  </label>
                  <input
                    id={`cliente-${campo.key}`}
                    ref={i === 0 ? primerCampoRef : undefined}
                    type="text"
                    name={campo.key}
                    value={editando[campo.key] || ''}
                    onChange={escribir(campo.key)}
                    placeholder={campo.placeholder}
                    autoComplete={campo.autoComplete}
                    required={campo.required}
                    maxLength={campo.key === 'nombre' ? 255 : 120}
                    className={CLASES_CAMPO}
                  />
                </div>
              ))}
            </div>

            {errorForm ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {errorForm}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                disabled={guardando}
                className={BOTON_NEUTRO}
              >
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                <MdSave className="text-base" />
                {guardando ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
            </div>
          </form>
        ) : null}

        {/* Listado */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-brand-deep/60">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-deep/20 border-t-brand-deep" />
              <p className="text-sm font-semibold">Cargando clientes…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button type="button" onClick={cargar} className={`${BOTON_NEUTRO} mt-2`}>
                Reintentar
              </button>
            </div>
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MdApartment className="text-4xl text-brand-ink/20" />
              <p className="font-extrabold text-brand-ink">
                {clientes.length === 0 ? 'Todavía no hay clientes' : 'Ningún cliente coincide'}
              </p>
              <p className="text-sm text-brand-ink/60">
                {clientes.length === 0
                  ? 'Crea el primero con el botón «Nuevo cliente».'
                  : `No hay resultados para «${busqueda.trim()}».`}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs font-bold text-brand-ink/50">
                {visibles.length === clientes.length
                  ? `${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`
                  : `${visibles.length} de ${clientes.length} clientes`}
              </p>

              <ul className="space-y-2">
                {visibles.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-brand-ink/10 bg-white px-3.5 py-3 transition hover:border-brand-cyan/40 hover:bg-brand-cyan/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-sm text-brand-ink break-words">
                          {c.nombre || 'Sin nombre'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-brand-ink/60">
                          <span className="rounded-md bg-brand-ink/5 px-1.5 py-0.5 font-mono">
                            NIT {c.nit}
                          </span>
                          {c.bodega ? <span>Bodega {c.bodega}</span> : null}
                          {c.zona ? <span>Zona {c.zona}</span> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(c)}
                          aria-label={`Editar ${c.nombre || c.nit}`}
                          title="Editar"
                          className="grid place-items-center size-9 rounded-lg bg-brand-cyan/15 text-brand-deep transition hover:bg-brand-cyan/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/50"
                        >
                          <MdEdit className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPorBorrar(c)}
                          aria-label={`Eliminar ${c.nombre || c.nit}`}
                          title="Eliminar"
                          className="grid place-items-center size-9 rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                        >
                          <MdDelete className="text-lg" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Confirmación de borrado */}
        {porBorrar ? (
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-borrar-cliente"
            className="absolute inset-0 z-10 grid place-items-center bg-brand-ink/70 backdrop-blur-sm p-4 animate-fadeIn"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-scaleIn">
              <h4
                id="titulo-borrar-cliente"
                className="font-extrabold text-base text-brand-ink inline-flex items-center gap-2"
              >
                <span className="grid place-items-center size-8 rounded-xl bg-red-50 text-red-600">
                  <MdDelete className="text-lg" />
                </span>
                ELIMINAR CLIENTE
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-brand-ink/75">
                ¿Seguro que quieres eliminar{' '}
                <span className="font-extrabold text-brand-ink">
                  {porBorrar.nombre || porBorrar.nit}
                </span>{' '}
                (NIT {porBorrar.nit})?
              </p>
              <p className="mt-2 text-xs leading-relaxed text-brand-ink/55">
                Ya no aparecerá en el selector de clientes. Las solicitudes que ya
                lo usaron conservan sus datos.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPorBorrar(null)}
                  disabled={borrando}
                  className={BOTON_NEUTRO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarBorrado}
                  disabled={borrando}
                  className={BOTON_PELIGRO}
                >
                  <MdDelete className="text-base" />
                  {borrando ? 'ELIMINANDO…' : 'ELIMINAR'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
