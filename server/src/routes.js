'use strict'

// ============================================================================
// RUTAS
// Endpoints que reemplazan las llamadas al SDK de Supabase. La respuesta mantiene
// la MISMA forma de datos que daba PostgREST para no tener que tocar los
// componentes de React: las filas de solicitudes/historial salen con nombres de
// columna (snake_case) y los booleanos como true/false, no 0/1.
// ============================================================================

const express = require('express')
const multer = require('multer')

const { pool } = require('./db')
const P = require('./permisos')
const C = require('./contrasenas')
const archivos = require('./archivos')
const config = require('./config')
const correo = require('./correo')
const push = require('./push')

const router = express.Router()

// Rutas que NO pasan por autenticar(). Solo la descarga de archivos firmados:
// el navegador las carga en un <img>/<iframe> o al abrir una pestaña, y en esos
// casos no puede mandar la cabecera Authorization. Aquí autoriza la firma HMAC
// de la URL (ver archivos.verificarFirma), no la sesión. Se monta en index.js
// ANTES del router protegido; si se dejara dentro, autenticar la rechazaría con
// 401 "Falta el token" y ningún documento podría verse.
const publico = express.Router()

// ---------------------------------------------------------------------------
// Utilidades de serialización
// ---------------------------------------------------------------------------
const b = (v) => Boolean(v)
const iso = (v) => (v ? new Date(v).toISOString() : null)

// MySQL no tiene text[] ni jsonb: las columnas JSON llegan como string o ya
// como objeto según el driver, y el frontend espera un array.
function aArrayJson(valor) {
  if (Array.isArray(valor)) return valor
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function jsonONull(valor) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'string') {
    try {
      return JSON.parse(valor)
    } catch {
      return null
    }
  }
  return valor
}

function filaSolicitud(f) {
  return {
    ...f,
    pendiente_sync: b(f.pendiente_sync),
    adjuntos: aArrayJson(f.adjuntos),
    creado_en: iso(f.creado_en),
    actualizado_en: iso(f.actualizado_en),
  }
}

function filaHistorial(h) {
  return {
    ...h,
    encuesta: jsonONull(h.encuesta),
    creado_en: iso(h.creado_en),
  }
}

// Envuelve un handler async para que los rechazos lleguen al middleware de
// errores en vez de matar el proceso.
const ruta = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Monta req.ctx con correo, nombre y rol leídos del servidor.
async function conContexto(req) {
  req.ctx = await P.contexto(pool, req.correo, req.nombreToken)
  return req.ctx
}

// ---------------------------------------------------------------------------
// Códigos (sustituye las RPC proximo_codigo / siguiente_codigo /
// reiniciar_contador)
// ---------------------------------------------------------------------------
function formatearCodigo(n) {
  return `CTPLOG-${String(n).padStart(5, '0')}`
}

// Todo código que llega del cliente se valida contra este patrón antes de tocar
// nada: es lo que impide que una fila arbitraria se cuele como clave primaria.
const RE_CODIGO = /^CTPLOG-\d{5}$/

function esCodigoValido(c) {
  return typeof c === 'string' && RE_CODIGO.test(c)
}

function numeroDeCodigo(c) {
  return Number(String(c).slice(-5))
}

const LOTE_CODIGOS = 200

// Minutos que una reserva puede seguir viva sin que alguien la reclame. Es el
// margen para subir adjuntos con archivos grandes y terminar el formulario; a
// partir de aquí se considera abandonada.
const VIGENCIA_RESERVA_MIN = 30

// Recupera los códigos que quedaron a medias: el proceso se reinició, el
// navegador se cerró a mitad de la subida, o la creación falló. La reserva sigue
// en la tabla pero no hay fila que la use, así que se borra.
//
// El contador NO se toca salvo que el número liberado sea exactamente el último
// emitido. Retroceder más allá dejaría la secuencia por detrás de una reserva
// viva y volvería a handing out un número que alguien ya tiene. Los huecos que
// queden por medio son inofensivos: en una secuencia, saltarse un número no
// rompe nada (es lo que hacen las secuencias de Postgres y los folios de
// factura); lo que no puede pasar es que falte un registro.
async function liberarReservasVencidas(conexion) {
  // La vigencia se escribe en el SQL con el valor de la constante de arriba, no
  // con un parámetro: MySQL no admite un marcador en la unidad de INTERVAL de
  // forma fiable, y aquí el valor no viene del cliente.
  const [vencidas] = await conexion.execute(
    `DELETE r FROM codigos_reservados r
       LEFT JOIN solicitudes s ON s.codigo = r.codigo
      WHERE r.creado_en < DATE_SUB(NOW(3), INTERVAL ${VIGENCIA_RESERVA_MIN} MINUTE)
        AND s.codigo IS NULL`
  )
  if (!vencidas.length) return 0

  const mayor = vencidas.reduce((acc, r) => Math.max(acc, numeroDeCodigo(r.codigo)), 0)
  const [cont] = await conexion.execute(
    'SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE',
    ['solicitudes_codigo']
  )
  const actual = cont[0] ? Number(cont[0].valor) : 1
  if (mayor + 1 === actual) {
    await conexion.execute(
      'UPDATE contadores SET valor = ? WHERE nombre = ?',
      [mayor, 'solicitudes_codigo']
    )
  }
  console.warn(
    `[Codigos] ${vencidas.length} reserva(s) vencida(s) liberada(s); `
    + `liberada mayor=${formatearCodigo(mayor)}, contador=${actual}`
  )
  return vencidas.length
}

router.get(
  '/codigos/siguiente',
  ruta(async (req, res) => {
    await conContexto(req)
    const [[fila]] = await pool.execute(
      'SELECT valor FROM contadores WHERE nombre = ?',
      ['solicitudes_codigo']
    )
    res.json({ codigo: formatearCodigo(fila ? fila.valor : 1) })
  })
)

