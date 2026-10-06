import { apiFetch, apiPost } from './apiClient.js'

// ============================================================================
// ARCHIVOS
// Sube adjuntos, facturas y evidencias al backend, que los guarda en disco y
// devuelve rutas firmadas de 24 h para poder verlos.
//
// Antes esto vivía en OneDrive/SharePoint y se subía con un token de Microsoft
// Graph. Con la sesión propia ya no hay token de Graph, así que TODOS los
// archivos pasan por el backend. Un solo camino para todo también elimina la
// doble lógica que había antes: la evidencia primero probaba con OneDrive y solo
// caía al backend si Microsoft fallaba.
//
// Estructura de las rutas dentro de storage/evidencias:
//
//   CTPLOG-00001/factura_1a2b3c_avance.pdf          ← factura o remisión
//   CTPLOG-00001/factura_1a2b3c_remision.pdf
//   CTPLOG-00001/adj_1a2b3c_orden.pdf                ← adjunto de la solicitud
//   CTPLOG-00001/DocEntregas/evi_1a2b3c.jpg          ← evidencia de la entrega
//
// La subcarpeta NO es decorativa: src/utils/pdfUtils.js distingue las facturas de
// los adjuntos mirando '/FacturasoRemisiones/' en la ruta, igual que hacía con
// las URL de OneDrive. Cambiar el nombre de la carpeta rompe esa separación y
// hace que las facturas aparezcan como adjuntos de la solicitud.
//
// Lo que se guarda en la base es la RUTA, no una URL. Una URL firmada caduca a
// las 24 h, así que persistirla dejaría todos los archivos rotos al día
// siguiente. Las rutas se firman al descargar (ver descargarSolicitudes).
// ============================================================================

const CARPETA_FACTURAS = 'FacturasoRemisiones'
const CARPETA_ENTREGAS = 'DocEntregas'

// Sufijo único por archivo. Sin esto, dos PDFs con el mismo nombre en la misma
// solicitud se pisarían en el servidor: la ruta es {codigo}/{nombre} y el
// nombre lo manda el cliente. Se antepone una marca de tiempo en base36 (más
// corta y ordenable que los milisegundos en decimal) y un fragmento aleatorio
// para el caso de dos subidas en el mismo milisegundo.
function marcaUnica() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// Nombre destino: {prefijo}_{marca}_{nombre original}. Se conserva el nombre
// original porque es lo que ve el usuario en la lista de adjuntos y en el
// explorador al descargar.
//
// El recorte a 140 es para que el nombre COMPLETO quepa en los 180 caracteres que
// acepta el servidor (server/src/archivos.js). Si se dejara más, el servidor
// cortaría por el final y se perdería la extensión, que es justo lo que dice el
// visor si el archivo es un PDF.
function nombreEnDisco(prefijo, nombreOriginal) {
  const base = String(nombreOriginal || 'archivo')
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140)
  return `${prefijo}_${marcaUnica()}_${base}`
}

// Sube un archivo al backend. `carpeta` es opcional y va DENTRO de la carpeta de
// la solicitud ('FacturasoRemisiones', 'DocEntregas').
//
// El Content-Type NO se pone a mano: apiFetch lo deja fuera cuando el cuerpo es
// FormData, para que el navegador lo ponga con su propio boundary. Si se
// forzara aquí con un boundary inventado, el servidor no reconocería el archivo.
async function subir(codigo, carpeta, nombreDestino, blob) {
  const cuerpo = new FormData()
  cuerpo.append('archivo', blob, nombreDestino)
  cuerpo.append('codigo', carpeta ? `${codigo}/${carpeta}` : String(codigo))
  cuerpo.append('nombre', nombreDestino)
  const { ruta } = await apiFetch('/api/archivos/evidencia', { method: 'POST', body: cuerpo })
  if (!ruta) throw new Error('El servidor no devolvió la ruta del archivo subido')
  return ruta
}

