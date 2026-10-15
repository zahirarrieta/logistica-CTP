import { useEffect, useMemo, useState } from 'react'
import { MdApartment, MdInbox, MdFilterList, MdInsights, MdDescription, MdAssignmentInd, MdTag, MdFilterAlt, MdLocalShipping, MdStorefront } from 'react-icons/md'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import EstadoFilter from '../../components/EstadoFilter.jsx'
import SearchFilters from '../../components/SearchFilters.jsx'
import AsignadoFilter from '../../components/AsignadoFilter.jsx'
import { SIN_ASIGNAR } from '../../components/filtrosConstants.js'
import ConductorFilter from '../../components/ConductorFilter.jsx'
import SolicitudesTable from '../../components/SolicitudesTable.jsx'
import RecoleccionesTable from '../Recolecciones/Components/RecoleccionesTable.jsx'
import RecoleccionDetalleModal from '../Recolecciones/Components/modals/RecoleccionDetalleModal.jsx'
import EstadosModal from './Components/modals/EstadosModal.jsx'
import { ESTADOS } from '../../utils/estadoColors.js'
import { ESTADOS_RECOLECCION } from '../../auth/roles.js'
// getRecoleccionBadge/getRecoleccionDot usados en filtro de recolecciones
import { getRecoleccionBadge, getRecoleccionDot } from '../../utils/estadoRecoleccion.js'
import AsignarUsuarioModal from './Components/modals/AsignarUsuarioModal.jsx'
import AsignarConductorModal from './Components/modals/AsignarConductorModal.jsx'
import HistorialModal from './Components/modals/HistorialModal.jsx'
import EntregaDetallesModal from './Components/modals/EntregaDetallesModal.jsx'
import ConfirmarEliminarModal from '../../components/ConfirmarEliminarModal.jsx'
import DashboardTab from './Components/DashboardTab.jsx'
import PlanillasTab from './Components/PlanillasTab.jsx'
import ClientesModal from './Components/modals/ClientesModal.jsx'
import { loadSolicitudes, updateSolicitud, removeSolicitud, suscribir, peekNextId, refrescarProximoCodigo } from '../../store/solicitudesStore.js'
import {
  loadRecolecciones,
  suscribirRecolecciones,
  cambiarEstadoRecoleccion,
  asignarRecoleccion,
  asignarConductorRecoleccion,
} from '../../store/recoleccionesStore.js'
import {
  estadoActualizado,
  solicitudAsignada,
  conductorAsignado,
  recoleccionEstadoActualizado,
  recoleccionAsignada,
  errorRecoleccion,
} from '../../services/notificaciones.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { esSuperAdmin, esAsignadoA } from '../../auth/roles.js'
import { HEX_ESTADO } from '../../utils/dashboardUtils.js'

// Pestañas comunes a administrador y super admin. El contenido de cada una se
// ajusta por rol (ver baseDelTab / Dashboard / Planillas).
const ORDEN_TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: MdInsights },
  { id: 'solicitudes', label: 'Solicitudes', Icon: MdInbox },
  { id: 'asignaciones', label: 'Mis solicitudes', Icon: MdAssignmentInd },
  { id: 'recolecciones', label: 'Recolecciones', Icon: MdStorefront },
  { id: 'planillas', label: 'Planillas', Icon: MdDescription },
  // El catálogo de clientes abre un modal en vez de cambiar el contenido de la
  // página, así que se marca con `modal` para que el click lo abra en lugar de
  // cambiar de pestaña. Solo el super admin: sus endpoints de escritura
  // responden 403 a cualquier otro rol (ver P.esSuperAdmin).
  { id: 'clientes', label: 'Clientes', Icon: MdApartment, soloSuper: true, modal: true },
]