// Reserva el siguiente código. La transacción con SELECT ... FOR UPDATE sobre la
// fila del contador es lo que garantiza que dos usuarios no obtengan el mismo
// número a la vez (equivalente a la atomicidad de nextval() en Postgres).
//
// Además deja constancia de a QUIÉN se le entregó, en la misma transacción. Sin
// ese registro el servidor no podría distinguir el código de este usuario del de
// otro, y un POST con un código ajeno se aceptaría como edición (el rol de
// administrador pisa la fila sin avisar).
router.post(
  '/codigos/reservar',
  ruta(async (req, res) => {
    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()

      // Si la fila del contador no existiera, SELECT ... FOR UPDATE no la
      // bloquearía, el UPDATE no tocaría nada y TODOS recibirían CTPLOG-00001.
      // El INSERT ... ON DUPLICATE asegura que existe antes de leerla.
      await conexion.execute(
        `INSERT INTO contadores (nombre, valor) VALUES (?, 1)
           ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
        ['solicitudes_codigo']
      )

      // Primero se recupera lo que quedó a medias de intentos anteriores, para
      // que el número que se entrega ahora sea el primero libre de verdad.
      await liberarReservasVencidas(conexion)

      const [filas] = await conexion.execute(
        'SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE',
        ['solicitudes_codigo']
      )
      const actual = filas[0] ? Number(filas[0].valor) : 1
      const codigo = formatearCodigo(actual)
      await conexion.execute(
        'UPDATE contadores SET valor = ? WHERE nombre = ?',
        [actual + 1, 'solicitudes_codigo']
      )
      await conexion.execute(
        'INSERT INTO codigos_reservados (codigo, correo) VALUES (?, ?)',
        [codigo, String(req.correo || '').trim().toLowerCase()]
      )
      await conexion.commit()
      res.json({ codigo })
    } catch (error) {
      await conexion.rollback()
      throw error
    } finally {
      conexion.release()
    }
  })
)

// Devuelve al contador un código que se reservó pero que nunca llegó a usarse
// (la creación falló al subir los adjuntos o antes de guardar). Sin esto el
// contador avanzaba y el número quedaba consumido sin ninguna fila detrás, que
// es lo que hacía ver que se salían solicitudes.
//
// Solo retrocede si se cumple TODO lo siguiente, para que un código ya publicado
// nunca se recicle ni se duplique:
//   · el número es el último reservado (el contador quedó justo por encima),
//   · no existe ninguna fila en solicitudes con ese código.
// En cualquier otro caso responde liberado: false y el frontend lo ignora.
router.post(
  '/codigos/liberar',
  ruta(async (req, res) => {
    const codigo = String(req.body?.codigo || '').trim()
    if (!esCodigoValido(codigo)) {
      return res.status(400).json({ error: 'Código inválido' })
    }
    const numero = numeroDeCodigo(codigo)

    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()
      const [filas] = await conexion.execute(
        'SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE',
        ['solicitudes_codigo']
      )
      const actual = filas[0] ? Number(filas[0].valor) : 1
      if (numero + 1 !== actual) {
        await conexion.rollback()
        return res.json({ liberado: false })
      }
      const [[enUso]] = await conexion.execute(
        'SELECT 1 AS existe FROM solicitudes WHERE codigo = ? LIMIT 1',
        [codigo]
      )
      if (enUso) {
        await conexion.rollback()
        return res.json({ liberado: false })
      }
      await conexion.execute(
        'UPDATE contadores SET valor = ? WHERE nombre = ?',
        [numero, 'solicitudes_codigo']
      )
      await conexion.execute('DELETE FROM codigos_reservados WHERE codigo = ?', [codigo])
      await conexion.commit()
      res.json({ liberado: true, codigo })
    } catch (error) {
      await conexion.rollback()
      throw error
    } finally {
      conexion.release()
    }
  })
)

// Reinicia el contador (solo privileged). Deja el próximo número en
// max(código existente) + 1; tras borrar todas las solicitudes vuelve a 00001.
router.post(
  '/codigos/reiniciar',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esPrivilegiado(ctx.rol)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    // SUBSTRING_INDEX en lugar de REGEXP_REPLACE: este último solo existe desde
    // MySQL 8.0 y el hosting compartido puede estar en 5.7. Con el LIKE previo,
    // un sufijo no numérico se convierte en 0 y no molesta al MAX.
    await pool.execute(
      `UPDATE contadores
          SET valor = GREATEST(
            COALESCE((SELECT MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED))
                        FROM solicitudes WHERE codigo LIKE 'CTPLOG-%'), 0) + 1,
            1)
        WHERE nombre = 'solicitudes_codigo'`
    )
    res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Clientes (catálogo)
// ---------------------------------------------------------------------------
// Lectura: cualquiera con sesión, porque el selector de clientes de las
// solicitudes lo necesita para todo el mundo.
//
// Escritura: solo superadmin (P.esSuperAdmin), no solo privilegiado. El catálogo
// alimenta datos que ya se usaron en solicitudes antiguas, así que crear,
// editar y borrar quedan para el rol más alto.
//
// Todas las rutas de escritura van por `:id` y no por `:nit` porque la clave
// natural de la tabla es el par (nit, bodega): un mismo NIT puede tener varias
// sedes y el NIT solo no identifica una fila (ver server/sql/schema.mysql.sql).
router.get(
  '/clientes',
  ruta(async (req, res) => {
    await conContexto(req)
    const [filas] = await pool.query(
      'SELECT id, nit, nombre, bodega, zona FROM clientes ORDER BY nombre'
    )
    res.json(filas)
  })
)

// Texto tal cual lo escribió el usuario, sin espacios en los bordes: un NIT con
// un espacio final no coincidiría con el unique (nit, bodega) y dejaría el
// cliente duplicado sin que nadie lo note.
const textoCliente = (v) => String(v === undefined || v === null ? '' : v).trim()

function leerCliente(cuerpo) {
  return {
    nit: textoCliente(cuerpo && cuerpo.nit),
    nombre: textoCliente(cuerpo && cuerpo.nombre),
    bodega: textoCliente(cuerpo && cuerpo.bodega),
    zona: textoCliente(cuerpo && cuerpo.zona),
  }
}

// MySQL lanza el error de la unique (nit, bodega) como excepción. Sin esto el
// modal recibiría un 500 genérico en vez de un 409 que sí puede explicar.
function esDuplicadoCliente(error) {
  return Boolean(error) && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)
}

const DUPLICADO_CLIENTE = { error: 'Ya existe un cliente con ese NIT y esa bodega' }

function idDeCliente(valor) {
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 ? id : null
}

router.post(
  '/clientes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esSuperAdmin(ctx.rol)) {
      return res.status(403).json({ error: 'Solo el super administrador puede crear clientes' })
    }
    const cliente = leerCliente(req.body)
    if (!cliente.nit) return res.status(400).json({ error: 'Falta el NIT' })
    try {
      await pool.execute(
        'INSERT INTO clientes (nit, nombre, bodega, zona) VALUES (?, ?, ?, ?)',
        [cliente.nit, cliente.nombre, cliente.bodega, cliente.zona]
      )
    } catch (error) {
      if (esDuplicadoCliente(error)) return res.status(409).json(DUPLICADO_CLIENTE)
      throw error
    }
    res.status(201).json({ ok: true })
  })
)

router.put(
  '/clientes/:id',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esSuperAdmin(ctx.rol)) {
      return res.status(403).json({ error: 'Solo el super administrador puede editar clientes' })
    }
    const id = idDeCliente(req.params.id)
    if (id === null) return res.status(400).json({ error: 'Cliente inválido' })
    const cliente = leerCliente(req.body)
    if (!cliente.nit) return res.status(400).json({ error: 'Falta el NIT' })
    const [actual] = await pool.execute(
      'SELECT id FROM clientes WHERE id = ?',
      [id]
    )
    if (!actual[0]) return res.status(404).json({ error: 'El cliente no existe' })
    try {
      await pool.execute(
        'UPDATE clientes SET nit = ?, nombre = ?, bodega = ?, zona = ? WHERE id = ?',
        [cliente.nit, cliente.nombre, cliente.bodega, cliente.zona, id]
      )
    } catch (error) {
      if (esDuplicadoCliente(error)) return res.status(409).json(DUPLICADO_CLIENTE)
      throw error
    }
    res.json({ ok: true })
  })
)

// No hay clave foránea desde solicitudes (guarda copia de nombre, nit, bodega y
// zona), así que borrar un cliente no rompe el histórico: las solicitudes viejas
// siguen mostrando los datos con los que se crearon.
router.delete(
  '/clientes/:id',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esSuperAdmin(ctx.rol)) {
      return res.status(403).json({ error: 'Solo el super administrador puede eliminar clientes' })
    }
    const id = idDeCliente(req.params.id)
    if (id === null) return res.status(400).json({ error: 'Cliente inválido' })
    const [resultado] = await pool.execute('DELETE FROM clientes WHERE id = ?', [id])
    if (!resultado.affectedRows) return res.status(404).json({ error: 'El cliente no existe' })
    res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------
// Módulo Inventario: el frontend pega el reporte exportado de Excel y lo guarda
// tal cual. Solo se guardan las columnas ORIGINALES; las calculadas (Estado,
// Días de Vigencia y Días de Inventario por rangos) las calcula el navegador al
// mostrarlas, para que siempre reflejen la fecha de hoy sin volver a subir nada.
//
// Cada subida REEMPLAZA el inventario completo (la hoja de Excel es la fuente de
// verdad) y solo la pueden hacer los roles privilegiados. La tabla se crea sola
// en la primera lectura/escritura, igual que push_suscripciones y
// correos_enviados: un hosting ya desplegado no necesita pegar SQL.
let inventarioCreado = false

async function asegurarInventario() {
  if (inventarioCreado) return true
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS inventario (
        id                INT AUTO_INCREMENT NOT NULL,
        numero_articulo   VARCHAR(64)   NOT NULL DEFAULT '',
        descripcion       VARCHAR(500)  NOT NULL DEFAULT '',
        lote              VARCHAR(64)   NOT NULL DEFAULT '',
        fecha_vencimiento DATE          NULL,
        cantidad          VARCHAR(64)   NOT NULL DEFAULT '',
        dias_inventario   INT           NULL,
        bodega            VARCHAR(120)  NOT NULL DEFAULT '',
        nombre_bodega     VARCHAR(255)  NOT NULL DEFAULT '',
        zona              VARCHAR(120)  NOT NULL DEFAULT '',
        grupo_articulos   VARCHAR(255)  NOT NULL DEFAULT '',
        tipo_bodega       VARCHAR(120)  NOT NULL DEFAULT '',
        comercial         VARCHAR(255)  NOT NULL DEFAULT '',
        creado_en         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY inventario_vencimiento_idx (fecha_vencimiento),
        KEY inventario_articulo_idx (numero_articulo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    inventarioCreado = true
    return true
  } catch (error) {
    // Sin flag a true: se volverá a intentar en la siguiente llamada y el error
    // no se registra cada vez para no llenar el log del hosting.
    console.error(`[Inventario] no se pudo crear/verificar la tabla: ${error?.message}`)
    return false
  }
}

const COLUMNAS_INVENTARIO = [
  'numero_articulo', 'descripcion', 'lote', 'fecha_vencimiento', 'cantidad',
  'dias_inventario', 'bodega', 'nombre_bodega', 'zona', 'grupo_articulos',
  'tipo_bodega', 'comercial',
]

const textoInv = (v, max = 500) =>
  String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max)

// Número tolerante: acepta "1.234,5" (español), "1,234.5" (inglés) y "90".
// Para «Días de inventario» lo que interesa es el entero resultante.
function numeroInv(v) {
  let s = String(v === undefined || v === null ? '' : v).replace(/\s/g, '')
  if (!s) return null
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

// Fecha en formato ISO (aaaa-mm-dd), que es lo que manda el frontend después de
// interpretar el dd/mm/aaaa de Excel. Cualquier otra cosa se guarda vacía.
function fechaInv(v) {
  const s = String(v === undefined || v === null ? '' : v).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// Devuelve la lista de filas como arrays en el orden de COLUMNAS_INVENTARIO,
// null si no hay nada que subir, o 'demasiadas' si se pasa del tope.
function normalizarInventario(cuerpo) {
  const filas = Array.isArray(cuerpo && cuerpo.filas) ? cuerpo.filas : null
  if (!filas || filas.length === 0) return null
  if (filas.length > 20000) return 'demasiadas'
  return filas.map((f) => [
    textoInv(f && f.numero_articulo, 64),
    textoInv(f && f.descripcion),
    textoInv(f && f.lote, 64),
    fechaInv(f && f.fecha_vencimiento),
    textoInv(f && f.cantidad, 64),
    numeroInv(f && f.dias_inventario),
    textoInv(f && f.bodega, 120),
    textoInv(f && f.nombre_bodega),
    textoInv(f && f.zona, 120),
    textoInv(f && f.grupo_articulos),
    textoInv(f && f.tipo_bodega, 120),
    textoInv(f && f.comercial),
  ])
}

router.get(
  '/inventario',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (ctx.rol === 'conductor') {
      return res.status(403).json({ error: 'No autorizado' })
    }
    await asegurarInventario()
    // DATE_FORMAT a texto: así el navegador recibe 'aaaa-mm-dd' sin que la zona
    // horaria del servidor corra el día una casilla hacia atrás.
    const [filas] = await pool.execute(
      `SELECT id, numero_articulo, descripcion, lote,
              DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
              cantidad, dias_inventario, bodega, nombre_bodega, zona,
              grupo_articulos, tipo_bodega, comercial
         FROM inventario
        ORDER BY id`
    )
    // Momento de la última subida. Como cada subida reemplaza todo el
    // inventario, MAX(creado_en) es la fecha en que se cargó la información que
    // se está viendo ahora (null = nunca se ha subido nada).
    const [[{ actualizado_en }]] = await pool.execute(
      'SELECT MAX(creado_en) AS actualizado_en FROM inventario'
    )
    res.json({ actualizadoEn: actualizado_en || null, filas })
  })
)

router.post(
  '/inventario',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esPrivilegiado(ctx.rol)) {
      return res.status(403).json({ error: 'Solo el administrador puede subir el inventario' })
    }
    const filas = normalizarInventario(req.body)
    if (filas === null) return res.status(400).json({ error: 'No hay filas para subir' })
    if (filas === 'demasiadas') {
      return res.status(400).json({ error: 'Máximo 20.000 filas por subida' })
    }
    await asegurarInventario()

    // Reemplazo completo dentro de una transacción: si algo falla a mitad de la
    // inserción no se queda el inventario a medias (vacío o con la mitad).
    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()
      await conexion.execute('DELETE FROM inventario')
      const columnas = `(${COLUMNAS_INVENTARIO.join(', ')})`
      const porTanda = 200
      for (let i = 0; i < filas.length; i += porTanda) {
        const tanda = filas.slice(i, i + porTanda)
        const valores = tanda.map(() => `(${COLUMNAS_INVENTARIO.map(() => '?').join(', ')})`).join(', ')
        await conexion.execute(
          `INSERT INTO inventario ${columnas} VALUES ${valores}`,
          tanda.flat()
        )
      }
      await conexion.commit()
    } catch (error) {
      try { await conexion.rollback() } catch { /* no hay transacción que deshacer */ }
      throw error
    } finally {
      conexion.release()
    }
    res.status(201).json({ ok: true, total: filas.length })
  })
)

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
router.get(
  '/usuarios',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const filtro = P.filtroUsuarios(ctx)
    const [filas] = await pool.execute(
      `SELECT correo, nombre, rol, vehiculo, placa, es_conductor
         FROM usuarios WHERE activo = 1 AND ${filtro.sql} ORDER BY nombre`,
      filtro.params
    )
    res.json(
      filas.map((f) => ({ ...f, es_conductor: b(f.es_conductor), activo: true }))
    )
  })
)

// El alta de usuario la hace POST /api/auth/registro (server/src/rutasAuth.js),
// que es pública y es la que calcula el hash de la contraseña. Aquí ya solo hay
// usuarios que pasaron por ahí.

// Fila del propio usuario. Un endpoint dedicado en vez de GET /usuarios porque
// el frontend solo necesita su rol en cada arranque, y así no depende de que el
// permiso de lectura alcance a toda la tabla.
router.get(
  '/usuarios/yo',
  ruta(async (req, res) => {
    const [filas] = await pool.execute(
      'SELECT correo, nombre, rol, vehiculo, placa, es_conductor, activo FROM usuarios WHERE correo = ? LIMIT 1',
      [req.correo]
    )
    const f = filas[0]
    res.json(
      f
        ? { ...f, es_conductor: b(f.es_conductor), activo: b(f.activo) }
        : null
    )
  })
)

// ---------------------------------------------------------------------------
// Notificaciones push (con la app cerrada)
//
// La clave pública no es un secreto —va incrustada en el bundle del navegador
// que la necesita para suscribirse— pero sí exige sesión: sin ella, cualquiera
// que conozca la URL podría suscribir un dispositivo ajeno y usarlo para medir
// cuántas cuentas hay o simply para no enterarse de nada. Va dentro del router
// protegido por una razón práctica: el frontend la pide justo al arrancar, y
// pedirla antes de tener token devolvería 401 y rompería el arranque.
// ---------------------------------------------------------------------------

// Clave pública VAPID. El frontend la llama antes de preguntar permiso: sin ella
// no tiene con qué firmarse y la suscripción siempre fallaría.
router.get(
  '/notificaciones/push',
  ruta(async (req, res) => {
    res.json({
      // Sin claves el frontend lo sabe y muestra el interruptor apagado con la
      // explicación, en vez de fallar en silencio al activar.
      activo: push.hayClaves,
      clavePublica: push.hayClaves ? config.push.publica : '',
      // Cierra el circuito con el diagnóstico del log de arranque: si alguien
      // pregunta "por qué no me llega", la respuesta está en este objeto.
      detalle: push.hayClaves
        ? 'Las notificaciones push están configuradas en el servidor.'
        : 'El servidor no tiene claves VAPID (faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).',
    })
  })
)

// Verificar si una suscripción concreta (por endpoint) sigue viva en el servidor.
// Lo usa el frontend al activar: si el servidor ya no la tiene, la recrea.
router.get(
  '/notificaciones/push',
  ruta(async (req, res) => {
    const endpoint = String(req.query?.equipo || '').trim()
    if (!endpoint) {
      return res.status(400).json({ error: 'Falta parámetro equipo (endpoint)' })
    }
    const filas = await push.suscripcionesDe([req.correo])
    const existe = filas.some((f) => f.endpoint === endpoint)
    res.json({ existe })
  })
)

// Registrar este dispositivo para recibir avisos aunque la app no esté abierta.
// Idempotente por endpoint: volver a activar en el mismo equipo actualiza la fila
// en vez de crear un duplicado.
router.post(
  '/notificaciones/suscripcion',
  ruta(async (req, res) => {
    const resultado = await push.suscribir(
      req.correo,
      req.body?.subscription || req.body?.suscripcion,
      req.get('user-agent') || ''
    )
    if (!resultado.ok) {
      return res.status(400).json({ error: 'No se pudo registrar la suscripción', motivo: resultado.motivo })
    }
    res.json({ ok: true })
  })
)

// Quitar la suscripción. Con ?equipo=<endpoint> se apaga solo en este navegador;
// sin él, en todos los equipos de la cuenta (es lo que se usa al cerrar sesión).
router.delete(
  '/notificaciones/suscripcion',
  ruta(async (req, res) => {
    const soloEste = String(req.query?.equipo || '').trim()
    await push.desuscribir(req.correo, soloEste)
    res.json({ ok: true })
  })
)

// Prueba de humo: manda un aviso solo a los equipos del propio usuario.
//
// Existe porque configurar VAPID es un ejercicio de fe —no hay forma de saber si
// las claves están bien hasta que llega un push— y el camino de depuración
// ("¿llegará al navegador?") necesita un paso intermedio entre "la API arrancó
// bien" y "a ver si el conductor recibe algo". Sin esto habría que crear una
// solicitud de prueba cada vez.
//
// Deliberadamente NO acepta destinatario: solo puede escribirse en los equipos de
// quien llama. Con destinatario libre sería una vía para que cualquier cuenta
// mandara avisos en nombre de la empresa, que es justo lo que se impidió con el
// correo.
router.post(
  '/notificaciones/prueba',
  ruta(async (req, res) => {
    if (!push.hayClaves) {
      return res.status(503).json({
        error: 'El servidor no tiene claves VAPID configuradas',
        detalle: 'Genera el par con: npx web-push generate-vapid-keys',
      })
    }
    const resultado = await push.enviar([req.correo], {
      titulo: 'PEDRO-CTP · prueba',
      cuerpo: 'Las notificacionespush funcionan en este equipo. Si la ves, ya está todo listo.',
      tag: 'ctp-prueba',
      url: '/inicio',
      datos: { tipo: 'prueba' },
    })
    res.json({ ok: true, ...resultado })
  })
)

router.put(
  '/usuarios/:correo',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const objetivo = String(req.params.correo || '').toLowerCase()
    if (!P.esPrivilegiado(ctx.rol) && objetivo !== ctx.correo) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const { nombre, rol, vehiculo, placa, es_conductor, activo } = req.body || {}
    // Un usuario que no es privileged no puede cambiar su propio rol ni su
    // estado: esos campos son terreno del administrador.
    const privileged = P.esPrivilegiado(ctx.rol)
    const campos = []
    const params = []
    if (nombre !== undefined) {
      campos.push('nombre = ?')
      params.push(nombre)
    }
    if (privileged) {
      if (rol !== undefined) {
        campos.push('rol = ?')
        params.push(rol)
      }
      if (activo !== undefined) {
        campos.push('activo = ?')
        params.push(activo ? 1 : 0)
      }
    }
    if (vehiculo !== undefined) {
      campos.push('vehiculo = ?')
      params.push(vehiculo)
    }
    if (placa !== undefined) {
      campos.push('placa = ?')
      params.push(placa)
    }
    if (es_conductor !== undefined) {
      campos.push('es_conductor = ?')
      params.push(es_conductor ? 1 : 0)
    }
    if (campos.length === 0) return res.json({ ok: true })
    params.push(objetivo)
    await pool.execute(`UPDATE usuarios SET ${campos.join(', ')} WHERE correo = ?`, params)
    res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// POST /api/usuarios/:correo/restablecer-clave
// Restablece la contraseña de un usuario que la olvidó y quedó fuera del sistema.
//
// No hay correo de recuperación en este proyecto (ver /cambiar-clave en
// rutasAuth.js), así que la única vía es que un humano autorizado la ponga de
// nuevo. La autoriza el CORREO_SISTEMAS, no el rol: pueden llamar este
// endpoint solo desde la cuenta de sistemas, ni siquiera los demás superadmins.
// El frontend solo muestra el botón para esa cuenta, y aquí la comprobación se
// repite porque la regla de negocio es el correo, no la interfaz.
//
// Sin cuerpo (o con la clave predeterminada) deja la CLAVE_PREDETERMINADA; con
// {"contrasena": "..."} deja la que se pida. La predeterminada son 7 caracteres
// y es la ÚNICA excepción a C.problema (mínimo 8): se acepta por igualdad con
// la constante, no bajando la regla, así que una clave personalizada de 7
// caracteres sigue siendo 400.
// ---------------------------------------------------------------------------
const CORREO_SISTEMAS = 'sistemas@ctpmedica.com'
const CLAVE_PREDETERMINADA = 'CTP2026'

router.post(
  '/usuarios/:correo/restablecer-clave',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (ctx.correo !== CORREO_SISTEMAS) {
      return res.status(403).json({ error: 'Solo el usuario de sistemas puede restablecer contraseñas' })
    }

    const destino = String(req.params.correo || '').trim().toLowerCase()
    const pedida = String(req.body?.contrasena || '').trim()
    const predeterminada = !pedida || pedida === CLAVE_PREDETERMINADA
    const nueva = predeterminada ? CLAVE_PREDETERMINADA : pedida

    if (!predeterminada) {
      const problema = C.problema(nueva)
      if (problema) return res.status(400).json({ error: problema })
    }

    const [existe] = await pool.execute(
      'SELECT correo FROM usuarios WHERE correo = ? LIMIT 1',
      [destino]
    )
    if (!existe[0]) return res.status(404).json({ error: 'Ese usuario no existe' })

    const hash = await C.hashear(nueva)
    await pool.execute('UPDATE usuarios SET password_hash = ? WHERE correo = ?', [hash, destino])

    console.log(`[Auth] clave restablecida: ${destino} por ${ctx.correo}${predeterminada ? ' (predeterminada)' : ''}`)
    return res.json({ ok: true, predeterminada })
  })
)

// ---------------------------------------------------------------------------
// Solicitudes · lectura
// ---------------------------------------------------------------------------
// GET /api/solicitudes?desde=<ISO watermark>
//
// Devuelve { solicitudes, historial, conHistorial, watermark }. El historial se
// trae solo de las solicitudes cuyo actualizado_en supera la marca de agua, que
// es la sincronización incremental que hacía el frontend con .in('solicitud').
router.get(
  '/solicitudes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const desde = String(req.query.desde || '').trim()
    const filtro = P.filtroSolicitudes(ctx)

    const [filas] = await pool.execute(
      `SELECT * FROM solicitudes
        WHERE ${filtro.sql}
        ORDER BY actualizado_en DESC, codigo DESC`,
      filtro.params
    )

    // La marca de agua es el MAYOR actualizado_en visto (string ISO comparable).
    let watermark = desde
    for (const f of filas) {
      const isoFila = filaSolicitud(f).actualizado_en
      if (isoFila && isoFila > watermark) watermark = isoFila
    }

    const codigos = desde
      ? filas
          .filter((f) => f.actualizado_en && iso(f.actualizado_en) > desde)
          .map((f) => f.codigo)
      : filas.map((f) => f.codigo)

    let registros = []
    if (codigos.length > 0) {
      const filtroHist = P.filtroHistorial(ctx)
      // El marcador `?` de la visibilidad va después de los del IN, así que se
      // pasan primero los códigos del lote y luego los del filtro.
      for (let i = 0; i < codigos.length; i += LOTE_CODIGOS) {
        const lote = codigos.slice(i, i + LOTE_CODIGOS)
        const [hist] = await pool.execute(
          `SELECT * FROM historial
            WHERE solicitud IN (${lote.map(() => '?').join(',')})
              AND ${filtroHist.sql}
            ORDER BY creado_en DESC`,
          [...lote, ...filtroHist.params]
        )
        registros.push(...hist)
      }
    }

    res.json({
      solicitudes: filas.map((f) => filaSolicitud(f)),
      historial: registros.map((h) => filaHistorial(h)),
      conHistorial: codigos,
      watermark,
    })
  })
)

// ---------------------------------------------------------------------------
// Solicitudes · escritura
// ---------------------------------------------------------------------------
const COLUMNAS_SOLICITUD = [
  'fecha_subida',
  'hora_subida',
  'tipo_solicitud',
  'cliente',
  'nit',
  'bodega',
  'zona',
  'cedula',
  'orden_compra',
  'observaciones',
  'adjuntos',
  'solicitante_nombre',
  'solicitante_correo',
  'estado',
  'asignado_a',
  'asignado_correo',
  'conductor',
  'conductor_correo',
  'vehiculo',
  'placa',
  'numero_referencia',
  'creado_por',
  'pendiente_sync',
]

// Normaliza la fila que llega del frontend. Rellena los text NOT NULL que
// puedan venir ausentes y convierte adjuntos a JSON.
function prepararFila(entrada) {
  const fila = {}
  for (const columna of COLUMNAS_SOLICITUD) {
    const valor = entrada[columna]
    if (columna === 'adjuntos') {
      fila[columna] = JSON.stringify(aArrayJson(valor))
    } else if (columna === 'pendiente_sync') {
      fila[columna] = valor ? 1 : 0
    } else {
      fila[columna] = valor === undefined || valor === null ? '' : String(valor)
    }
  }
  // El código es la clave primaria: va aparte porque no es una columna de datos
  // que el frontend pueda mandar en el cuerpo del upsert (el alta pasa por
  // /api/codigos/reservar), pero las consultas siguientes lo necesitan.
  fila.codigo = entrada.codigo === undefined || entrada.codigo === null ? '' : String(entrada.codigo)
  if (!fila.estado) fila.estado = 'Abierto'
  return fila
}

// Escribe el historial de una solicitud (upsert por id). El ON DUPLICATE KEY
// refleja el on conflict (id) do update de la función guardar_solicitud.
async function escribirHistorial(conexion, entradas, ctx) {
  for (const h of entradas) {
    if (!h || !h.id) continue
    const [solicitudes] = await conexion.execute(
      'SELECT codigo, solicitante_correo FROM solicitudes WHERE codigo = ? LIMIT 1',
      [h.solicitud]
    )
    const solicitud = solicitudes[0]
    if (!solicitud) continue
    if (!P.permiteInsertarHistorial(ctx, solicitud) && !P.permiteActualizarHistorial(ctx, solicitud)) {
      return false
    }
    const encuesta = h.encuesta === null || h.encuesta === undefined
      ? null
      : JSON.stringify(h.encuesta)
    await conexion.execute(
      `INSERT INTO historial
         (id, solicitud, campo, anterior, nuevo, nota, referencia, adjunto,
          conductor, vehiculo, placa, evidencia_url, encuesta, persona, fecha, hora)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         campo = VALUES(campo), anterior = VALUES(anterior), nuevo = VALUES(nuevo),
         nota = VALUES(nota), referencia = VALUES(referencia), adjunto = VALUES(adjunto),
         conductor = VALUES(conductor), vehiculo = VALUES(vehiculo), placa = VALUES(placa),
         evidencia_url = VALUES(evidencia_url), encuesta = VALUES(encuesta),
         persona = VALUES(persona), fecha = VALUES(fecha), hora = VALUES(hora)`,
      [
        h.id,
        h.solicitud,
        h.campo || 'estado',
        h.anterior || '',
        h.nuevo || '',
        h.nota || '',
        h.referencia || '',
        h.adjunto || '',
        h.conductor || '',
        h.vehiculo || '',
        h.placa || '',
        h.evidencia_url || '',
        encuesta,
        h.persona || '',
        h.fecha || '',
        h.hora || '',
      ]
    )
  }
  return true
}

// POST /api/solicitudes
// Reemplaza el upsert + el RPC guardar_solicitud. Autoriza con la misma regla
// que la función SECURITY DEFINER y escribe solicitud e historial en una sola
// transacción, que es lo que hacía RLS con el bypass.
//
// El cuerpo dice si es un ALTA (`crear: true`) o una EDICIÓN. Sin esa
// distinción el servidor no puede saber qué hacer cuando el código ya existe, y
// la única opción segura sería rechazar, con lo que las ediciones de las
// solicitudes ya guardadas dejarían de funcionar. Con ella, un alta nunca cae
// en el camino de edición: si el código ya está ocupado, se rechaza con 409 en
// vez de pisar la fila que hubiera.
router.post(
  '/solicitudes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const { fila: entrada, historial = [] } = req.body || {}
    const esAlta = req.body?.crear === true
    if (!entrada || !entrada.codigo) {
      return res.status(400).json({ error: 'Falta el código de la solicitud' })
    }
    // El código es clave primaria: se valida antes de tocar la base, no después.
    if (!esCodigoValido(String(entrada.codigo).trim())) {
      return res.status(400).json({ error: `Código inválido: ${entrada.codigo}` })
    }

    const fila = prepararFila(entrada)
    if (!P.permiteGuardarSolicitud(ctx, fila)) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()

      const [existentes] = await conexion.execute(
        `SELECT codigo, solicitante_correo, estado, asignado_a, asignado_correo,
                conductor, conductor_correo
           FROM solicitudes WHERE codigo = ? FOR UPDATE`,
        [fila.codigo]
      )
      const actual = existentes[0]

      if (actual) {
        // Un alta que llega a un código ocupado NO se convierte en edición: se
        // rechaza. Sin esto, dos administradores guardando a la vez el mismo
        // código (o un cliente que reenvía un alta) pisarían la solicitud
        // existente de abajo abajo, porque permiteActualizarSolicitud devuelve
        // true para administrador y superadmin.
        if (esAlta) {
          await conexion.rollback()
          return res.status(409).json({
            error: `El código ${fila.codigo} ya existe. Recarga y revisa si la solicitud ya se había creado.`,
          })
        }
        if (!P.permiteActualizarSolicitud(ctx, actual, fila)) {
          await conexion.rollback()
          return res.status(403).json({ error: 'No autorizado' })
        }
        const asignaciones = COLUMNAS_SOLICITUD.map((c) => `${c} = ?`)
        await conexion.execute(
          `UPDATE solicitudes SET ${asignaciones.join(', ')}, actualizado_en = CURRENT_TIMESTAMP(3)
            WHERE codigo = ?`,
          [...COLUMNAS_SOLICITUD.map((c) => fila[c]), fila.codigo]
        )
      } else {
        if (!P.permiteInsertarSolicitud(ctx, fila)) {
          await conexion.rollback()
          return res.status(403).json({ error: 'No autorizado' })
        }
        // El alta exige que el código sea uno que la secuencia ya entregara a
        // ESTA cuenta. Sin esta comprobación el servidor aceptaría cualquier
        // código inventado por el cliente, y dos dispositivos podrían acabar
        // peleándose el mismo CTPLOG-xxxxx.
        const [reservas] = await conexion.execute(
          'SELECT correo FROM codigos_reservados WHERE codigo = ? LIMIT 1',
          [fila.codigo]
        )
        if (reservas[0]) {
          if (String(reservas[0].correo || '') !== ctx.correo) {
            await conexion.rollback()
            return res.status(409).json({
              error: `El código ${fila.codigo} está reservado a otra cuenta. Vuelve a pedir un número.`,
            })
          }
        } else {
          // Sin reserva viva: solo se admite si la secuencia ya pasó por ese
          // número (es el camino sin conexión, que deriva el código en local) o
          // si la reserva caducó mientras subía los archivos.
          const [cont] = await conexion.execute(
            'SELECT valor FROM contadores WHERE nombre = ?',
            ['solicitudes_codigo']
          )
          const actual_contador = cont[0] ? Number(cont[0].valor) : 1
          if (numeroDeCodigo(fila.codigo) >= actual_contador) {
            await conexion.rollback()
            return res.status(409).json({
              error: `El código ${fila.codigo} no está reservado. Vuelve a pedir un número.`,
            })
          }
        }
        try {
          await conexion.execute(
            `INSERT INTO solicitudes (codigo, ${COLUMNAS_SOLICITUD.join(', ')})
             VALUES (?, ${COLUMNAS_SOLICITUD.map(() => '?').join(', ')})`,
            [fila.codigo, ...COLUMNAS_SOLICITUD.map((c) => fila[c])]
          )
        } catch (error) {
          // PRIMARY KEY (codigo): si otra transacción escribió este código entre
          // el SELECT ... FOR UPDATE y el INSERT, MySQL lo rejects aquí. Sin
          // esta captura salía un 500 genérico y el frontend lo reintentaba en
          // bucle por siempre.
          if (error?.code === 'ER_DUP_ENTRY') {
            await conexion.rollback()
            return res.status(409).json({
              error: `El código ${fila.codigo} se usó mientras se guardaba. Vuelve a pedir un número.`,
            })
          }
          throw error
        }
        // La reserva se consume: el código ya tiene fila y no hay nada que liberar.
        await conexion.execute('DELETE FROM codigos_reservados WHERE codigo = ?', [fila.codigo])
      }

      const okHistorial = await escribirHistorial(conexion, historial, ctx)
      if (!okHistorial) {
        await conexion.rollback()
        return res.status(403).json({ error: 'No autorizado' })
      }

      await conexion.commit()

      // Carpeta {usuario}/{codigo}, solo en la administrativa.
      //
      // Ahí el adjunto es opcional, así que no se puede esperar al primer archivo
      // para crearla: la carpeta tiene que existir aunque nunca se suba nada. En
      // el resto de tipos los documentos son obligatorios y ya nacen dentro de
      // esta misma ruta al subirlos, así que crearles una carpeta vacía al dar de
      // alta solo dejaría directorios sueltos.
      //
      // Va después del commit y con try/catch: si el disco falla, la solicitud YA
      // está guardada y devolver un error aquí la perdería. Se registra en el log
      // y se sigue. Es idempotente: si la carpeta existe no se toca.
      if (fila.tipo_solicitud === 'ADMINISTRATIVA') {
        try {
          const carpeta = await carpetaUsuario(fila.codigo, ctx)
          await archivos.crearCarpeta(`${carpeta}/${fila.codigo}`)
        } catch (error) {
          console.warn(`[Archivos] no se pudo crear la carpeta de ${fila.codigo}:`, error?.message)
        }
      }

      // Avisos por correo: mala calificación (encuesta ≤ 2.5) y paso a 'Retenido
      // por Cartera'. Es la ÚNICA vía por la que entra un cambio de estado o una
      // encuesta, así que se comprueba aquí y no en dos sitios distintos.
      //
      // Va después del commit, y por lo mismo que la carpeta: el correo es
      // accesorio y despachar() nunca lanza. Si el SMTP está caído, la
      // almacenamiento sigue hecha y solo se pierde el aviso.
      const avisos = correo.planCorreos({ fila, historial })
      if (avisos.length > 0) {
        const enviados = await correo.despachar(avisos)
        if (enviados < avisos.length) {
          console.warn(
            `[Correo] ${avisos.length - enviados} de ${avisos.length} aviso(s) de ${fila.codigo} no salieron`
          )
        }
      }

      // Avisos push: los mismos eventos, pero para cuando la app está CERRADA.
      //
      // Se comparan contra la fila leída con FOR UPDATE (no contra lo que vino
      // del cliente) porque esta es la foto fiable de lo que había antes. Por lo
      // mismo que el correo, va después del commit y no puede tumbar el guardado.
      const actor = { correo: ctx.correo, rol: ctx.rol }
      await push.despachar(null, { anterior: actual || null, fila, actor, historial })

      return res.json({ ok: true, codigo: fila.codigo, avisosCorreo: avisos.length })
    } catch (error) {
      await conexion.rollback()
      throw error
    } finally {
      conexion.release()
    }
  })
)

router.delete(
  '/solicitudes/:codigo',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const codigo = String(req.params.codigo || '')
    const [filas] = await pool.execute(
      'SELECT codigo, solicitante_correo FROM solicitudes WHERE codigo = ? LIMIT 1',
      [codigo]
    )
    const fila = filas[0]
    if (!fila) return res.status(404).json({ error: 'No existe' })
    if (!P.permiteBorrarSolicitud(ctx, fila)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    // El historial cae solo por ON DELETE CASCADE, igual que en Postgres.
    await pool.execute('DELETE FROM solicitudes WHERE codigo = ?', [codigo])
    res.json({ ok: true })
  })
)

router.delete(
  '/solicitudes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const filtro = P.filtroSolicitudes(ctx)
    const [resultado] = await pool.execute(
      `DELETE FROM solicitudes WHERE ${filtro.sql}`,
      filtro.params
    )
    res.json({ ok: true, borradas: resultado.affectedRows })
  })
)

// ---------------------------------------------------------------------------
// Archivos · evidencia (reemplaza el bucket 'evidencias')
// ---------------------------------------------------------------------------
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: archivos.LIMITE_BYTES, files: 1 },
})

// Devuelve el subconjunto de códigos que el usuario puede ver. Sin esto, quien
// supiera un código ajeno podría subirle un archivo o pedir una URL firmada de
// sus evidencias; el bucket de Supabase lo impedían sus políticas sobre
// storage.objects y aquí hay que reconstruirlo contra la tabla de solicitudes.
async function codigosVisibles(ctx, codigos) {
  const unicos = [...new Set(codigos.filter((c) => typeof c === 'string' && c))]
  if (unicos.length === 0) return new Set()
  const filtro = P.filtroSolicitudes(ctx)
  const marcas = unicos.map(() => '?').join(', ')
  const [filas] = await pool.execute(
    `SELECT codigo FROM solicitudes
      WHERE ${filtro.sql} AND codigo IN (${marcas})`,
    [...filtro.params, ...unicos]
  )
  return new Set(filas.map((f) => f.codigo))
}

// Localiza el código de la solicitud dentro de una ruta. Con la estructura
// {usuario}/{codigo}/{tipo}/{nombre} el código ya NO es el primer segmento, así
// que se busca el que tenga forma CTPLOG-#####. Sirve igual para rutas antiguas
// sin carpeta de usuario (el primer segmento ya es el código).
function codigoDeRuta(ruta) {
  const limpio = String(ruta || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const partes = limpio.split('/').filter(Boolean)
  const encontrado = partes.find((p) => /^CTPLOG-\d+/i.test(p))
  return encontrado || partes[0] || ''
}

// Carpeta de usuario bajo la que vive la solicitud. Es el DUEÑO (solicitante), no
// quien sube el archivo, para que todos los documentos de un pedido queden juntos
// aunque los suba después un admin o el conductor. Se resuelve del servidor, nunca
// del cliente, así que no se puede falsear. En la reserva inicial la fila aún no
// existe y quien crea ES el solicitante, así que se usa su nombre de sesión.
async function carpetaUsuario(codigoSolicitud, ctx) {
  const [[fila]] = await pool.execute(
    'SELECT solicitante_nombre, solicitante_correo FROM solicitudes WHERE codigo = ? LIMIT 1',
    [codigoSolicitud]
  )
  if (fila) {
    const nombre = String(fila.solicitante_nombre || '').trim()
    if (nombre) return nombre
    const correo = String(fila.solicitante_correo || '').trim()
    if (correo) {
      const [[usuario]] = await pool.execute(
        'SELECT nombre FROM usuarios WHERE correo = ? LIMIT 1',
        [correo]
      )
      if (usuario && usuario.nombre) return usuario.nombre
    }
  }
  return String(ctx.nombre || '').trim() || ctx.correo || 'solicitudes'
}

router.post(
  '/archivos/evidencia',
  subida.single('archivo'),
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' })
    const { codigo = '', nombre = '' } = req.body || {}
    if (!codigo) return res.status(400).json({ error: 'Falta el código de la solicitud' })
    // `codigo` puede traer subcarpetas detrás: "CTPLOG-00001/FacturasoRemisiones".
    // El permiso se comprueba contra el código de la solicitud, que es el primer
    // segmento, y el resto es dónde acaba el archivo dentro de la carpeta de esa
    // solicitud. Así facturas y evidencias se separan por carpeta sin abrir una
    // ruta nueva, y el frontend sigue distinguiéndolas por la ruta (ver
    // src/utils/pdfUtils.js).
    const codigoSolicitud = codigoDeRuta(codigo)
    const visibles = await codigosVisibles(ctx, [codigoSolicitud])
    if (!visibles.has(codigoSolicitud)) {
      // Al CREAR un pedido los adjuntos se suben con el código recién reservado,
      // antes de que exista la fila en `solicitudes`; por eso no puede estar en
      // `visibles`. Se distingue ese caso del de un código ajeno: si la solicitud
      // no existe todavía y el usuario puede crear solicitudes, es una reserva
      // nueva y se acepta (el archivo queda huérfano hasta que se guarde la fila).
      // Si la solicitud SÍ existe pero no es visible, es de otro usuario → 403.
      const [[existente]] = await pool.execute(
        'SELECT codigo FROM solicitudes WHERE codigo = ? LIMIT 1',
        [codigoSolicitud]
      )
      const puedeCrear = P.permiteInsertarSolicitud(ctx, {
        solicitante_correo: ctx.correo,
        estado: 'Abierto',
      })
      if (existente || !puedeCrear) {
        return res.status(403).json({ error: 'No autorizado' })
      }
    }
    // Estructura final en disco: {usuario}/{codigo}[/{subcarpeta}]/{nombre}. La
    // carpeta de usuario la pone el servidor (dueño de la solicitud); `codigo` ya
    // puede traer la subcarpeta detrás (FacturasoRemisiones, DocEntregas).
    const usuario = await carpetaUsuario(codigoSolicitud, ctx)
    const rutaRel = archivos.guardar(
      `${usuario}/${codigo}`,
      nombre || req.file.originalname,
      req.file.buffer
    )
    res.json({ ruta: rutaRel })
  })
)

// Equivalente a createSignedUrls: devuelve URLs firmadas con 24 h de vigencia
// para las rutas de evidencia que se descargan (no son http, no van a OneDrive).
router.post(
  '/archivos/firmar',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const rutas = Array.isArray(req.body?.rutas) ? req.body.rutas : []
    if (rutas.length > 100) return res.status(400).json({ error: 'Demasiadas rutas' })
    const visibles = await codigosVisibles(ctx, rutas.map(codigoDeRuta))
    const base = `${req.protocol}://${req.get('host')}`
    const firmadas = {}
    for (const ruta of rutas) {
      if (typeof ruta !== 'string' || !ruta || /^https?:\/\//i.test(ruta)) continue
      if (!visibles.has(codigoDeRuta(ruta))) continue
      if (!archivos.existe(ruta)) continue
      firmadas[ruta] = archivos.urlFirmada(ruta, base)
    }
    res.json(firmadas)
  })
)