// ---------------------------------------------------------------------------
// Adjuntos de la solicitud
// ---------------------------------------------------------------------------
// Devuelve [{ nombre, ruta, url, tamaño, tipo }]. `url` es la RUTA, no un enlace:
// quien llama la mete en la base y se firmará al descargar.
export async function subirAdjuntos(archivos, codigo, onProgreso = null) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const total = archivos.length
  let listos = 0

  const resultados = await Promise.all(
    archivos.map(async (archivo) => {
      const nombre = nombreEnDisco('adj', archivo.name)
      const ruta = await subir(codigo, '', nombre, archivo)
      listos += 1
      if (onProgreso) onProgreso(listos, total)
      console.info(`[Archivos] adjunto subido → ${ruta}`)
      return { nombre: archivo.name, ruta, url: ruta, tamaño: archivo.size, tipo: archivo.type }
    })
  )

  return resultados
}

// ---------------------------------------------------------------------------
// Facturas y remisiones (las del estado «En Trámite»)
// ---------------------------------------------------------------------------
// El número de factura se antepone al nombre como antes se hacía en OneDrive:
// es lo que permite reconocer el documento en el disco sin abrir la base.
export async function subirFacturasRemisiones(archivos, numeroFactura, codigo) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const numero = String(numeroFactura || '').trim() || 'SinNumero'
  const resultados = []
  for (const archivo of archivos) {
    const nombre = nombreEnDisco('factura', `${numero}_${archivo.name}`)
    const ruta = await subir(codigo, CARPETA_FACTURAS, nombre, archivo)
    resultados.push({ nombre, ruta, url: ruta, cantidadBytes: archivo.size, tipo: archivo.type })
    console.info(`[Archivos] factura/remisión subida → ${ruta}`)
  }
  return resultados
}

// ---------------------------------------------------------------------------
// Evidencia de la entrega (foto o PDF que manda el conductor)
// ---------------------------------------------------------------------------
export async function subirEvidenciaEntrega(blob, referencia, codigo) {
  if (!blob) return null

  const base = String(referencia || '').trim() || 'SinReferencia'
  const tipo = blob.type || ''
  const extension = tipo.includes('pdf') ? 'pdf' : tipo.includes('png') ? 'png' : 'jpg'
  const nombre = nombreEnDisco('evi', `${base}.${extension}`)

  const ruta = await subir(codigo, CARPETA_ENTREGAS, nombre, blob)
  console.info(`[Archivos] evidencia de entrega subida → ${ruta}`)
  return { nombre, ruta, url: ruta }
}

// ---------------------------------------------------------------------------
// Firma bajo demanda
// ---------------------------------------------------------------------------
// El store guarda el `adjunto` del historial como RUTA cruda en la misma sesión
// en que se sube (solo se firma al re-descargar las solicitudes). Si el visor
// recibe esa ruta cruda, el <iframe> la resuelve contra el origen del frontend y
// no carga nada. Estos helpers firman una ruta suelta en el momento, devolviendo
// la URL absoluta de 24 h del backend.

// Firma varias rutas y devuelve el mapa { ruta: urlFirmada }. Las que el backend
// descarta (no existen o no son visibles) simplemente no vienen en el mapa.
export async function firmarRutas(rutas) {
  const limpias = [
    ...new Set(
      (Array.isArray(rutas) ? rutas : [])
        .map((r) => String(r || '').trim())
        .filter((r) => r && !/^https?:\/\//i.test(r) && !/^data:/i.test(r) && !/^blob:/i.test(r))
    ),
  ]
  if (limpias.length === 0) return {}
  try {
    const mapa = await apiPost('/api/archivos/firmar', { rutas: limpias })
    return mapa || {}
  } catch (error) {
    console.warn('[Archivos] no se pudo firmar bajo demanda:', error?.message)
    return {}
  }
}

// Firma una sola ruta. Devuelve la URL firmada o null si el backend no la firmó.
export async function firmarRuta(ruta) {
  const mapa = await firmarRutas([ruta])
  return mapa[String(ruta).trim()] || null
}

// ---------------------------------------------------------------------------
// Borrado de una factura/remisión del trámite
// ---------------------------------------------------------------------------
// El store guarda el `adjunto` como ruta al subirlo, pero al re-descargar las
// solicitudes lo guarda ya firmado; el backend acepta las dos formas, así que
// aquí no hace falta convertir nada: se manda lo que haya.
export async function borrarArchivo(ruta) {
  const valor = String(ruta || '').trim()
  if (!valor) throw new Error('No hay archivo que borrar')
  const datos = await apiPost('/api/archivos/borrar', { ruta: valor })
  console.info(`[Archivos] factura/remisión borrada → ${valor}`)
  return datos
}
