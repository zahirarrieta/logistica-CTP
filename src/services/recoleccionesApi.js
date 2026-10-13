import { apiFetch, apiGet, apiPut, iniciarSesion } from './apiClient.js'
import { firmarRutas } from './archivosApi.js'

// ============================================================================
// RECOLECCIONES
// Módulo hermano del de solicitudes, con su propia secuencia (Rec-00001) y su
// propio ciclo de vida. El alta manda los adjuntos en la MISMA petición (el
// código lo genera el servidor), así que no hay reserva previa ni subida
// separada: se arma un FormData con los campos y hasta 3 archivos.
//
// Las filas viajan con los nombres de columna del backend (snake_case); el
// módulo es nuevo, así que no arrastra la traducción a camelCase que sí tienen
// las solicitudes por compatibilidad histórica.
// ============================================================================

// Descarga todas las recolecciones visibles para el usuario y firma sus
// adjuntos (rutas → URLs de 24 h) para poder verlos sin cabecera Authorization.
export async function descargarRecolecciones() {
  await iniciarSesion()
  const filas = (await apiFetch('/api/recolecciones')) || []

  const rutas = [
    ...new Set(
      filas
        .flatMap((f) => (Array.isArray(f.adjuntos) ? f.adjuntos : []))
        .map((r) => String(r || '').trim())
        .filter((r) => r && !/^https?:\/\//i.test(r))
    ),
  ]
  let firmadas = {}
  if (rutas.length > 0) {
    firmadas = await firmarRutas(rutas)
  }

  console.info(`[API] descargadas ${filas.length} recolección(es)`)
  return filas.map((f) => ({
    ...f,
    adjuntos: (Array.isArray(f.adjuntos) ? f.adjuntos : []).map((r) => firmadas[r] || r),
  }))
}

// Próximo código sin consumirlo (solo para mostrarlo en el formulario).
export async function peekCodigoRecoleccion() {
  await iniciarSesion()
  try {
    const { codigo } = await apiGet('/api/recolecciones/siguiente')
    return codigo || null
  } catch {
    return null
  }
}

// Alta con adjuntos. `datos` lleva las columnas del formulario; `archivos` es un
// array de File (máx. 3). Devuelve { ok, codigo, adjuntos }.
export async function crearRecoleccion(datos, archivos = []) {
  await iniciarSesion()
  const cuerpo = new FormData()
  for (const [clave, valor] of Object.entries(datos || {})) {
    if (valor === undefined || valor === null) continue
    if (clave === 'adjuntos') continue
    cuerpo.append(clave, String(valor))
  }
  for (const archivo of archivos.slice(0, 3)) {
    cuerpo.append('archivos', archivo, archivo.name)
  }
  const data = await apiFetch('/api/recolecciones', { method: 'POST', body: cuerpo })
  console.info(`[API] recolección creada: ${data?.codigo}`)
  return data
}

// Actualiza solo los campos enviados (p. ej. { estado: 'Trámite' }). Un cambio
// de estado no toca el resto de los datos.
export async function actualizarRecoleccion(codigo, cambios) {
  await iniciarSesion()
  await apiPut(`/api/recolecciones/${encodeURIComponent(codigo)}`, cambios)
  console.info(`[API] recolección ${codigo} actualizada`)
  return true
}
