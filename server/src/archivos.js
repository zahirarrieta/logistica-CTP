'use strict'

// ============================================================================
// ALMACENAMIENTO DE ARCHIVOS
// Reemplaza los buckets privados de Supabase Storage ('adjuntos' y
// 'evidencias') por archivos en disco bajo server/storage/evidencias.
//
// La app solo escribe aquí en el flujo de RESPALDO: los adjuntos de la
// solicitud y la evidencia de la entrega suben primero a OneDrive/SharePoint
// (oneDriveApi.js) y solo caen aquí si Microsoft falla. Las evidencias que sí
// se guardan son imágenes/PDF de la entrega.
//
// Rutas firmadas: /api/archivos/firmar devuelve URLs con HMAC y caducidad
// (24 h, el mismo EXPIRA_EVIDENCIA del frontend), de modo que un <img src> los
// pueda cargar sin cabeceras. Es el equivalente de createSignedUrls.
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

// Guarda el buffer y devuelve la ruta relativa dentro del bucket (lo que se
// persiste en historial.evidencia_url, igual que antes).
function guardar(codigo, nombre, buffer) {
  const destinoRel = path
    .join(sanitizar(codigo || 'solicitudes'), sanitizar(nombre))
    .replace(/\\/g, '/')
  const destinoAbs = rutaSegura(destinoRel)
  if (!destinoAbs) throw new Error('Ruta de archivo no válida')
  fs.mkdirSync(path.dirname(destinoAbs), { recursive: true })
  fs.writeFileSync(destinoAbs, buffer)
  return destinoRel
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
  existe,
  sanitizar,
  urlFirmada,
  verificarFirma,
  rutaSegura,
}
