'use strict'

// ============================================================================
// RUTAS DE AUTENTICACIÓN
// /registro y /login son las únicas que NO pasan por autenticar: son justamente
// las que crean la sesión. Se montan antes del router protegido en index.js.
//
// /yo sí va por autenticar (lleva el middleware puesto en la propia ruta), porque
// responde «quién es esta sesión» y sin token no hay nada que responder.
//
// El registro es abierto: cualquiera que llegue a la URL puede crear su cuenta.
// Por eso el rol inicial es SIEMPRE 'solicitante', el más restrictivo, y el
// registro NUNCA acepta un rol del cuerpo: si lo aceptara, bastaría con mandar
// {"rol":"superadmin"} para quedarse con el sistema. Subir de rol es cosa del
// administrador, desde la pestaña Administrador.
// ============================================================================

const express = require('express')
const crypto = require('crypto')

const { pool } = require('./db')
const { autenticar, firmarToken } = require('./auth')
const C = require('./contrasenas')

const router = express.Router()

// Hash de una contraseña que nadie tiene. Solo sirve para gastar el mismo tiempo
// que un scrypt real en el caso "el correo no existe" (ver /login).
const hashDeTrampa = `scrypt$16384$8$1$${'00'.repeat(16)}${'00'.repeat(64)}`

// Envuelve un handler async para que los rechazos lleguen al middleware de
// errores en vez de matar el proceso.
const ruta = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Fila pública del usuario: NUNCA incluye password_hash. Todo lo que se devuelve
// al navegador pasa por aquí, para que el hash no se escape por un descuido al
// añadir un campo.
function filaPublica(fila) {
  return {
    correo: fila.correo,
    nombre: fila.nombre || '',
    rol: fila.rol,
    activo: Boolean(fila.activo),
  }
}

// Fila de la tabla usuarios, con el hash incluido. Solo para uso interno del
// servidor (comparar contraseñas), nunca para responder.
async function leerPorCorreo(correo) {
  const [filas] = await pool.execute(
    'SELECT correo, nombre, rol, activo, password_hash FROM usuarios WHERE correo = ? LIMIT 1',
    [correo]
  )
  return filas[0] || null
}

