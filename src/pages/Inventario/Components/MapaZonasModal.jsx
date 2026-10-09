import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MdChevronRight, MdClose, MdInventory2, MdOutlinePlace } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import ZonaArticulosModal from './ZonaArticulosModal.jsx'
import { colorZona, coordenadasZona } from '../../../utils/zonasColombia.js'

// Pin del mapa: el icono del artículo con el número de artículos de la zona,
// coloreado según la zona. Se construye como HTML porque los marcadores de
// Leaflet reciben un `divIcon`, no un componente de React.
function iconoPin(zona, n) {
  const color = colorZona(zona)
  const html = `
    <div style="position:relative;width:46px;height:58px">
      <div style="position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="display:block"><path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>
        <span style="font-size:12px;font-weight:800;line-height:1;margin-top:1px">${n}</span>
      </div>
      <div style="position:absolute;left:50%;bottom:0;width:14px;height:14px;background:${color};border-left:2px solid #fff;border-bottom:2px solid #fff;transform:translate(-50%,-2px) rotate(-45deg);"></div>
    </div>`
  return L.divIcon({ html, className: 'pin-zona', iconSize: [46, 58], iconAnchor: [23, 58] })
}

// Ajusta el encuadre del mapa a los pines y recalcula el tamaño (el mapa nace
// dentro de un modal; sin esto a veces sale con tiles a medias).
function AjustarVista({ puntos }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [map])

  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      map.setView(puntos[0], 9)
      return
    }
    map.fitBounds(L.latLngBounds(puntos), { padding: [56, 56] })
  }, [map, puntos])

  return null
}

