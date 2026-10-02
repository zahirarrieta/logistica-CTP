import { useCallback, useEffect, useState } from 'react'

// Versión con la que se construyó ESTE bundle. La inyecta vite.config.js desde
// public/version.json (única fuente de verdad). Si el version.json que sirve el
// servidor trae otra versión, es que se publicó una actualización y hay que
// avisar al usuario para que recargue.
const VERSION_ACTUAL = import.meta.env.VITE_APP_VERSION || ''

// Cada cuánto se pregunta al servidor si hay una versión nueva. 60 s es de sobra:
// un deploy no es urgente al segundo y así no se castiga la red.
const INTERVALO_MS = 60_000

// Cuánto se silencia el aviso cuando el usuario pulsa «Más tarde».
const POSPONER_MS = 5 * 60_000

// Trae el version.json vivo del servidor. cache:'no-store' + el SW que nunca lo
// cachea garantizan que se compare contra lo último publicado, no contra una
// copia vieja del navegador.
async function consultarVersion() {
  const resp = await fetch('/version.json', { cache: 'no-store' })
  if (!resp.ok) return null
  return resp.json()
}

// Devuelve { disponible, info, posponer }. `disponible` es true cuando el
// servidor tiene una versión distinta a la cargada y el aviso no está pospuesto;
// `info` trae { version, fecha, cambios } para pintarlos en el modal.
export default function useNuevaVersion() {
  const [info, setInfo] = useState(null)
  // Marca de tiempo hasta la que se silenció el aviso (0 = sin posponer).
  const [pospuestoHasta, setPospuestoHasta] = useState(0)

  useEffect(() => {
    let activo = true

    const comprobar = async () => {
      try {
        const datos = await consultarVersion()
        if (!activo || !datos || !datos.version) return
        // Misma versión que el bundle: nada que avisar.
        if (datos.version === VERSION_ACTUAL) {
          setInfo(null)
          return
        }
        setInfo(datos)
      } catch {
        // Sin red o archivo ausente: se ignora y se reintenta en el próximo ciclo.
      }
    }

    comprobar()
    const id = setInterval(comprobar, INTERVALO_MS)
    return () => {
      activo = false
      clearInterval(id)
    }
  }, [])

  // Al vencer el aplazamiento se limpia la marca, lo que re-evalúa `disponible` y
  // hace reaparecer el aviso.
  useEffect(() => {
    if (!pospuestoHasta) return undefined
    const falta = pospuestoHasta - Date.now()
    if (falta <= 0) return undefined
    const id = setTimeout(() => setPospuestoHasta(0), falta)
    return () => clearTimeout(id)
  }, [pospuestoHasta])

  const posponer = useCallback(() => {
    setPospuestoHasta(Date.now() + POSPONER_MS)
  }, [])

  const pospuesto = pospuestoHasta > 0 && Date.now() < pospuestoHasta
  const disponible = Boolean(info) && !pospuesto

  return { disponible, info, posponer }
}
