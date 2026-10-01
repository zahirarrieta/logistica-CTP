'use strict'

// ============================================================================
// ALMACENAMIENTO DE ARCHIVOS
// Todo archivo del sistema vive aquí, en disco, bajo server/storage/evidencias:
// los adjuntos de la solicitud (facturas y remisiones) y la evidencia de la
// entrega.
//
// Antes estos archivos iban a dos sitios: los buckets privados de Supabase Storage
// ('adjuntos' y 'evidencias') y, como respaldo, OneDrive/SharePoint. Ya no hay
// ninguno de los dos; el nombre del endpoint conserva la palabra "evidencia" por
// compatibilidad con las URLs ya firmadas que el navegador tiene en caché.
//
// Rutas firmadas: /api/archivos/firmar devuelve URLs con HMAC y caducidad
// (24 h, el mismo EXPIRA_EVIDENCIA del frontend), de modo que un <img src> los
// pueda cargar sin cabeceras. Es el equivalente de createSignedUrls, y con él una
// ruta de la base no se puede usar como enlace permanente: se puede ver hoy y
// mañana hay que pedirla de nuevo.
// ============================================================================

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const config = require('./config')

const BASE = path.join(__dirname, '..', 'storage')
const RAIZ_EVIDENCIAS = path.join(BASE, 'evidencias')

// El secreto llega validado desde config.js: en producción es obligatorio y ahí
// ya se lance si falta. En desarrollo, si no se definió, se genera uno temporal.
const SECRETO = config.firma.secreto || crypto.randomBytes(32).toString('hex')
const CADUCIDAD_SEG = config.firma.ttl
const LIMITE_BYTES = config.firma.maxBytes

function asegurarCarpeta() {
  fs.mkdirSync(RAIZ_EVIDENCIAS, { recursive: true })
}
asegurarCarpeta()

// Impide salir de la carpeta de evidencias (.. o rutas absolutas).
function rutaSegura(ruta) {
  const limpio = String(ruta || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const destino = path.resolve(RAIZ_EVIDENCIAS, limpio)
  const base = path.resolve(RAIZ_EVIDENCIAS)
  if (destino !== base && !destino.startsWith(base + path.sep)) return null
  return destino
}

function firmaDe(ruta, expira) {
  return crypto
    .createHmac('sha256', SECRETO)
    .update(`${ruta}|${expira}`)
    .digest('hex')
}

// Genera la URL firmada que reemplaza a createSignedUrls.
function urlFirmada(ruta, baseUrl, segundos = CADUCIDAD_SEG) {
  const expira = Math.floor(Date.now() / 1000) + segundos
  const firma = firmaDe(ruta, expira)
  const params = new URLSearchParams({ ruta, exp: String(expira), firma })
  return `${baseUrl.replace(/\/+$/, '')}/api/archivos/ver?${params.toString()}`
}

function verificarFirma(ruta, expira, firma) {
  const t = Number(expira)
  if (!Number.isFinite(t) || t * 1000 < Date.now()) return false
  const esperada = firmaDe(ruta, t)
  const a = Buffer.from(String(firma || ''))
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Guarda el buffer y devuelve la ruta relativa (lo que se persiste en la base,
// igual que antes). `carpetas` puede traer varios niveles separados por '/',
// p.ej. "Juan Perez/CTPLOG-00001/FacturasoRemisiones": cada segmento se sanea
// por separado para conservar la estructura real de carpetas (usuario →
// solicitud → tipo de documento) en vez de aplanarla. Un segmento que sea '.' o
// '..' se descarta, así que un código manipulado no puede escalar directorios;
// rutaSegura queda además como red de seguridad.
function guardar(carpetas, nombre, buffer) {
  const segmentos = String(carpetas || '')
    .split('/')
    .map(segmentoSeguro)
    .filter(Boolean)
  if (segmentos.length === 0) segmentos.push('solicitudes')
  const destinoRel = [...segmentos, sanitizar(nombre)].join('/')
  const destinoAbs = rutaSegura(destinoRel)
  if (!destinoAbs) throw new Error('Ruta de archivo no válida')
  fs.mkdirSync(path.dirname(destinoAbs), { recursive: true })
  fs.writeFileSync(destinoAbs, buffer)
  return destinoRel
}

// Sanea un segmento de carpeta y neutraliza '.'/'..' para que no haya salto de
// directorio. Devuelve '' si el segmento no aporta nada (se filtra arriba).
function segmentoSeguro(segmento) {
  const limpio = sanitizar(segmento)
  if (!limpio || limpio === '.' || limpio === '..') return ''
  return limpio
}

// Un solo segmento: quita separadores y caracteres problemáticos. El nombre lo
// genera el backend ({id}_{indice}.{ext}), no el usuario, pero se sanea igual.
function sanitizar(segmento) {
  return String(segmento || '')
    // Los caracteres de control se eliminan a propósito: un nombre con \0 o un
    // salto de línea rompería la escritura en disco.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180)
}

// Crea la carpeta de una solicitud sin dejar ningún archivo dentro. Es lo que
// permite que una solicitud 'administrativa' —donde el adjunto es opcional—
// tenga su carpeta desde el primer momento, en vez de aparecer en el disco solo
// si alguien llega a subir un documento.
//
// Es idempotente: mkdirSync con recursive:true no falla si ya existe, así que se
// puede llamar en cada alta sin comprobar nada antes. Si la carpeta ya existe,
// simplemente se queda como está, que es justo lo que se pidió: no se toca lo que
// hubiera.
//
// Devuelve la ruta relativa ({usuario}/{codigo}) o null si la ruta no es válida.
// Igual que segmentoSeguro, pero además descarta cualquier segmento que EMPIECE
// por '..'. archivo.guardar solo descarta el '..' exacto porque sus nombres los
// genera el backend; aquí la carpeta viene del nombre del usuario, que sí es
// texto elegido por una persona, y '..' seguido de algo tampoco puede ser un
// nombre de carpeta legítimo. Se rechaza en vez de confiar en rutaSegura para que
// un nombre hostil no acabe creando una carpeta llamada '.env' dentro de
// evidencias.
function segmentoDeCarpeta(segmento) {
  const limpio = segmentoSeguro(segmento)
  if (!limpio || limpio.startsWith('..')) return ''
  return limpio
}

function crearCarpeta(carpetas) {
  const segmentos = String(carpetas || '')
    .split('/')
    .map(segmentoDeCarpeta)
    .filter(Boolean)
  if (segmentos.length === 0) return null
  const destinoRel = segmentos.join('/')
  const destinoAbs = rutaSegura(destinoRel)
  if (!destinoAbs) return null
  fs.mkdirSync(destinoAbs, { recursive: true })
  return destinoRel
}

function existe(ruta) {
  const destino = rutaSegura(ruta)
  if (!destino) return false
  try {
    return fs.statSync(destino).isFile()
  } catch {
    return false
  }
}

module.exports = {
  BASE,
  RAIZ_EVIDENCIAS,
  LIMITE_BYTES,
  guardar,
  crearCarpeta,
  existe,
  sanitizar,
  urlFirmada,
  verificarFirma,
  rutaSegura,
}
