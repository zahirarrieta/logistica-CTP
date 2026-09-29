'use strict'

// ============================================================================
// CONFIGURACIÓN
// Lee y valida las variables de entorno en un solo lugar, antes de que arranque
// nada. Si falta algo se listing TODO lo que falta de una vez, en vez de fallar
// por el primer módulo que se topa con un undefined.
//
// En cPanel estas variables se definen en Setup Node.js App > Environment
// variables (no en un .env: el panel las inyecta al arrancar Passenger).
// ============================================================================

const esProduccion = process.env.NODE_ENV === 'production'

// Node no lee solo los .env (hasta la v20.6, y con --env-file). Para que
// `server/.env` sirva de algo en desarrollo, se carga aquí a mano, ANTES de
// leer cualquier variable. En producción no se toca: en el hosting las
// inyecta el panel y no hay ningún .env en el disco.
//
// Formato: LLAVE=valor, # para comentarios. Sin comillas, sin expansión.
if (!esProduccion) {
  const rutaEnv = require('path').join(__dirname, '..', '.env')
  try {
    const { readFileSync } = require('fs')
    for (const linea of readFileSync(rutaEnv, 'utf8').split('\n')) {
      const limpia = linea.replace(/\r$/, '').trim()
      if (!limpia || limpia.startsWith('#')) continue
      const igual = limpia.indexOf('=')
      if (igual < 1) continue
      const llave = limpia.slice(0, igual).trim()
      const valor = limpia.slice(igual + 1).trim()
      // No pisa lo que venga del entorno real (p. ej. PORT en desarrollo).
      if (process.env[llave] === undefined) process.env[llave] = valor
    }
  } catch {
    // Sin .env no pasa nada: en desarrollo se puede arrancar igual.
  }
}

function leer(nombre, valorPorDefecto = '') {
  const valor = process.env[nombre]
  return valor === undefined || valor === null ? valorPorDefecto : String(valor).trim()
}

const config = {
  esProduccion,

  db: {
    host: leer('DB_HOST', 'localhost'),
    port: Number(leer('DB_PORT', '3306')),
    user: leer('DB_USER'),
    password: leer('DB_PASSWORD'),
    name: leer('DB_NAME'),
    pool: Number(leer('DB_POOL', '10')),
  },

  azure: {
    tenantId: leer('AZURE_TENANT_ID'),
    clientId: leer('AZURE_CLIENT_ID'),
  },

  // Secreto de firma de las URLs de evidencia. Obligatorio en producción: con uno
  // temporal cada reinicio invalidaría las URLs que el navegador ya tiene en
  // caché, y con uno fijo todas las instalaciones firmarían igual.
  firma: {
    secreto: leer('FIRMA_SECRET'),
    ttl: Number(leer('FIRMA_TTL', 24 * 60 * 60)),
    maxBytes: Number(leer('MAX_ARCHIVO_BYTES', 10 * 1024 * 1024)),
  },

  cors: {
    origenes: leer('CORS_ORIGENES')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
}

// --------------------------------------------------------------- validación
// En producción, cualquier variable esencial que falte impide arrancar: es
// preferible un 500 con este mensaje claro que un fallo raro más tarde (un
// "Unknown column", un 401 inexplicable) cuando el usuario ya está probando.
//
// En desarrollo solo se avisa, para poder levantar la API sin base de datos y
// usarla para comprobar el arranque y el 401 de /api/salud.
const faltantes = []
const avisos = []
const requiere = (faltante) => {
  if (esProduccion) faltantes.push(faltante)
  else avisos.push(`falta ${faltante}`)
}

if (!config.db.user) requiere('DB_USER')
if (!config.db.name) requiere('DB_NAME')
if (!config.azure.tenantId) requiere('AZURE_TENANT_ID')
if (!config.azure.clientId) requiere('AZURE_CLIENT_ID')

// La contraseña solo importa si hay base configurada: es absurdo reclamar
// DB_PASSWORD cuando tampoco hay DB_USER.
if (!config.db.password && config.db.user) requiere('DB_PASSWORD')

if (!config.firma.secreto) {
  if (esProduccion) {
    faltantes.push('FIRMA_SECRET')
  } else {
    avisos.push('FIRMA_SECRET no está definido: se usará uno temporal y las URLs firmadas expiran al reiniciar.')
  }
}
if (config.cors.origenes.length === 0) {
  avisos.push('CORS_ORIGENES vacío: se aceptará cualquier origen (hay token en cada petición, pero conviene acotarlo).')
}

if (faltantes.length > 0) {
  const bloque = [
    '',
    '='.repeat(72),
    '  FALTAN VARIABLES DE ENTORNO: la API no puede arrancar.',
    '='.repeat(72),
    '',
    ...faltantes.map((v) => `    · ${v}`),
    '',
    '  Dónde definirlas:',
    '    cPanel > Setup Node.js App > tu aplicación > Environment variables',
    '',
    '  Plantilla de referencia: server/.env.example',
    '',
    '  Para generar el secreto de firma:',
    '    node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    '',
    '  Después de guardarlas, pulsa Restart en el panel.',
    '='.repeat(72),
    '',
  ].join('\n')
  throw new Error(bloque)
}

if (avisos.length > 0) {
  for (const aviso of avisos) console.warn(`[Config] ${aviso}`)
}

// --------------------------------------------------------------- diagnóstico
// Imprime un resumen al arrancar. En el hosting, los logs de Passenger se ven
// en cPanel > Errors, y esto dice de un vistazo si la configuración quedó bien.
const resumen = {
  node: process.version,
  entorno: process.env.NODE_ENV || '(sin definir, se trata como desarrollo)',
  base: `${config.db.user}@${config.db.host}:${config.db.port}/${config.db.name}`,
  tenant: config.azure.tenantId || '(sin definir)',
  firma: config.firma.secreto ? 'definida' : 'temporal (solo desarrollo)',
  cors: config.cors.origenes.length > 0 ? config.cors.origenes.join(', ') : 'cualquiera',
}
console.log('[Config] listo:', JSON.stringify(resumen))

module.exports = config
