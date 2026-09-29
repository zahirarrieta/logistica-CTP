'use strict'

// ============================================================================
// AUTENTICACIÓN
// Valida el token de Microsoft (Azure AD / Entra ID) que envía el frontend en
// Authorization: Bearer. Reemplaza a Supabase Auth: ya no hay sesiones anónimas
// ni JWT propios, el identificador es el correo de la cuenta de Microsoft.
//
// El token se verifica contra las claves públicas del tenant (JWKS) que publica
// Microsoft, comprobando firma, emisor, audiencia y expiración. El rol NO se
// lee del token: vive en la tabla usuarios (ver permisos.contexto), para que
// cambiar permisos no requiera tocar el frontend.
// ============================================================================

const { createRemoteJWKSet, jwtVerify, decodeJwt, decodeProtectedHeader } = require('jose')

const config = require('./config')

const TENANT_ID = config.azure.tenantId
const CLIENT_ID = config.azure.clientId

const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`

// Audiencias aceptadas.
//
// La correcta es CLIENT_ID: el token que pide el scope `api://<client-id>/access_as_user`
// viene con `aud` = el id de la app, y es lo que exige el diseño.
//
// Se acepta además la audiencia de Microsoft Graph porque muchos clientes de
// MSAL piden un token de Graph (User.Read, Files.ReadWrite) por costumbre, y ese
// token también está firmado por las claves del MISMO tenant: prueba la misma
// identidad de usuario. No se abre nada al exterior porque el emisor sigue
// atado a un solo tenant y la firma se sigue comprobando contra su JWKS.
//
// OJO con las dos formas de Graph: NO es lo mismo el GUID que la URL. Un token
// emitido por el endpoint v1.0 lleva `aud` = "00000003-0000-0000-c000-000000000000",
// pero uno emitido por v2.0 lleva el identificador de recurso completo
// `https://graph.microsoft.com/00000003-0000-0000-c000-000000000000`. MSAL v3 usa
// v2.0 por defecto, así que accepting solo el GUID hacía que toda petición
// respondiera 401 "Token inválido" aunque el login funcionara. Se aceptan ambas.
//
// Cuando el scope de la API esté publicado en Entra ID, se pueden quitar las dos
// formas de Graph de esta lista.
const GRAPH_AUDIENCE = '00000003-0000-0000-c000-000000000000'
const GRAPH_AUDIENCE_V2 = `https://graph.microsoft.com/${GRAPH_AUDIENCE}`
const AUDIENCIAS = [CLIENT_ID, GRAPH_AUDIENCE, GRAPH_AUDIENCE_V2]

// jose cachea las claves y las refresca solo cuando expira la Cache-Control, así
// que cada petición no vuelve a Microsoft.
const jwks = createRemoteJWKSet(new URL(JWKS_URI))

// Extrae el correo del token. En Entra ID el claim puede venir como
// preferred_username, upn o email según el flujo; se prueban en ese orden.
function correoDelToken(payload) {
  const candidato = payload.preferred_username || payload.upn || payload.email || ''
  return String(candidato).trim().toLowerCase()
}

// Resumen del token recibido, DECODIFICADO pero NO verificado.
//
// Existe por un motivo concreto: jose no rellena error.payload cuando la firma
// falla, así que el log decía "aud=(sin leer)" y no había forma de saber por qué
// se rechazaba. Con este resumen, el propio 401 dice quéalgoritmo y qué clave
// trae el token, y se compara con la lista de claves que el servidor tiene.
//
// Decodificar no es verificar: no da acceso a nada y solo refleja lo que el
// cliente ya mandó. No se registra el token completo en ningún log.
function resumirToken(token) {
  try {
    const header = decodeProtectedHeader(token)
    const payload = decodeJwt(token)
    return {
      alg: header.alg || '(sin alg)',
      kid: header.kid || '(sin kid)',
      aud: payload.aud || '(sin aud)',
      iss: payload.iss || '(sin iss)',
      exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      scp: payload.scp || '',
      largo: token.length,
    }
  } catch (error) {
    return { error: `no decodificable: ${error.message}`, largo: token.length }
  }
}

// Lista de claves que el servidor tiene cargadas del tenant, para poder
// comparar con el kid del token que llega.
async function kidsDisponibles() {
  try {
    const r = await fetch(JWKS_URI)
    const j = await r.json()
    return { http: r.status, kids: (j.keys || []).map((k) => k.kid) }
  } catch (error) {
    return { error: error.message }
  }
}

// Exige un token válido. Deja en req.ctx lo que las rutas necesitan para
// autorizar. Responde 401 solo; las decisiones de rol son de permisos.js.
async function autenticar(req, res, next) {
  const encabezado = req.get('authorization') || ''
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7).trim() : ''

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' })
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCIAS,
    })
    const correo = correoDelToken(payload)
    if (!correo) {
      return res.status(401).json({ error: 'El token no trae un correo utilizable' })
    }
    req.token = payload
    req.correo = correo
    req.nombreToken = String(payload.name || '').trim()
    return next()
  } catch (error) {
    const expired = error?.code === 'ERR_JWT_EXPIRED'
    // Se registra el motivo y los claims relevantes. NUNCA el token entero. Con
    // el `aud` basta para distinguir "token de otra app" de "audiencia mal
    // listada", que es justo lo que rompía con Graph v2.0.
    const info = resumirToken(token)
    const kids = await kidsDisponibles()
    const codigo = error?.code || error?.message
    console.warn(`[Auth] token rechazado: ${codigo} | ${JSON.stringify(info)}`)

    // El frontend muestra este texto tal cual, así que el diagnóstico viaja en
    // el mensaje: no hace falta que nadie abra los logs para ver qué pasa.
    const detalle = [
      `codigo=${codigo}`,
      `alg=${info.alg}`,
      `kid=${info.kid}`,
      `aud=${info.aud}`,
      `exp=${info.exp || 'sin exp'}`,
      `kids=${(kids.kids || []).join('|') || kids.error || 'sin claves'}`,
    ].join(' ')

    return res.status(401).json({
      error: expired ? 'La sesión expiró, vuelve a iniciar sesión' : `Token inválido ${detalle}`,
    })
  }
}

module.exports = { autenticar, correoDelToken }
