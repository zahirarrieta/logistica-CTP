'use strict'

// ============================================================================
// CONTRASEÑAS
// Hash de contraseñas con scrypt, que viene en el módulo `crypto` de Node: no
// hace falta añadir ninguna dependencia al hosting.
//
// Formato guardado (una sola columna de texto):
//
//   scrypt$<N>$<r>$<p>$<sal_en_hex>$<hash_en_hex>
//
// Se guardan los parámetros DENTRO del hash a propósito. scrypt va endureciéndose
// con el tiempo (más N y p), y si el formato no los lleva, subir los parámetros
// obligaría a re-hashear todas las contraseñas, porque las viejas se verificarían
// con los parámetros con los que se crearon, no con los nuevos. Con el formato
// completo, un hash viejo se reconoce por sus N/p y se acepta tal cual.
//
// Nunca se guarda ni se registra la contraseña en claro.
// ============================================================================

const crypto = require('crypto')

// Equivalentes a los valores por defecto de Node. Se fijan aquí para que el
// formato sea explícito y el coste sea legible en el código en vez de depender
// de la versión de Node que corre en el servidor.
const N = 16384
const R = 8
const P = 1
const LARGO_SAL = 16
const LARGO_HASH = 64
const LARGO_MAXIMO = 200

// Deriva la clave de scrypt a partir de la contraseña y la sal.
function derivar(contrasena, sal, n = N, r = R, p = P) {
  return new Promise((resolver, rechazar) => {
    crypto.scrypt(
      Buffer.from(String(contrasena), 'utf8'),
      sal,
      LARGO_HASH,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (error, clave) => (error ? rechazar(error) : resolver(clave))
    )
  })
}

// Genera un hash para guardar en usuarios.password_hash.
async function hashear(contrasena) {
  const sal = crypto.randomBytes(LARGO_SAL)
  const clave = await derivar(contrasena, sal)
  return `scrypt$${N}$${R}$${P}$${sal.toString('hex')}$${clave.toString('hex')}`
}

// Comprueba una contraseña contra un hash guardado. Devuelve false ante
// cualquier hash con formato desconocido, en vez de lanzar: un registro escrito a
// mano o por un script antiguo no debe poder tumbar el endpoint de login.
async function verificar(contrasena, hashGuardado) {
  const partes = String(hashGuardado || '').split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false

  const n = Number(partes[1])
  const r = Number(partes[2])
  const p = Number(partes[3])
  const sal = Buffer.from(partes[4], 'hex')
  const esperado = Buffer.from(partes[5], 'hex')
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (sal.length !== LARGO_SAL || esperado.length !== LARGO_HASH) return false

  // scrypt es lento a propósito. Con un solo scrypt el login sería un vector de
  // fuerza bruta. Se compara en tiempo constante para que el tiempo de respuesta
  // no revele cuántos caracteres correctos hay.
  const calculado = await derivar(contrasena, sal, n, r, p)
  return crypto.timingSafeEqual(esperado, calculado)
}

// Reglas mínimas de la contraseña. A propósito NO se exige mayúscula, símbolo ni
// número: la app la usan operarios de campo y hay gente que teclea con una sola
// mano o en un teléfono. Lo que sí se exige es largo, que es lo único que de
// verdad protege contra la fuerza bruta.
function problema(contrasena) {
  const valor = String(contrasena || '')
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (valor.length > LARGO_MAXIMO) return `La contraseña no puede pasar de ${LARGO_MAXIMO} caracteres`
  return ''
}

// Normaliza el correo a la misma forma en que se guarda en usuarios.correo:
// minúsculas y sin espacios. Si no se normaliza, ' Juan@CTP.com ' y
// 'juan@ctp.com' serían dos cuentas distintas, porque la UNIQUE es de texto y en
// MySQL collation utf8mb4_unicode_ci solo iguala mayúsculas, no espacios.
function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase()
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Valida el correo de registro. Devuelve el texto del problema, o '' si vale.
function problemaCorreo(correo) {
  const valor = normalizarCorreo(correo)
  if (!valor) return 'Falta el correo'
  if (valor.length > 190) return 'El correo es demasiado largo'
  if (!RE_CORREO.test(valor)) return 'El correo no tiene un formato válido'
  return ''
}

module.exports = { hashear, verificar, problema, problemaCorreo, normalizarCorreo }