// Modal de pantalla completa: todo el inventario filtrado por zonas en un mapa
// de Colombia y, siempre visible al lado, la lista de zonas (sin desplegable).
// Al hacer clic en un pin (o en una zona de la lista) se abre directamente el
// modal con los artículos de esa zona.
export default function MapaZonasModal({ open, onClose, filas }) {
  const [zonaAbierta, setZonaAbierta] = useState(null)

  const grupos = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      const zona = String(f.zona ?? '').trim() || 'Sin zona'
      const g = m.get(zona) || { zona, filas: [], cantidad: 0 }
      g.filas.push(f)
      const n = Number(String(f.cantidad ?? '').replace(/\./g, '').replace(',', '.'))
      g.cantidad += Number.isFinite(n) ? n : 0
      m.set(zona, g)
    }
    return [...m.values()].sort((a, b) => b.filas.length - a.filas.length)
  }, [filas])

  const gruposConCoords = useMemo(
    () => grupos.map((g) => ({ ...g, coords: coordenadasZona(g.zona) })),
    [grupos]
  )
  const ubicables = useMemo(() => gruposConCoords.filter((g) => g.coords), [gruposConCoords])
  const puntos = useMemo(() => ubicables.map((g) => [g.coords.lat, g.coords.lng]), [ubicables])

  if (!open) return null

  const totalArticulos = filas.length

  return (
    <>
      <Modal
        onClose={onClose}
        overlayClassName="fixed inset-0 z-[1000] bg-brand-ink/85 backdrop-blur-sm flex flex-col animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-mapa-zonas"
          className="relative flex-1 min-h-0 flex flex-col bg-brand-ink text-white overflow-hidden animate-scaleIn"
        >
          {/* Encabezado */}
          <div className="relative overflow-hidden px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep border-b border-white/10 shrink-0">
            <MdOutlinePlace className="pointer-events-none absolute -right-3 -bottom-8 text-[7rem] text-white/10" />
            <div className="relative flex items-center justify-between gap-3">
              <h3
                id="titulo-mapa-zonas"
                className="text-white font-extrabold text-base sm:text-xl inline-flex items-center gap-2.5 min-w-0"
              >
                <span className="grid place-items-center size-9 shrink-0 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
                  <MdOutlinePlace className="text-brand-cyan text-xl" />
                </span>
                <span className="truncate">Artículos por zona</span>
              </h3>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
              >
                <MdClose className="text-lg" />
              </button>
            </div>
            <p className="relative mt-1 text-xs sm:text-sm font-semibold text-white/70 pl-1">
              {totalArticulos.toLocaleString('es-CO')} artículo{totalArticulos === 1 ? '' : 's'} en{' '}
              {grupos.length} zona{grupos.length === 1 ? '' : 's'}
              {grupos.some((g) => !g.coords) ? ' · incluye zonas sin ubicación' : ''}
              {' · refleja los filtros del inventario'}
            </p>
          </div>

          {/* Cuerpo: el mapa y la lista de zonas, siempre visible, lado a lado */}
          <div className="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            <div className="relative flex-1 min-h-0">
              <MapContainer
                center={[4.6, -74.1]}
                zoom={6}
                minZoom={6}
                maxZoom={18}
                maxBounds={[[-4.3, -79.1], [12.6, -66.8]]}
                maxBoundsViscosity={1.0}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <AjustarVista puntos={puntos} />
                {ubicables.map((g) => (
                  <Marker
                    key={g.zona}
                    position={[g.coords.lat, g.coords.lng]}
                    icon={iconoPin(g.zona, g.filas.length)}
                    eventHandlers={{ click: () => setZonaAbierta(g) }}
                  >
                    <Tooltip direction="top" offset={[0, -46]} opacity={1}>
                      <span className="block font-extrabold text-brand-ink">{g.zona}</span>
                      <span className="block text-[11px] font-semibold text-brand-ink/70">
                        {g.filas.length.toLocaleString('es-CO')} artículo{g.filas.length === 1 ? '' : 's'} ·{' '}
                        {g.cantidad.toLocaleString('es-CO')} unidades
                      </span>
                      <span className="block text-[11px] font-bold text-brand-deep">Clic para ver artículos</span>
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Listado de zonas, siempre visible (con scroll propio) */}
            <aside className="shrink-0 flex flex-col bg-brand-navy/95 backdrop-blur border-t md:border-t-0 md:border-l border-white/10 max-h-[45%] md:max-h-none md:w-[21rem]">
              <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/60">
                    <MdInventory2 className="text-brand-cyan text-sm" />
                    Zonas
                  </p>
                  <p className="text-[11px] font-semibold text-white/40">
                    Cada zona tiene su color en el mapa · tocá una para ver sus artículos
                  </p>
                </div>
              </div>
              <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/10">
                {gruposConCoords.map((g) => (
                  <li key={g.zona}>
                    <button
                      type="button"
                      onClick={() => setZonaAbierta(g)}
                      className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-white/5 transition"
                    >
                      <span
                        className="size-3 rounded-full shrink-0 ring-2 ring-white/25"
                        style={{ backgroundColor: colorZona(g.zona) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{g.zona}</span>
                        <span className="block text-[11px] font-semibold text-white/45">
                          {g.filas.length.toLocaleString('es-CO')} artículo
                          {g.filas.length === 1 ? '' : 's'} · {g.cantidad.toLocaleString('es-CO')} unidades
                          {!g.coords && ' · sin ubicación en el mapa'}
                        </span>
                      </span>
                      <span className="grid place-items-center size-6 rounded-full bg-brand-cyan/20 ring-1 ring-brand-cyan/40 text-brand-cyan">
                        <MdChevronRight className="text-base" />
                      </span>
                    </button>
                  </li>
                ))}
                {gruposConCoords.length === 0 && (
                  <li className="px-5 py-6 text-sm font-semibold text-white/50">
                    No hay artículos para las zonas de los filtros activos.
                  </li>
                )}
              </ul>
            </aside>
          </div>
        </div>
      </Modal>

      {zonaAbierta && (
        <ZonaArticulosModal
          zona={zonaAbierta.zona}
          articulos={zonaAbierta.filas}
          onClose={() => setZonaAbierta(null)}
        />
      )}
    </>
  )
}
