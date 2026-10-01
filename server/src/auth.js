'use strict'

// ============================================================================
// AUTENTICACIÓN
// Sesión propia: la API firma un JWT cuando alguien se registra o inicia sesión
// y lo verifica en cada petición. Ya no depende de Microsoft ni de ningún
// proveedor externo.
//
// El token lleva el correo y el nombre, pero NO el rol: el rol se lee siempre de
// la tabla usuarios (ver permisos.contexto). Así un administrador cambia permisos
// sin que el token de nadie tenga que renovarse, que es justo lo que pasaba con
// el token de Microsoft.
//
// La firma es HMAC-SHA256 con SESSION_SECRET. Con jose, que ya era dependencia del
// proyecto para verificar el token de Microsoft.
// ============================================================================

const crypto = require('crypto')
const { SignJWT, jwtVerify } = require('jose')

const config = require('./config')

// Clave de firma. En desarrollo, si no hay SESSION_SECRET, se genera una al
// arrancar: permite levantar la API sin configurar nada, a costa de que cada
// reinicio invalide las sesiones abiertas (config.js lo avisa). En producción
// config.js IMPIDE arrancar sin secreto, así que aquí nunca se llega con uno vacío.
const secreto = config.sesion.secreto
const clave = new TextEncoder().encode(
  secreto || 'secreto-temporal-de-desarrollo-no-usar-en-produccion'
)

// Tope de seguridad ante un token con un "iat" absurdo (el futuro). Sin esto un
// token con iat en el año 3000 sería válido durante 8000 años.
const MAX_EDAD = config.sesion.ttl

// Firma el token de sesión. Lo llaman las rutas /api/auth/*.
async function firmarToken({ correo, nombre = '' }) {
  const ahora = Math.floor(Date.now() / 1000)
  return new SignJWT({ correo, nombre })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(ahora)
    .setIssuer(config.sesion.emisor)
    .setSubject(correo)
    .setExpirationTime(ahora + config.sesion.ttl)
    .setJti(crypto.randomUUID())
    .sign(clave)
}

// Verifica firma, emisor y caducidad. Devuelve el payload, o lanza.
async function verificarToken(token) {
  const { payload } = await jwtVerify(token, clave, {
    issuer: config.sesion.emisor,
    maxTokenAge: MAX_EDAD,
    algorithms: ['HS256'],
  })
  return payload
}

// Exige un token válido. Deja en req.ctx lo que las rutas necesitan para
// autorizar. Responde 401 solo; las decisiones de rol son de permisos.js.
async function autenticar(req, res, next) {
  const encabezado = req.get('authorization') || ''
  let token = encabezado.startsWith('Bearer ') ? encabezado.slice(7).trim() : ''

  // Respaldo para cuando un intermediario del hosting altera la cabecera
  // Authorization: el navegador puede mandar el mismo token en el cuerpo, que
  // los WAF no reescriben. Solo se usa si la cabecera no trajo token.
  if (!token) {
    const delCuerpo = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (delCuerpo) {
      token = delCuerpo
      // Se retira para que ninguna ruta lo vea ni lo persista: el token no es un
      // dato del dominio y no debe acabar en MySQL aunque una ruta futura
      // decida volcar el cuerpo entero.
      delete req.body.token
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' })
  }

  try {
    const payload = await verificarToken(token)
    const correo = correoDelToken(payload)
    if (!correo) {
      return res.status(401).json({ error: 'El token no trae un correo utilizable' })
    }
    req.token = payload
    req.correo = correo
    req.nombreToken = String(payload.nombre || '').trim()
    return next()
  } catch (error) {
    const expirado = error?.code === 'ERR_JWT_EXPIRED'
    console.warn(`[Auth] token rechazado: ${error?.code || error?.message}`)
    // El frontend muestra este texto tal cual, así que el diagnóstico viaja en el
    // mensaje: no hace falta que nadie abra los logs del hosting.
    return res.status(401).json({
      error: expirado
        ? 'La sesión expiró, vuelve a iniciar sesión'
        : 'Token inválido: la sesión no es de este servidor o se alteró',
    })
  }
}

// Extrae el correo del token. El claim se llama 'correo' (no 'email') porque es
// el mismo nombre que usa la columna usuarios.correo y el que espera
// permisos.contexto; se acepta 'email' solo por si algún token antiguo viniera así.
function correoDelToken(payload) {
  const candidato = payload.correo || payload.email || ''
  return String(candidato).trim().toLowerCase()
}

// ============================================================================
// TOKEN DE CONFIANZA («recordar este equipo»)
// No es un JWT: son 32 bytes aleatorios en base64url, sin firma ni contenido que
// leer. No lleva datos, así que no hay claim que falsificar y no se puede usar
// como token de sesión: su único valor es servir para canjearse por una sesión
// contra la fila que le corresponde en `sesiones_recordadas`.
//
// Lo que se guarda en MySQL es el SHA-256, nunca el token. Consecuencias que son
// justo las buscadas:
//   - una copia de la tabla no permite entrar en nada;
//   - borrar la fila revoca el acceso al instante, sin esperar a que expire;
//   - el hash es determinista, así que la búsqueda es un SELECT por un índice UNIQUE.
//
// El token lleva 30 días de vida (config.sesion.recordarTtl) y caduca por
// `expira_en` en la base, no por una fecha dentro del token.
// ============================================================================
function nuevoTokenRecordar() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') }
}

// Normaliza lo que llega desde el navegador antes de hashearlo. Si no coincide
// con el hash guardado, la fila no existe y el token no vale: por eso se
// devuelve '' en vez de lanzar, para tratarlo como un token inválido más.
function hashDeTokenRecordar(token) {
  const limpio = String(token || '').trim()
  if (!limpio || limpio.length > 200) return ''
  return crypto.createHash('sha256').update(limpio).digest('hex')
}

// Agente del cliente, solo para que un superadmin pueda reconocer el equipo en
// la tabla. Se recorta porque va a un VARCHAR(255) y el User-Agent lo manda el
// cliente: sin recorte, un valor enorme rompe el INSERT.
function agenteDe(req) {
  return String(req?.get?.('user-agent') || '').trim().slice(0, 255)
}

module.exports = {
  agenteDe,
  autenticar,
  correoDelToken,
  firmarToken,
  hashDeTokenRecordar,
  nuevoTokenRecordar,
  verificarToken,
}
