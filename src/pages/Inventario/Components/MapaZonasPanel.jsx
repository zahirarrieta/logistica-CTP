import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MdMap, MdTableChart, MdRemove } from 'react-icons/md'
import ZonaArticulosModal from './ZonaArticulosModal.jsx'
import { AjustarVista, PinesZona } from './MapaZonasComun.jsx'
import { agruparZonas } from '../../../utils/mapaZonas.js'
import { colorZona } from '../../../utils/zonasColombia.js'
import { esBodegaC } from '../../../utils/inventarioUtils.js'

// Mapa incrustado en la página, al lado del card de filtros. Muestra un pin por
// zona (coloreado y con el número de artículos) y refleja los filtros activos.
// Al hacer clic en un pin abre el modal con los artículos de esa zona; el botón
// del recuadro abre el modal completo (pantalla completa) con la lista de zonas.
// La tabla de totales por zona (artículos y unidades, sin bodegas en C) flota
// dentro del mapa, debajo del botón, y se puede plegar para no tapar los pines.
export default function MapaZonasPanel({ filas, onAbrir }) {
  const [zonaAbierta, setZonaAbierta] = useState(null)
  const [tablaAbierta, setTablaAbierta] = useState(true)
  const { ubicables, puntos } = useMemo(() => agruparZonas(filas), [filas])

  // Totales por zona excluyendo las bodegas en C, tal como se pidió: el conteo
  // del mapa no debe sumar esas bodegas.
  const totales = useMemo(() => {
    const grupos = agruparZonas(filas.filter((f) => !esBodegaC(f.bodega))).grupos
    const articulos = grupos.reduce((s, g) => s + g.filas.length, 0)
    const unidades = grupos.reduce((s, g) => s + g.cantidad, 0)
    return { grupos, articulos, unidades }
  }, [filas])

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
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

          {/* Totales por zona flotando dentro del mapa, debajo del botón. Se
              puede plegar en una pastilla para dejar el mapa limpio de paneles
              y que nada tape los pines. */}
          <div className="absolute top-14 right-3 z-[1000] w-56 sm:w-64">
            {tablaAbierta ? (
              <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-brand-ink/20 bg-white">
                <div className="flex items-center justify-between gap-2 bg-brand-navy px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white min-w-0">
                    <MdTableChart className="text-brand-cyan text-sm shrink-0" />
                    <span className="truncate">Total por zonas</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setTablaAbierta(false)}
                    aria-label="Ocultar tabla de totales"
                    title="Ocultar la tabla para ver el mapa sin paneles"
                    className="grid place-items-center size-6 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  >
                    <MdRemove className="text-base" />
                  </button>
                </div>

                {totales.grupos.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs font-semibold text-brand-ink/50">
                    No hay artículos para los filtros activos.
                  </p>
                ) : (
                  <div className="max-h-44 sm:max-h-56 overflow-y-auto [scrollbar-width:thin]">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-brand-mist">
                        <tr>
                          <th className="px-2.5 py-1.5 text-left font-extrabold uppercase tracking-wide text-brand-deep border-b border-brand-ink/10">
                            Zona
                          </th>
                          <th className="px-2.5 py-1.5 text-right font-extrabold uppercase tracking-wide text-brand-deep border-b border-brand-ink/10 whitespace-nowrap">
                            Art.
                          </th>
                          <th className="px-2.5 py-1.5 text-right font-extrabold uppercase tracking-wide text-brand-deep border-b border-brand-ink/10 whitespace-nowrap">
                            Und.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {totales.grupos.map((g) => (
                          <tr
                            key={g.zona}
                            className="border-b border-brand-ink/5 hover:bg-brand-cyan/10 transition-colors"
                          >
                            <td className="px-2.5 py-1.5 font-semibold text-brand-ink">
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <span
                                  className="size-2.5 rounded-full shrink-0 ring-1 ring-white/40"
                                  style={{ backgroundColor: colorZona(g.zona) }}
                                />
                                <span className="truncate">{g.zona}</span>
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-brand-ink/80">
                              {g.filas.length.toLocaleString('es-CO')}
                            </td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-brand-ink/80">
                              {Math.round(g.cantidad).toLocaleString('es-CO')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-brand-cyan/15">
                          <td className="px-2.5 py-1.5 text-left font-extrabold uppercase tracking-wide text-brand-deep">
                            Total
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums font-extrabold text-brand-deep">
                            {totales.articulos.toLocaleString('es-CO')}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums font-extrabold text-brand-deep">
                            {Math.round(totales.unidades).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="bg-brand-mist/80 px-2.5 py-1 text-[9px] font-semibold text-brand-ink/50">
                  Sin bodegas en C (código terminado en C)
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTablaAbierta(true)}
                title="Ver el total de artículos y unidades por zona"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-navy text-white px-3 py-1.5 text-[11px] font-bold shadow-lg ring-1 ring-white/20 hover:bg-brand-deep transition"
              >
                <MdTableChart className="text-brand-cyan text-sm" />
                Total por zonas
              </button>
            )}
          </div>

          {ubicables.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-brand-ink/75 px-3 py-2 text-center text-[11px] sm:text-xs font-bold text-white">
              Ninguna zona con ubicación para los filtros activos
            </div>
          )}
        </div>
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
