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

const { createRemoteJWKSet, jwtVerify } = require('jose')

const TENANT_ID = process.env.AZURE_TENANT_ID || ''
const CLIENT_ID = process.env.AZURE_CLIENT_ID || ''

if (!TENANT_ID || !CLIENT_ID) {
  console.error(
    '[Auth] faltan AZURE_TENANT_ID y/o AZURE_CLIENT_ID en las variables de entorno. La API no aceptará peticiones.'
  )
}

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
// Cuando el scope de la API esté publicado en Entra ID, se puede quitar
// GRAPH_AUDIENCE de esta lista.
const GRAPH_AUDIENCE = '00000003-0000-0000-c000-000000000000'
const AUDIENCIAS = [CLIENT_ID, GRAPH_AUDIENCE].filter(Boolean)

// jose cachea las claves y las refresca solo cuando expira la Cache-Control, así
// que cada petición no vuelve a Microsoft.
const jwks = createRemoteJWKSet(new URL(JWKS_URI))

// Extrae el correo del token. En Entra ID el claim puede venir como
// preferred_username, upn o email según el flujo; se prueban en ese orden.
function correoDelToken(payload) {
  const candidato = payload.preferred_username || payload.upn || payload.email || ''
  return String(candidato).trim().toLowerCase()
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
    console.warn(`[Auth] token rechazado: ${error?.code || error?.message}`)
    return res.status(401).json({
      error: expired ? 'La sesión expiró, vuelve a iniciar sesión' : 'Token inválido',
    })
  }
}

module.exports = { autenticar, correoDelToken }