// ---------------------------------------------------------------------------
// POST /api/auth/registro
// Crea la cuenta y devuelve la sesión ya iniciada, para que el frontend no tenga
// que pedir un segundo viaje tras registrarse.
// ---------------------------------------------------------------------------
router.post(
  '/registro',
  ruta(async (req, res) => {
    const { nombre = '', correo = '', contrasena = '' } = req.body || {}

    const correoLimpio = C.normalizarCorreo(correo)
    const problemaCorreo = C.problemaCorreo(correoLimpio)
    if (problemaCorreo) return res.status(400).json({ error: problemaCorreo })

    const problemaClave = C.problema(contrasena)
    if (problemaClave) return res.status(400).json({ error: problemaClave })

    const nombreLimpio = String(nombre || '').trim().slice(0, 190)
    if (!nombreLimpio) return res.status(400).json({ error: 'Falta el nombre' })

    // El hash se calcula ANTES de tocar la base de datos. scrypt tarda ~100 ms a
    // propósito, así que en una carrera entre dos registros del mismo correo los
    // dos hashean en paralelo y la UNIQUE decide: es la base la que resuelve la
    // carrera, no el SELECT previo.
    const hash = await C.hashear(contrasena)

    // ON DUPLICATE KEY UPDATE con password_hash = password_hash: si el correo ya
    // existe no se cambia nada. NO se hace
    // "ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)" porque eso dejaría que
    // cualquiera reescriba el nombre de una cuenta ajena con solo conocer el
    // correo.
    //
    // affectedRows no sirve aquí para distinguir insert de duplicado: MySQL
    // devuelve 0 cuando un ON DUPLICATE KEY UPDATE "no cambia nada" y 2 cuando
    // "cambia algo". La comprobación correcta es leer la fila y ver si el hash
    // guardado es el que acabamos de calcular.
    await pool.execute(
      `INSERT INTO usuarios (id, correo, nombre, rol, password_hash)
            VALUES (?, ?, ?, 'solicitante', ?)
       ON DUPLICATE KEY UPDATE password_hash = password_hash`,
      [crypto.randomUUID(), correoLimpio, nombreLimpio, hash]
    )

    const fila = await leerPorCorreo(correoLimpio)
    if (!fila) return res.status(500).json({ error: 'No se pudo crear la cuenta' })

    const esNuevo = fila.password_hash === hash
    if (!esNuevo) {
      // Mismo correo, distinta contraseña (o el mismo correo simplemente ya
      // existía). Se responde 409 sin decir cuál de las dos cosas es: esa
      // diferencia es lo que permite enumerar las cuentas que existen.
      return res.status(409).json({ error: 'Ese correo ya está registrado' })
    }

    const token = await firmarToken({ correo: correoLimpio, nombre: nombreLimpio })
    console.log(`[Auth] cuenta creada: ${correoLimpio} (rol solicitante)`)
    return res.status(201).json({ token, usuario: filaPublica(fila) })
  })
)

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
// Freno de fuerza bruta por IP. Sin esto, un atacante que encuentre un correo
// puede probar contraseñas sin límite desde el mismo servidor, y el login lento
// por scrypt es justo lo que hace ese ataque lento.
//
// Es un recorte, no una garantía: cambiar de IP reinicia la cuenta. Por eso el
// hash de la contraseña sigue siendo la defensa de verdad.
//
// Dos detalles que importan:
//
// 1. Solo cuentan los intentos FALLIDOS. Contar también los correctos bloqueaba a
//    un usuario que trabaja todo el día entrando y saliendo, al décimo ingreso.
//
// 2. El bloqueo NO impide pasar con la contraseña correcta. Si el contador está
//   agotado se verifica igualmente y, si la clave es buena, se entra. Tiene que
//    ser así: el freno existe para quien está adivinando, y a quien ya sabe la
//    clave no hay nada que frenarle (si la sabe, puede entrar las veces que
//    quiera). Sin esto, diez equivocadas typografiadas dejaban al empleado fuera
//    del sistema quince minutos sin forma de recuperar la sesión.
const INTENTOS_MAXIMOS = 10
const VENTANA_MS = 15 * 60 * 1000
const intentosPorIp = new Map()

function ipDe(req) {
  return String(req.ip || req.socket?.remoteAddress || 'desconocida')
}

function registroDe(clave) {
  const ahora = Date.now()
  let registro = intentosPorIp.get(clave)
  if (registro && ahora - registro.desde > VENTANA_MS) {
    intentosPorIp.delete(clave)
    registro = null
  }
  if (!registro) {
    registro = { desde: ahora, cuenta: 0 }
    intentosPorIp.set(clave, registro)
  }
  return registro
}

// Poda: se limpian las IP que ya no tienen intentos, para que el Map no crezca
// sin límite con cada petición de un escáner distinto.
function podar() {
  if (intentosPorIp.size <= 5000) return
  const ahora = Date.now()
  for (const [ip, registro] of intentosPorIp) {
    if (ahora - registro.desde > VENTANA_MS) intentosPorIp.delete(ip)
  }
}

// ¿Se agotó el margen de esta IP? NO cuenta el intento: solo lo consulta.
function agotado(req) {
  podar()
  return registroDe(ipDe(req)).cuenta >= INTENTOS_MAXIMOS
}

function registraIntentoFallido(req) {
  registroDe(ipDe(req)).cuenta += 1
}

// El login correcto borra el historial: entrar con la clave buena es la prueba
// de que ya no se está probando al azar.
function limpiaIntentos(req) {
  intentosPorIp.delete(ipDe(req))
}

