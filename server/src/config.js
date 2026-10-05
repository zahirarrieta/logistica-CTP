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

// Puerto SMTP y modo de cifrado. 465 es SMTPS directo (TLS implícito) y 587 es
// STARTTLS sobre texto plano. El modo se deduce del puerto cuando MAIL_SECURE no
// está definido, que es lo habitual: cPanel deja abiertos uno u otro según el
// buzón, y el valor por defecto tiene que funcionar en los dos casos.
const puertoCorreo = Number(leer('MAIL_PORT', '465'))
const seguroCorreo = leer('MAIL_SECURE', puertoCorreo < 587 ? 'true' : 'false') === 'true'

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

  // Sesión propia. La API firma un JWT con SESSION_SECRET cuando alguien se
  // registra o inicia sesión, y lo verifica en cada petición. El secreto es
  // OBLIGATORIO en producción: con uno fijo en el código, cualquiera que descargue
  // el repositorio podría fabricar su propio token con el rol de superadmin.
  sesion: {
    secreto: leer('SESSION_SECRET'),
    ttl: Number(leer('SESSION_TTL', 8 * 60 * 60)),
    emisor: leer('SESSION_EMISOR', 'logistica-ctp'),
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

  // ------------------------------------------------------------------ correo
  // Envío de avisos (mala calificación y retención por cartera). Todo se manda
  // desde AQUÍ, nunca desde el navegador: así hay una sola identidad remitente
  // (la del hosting) y queda registrado en el log del servidor quién pidió qué.
  //
  // MAIL_SECURE decide el cifrado del puerto: 465 es SMTPS directo (true), y 587
  // es STARTTLS sobre texto plano (false). Si no se define, se deduce del puerto
  // para que el valor por defecto funcione en los dos casos habituales.
  //
  // Si MAIL_HOST y MAIL_FROM no están, no se manda nada y la app sigue
  // funcionando: el correo es una función accesoria y no puede tumbar la
  // logística porque el SMTP del hosting esté caído.
  correo: {
    host: leer('MAIL_HOST'),
    puerto: puertoCorreo,
    secure: seguroCorreo,
    usuario: leer('MAIL_USER'),
    clave: leer('MAIL_PASSWORD'),
    remitente: leer('MAIL_FROM'),
    nombreRemitente: leer('MAIL_FROM_NAME', 'Logística CTP'),
    // Casilla que recibe SIEMPRE, aunque el resto de la lista interna no exista
    // todavía. Es la que garantiza que solicitante y operación se enteran: una
    // dirección inexistente hace que el servidor rechace el mensaje entero. Si no
    // se define, es la misma que emite (MAIL_USER).
    operativo: leer('MAIL_OPERATIVO'),
    // Destinatarios internos en copia. Se pueden cambiar por entorno sin tocar el
    // código, porque estas direcciones cambian con la organización más que el
    // resto de la configuración.
    copiaCalidad: leer('CORREOS_ALERTA_CALIDAD'),
    copiaCartera: leer('CORREOS_REENCION_CARTERA'),
  },

  // ------------------------------------------------------------------- push
  // Notificaciones cuando la app está CERRADA (otra pestaña, navegador cerrado,
  // celular bloqueado). Es lo único que funciona en ese escenario: la API de
  // notificaciones del navegador solo existe mientras hay una pestaña viva.
  //
  // VAPID es el par de claves que identifica al servidor ante el navegador. Se
  // genera UNA vez con el comando que indica el aviso de arranque y no se cambia
  // nunca: si se regenera, todos los dispositivos suscritos dejan de recibir y
  // hay que volver a activarlos uno por uno.
  push: {
    publica: leer('VAPID_PUBLIC_KEY'),
    privada: leer('VAPID_PRIVATE_KEY'),
    // Contacto del responsable del envío. Los navegadores lo usan para avisar
    // si un servidor empieza a mandar push de más. Un correo real (no una
    // dirección inventada) es lo que evita que Firefox/push services lo rechace.
    contacto: leer('VAPID_SUBJECT', 'mailto:operaciones@pedro-ctpmedica.com'),
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

// La contraseña solo importa si hay base configurada: es absurdo reclamar
// DB_PASSWORD cuando tampoco hay DB_USER.
if (!config.db.password && config.db.user) requiere('DB_PASSWORD')

if (!config.sesion.secreto) {
  if (esProduccion) {
    faltantes.push('SESSION_SECRET')
  } else {
    avisos.push('SESSION_SECRET no está definido: se usará uno temporal y toda sesión caerá en cada reinicio del servidor.')
  }
}

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

// El correo NO es imprescindible: si falta su configuración, la app arranca
// igual y solo se pierden los avisos. Por eso va a `avisos` y nunca a
// `faltantes` — un SMTP mal puesto no puede dejar sin entregas a la operación.
if (!config.correo.host) {
  avisos.push(
    'correo sin configurar (MAIL_HOST/MAIL_FROM): los avisos de mala calificación '
    + 'y de retención por cartera se guardarán solo en el log.'
  )
} else {
  if (!config.correo.remitente) avisos.push('MAIL_HOST está definido pero MAIL_FROM no: no se podrá enviar nada.')
  // Sin clave casi siempre es buzón local de cPanel, que sí autentica. Solo se
  // avisa si además se puso un usuario: usuario sin clave sí es un descuido.
  if (config.correo.usuario && !config.correo.clave) {
    avisos.push('MAIL_USER está definido pero MAIL_PASSWORD no: la autenticación SMTP fallará.')
  }
}

// El push, igual que el correo, es accesorio: si faltan las claves VAPID la app
// arranca igual y solo se pierden las notificaciones con la app cerrada. Se avisa
// porque es muy fácil confundir "no tengo clave" con "el navegador no soporta".
if (!config.push.publica || !config.push.privada) {
  avisos.push(
    'push sin configurar (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY): las notificaciones solo '
    + 'llegarán con la app abierta. Genera el par de claves con el comando que sale '
    + 'en el log de arranque.'
  )
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
    '  (el mismo comando sirve para FIRMA_SECRET y para SESSION_SECRET:',
    '   cada uno con su propio valor, nunca el mismo)',
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
  sesion: config.sesion.secreto ? 'secreta definida' : 'secreto temporal (solo desarrollo)',
  ttlSesion: `${Math.round(config.sesion.ttl / 60)} min`,
  firma: config.firma.secreto ? 'definida' : 'temporal (solo desarrollo)',
  correo: config.correo.host
    ? `${config.correo.usuario ? 'autenticado' : 'anónimo'} en ${config.correo.host}:${config.correo.puerto}`
      + ` (${config.correo.secure ? 'SMTPS' : 'STARTTLS'}) desde ${config.correo.remitente || 'SIN REMITENTE'}`
    : 'sin configurar (los avisos solo quedan en el log)',
  push: config.push.publica && config.push.privada
    ? `claves VAPID listas (público ${config.push.publica.slice(0, 8)}…)`
    : 'sin claves VAPID (las notificaciones solo llegan con la app abierta)',
  cors: config.cors.origenes.length > 0 ? config.cors.origenes.join(', ') : 'cualquiera',
}

// El comando para generar las claves VAPID se imprime solo cuando faltan, que es
// justo cuando el usuario lo necesita: si las define, este bloque no aparece en
// los logs. No se puede escribir un comando de una línea con comillas simples y
// dobles mezcladas sin líos, así que va en un array unido por saltos de línea.
if (!(config.push.publica && config.push.privada)) {
  const comando = [
    '',
    '  Para activar las notificaciones con la app cerrada falta generar las claves',
    '  VAPID. Se hace UNA VEZ y el resultado se copia en Setup Node.js App >',
    '  Environment variables:',
    '',
    '    npx web-push generate-vapid-keys',
    '',
    "    VAPID_PUBLIC_KEY=<la que imprimir>",
    '    VAPID_PRIVATE_KEY=<la que imprima>',
    '    VAPID_SUBJECT=mailto:tu-correo-real@tu-dominio.com',
    '',
    '  Después, Restart. Sin estas claves la app funciona igual, pero los avisos',
    '  solo se ven con la pestaña abierta.',
    '',
  ].join('\n')
  console.warn(`[Config]${comando}`)
}
console.log('[Config] listo:', JSON.stringify(resumen))

module.exports = config