// Las URLs firmadas no llevan Authorization (van en un <img src>), así que la
// firma HMAC es la que autoriza. Por eso esta ruta vive en el router `publico`,
// montado en index.js antes del middleware autenticar().
publico.get('/archivos/ver', (req, res) => {
  const { ruta = '', exp = '', firma = '' } = req.query
  if (!archivos.verificarFirma(ruta, exp, firma)) {
    return res.status(403).send('Enlace inválido o vencido')
  }
  const destino = archivos.rutaSegura(ruta)
  if (!destino || !archivos.existe(ruta)) return res.status(404).send('No encontrado')

  // Permitir que el archivo se vea en un <iframe> desde el frontend, que vive en
  // otro subdominio. Lo decide la CSP «frame-ancestors»: si el origen que abre el
  // visor no está en la lista, Chrome responde «ha bloqueado esta página» en
  // lugar de mostrar el documento.
  //
  // La lista sale de CORS_ORIGENES, la misma variable que ya admite las
  // peticiones a la API, más el dev server de Vite. Antes estaba escrita a mano y
  // se quedó sin el origen con «www», que es el que usa el sitio: por eso el PDF
  // salía bloqueado dentro del visor.
  //
  // No se manda X-Frame-Options: sus únicos valores válidos son DENY y SAMEORIGIN
  // (ALLOWALL no existe y Chrome lo ignora) y, si estuviera presente junto a la
  // CSP, mandaría sobre ella.
  const frameAncestors = [
    "'self'",
    'http://localhost:5173',
    // Solo orígenes http(s): un '*' o un valor suelto haría la cabecera inválida
    // y el navegador la descartaría entera, que es justo lo que hay que evitar.
    ...config.cors.origenes.filter((o) => /^https?:\/\//i.test(o)),
  ]
    .filter((o, i, lista) => lista.indexOf(o) === i)
    .join(' ')

  res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`)

  res.sendFile(destino)
})

// ---------------------------------------------------------------------------
// Salud
// ---------------------------------------------------------------------------
router.get('/salud', ruta(async (req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true, hora: new Date().toISOString() })
}))

module.exports = {
  protegido: router,
  publico,
  // Solo para test/inventario.test.js: olvida que la tabla de inventario ya se
  // creó, para poder comprobar que se crea sola en el primer uso.
  reiniciarInventarioPruebas: () => { inventarioCreado = false },
}
