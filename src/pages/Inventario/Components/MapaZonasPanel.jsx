import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MdMap } from 'react-icons/md'
import ZonaArticulosModal from './ZonaArticulosModal.jsx'
import { AjustarVista, PinesZona } from './MapaZonasComun.jsx'
import { agruparZonas } from '../../../utils/mapaZonas.js'

// Mapa incrustado en la página, al lado del card de filtros. Muestra un pin por
// zona (coloreado y con el número de artículos) y refleja los filtros activos.
// Al hacer clic en un pin abre el modal con los artículos de esa zona; el botón
// del recuadro abre el modal completo (pantalla completa) con la lista de zonas.
export default function MapaZonasPanel({ filas, onAbrir }) {
  const [zonaAbierta, setZonaAbierta] = useState(null)
  const { ubicables, puntos } = useMemo(() => agruparZonas(filas), [filas])

  return (
    <>
      <div className="relative flex-1 min-h-[340px] rounded-2xl overflow-hidden ring-1 ring-brand-ink/10 bg-brand-ink/5">
        <MapContainer
          center={[4.6, -74.1]}
          zoom={6}
          minZoom={5}
          maxZoom={18}
          maxBounds={[[-4.3, -79.1], [12.6, -66.8]]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjustarVista puntos={puntos} />
          <PinesZona ubicables={ubicables} onZona={setZonaAbierta} />
        </MapContainer>

        {/* Botón dentro del recuadro del mapa: abre el modal completo */}
        <button
          type="button"
          onClick={onAbrir}
          className="absolute top-3 right-3 z-[1000] inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold shadow-lg ring-1 ring-white/20 hover:bg-brand-deep transition"
        >
          <MdMap className="text-base" />
          Ver artículos en el mapa
        </button>

        {ubicables.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-brand-ink/75 px-3 py-2 text-center text-[11px] sm:text-xs font-bold text-white">
            Ninguna zona con ubicación para los filtros activos
          </div>
        )}
      </div>

      {zonaAbierta &&
        createPortal(
          <ZonaArticulosModal
            zona={zonaAbierta.zona}
            articulos={zonaAbierta.filas}
            onClose={() => setZonaAbierta(null)}
          />,
          document.body
        )}
    </>
  )
}