function minutosRestantes(req) {
  const registro = intentosPorIp.get(ipDe(req))
  if (!registro) return 0
  const pasado = Date.now() - registro.desde
  return pasado > VENTANA_MS ? 0 : Math.ceil((VENTANA_MS - pasado) / 60000)
}

router.post(
  '/login',
  ruta(async (req, res) => {
    const { correo = '', contrasena = '' } = req.body || {}
    const correoLimpio = C.normalizarCorreo(correo)

    if (!correoLimpio || !String(contrasena || '')) {
      return res.status(400).json({ error: 'Falta el correo o la contraseña' })
    }

    // Se anota ANTES de verificar, no después: el hasheo se paga igual en los dos
    // caminos, así que decidir la respuesta antes mantiene el tiempo de respuesta
    // parejo y no regala una diferencia de tiempos.
    const bloqueada = agotado(req)

    const fila = await leerPorCorreo(correoLimpio)

    // Mensaje ÚNICO para «no existe», «contraseña incorrecta» y «sin hash». Distinguir
    // los tres casos es un oráculo: permite confirmar qué correos tienen cuenta
    // probando contraseñas hasta que el mensaje cambie.
    const credencialesMalas = { error: 'Correo o contraseña incorrectos' }

    if (!fila) {
      // Se hashea una contraseña inventada para que el tiempo de respuesta sea el
      // mismo que con una cuenta existente. Si el caso "correo inexistente" fuera
      // instantáneo y el de "contraseña mala" tardara 100 ms, el atacante vería
      // qué correos existen solo midiendo.
      await C.verificar(contrasena, hashDeTrampa)
      if (bloqueada) {
        console.warn(`[Auth] intento bloqueado desde ${ipDe(req)}`)
        return res.status(429).json({
          error: `Demasiados intentos. Espera ${minutosRestantes(req)} min y vuelve a intentar.`,
        })
      }
      registraIntentoFallido(req)
      return res.status(401).json(credencialesMalas)
    }

    const buena = await C.verificar(contrasena, fila.password_hash)
    if (!buena) {
      console.warn(`[Auth] contraseña incorrecta para ${correoLimpio} desde ${ipDe(req)}`)
      if (bloqueada) {
        return res.status(429).json({
          error: `Demasiados intentos. Espera ${minutosRestantes(req)} min y vuelve a intentar.`,
        })
      }
      registraIntentoFallido(req)
      return res.status(401).json(credencialesMalas)
    }

    // A partir de aquí la contraseña es correcta, así que entra siempre. Cuenta
    // desactivada por un administrador: se dice explícitamente para que el usuario
    // sepa que debe llamar, en vez de pensar que se equivocó de clave.
    limpiaIntentos(req)
    if (!fila.activo) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' })
    }

    const token = await firmarToken({ correo: fila.correo, nombre: fila.nombre })
    console.log(`[Auth] sesión iniciada: ${fila.correo} (${fila.rol})`)
    return res.json({ token, usuario: filaPublica(fila) })
  })
)

// ---------------------------------------------------------------------------
// GET /api/auth/yo
// Devuelve la fila del usuario del token. Lo usa el frontend para saber si la
// sesión guardada en el navegador sigue siendo válida sin tener que iniciar
// sesión otra vez; si el token caducó, responde 401 y el frontend limpia.
//
// A diferencia de /registro y /login, esta SÍ va por autenticar: necesita
// req.correo, que es lo que autenticar deja puesto. Por eso este router se
// monta entero antes del router protegido de index.js y es esta ruta la que
// lleva su propio autenticar; lo que no se puede es dejarla pública.
// ---------------------------------------------------------------------------
router.get(
  '/yo',
  autenticar,
  ruta(async (req, res) => {
    const [filas] = await pool.execute(
      'SELECT correo, nombre, rol, activo FROM usuarios WHERE correo = ? LIMIT 1',
      [req.correo]
    )
    const fila = filas[0]
    if (!fila) return res.status(404).json({ error: 'La cuenta ya no existe' })
    return res.json(filaPublica(fila))
  })
)

module.exports = router
