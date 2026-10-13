import { useEffect } from 'react'
import { Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { crearIconoPin } from '../../../utils/mapaZonas.js'

// Ajusta el encuadre del mapa a los pines y recalcula el tamaño (el mapa puede
// nacer dentro de un modal o de un recuadro en la página; sin esto a veces sale
// con los tiles a medias).
export function AjustarVista({ puntos }) {
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

// Pines de cada zona: al hacer clic abren el modal con los artículos de esa zona
// (onZona); al pasar el mouse muestran un globo con el resumen.
export function PinesZona({ ubicables, onZona }) {
  return ubicables.map((g) => (
    <Marker
      key={g.zona}
      position={[g.coords.lat, g.coords.lng]}
      icon={crearIconoPin(g.zona, g.filas.length)}
      eventHandlers={{ click: () => onZona(g) }}
    >
      <Tooltip direction="auto" opacity={1}>
        <span className="block font-extrabold text-brand-ink">{g.zona}</span>
        <span className="block text-[11px] font-semibold text-brand-ink/70">
          {g.filas.length.toLocaleString('es-CO')} artículo{g.filas.length === 1 ? '' : 's'} ·{' '}
          {g.cantidad.toLocaleString('es-CO')} unidades
        </span>
        <span className="block text-[11px] font-bold text-brand-deep">Clic para ver artículos</span>
      </Tooltip>
    </Marker>
  ))
}
