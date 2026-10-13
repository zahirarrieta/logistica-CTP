import L from 'leaflet'
import { colorZona, coordenadasZona } from './zonasColombia.js'

// Ícono de temperatura (FaTemperatureHigh) como SVG incrustado: los pines de
// Leaflet se construyen con `divIcon` a partir de un HTML, no de un componente
// de React, así que el trazo va aquí en texto.
const PATH_TERMOMETRO =
  'M416 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm0 128A96 96 0 1 0 416 0a96 96 0 1 0 0 192zM96 112c0-26.5 21.5-48 48-48s48 21.5 48 48V276.5c0 17.3 7.1 31.9 15.3 42.5C217.8 332.6 224 349.5 224 368c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-18.5 6.2-35.4 16.7-48.9C88.9 308.4 96 293.8 96 276.5V112zM144 0C82.1 0 32 50.2 32 112V276.5c0 .1-.1 .3-.2 .6c-.2 .6-.8 1.6-1.7 2.8C11.2 304.2 0 334.8 0 368c0 79.5 64.5 144 144 144s144-64.5 144-144c0-33.2-11.2-63.8-30.1-88.1c-.9-1.2-1.5-2.2-1.7-2.8c-.1-.3-.2-.5-.2-.6V112C256 50.2 205.9 0 144 0zm0 416c26.5 0 48-21.5 48-48c0-20.9-13.4-38.7-32-45.3V112c0-8.8-7.2-16-16-16s-16 7.2-16 16V322.7c-18.6 6.6-32 24.4-32 45.3c0 26.5 21.5 48 48 48z'
const SVG_TERMOMETRO =
  `<svg viewBox="0 0 512 512" width="14" height="14" fill="currentColor" style="display:block">` +
  `<path d="${PATH_TERMOMETRO}"></path>` +
  '</svg>'

// Pin del mapa: el ícono de temperatura con el número de artículos de la zona,
// coloreado según la zona.
export function crearIconoPin(zona, n) {
  const color = colorZona(zona)
  const html = `
    <div style="position:relative;width:46px;height:58px">
      <div style="position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;">
        ${SVG_TERMOMETRO}
        <span style="font-size:12px;font-weight:800;line-height:1;margin-top:1px">${n}</span>
      </div>
      <div style="position:absolute;left:50%;bottom:0;width:14px;height:14px;background:${color};border-left:2px solid #fff;border-bottom:2px solid #fff;transform:translate(-50%,-2px) rotate(-45deg);"></div>
    </div>`
  return L.divIcon({ html, className: 'pin-zona', iconSize: [46, 58], iconAnchor: [23, 58] })
}

// Agrupa las filas por zona (usando el campo «zona») y resuelve las coordenadas
// de cada una. Devuelve también las zonas ubicables y los puntos para encuadrar
// el mapa. Lo comparten el mapa de la página y el modal de pantalla completa.
export function agruparZonas(filas) {
  const m = new Map()
  for (const f of filas) {
    const zona = String(f.zona ?? '').trim() || 'Sin zona'
    const g = m.get(zona) || { zona, filas: [], cantidad: 0 }
    g.filas.push(f)
    const n = Number(String(f.cantidad ?? '').replace(/\./g, '').replace(',', '.'))
    g.cantidad += Number.isFinite(n) ? n : 0
    m.set(zona, g)
  }
  const grupos = [...m.values()].sort((a, b) => b.filas.length - a.filas.length)
  const gruposConCoords = grupos.map((g) => ({ ...g, coords: coordenadasZona(g.zona) }))
  const ubicables = gruposConCoords.filter((g) => g.coords)
  const puntos = ubicables.map((g) => [g.coords.lat, g.coords.lng])
  return { grupos, gruposConCoords, ubicables, puntos }
}
