import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MdClose, MdInventory2, MdOutlinePlace } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
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
  return L.divIcon({ html, className: 'pin-zona', iconSize: [46, 58], iconAnchor: [23, 58], popupAnchor: [0, -52] })
}

// Ajusta el encuadre del mapa a los pines y recalcula el tamaño (el mapa nace
// dentro de un modal; sin esto a veces sale con tiles a medias).
function AjustarVista({ puntos }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])

  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      map.setView(puntos[0], 9)
      return
    }
    map.fitBounds(L.latLngBounds(puntos), { padding: [48, 48] })
  }, [map, puntos])

  return null
}

export default function MapaZonasModal({ open, onClose, filas }) {
  const grupos = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      const zona = String(f.zona ?? '').trim() || 'Sin zona'
      const g = m.get(zona) || { zona, articulos: 0, cantidad: 0 }
      g.articulos += 1
      const n = Number(String(f.cantidad ?? '').replace(/\./g, '').replace(',', '.'))
      g.cantidad += Number.isFinite(n) ? n : 0
      m.set(zona, g)
    }
    return [...m.values()].sort((a, b) => b.articulos - a.articulos)
  }, [filas])

  const ubicables = useMemo(
    () =>
      grupos
        .map((g) => ({ ...g, coords: coordenadasZona(g.zona) }))
        .filter((g) => g.coords),
    [grupos]
  )
  const sinUbicar = useMemo(
    () => grupos.filter((g) => !coordenadasZona(g.zona)),
    [grupos]
  )
  const puntos = useMemo(() => ubicables.map((g) => [g.coords.lat, g.coords.lng]), [ubicables])

  if (!open) return null

  const totalArticulos = grupos.reduce((s, g) => s + g.articulos, 0)

  return (
    <Modal onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-mapa-zonas"
        className="relative bg-white text-brand-ink w-full max-w-5xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Encabezado */}
        <div className="relative overflow-hidden px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <MdOutlinePlace className="pointer-events-none absolute -right-3 -bottom-7 text-[6rem] text-white/10" />
          <h3
            id="titulo-mapa-zonas"
            className="relative text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdOutlinePlace className="text-brand-cyan text-lg" />
            </span>
            Artículos por zona
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="relative grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition shrink-0"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <p className="text-xs font-bold text-brand-ink/60">
            {totalArticulos.toLocaleString('es-CO')} artículo{totalArticulos === 1 ? '' : 's'} en{' '}
            {grupos.length} zona{grupos.length === 1 ? '' : 's'}
            {sinUbicar.length > 0 && ' · refleja los filtros activos'}
          </p>

          {/* Mapa */}
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-brand-ink/10 shadow-sm">
            <MapContainer
              center={[4.6, -74.1]}
              zoom={6}
              minZoom={5}
              maxZoom={18}
              maxBounds={[[-4.5, -79.5], [13.5, -66.5]]}
              maxBoundsViscosity={1.0}
              scrollWheelZoom
              style={{ height: '58vh', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AjustarVista puntos={puntos} />
              {ubicables.map((g) => (
                <Marker key={g.zona} position={[g.coords.lat, g.coords.lng]} icon={iconoPin(g.zona, g.articulos)}>
                  <Popup>
                    <span className="block text-sm font-extrabold text-brand-ink">{g.zona}</span>
                    <span className="block text-xs text-brand-ink/70">
                      {g.articulos.toLocaleString('es-CO')} artículo{g.articulos === 1 ? '' : 's'}
                    </span>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Leyenda de zonas */}
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-ink/45">
              <MdInventory2 className="text-brand-cyan text-sm" />
              Zonas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {grupos.map((g) => (
                <div
                  key={g.zona}
                  className="flex items-center gap-2 rounded-xl bg-brand-ink/[0.04] ring-1 ring-brand-ink/10 px-3 py-2"
                >
                  <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: colorZona(g.zona) }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-brand-ink" title={g.zona}>
                    {g.zona}
                  </span>
                  <span className="rounded-full bg-brand-navy text-white text-xs font-extrabold px-2 py-0.5 tabular-nums">
                    {g.articulos.toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
            {sinUbicar.length > 0 && (
              <p className="mt-2 text-[11px] font-semibold text-brand-ink/45">
                Sin ubicación conocida (no se pintan en el mapa):{' '}
                {sinUbicar.map((g) => g.zona).join(', ')}.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold bg-brand-navy text-white hover:bg-brand-deep transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