export default function Administrador() {
  const { account, usuario, rol } = useAuth()
const esSuper = esSuperAdmin(rol)
  const [solicitudes, setSolicitudes] = useState(loadSolicitudes())
  const [recolecciones, setRecolecciones] = useState(loadRecolecciones)
  const [recoleccionDetalle, setRecoleccionDetalle] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [editSolicitud, setEditSolicitud] = useState(null)
  const [asignarSolicitud, setAsignarSolicitud] = useState(null)
  const [asignarConductorSolicitud, setAsignarConductorSolicitud] = useState(null)
  const [historialSolicitud, setHistorialSolicitud] = useState(null)
  const [entregaDetallesSolicitud, setEntregaDetallesSolicitud] = useState(null)
  const [eliminarSolicitud, setEliminarSolicitud] = useState(null)
  const [proximo, setProximo] = useState(peekNextId())
  const [filterEstado, setFilterEstado] = useState(null)
  const [filtroAsignado, setFiltroAsignado] = useState(null)
  const [filtroConductor, setFiltroConductor] = useState(null)
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroZona, setFiltroZona] = useState('')
  const [filtroId, setFiltroId] = useState('')
  // Filtros mes/año para el dashboard (admin y superadmin)
  const [filtroMes, setFiltroMes] = useState(null)
  const [filtroAno, setFiltroAno] = useState(null)
  // La pestaña «Clientes» no cambia el contenido de la página: abre el modal
  // encima. Se lleva un estado aparte para poder cerrarlo sin tener que adivinar
  // a qué pestaña volver.
  const [clientesAbierto, setClientesAbierto] = useState(false)

  useEffect(() => suscribir(setSolicitudes), [])

  // Recolecciones desde el store: ya viene con polling, así que el tab se
  // actualiza solo cuando otro admin cambia un estado o entra una recolección
  // nueva (admin/superadmin ven todas, según el filtro del backend).
  useEffect(() => suscribirRecolecciones(setRecolecciones), [])

  // Re-apunta los modales abiertos a la versión fresca cuando llega un cambio en
  // vivo, y los cierra si la fila desapareció. Cada lista toca SOLO los modales
  // de lo suyo (bandera `_esRecoleccion`): los tres estados de modal están
  // compartidos, así que si una lista resolviera los de la otra, el polling de
  // solicitudes cerraría el modal de una recolección a los pocos segundos de
  // abrirlo (y al revés) porque ningún id coincide con un código REC-.
  useEffect(() => {
    const fresco = (prev) =>
      prev && !prev._esRecoleccion ? (solicitudes.find((s) => s.id === prev.id) || null) : prev
    setEditSolicitud(fresco)
    setAsignarSolicitud(fresco)
    setAsignarConductorSolicitud(fresco)
    setHistorialSolicitud(fresco)
    setEntregaDetallesSolicitud(fresco)
    setEliminarSolicitud(fresco)
  }, [solicitudes])

  // Ídem para las recolecciones. Se conserva el `historial` ya cargado: el
  // HistorialModal lo pide bajo demanda y un tick de polling no debe vaciarlo.
  useEffect(() => {
    const frescoRec = (prev) => {
      if (!prev?._esRecoleccion) return prev
      const fila = recolecciones.find((r) => r.codigo === prev.codigo)
      // adaptarRecoleccion ya trae el historial firmado de la fila fresca, así que
      // el modal ve al día los PDF de la guía (y su borrado) en cada tick.
      return fila ? adaptarRecoleccion(fila) : null
    }
    setEditSolicitud(frescoRec)
    setAsignarSolicitud(frescoRec)
    setHistorialSolicitud(frescoRec)
    // El detalle trabaja con la fila cruda (sin adaptar), así que se re-apunta
    // directo: si otro admin cambia el estado con el detalle abierto, se ve.
    setRecoleccionDetalle((prev) =>
      prev ? (recolecciones.find((r) => r.codigo === prev.codigo) || null) : prev
    )
  }, [recolecciones])

  // Adaptador: convierte una recolección a objeto tipo solicitud para reutilizar
  // los modales existentes (AsignarUsuarioModal, EstadosModal, HistorialModal).
  const adaptarRecoleccion = (r) => ({
    id: r.codigo,
    codigo: r.codigo,
    estado: r.estado,
    asignadoA: r.asignado_a,
    asignadoCorreo: r.asignado_correo,
    conductor: r.conductor || '',
    conductorCorreo: r.conductor_correo || '',
    vehiculo: r.vehiculo || '',
    placa: r.placa || '',
    nombreCompleto: r.nombre_completo,
    correo: r.correo,
    cliente: r.recoge_cliente,
    zona: r.zona,
    fechaSubida: r.fecha_subida,
    horaSubida: r.hora_subida,
    tipoSolicitud: r.tipo_servicio,
    // El listado ya trae el historial en cada fila (y firmado), así que el modal
    // de estados puede contar y listar los PDF de la guía de trámites previos.
    historial: Array.isArray(r.historial) ? r.historial : [],
    adjuntos: r.adjuntos,
    observaciones: r.observaciones,
    // Bandera para distinguir en modales compartidos
    _esRecoleccion: true,
    // Campos extra para EstadosModal (no aplican a recolecciones, pero evitan undefined)
    ordenCompra: '',
    cedula: '',
    nit: r.recoge_nit,
    bodega: r.recoge_bodega,
    numeroReferencia: '',
    creadoPor: r.correo,
  })

  // Identidad del admin actual para saber qué solicitudes le pertenecen.
  const misDatos = useMemo(() => ({
    nombre: usuario?.nombre || account?.name || '',
    correo: usuario?.correo || account?.username || '',
  }), [usuario, account])

  const nombreAdmin = (usuario?.nombre || account?.name || '').trim()

  // Sin asignar: las que aún no tienen responsable. El admin las ve en el tab
  // «Solicitudes» y puede auto-asignárselas; el super admin ve ahí todas.
  const sinAsignar = useMemo(
    () => solicitudes.filter((s) => !String(s.asignadoA || '').trim()),
    [solicitudes]
  )
  // Mis asignaciones: las que están a mi nombre o correo. Es lo único que ve el
  // administrador en el Dashboard.
  const misAsignaciones = useMemo(
    () => solicitudes.filter((s) => esAsignadoA(s, misDatos)),
    [solicitudes, misDatos]
  )

  // El super admin ya ve todas las solicitudes en la pestaña "Solicitudes",
  // así que no necesita "Mis solicitudes".
  const TABS = esSuper
    ? ORDEN_TABS.filter((t) => t.id !== 'asignaciones')
    : ORDEN_TABS.filter((t) => !t.soloSuper)

  // Lista base del tab activo (antes de aplicar los filtros de la barra).
  const baseDelTab = esSuper
    ? (tab === 'asignaciones' ? misAsignaciones : solicitudes)
    : (tab === 'asignaciones' ? misAsignaciones : sinAsignar)

  // Aplica filtro mes/año si está activo (para dashboard y tabla)
  const baseConFiltroFecha = useMemo(() => {
    if (!filtroMes && !filtroAno) return baseDelTab
    return baseDelTab.filter((s) => {
      const partes = String(s.fechaSubida || '').split(/[/\-.]/)
      if (partes.length !== 3) return false
      const d = Number(partes[0])
      const m = Number(partes[1])
      let y = Number(partes[2])
      if (!d || !m || !y) return false
      if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
      if (filtroMes && m !== filtroMes) return false
      if (filtroAno && y !== filtroAno) return false
      return true
    })
  }, [baseDelTab, filtroMes, filtroAno])

  const filtered = useMemo(() => {
    const cliente = filtroCliente.toLowerCase()
    const zona = filtroZona.toLowerCase()
    const idBuscado = filtroId.trim().toLowerCase()
    const nombreBuscado = filtroNombre.trim().toLowerCase()
    return baseConFiltroFecha.filter((s) => {
      const e = s.estado || 'Abierto'
      if (filterEstado && e !== filterEstado) return false
      if (filtroAsignado) {
        if (filtroAsignado === SIN_ASIGNAR) {
          if (String(s.asignadoA || '').trim()) return false
        } else if ((s.asignadoA || '') !== filtroAsignado) return false
      }
      if (filtroConductor && (s.conductor || '') !== filtroConductor) return false
      if (nombreBuscado && !(s.nombreCompleto || '').toLowerCase().includes(nombreBuscado)) return false
      if (cliente && !(s.cliente || '').toLowerCase().includes(cliente)) return false
      if (zona && !(s.zona || '').toLowerCase().includes(zona)) return false
      if (idBuscado && !(s.id || '').toLowerCase().includes(idBuscado)) return false
      return true
    })
  }, [baseConFiltroFecha, filterEstado, filtroAsignado, filtroConductor, filtroNombre, filtroCliente, filtroZona, filtroId])

  const hasFilters = Boolean(filterEstado || filtroAsignado || filtroConductor || filtroNombre.trim() || filtroCliente || filtroZona || filtroId.trim())

  const contadorTab = (id) => {
    if (id === 'solicitudes') return esSuper ? solicitudes.length : sinAsignar.length
    if (id === 'asignaciones') return misAsignaciones.length
    if (id === 'recolecciones') return recolecciones.length
    return 0
  }

  const recoleccionesFiltradasLista = useMemo(() => {
    const cliente = filtroCliente.toLowerCase()
    const zona = filtroZona.toLowerCase()
    const idBuscado = filtroId.trim().toLowerCase()
    const nombreBuscado = filtroNombre.trim().toLowerCase()
    return recolecciones.filter((r) => {
      if (filterEstado && r.estado !== filterEstado) return false
      if (filtroAsignado) {
        if (filtroAsignado === SIN_ASIGNAR) {
          if (String(r.asignado_a || '').trim()) return false
        } else if ((r.asignado_a || '') !== filtroAsignado) return false
      }
      if (nombreBuscado && !(r.nombre_completo || r.nombreCompleto || '').toLowerCase().includes(nombreBuscado)) return false
      if (cliente && !(r.recoge_cliente || r.cliente || r.cliente_entrega || '').toLowerCase().includes(cliente)) return false
      if (zona && !(r.zona || '').toLowerCase().includes(zona)) return false
      if (idBuscado) {
        const cod = String(r.codigo || r.id || '').toLowerCase()
        if (!cod.includes(idBuscado)) return false
      }
      return true
    })
  }, [recolecciones, filterEstado, filtroAsignado, filtroNombre, filtroCliente, filtroZona, filtroId])

  const ESTADOS_ADMIN = ESTADOS.filter((e) => e !== 'Entregado' && e !== 'Entregado Parcial')

  const handleEliminar = (solicitud) => {
    setEliminarSolicitud(solicitud)
  }

  // «Clientes» es una pestaña-modal: al pulsarla se abre el modal encima de la
  // página sin perder de vista la pestaña de la que se viene. Al cerrarlo se
  // vuelve al Dashboard, que es donde está el contenido real.
  const abrirClientes = () => {
    setClientesAbierto(true)
    setTab('clientes')
  }

  const cerrarClientes = () => {
    setClientesAbierto(false)
    setTab('dashboard')
  }

  const irATab = (id) => {
    if (id === 'clientes') return abrirClientes()
    // Cambiar de pestaña con el modal abierto lo cierra: si no, el modal
    // seguiría tapando la página que se acaba de elegir.
    setClientesAbierto(false)
    setTab(id)
  }

  const confirmarEliminar = (solicitud) => {
    const siguiente = removeSolicitud(solicitud.id)
    setSolicitudes(siguiente)
    if (editSolicitud?.id === solicitud.id) setEditSolicitud(null)
    if (asignarSolicitud?.id === solicitud.id) setAsignarSolicitud(null)
    if (asignarConductorSolicitud?.id === solicitud.id) setAsignarConductorSolicitud(null)
    if (historialSolicitud?.id === solicitud.id) setHistorialSolicitud(null)
    if (entregaDetallesSolicitud?.id === solicitud.id) setEntregaDetallesSolicitud(null)
  }

  useEffect(() => {
    if (!esSuper) return
    setProximo(peekNextId())
    void refrescarProximoCodigo().then((c) => {
      if (c) setProximo(c)
    })
  }, [solicitudes, esSuper])

  const handleUpdateEstado = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
    estadoActualizado(id, updates.estado)
  }

  const handleAsignar = (id, updates) => {
    setSolicitudes(updateSolicitud(id, updates))
    solicitudAsignada(id, updates.asignadoA)
  }

  const handleAsignarConductor = async (id, updates) => {
    // En una recolección el conductor se guarda en su propia tabla (no en el store
    // de solicitudes): el modal de tránsito es compartido, pero la escritura va
    // por asignarConductorRecoleccion. Al sincronizar, el efecto de [recolecciones]
    // re-apunta el EstadosModal abierto a la fila fresca y la compuerta de
    // «En Tránsito» queda satisfecha.
    if (asignarConductorSolicitud?._esRecoleccion) {
      try {
        await asignarConductorRecoleccion(id, updates)
        conductorAsignado(id, updates.conductor)
        setAsignarConductorSolicitud(null)
      } catch (e) {
        console.error('[Admin] error asignando conductor a recolección:', e)
        errorRecoleccion(e?.message || 'No se pudo asignar el conductor')
      }
      return
    }
    const siguiente = updateSolicitud(id, updates)
    setSolicitudes(siguiente)
    conductorAsignado(id, updates.conductor)
    if (editSolicitud && editSolicitud.id === id) {
      setEditSolicitud(siguiente.find((s) => s.id === id) || null)
    }
  }

  // Recolecciones: mismos modales que solicitudes con el objeto adaptado. Las
  // escrituras van por el store, que re-descarga y marca la fila como eco local
  // para que el aviso en vivo no le llegue también a quien hizo el cambio.
  const handleRecoleccionAsignar = async (codigo, { asignadoA, asignadoCorreo }) => {
    try {
      await asignarRecoleccion(codigo, asignadoA, asignadoCorreo)
      recoleccionAsignada(codigo, asignadoA)
    } catch (e) {
      console.error('[Admin] error asignando recolección:', e)
      errorRecoleccion(e?.message || 'No se pudo asignar la recolección')
    }
  }

  const handleRecoleccionCambiarEstado = async (codigo, updates) => {
    const { estado, notaEstado, numeroReferencia, nuevaFacturaUrls } = updates || {}
    try {
      // `notaEstado` es el campo que manda EstadosModal (no `nota`): es el motivo
      // que escribe el admin y lo que queda guardado en recoleccion_historial. El
      // «N° de guía» y sus PDF viajan como `referencia`/`guiaUrls` (trámite).
      await cambiarEstadoRecoleccion(codigo, estado, notaEstado || '', {
        referencia: numeroReferencia || '',
        guiaUrls: Array.isArray(nuevaFacturaUrls) ? nuevaFacturaUrls : [],
      })
      recoleccionEstadoActualizado(codigo, estado)
    } catch (e) {
      console.error('[Admin] error cambiando estado recolección:', e)
      errorRecoleccion(e?.message || 'No se pudo guardar el estado de la recolección')
    }
  }

  // El listado de recolecciones ya trae el historial en cada fila (columna JSON),
  // así que no hace falta una petición aparte: se usa la fila tal cual, igual que
  // el HistorialModal de solicitudes.
  const handleRecoleccionHistorial = (recoleccion) => {
    const adaptada = adaptarRecoleccion(recoleccion)
    adaptada.historial = Array.isArray(recoleccion.historial) ? recoleccion.historial : []
    setHistorialSolicitud(adaptada)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-ink">
      <Header />

      <main className="flex-1 py-6 sm:py-10">
        <div className="w-full px-4 sm:px-6">
          {/* Barra superior */}
          <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold text-brand-ink inline-flex items-center gap-3">
                <span className="grid place-items-center size-10 sm:size-12 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 overflow-hidden">
                  <img
                    src={esSuper ? '/ITitulos/Superadmin.png' : '/ITitulos/AdminI.png'}
                    alt={esSuper ? 'Super administrador' : 'Administrador'}
                    className="size-full object-contain"
                  />
                </span>
                <span>
                  {esSuper ? 'SUPER ADMINISTRADOR' : 'ADMINISTRADOR'}
                  {nombreAdmin && (
                    <span className="block text-sm sm:text-base font-extrabold text-brand-deep/80 mt-0.5 tracking-wide">
                      {nombreAdmin.toUpperCase()}
                    </span>
                  )}
                </span>
              </h1>
              <p className="text-brand-ink/60 mt-2 text-sm sm:text-base">
                {esSuper
                  ? 'Listado de todas las solicitudes registradas'
                  : 'Solicitudes sin asignar y tus propias asignaciones'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {esSuper && (
                <span
                  title="Próximo código global"
                  className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-deep px-3 py-2 text-xs sm:text-sm font-bold tracking-wide select-none">
                  <MdTag className="text-sm" />
                  {proximo}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 -mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-brand-mist/70 ring-1 ring-brand-ink/10 p-1 whitespace-nowrap">
              {TABS.map((t) => {
                const Icon = t.Icon
                const active = tab === t.id
                const cuenta = contadorTab(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => irATab(t.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:px-6 sm:text-sm font-extrabold transition-all ${
                      active
                        ? 'bg-brand-navy text-white shadow-lg'
                        : 'text-brand-ink/60 hover:bg-white/70 hover:text-brand-deep'
                    }`}
                  >
                    <Icon className="text-base" />
                    <span>{t.label}</span>
                    {(t.id === 'solicitudes' || t.id === 'asignaciones' || t.id === 'recolecciones') && cuenta > 0 && (
                      <span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-[10px] font-extrabold ${active ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-deep/10 text-brand-deep'}`}>
                        {cuenta}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {tab === 'dashboard' ? (
            <DashboardTab
              solicitudes={esSuper ? solicitudes : misAsignaciones}
              onFilterMes={setFiltroMes}
              onFilterAno={setFiltroAno}
            />
          ) : tab === 'planillas' ? (
            <PlanillasTab solicitudes={solicitudes} />
          ) : tab === 'clientes' ? (
            // La pestaña «Clientes» no tiene contenido propio: el modal se pinta
            // al final del return. Se deja un aviso para el caso raro de que se
            // quede seleccionada sin el modal abierto.
            <p className="rounded-2xl border border-brand-ink/10 bg-brand-mist/60 px-4 py-6 text-center text-sm font-semibold text-brand-ink/60">
              Pulsa «Clientes» para abrir el catálogo.
            </p>
          ) : tab === 'recolecciones' ? (
            <>
              {recolecciones.length > 0 && (
                <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <EstadoFilter
                    solicitudes={recolecciones}
                    value={filterEstado}
                    onChange={setFilterEstado}
                    estados={ESTADOS_RECOLECCION}
                    getBadge={getRecoleccionBadge}
                    getDot={getRecoleccionDot}
                  />
                  <AsignadoFilter
                    solicitudes={recolecciones}
                    value={filtroAsignado}
                    onChange={setFiltroAsignado}
                    getAsignado={(r) => r.asignado_a}
                  />
                  <SearchFilters
                    cliente={filtroCliente}
                    onClienteChange={setFiltroCliente}
                    zona={filtroZona}
                    onZonaChange={setFiltroZona}
                    nombre={filtroNombre}
                    onNombreChange={setFiltroNombre}
                    id={filtroId}
                    onIdChange={setFiltroId}
                  />
                </div>
              )}
              {recoleccionesFiltradasLista.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-ink/20 bg-brand-mist/40 px-4 py-16 text-center text-brand-deep/60">
                  <MdFilterList className="text-4xl" />
                  <p className="text-base font-bold">
                    {hasFilters ? 'No hay recolecciones que coincidan con los filtros' : 'No hay recolecciones registradas'}
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterEstado(null)
                        setFiltroAsignado(null)
                        setFiltroCliente('')
                        setFiltroZona('')
                        setFiltroNombre('')
                        setFiltroId('')
                      }}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-deep px-4 py-2 text-xs font-extrabold text-white shadow-lg transition hover:brightness-110"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
                <RecoleccionesTable
                  items={recoleccionesFiltradasLista}
                  onRowClick={(r) => setRecoleccionDetalle(r)}
                  onAsignarClick={(r) => setAsignarSolicitud(adaptarRecoleccion(r))}
                  onCambiarEstadoClick={(r) => setEditSolicitud(adaptarRecoleccion(r))}
                  onHistorialClick={handleRecoleccionHistorial}
                  colorRowsPorEstado
                />
              )}
            </>
          ) : (
            <>
              {baseDelTab.length > 0 && (
                <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <EstadoFilter solicitudes={baseDelTab} value={filterEstado} onChange={setFilterEstado} />
                  <AsignadoFilter solicitudes={baseDelTab} value={filtroAsignado} onChange={setFiltroAsignado} />
                  <ConductorFilter solicitudes={baseDelTab} value={filtroConductor} onChange={setFiltroConductor} />
                  <SearchFilters
                    nombre={filtroNombre}
                    onNombreChange={setFiltroNombre}
                    cliente={filtroCliente}
                    zona={filtroZona}
                    onClienteChange={setFiltroCliente}
                    onZonaChange={setFiltroZona}
                    id={filtroId}
                    onIdChange={setFiltroId}
                  />
                </div>
              )}

              <SolicitudesTable
                items={filtered}
                onEstadoClick={(s) => setHistorialSolicitud(s)}
                onAsignarClick={(s) => setAsignarSolicitud(s)}
                onCambiarEstadoClick={(s) => setEditSolicitud(s)}
                onAsignarConductorClick={(s) => setAsignarConductorSolicitud(s)}
                onEntregaDetallesClick={(s) => setEntregaDetallesSolicitud(s)}
                onEliminarClick={esSuper ? handleEliminar : undefined}
                accionesCancelado={esSuper}
                reabrirParcial={esSuper}
                colorRowsPorEstado
                empty={
                  hasFilters
                    ? {
                        icon: <MdFilterList />,
                        title: 'No hay solicitudes que coincidan con los filtros',
                        text: 'Ajusta el estado, asignado, cliente o zona seleccionados.',
                      }
                    : tab === 'asignaciones'
                      ? {
                          icon: <MdAssignmentInd />,
                          title: 'Aún no tienes solicitudes asignadas',
                          text: 'Cuando te asignen una solicitud aparecerá aquí.',
                        }
                      : {
                          icon: <MdInbox />,
                          title: esSuper ? 'Aún no hay solicitudes registradas' : 'No hay solicitudes sin asignar',
                          text: esSuper
                            ? 'Crea tu primera solicitud desde «MIS SOLICITUDES».'
                            : 'Todas las solicitudes ya están asignadas. Revisa el tab «Mis asignaciones».',
                        }
                }
              />
            </>
          )}
        </div>
      </main>

      <Footer />

      <EstadosModal
        solicitud={editSolicitud}
        open={editSolicitud !== null}
        onClose={() => setEditSolicitud(null)}
        onUpdate={editSolicitud?._esRecoleccion ? handleRecoleccionCambiarEstado : handleUpdateEstado}
        onAsignarConductorClick={(s) => setAsignarConductorSolicitud(s)}
        permitidos={editSolicitud?._esRecoleccion ? ESTADOS_RECOLECCION : ESTADOS_ADMIN}
        permitirReabrir={esSuper}
      />

      <AsignarUsuarioModal
        solicitud={asignarSolicitud}
        open={asignarSolicitud !== null}
        onClose={() => setAsignarSolicitud(null)}
        onUpdate={asignarSolicitud?._esRecoleccion ? handleRecoleccionAsignar : handleAsignar}
      />

      <AsignarConductorModal
        solicitud={asignarConductorSolicitud}
        open={asignarConductorSolicitud !== null}
        onClose={() => setAsignarConductorSolicitud(null)}
        onUpdate={handleAsignarConductor}
      />

      <HistorialModal
        solicitud={historialSolicitud}
        open={historialSolicitud !== null}
        onClose={() => setHistorialSolicitud(null)}
      />

      <EntregaDetallesModal
        solicitud={entregaDetallesSolicitud}
        open={entregaDetallesSolicitud !== null}
        onClose={() => setEntregaDetallesSolicitud(null)}
      />

      {recoleccionDetalle && (
        <RecoleccionDetalleModal
          open
          recoleccion={recoleccionDetalle}
          onClose={() => setRecoleccionDetalle(null)}
        />
      )}
      <ConfirmarEliminarModal
        solicitud={eliminarSolicitud}
        open={eliminarSolicitud !== null}
        onClose={() => setEliminarSolicitud(null)}
        onConfirm={confirmarEliminar}
      />

      <ClientesModal open={clientesAbierto} onClose={cerrarClientes} />

    </div>
  )
}