// ============================================================================
// TIPO DE ARCHIVO A PARTIR DE SU DIRECCIÓN
// Sirve para saber si una URL es una imagen, un PDF o una hoja de cálculo.
//
// El backend no guarda URLs: guarda la RUTA del archivo y la firma al
// descargarla, así que lo que llega a la app es una dirección con la ruta dentro
// del query:
//
//   /api/archivos/ver?ruta=CTPLOG-00001%2Fadj_abc_foto.jpg&exp=1790000000&firma=9f2a
//
// O sea, la extensión va seguida de «&». Un patrón que solo admita «?», «#» o el
// final de la cadena NO la reconoce: el archivo se tomaba por otro tipo y las
// fotos salían como un simple enlace «Abrir», sin vista previa. Por eso todo
// pasa por aquí y no por regex sueltos en cada componente.
// ============================================================================

// La ruta firmada viaja en el parámetro «ruta». Se captura hasta el primer «&».
const RUTA_EN_QUERY = /[?&]ruta=([^&]+)/i

// data:image/jpeg;base64,… → lo que importa está en la cabecera, no en el nombre.
const MIME_DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+)/i

// Devuelve la extensión en minúsculas, sin punto, o '' si no se deduce.
// Cubre las tres formas que llegan a la app: URL firmada, ruta cruda del backend
// y data URL de un archivo que aún no se ha subido.
export function extensionDe(url) {
  const s = String(url || '')
  if (!s) return ''

  if (/^data:/i.test(s)) {
    const tipo = (MIME_DATA_URL.exec(s) || [])[1] || ''
    const subtipo = (tipo.split('/')[1] || '').split('+')[0]
    return subtipo.toLowerCase()
  }

  // La ruta real está en el query si viene firmada; si no, es el pathname (o la
  // propia ruta cruda, que no es una URL válida y se deja tal cual).
  let ruta = s
  const enQuery = RUTA_EN_QUERY.exec(s)
  if (enQuery) {
    try {
      ruta = decodeURIComponent(enQuery[1])
    } catch {
      // Si el porcentaje está mal formado se usa la cadena sin decodificar: peor
      // que no tener la extensión, pero no rompe nada.
      ruta = enQuery[1]
    }
  } else {
    try {
      ruta = new URL(s, 'http://x').pathname
    } catch {
      // No es una URL: se prueba con la cadena completa.
    }
  }

  const nombre = ruta.split('?')[0].split('#')[0].split('/').pop() || ''
  const punto = nombre.lastIndexOf('.')
  return punto > 0 ? nombre.slice(punto + 1).toLowerCase() : ''
}

// heic/avif se incluyen porque las fotos de un iPhone las baja el navegador con
// esas extensiones aunque el equipo las tenga como .jpg.
const EXT_IMAGEN = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'])
const EXT_EXCEL = new Set(['xls', 'xlsx'])

export function esImagenUrl(url) {
  return EXT_IMAGEN.has(extensionDe(url))
}

export function esExcelUrl(url) {
  return EXT_EXCEL.has(extensionDe(url))
}