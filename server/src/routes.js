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
const crypto = require('crypto')

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

// Código del módulo de recolección: secuencia propia (Rec-00001) para no
// mezclarse con los CTPLOG de las solicitudes.
function formatearCodigoRec(n) {
  return `Rec-${String(n).padStart(5, '0')}`
}

const RE_CODIGO_REC = /^Rec-\d{5}$/i

function esCodigoRecValido(c) {
  return typeof c === 'string' && RE_CODIGO_REC.test(c)
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
        proveedor         VARCHAR(255)  NOT NULL DEFAULT '',
        tipo_bodega       VARCHAR(120)  NOT NULL DEFAULT '',
        comercial         VARCHAR(255)  NOT NULL DEFAULT '',
        creado_en         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY inventario_vencimiento_idx (fecha_vencimiento),
        KEY inventario_articulo_idx (numero_articulo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    // Tablas creadas antes de que existiera «proveedor»: se agrega la columna
    // aquí, de forma idempotente, para no depender de pegar SQL en el hosting.
    // Si la tabla es nueva el CREATE ya la trae y este ALTER falla con «columna
    // duplicada» (código 1060), que se ignora.
    try {
      await pool.execute(
        "ALTER TABLE inventario ADD COLUMN proveedor VARCHAR(255) NOT NULL DEFAULT '' AFTER grupo_articulos"
      )
    } catch (error) {
      const codigo = error?.code || error?.errno
      if (codigo !== 'ER_DUP_FIELDNAME' && codigo !== 1060) {
        console.error(`[Inventario] no se pudo agregar la columna «proveedor»: ${error?.message}`)
      }
    }
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
  'proveedor', 'tipo_bodega', 'comercial',
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
    textoInv(f && f.proveedor),
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
              grupo_articulos, proveedor, tipo_bodega, comercial
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
    if (!P.puedeSubirInventario(ctx)) {
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

    // Aviso general: subir o actualizar el inventario interesa a TODOS los
    // usuarios, no solo a un rol. Va después del commit y nunca puede tumbar el
    // guardado (despacharATodos devuelve ceros si faltan las claves VAPID). El
    // actor queda excluido: ya tiene la pantalla delante con el aviso de éxito.
    await push.despacharATodos(
      {
        titulo: 'Inventario actualizado',
        cuerpo: `${ctx.nombre || 'Un administrador'} subió ${filas.length} artículo(s) al inventario.`,
        tag: 'ctp-inventario',
        url: '/inventario',
        datos: { tipo: 'inventario' },
        // Se muestra aunque haya una pestaña visible: el inventario no tiene el
        // polling sonando que sí tienen las solicitudes, así que sin esto quien
        // tenga la app abierta no se enteraría.
        forzar: true,
      },
      { excluir: [ctx.correo] }
    )

    res.status(201).json({ ok: true, total: filas.length })
  })
)

// ---------------------------------------------------------------------------
// ChatBot Inventario
// ---------------------------------------------------------------------------
// Endpoint para responder preguntas en lenguaje natural sobre el inventario.
// Recibe: { pregunta: "¿Cuántas unidades de BMX hay en Cota?" }
// Devuelve: { respuesta: "...", datos: [...] }
let chatbotCreado = false

async function asegurarChatbot() {
  if (chatbotCreado) return true
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS chatbot_logs (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        correo        VARCHAR(190) NOT NULL,
        pregunta      TEXT         NOT NULL,
        respuesta     TEXT         NOT NULL,
        datos_json    JSON         NULL,
        creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    chatbotCreado = true
    return true
  } catch (error) {
    console.error(`[ChatBot] no se pudo crear/verificar la tabla: ${error?.message}`)
    return false
  }
}

// Patrones de preguntas comunes para consultar el inventario
function analizarPreguntaInventario(pregunta, filas) {
  const p = pregunta.toLowerCase().trim()
  let resultado = { tipo: 'general', filtro: {}, agregacion: 'contar' }

  // Detectar si pregunta por cantidad/unidades
  if (p.includes('cuant') || p.includes('cuánt') || p.includes('cuantas') || p.includes('cuántas') || p.includes('total') || p.includes('suma')) {
    resultado.agregacion = 'sumar'
  } else if (p.includes('promedio') || p.includes('media')) {
    resultado.agregacion = 'promedio'
  } else if (p.includes('listar') || p.includes('mostrar') || p.includes('ver') || p.includes('cuales') || p.includes('cuáles') || p.includes('detalle')) {
    resultado.agregacion = 'listar'
  } else {
    resultado.agregacion = 'contar'
  }

  // Filtrar por bodega/zona (Cota, Bogotá, Nacional, etc.)
  const bodegasConocidas = [...new Set(filas.map(f => f.bodega).filter(Boolean))]
  const zonasConocidas = [...new Set(filas.map(f => f.zona).filter(Boolean))]
  const nombresBodega = [...new Set(filas.map(f => f.nombre_bodega).filter(Boolean))]

  for (const b of bodegasConocidas) {
    if (p.includes(b.toLowerCase())) {
      resultado.filtro.bodega = b
      break
    }
  }
  for (const z of zonasConocidas) {
    if (p.includes(z.toLowerCase())) {
      resultado.filtro.zona = z
      break
    }
  }
  for (const nb of nombresBodega) {
    if (p.includes(nb.toLowerCase())) {
      resultado.filtro.nombre_bodega = nb
      break
    }
  }

  // Filtrar por artículo (número o descripción)
  const articulos = [...new Set(filas.map(f => f.numero_articulo).filter(Boolean))]
  const descripciones = [...new Set(filas.map(f => f.descripcion).filter(Boolean))]
  for (const a of articulos) {
    if (p.includes(a.toLowerCase())) {
      resultado.filtro.numero_articulo = a
      break
    }
  }
  for (const d of descripciones) {
    const palabras = d.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    for (const pal of palabras) {
      if (p.includes(pal)) {
        resultado.filtro.descripcion = d
        break
      }
    }
    if (resultado.filtro.descripcion) break
  }

  // Filtrar por grupo de artículos
  const grupos = [...new Set(filas.map(f => f.grupo_articulos).filter(Boolean))]
  for (const g of grupos) {
    if (p.includes(g.toLowerCase())) {
      resultado.filtro.grupo_articulos = g
      break
    }
  }

  // Filtrar por proveedor
  const proveedores = [...new Set(filas.map(f => f.proveedor).filter(Boolean))]
  for (const prov of proveedores) {
    if (p.includes(prov.toLowerCase())) {
      resultado.filtro.proveedor = prov
      break
    }
  }

  // Filtrar por lote
  const lotes = [...new Set(filas.map(f => f.lote).filter(Boolean))]
  for (const l of lotes) {
    if (p.includes(l.toLowerCase())) {
      resultado.filtro.lote = l
      break
    }
  }

  return resultado
}

function ejecutarConsultaInventario(filas, analisis) {
  let datos = filas

  // Aplicar filtros
  if (analisis.filtro.bodega) {
    datos = datos.filter(f => f.bodega === analisis.filtro.bodega)
  }
  if (analisis.filtro.zona) {
    datos = datos.filter(f => f.zona === analisis.filtro.zona)
  }
  if (analisis.filtro.nombre_bodega) {
    datos = datos.filter(f => f.nombre_bodega === analisis.filtro.nombre_bodega)
  }
  if (analisis.filtro.numero_articulo) {
    datos = datos.filter(f => f.numero_articulo === analisis.filtro.numero_articulo)
  }
  if (analisis.filtro.descripcion) {
    datos = datos.filter(f => f.descripcion === analisis.filtro.descripcion)
  }
  if (analisis.filtro.grupo_articulos) {
    datos = datos.filter(f => f.grupo_articulos === analisis.filtro.grupo_articulos)
  }
  if (analisis.filtro.proveedor) {
    datos = datos.filter(f => f.proveedor === analisis.filtro.proveedor)
  }
  if (analisis.filtro.lote) {
    datos = datos.filter(f => f.lote === analisis.filtro.lote)
  }

  // Ejecutar agregación
  let respuesta = ''
  let resumen = null

  switch (analisis.agregacion) {
    case 'sumar': {
      const total = datos.reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0)
      const partes = []
      if (analisis.filtro.bodega) partes.push(`en bodega ${analisis.filtro.bodega}`)
      if (analisis.filtro.zona) partes.push(`en zona ${analisis.filtro.zona}`)
      if (analisis.filtro.nombre_bodega) partes.push(`en ${analisis.filtro.nombre_bodega}`)
      if (analisis.filtro.numero_articulo) partes.push(`del artículo ${analisis.filtro.numero_articulo}`)
      if (analisis.filtro.descripcion) partes.push(`de "${analisis.filtro.descripcion}"`)
      if (analisis.filtro.grupo_articulos) partes.push(`del grupo ${analisis.filtro.grupo_articulos}`)
      if (analisis.filtro.proveedor) partes.push(`del proveedor ${analisis.filtro.proveedor}`)
      if (analisis.filtro.lote) partes.push(`del lote ${analisis.filtro.lote}`)
      const donde = partes.length ? partes.join(', ') : 'en total'
      respuesta = `Hay ${total.toLocaleString('es-CO')} unidades ${donde}.`
      resumen = { total, registros: datos.length }
      break
    }
    case 'promedio': {
      const cantidades = datos.map(f => Number(f.cantidad) || 0).filter(c => c > 0)
      const promedio = cantidades.length ? cantidades.reduce((a, b) => a + b, 0) / cantidades.length : 0
      respuesta = `El promedio de unidades es ${promedio.toFixed(1)}.`
      resumen = { promedio, registros: datos.length }
      break
    }
    case 'listar': {
      if (datos.length === 0) {
        respuesta = 'No hay artículos que coincidan con tu búsqueda.'
      } else if (datos.length <= 10) {
        const items = datos.map(f => `• ${f.numero_articulo}: ${f.descripcion} — ${Number(f.cantidad || 0).toLocaleString('es-CO')} unds (${f.bodega}${f.nombre_bodega ? ` / ${f.nombre_bodega}` : ''}${f.zona ? ` / ${f.zona}` : ''})`).join('\n')
        respuesta = `Encontré ${datos.length} artículo(s):\n${items}`
      } else {
        const total = datos.reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0)
        respuesta = `Encontré ${datos.length} artículos (${total.toLocaleString('es-CO')} unidades totales). Aquí los primeros 10:\n${datos.slice(0, 10).map(f => `• ${f.numero_articulo}: ${f.descripcion} — ${Number(f.cantidad || 0).toLocaleString('es-CO')} unds`).join('\n')}`
      }
      resumen = { registros: datos.length, total: datos.reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0) }
      break
    }
    case 'contar':
    default: {
      const total = datos.reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0)
      const partes = []
      if (analisis.filtro.bodega) partes.push(`bodega ${analisis.filtro.bodega}`)
      if (analisis.filtro.zona) partes.push(`zona ${analisis.filtro.zona}`)
      if (analisis.filtro.nombre_bodega) partes.push(`${analisis.filtro.nombre_bodega}`)
      if (analisis.filtro.numero_articulo) partes.push(`artículo ${analisis.filtro.numero_articulo}`)
      if (analisis.filtro.descripcion) partes.push(`"${analisis.filtro.descripcion}"`)
      if (analisis.filtro.grupo_articulos) partes.push(`grupo ${analisis.filtro.grupo_articulos}`)
      if (analisis.filtro.proveedor) partes.push(`proveedor ${analisis.filtro.proveedor}`)
      if (analisis.filtro.lote) partes.push(`lote ${analisis.filtro.lote}`)
      const donde = partes.length ? partes.join(', ') : 'el inventario'
      respuesta = `En ${donde} hay ${datos.length} registro(s) (${total.toLocaleString('es-CO')} unidades totales).`
      resumen = { registros: datos.length, total }
      break
    }
  }

  return { respuesta, datos: analisis.agregacion === 'listar' ? datos.slice(0, 20) : [], resumen }
}

router.post(
  '/chatbot/inventario',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (ctx.rol === 'conductor') {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const pregunta = String(req.body?.pregunta || '').trim()
    if (!pregunta) {
      return res.status(400).json({ error: 'Falta la pregunta' })
    }
    const tablaLista = await asegurarChatbot()
    await asegurarInventario()

    // Traer todo el inventario (máx ~20k filas, aceptable para análisis en memoria)
    const [filas] = await pool.execute(
      `SELECT id, numero_articulo, descripcion, lote,
              DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
              cantidad, dias_inventario, bodega, nombre_bodega, zona,
              grupo_articulos, proveedor, tipo_bodega, comercial
         FROM inventario`
    )

    const analisis = analizarPreguntaInventario(pregunta, filas)
    const { respuesta, datos, resumen } = ejecutarConsultaInventario(filas, analisis)

    // Log de la interacción. Es solo trazabilidad: si la tabla no se pudo crear
    // (falta de privilegios en el hosting) o el INSERT falla, la respuesta al
    // usuario no debe caerse por eso.
    if (tablaLista) {
      try {
        await pool.execute(
          'INSERT INTO chatbot_logs (correo, pregunta, respuesta, datos_json) VALUES (?, ?, ?, ?)',
          [ctx.correo, pregunta, respuesta, JSON.stringify(resumen || {})]
        )
      } catch (error) {
        console.error(`[ChatBot] no se pudo registrar la consulta: ${error?.message}`)
      }
    }

    res.json({ respuesta, datos, analisis: analisis.filtro, resumen })
  })
)

// ---------------------------------------------------------------------------
// Recolecciones
// ---------------------------------------------------------------------------
// Módulo propio, hermano del de solicitudes pero con su propia secuencia
// (Rec-00001) y su propio ciclo de vida (Abierto → Trámite → Entregado/Fallido).
// El alta lleva los adjuntos en la MISMA petición (multipart) porque el código
// lo genera el servidor: así no hace falta reservar antes ni tocar el servicio
// de archivos de las solicitudes, y el archivo queda bajo
// recolecciones/{solicitante}/Rec-00001/. La tabla se crea sola en el primer
// uso, igual que
// inventario, push_suscripciones y correos_enviados: un hosting ya desplegado no
// necesita pegar SQL.
let recoleccionesCreado = false

async function asegurarRecolecciones() {
  if (recoleccionesCreado) return true
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS recolecciones (
        codigo            VARCHAR(32)  NOT NULL,
        fecha_subida      VARCHAR(40)  NOT NULL DEFAULT '',
        hora_subida       VARCHAR(40)  NOT NULL DEFAULT '',
        nombre_completo   VARCHAR(190) NOT NULL DEFAULT '',
        correo            VARCHAR(190) NOT NULL DEFAULT '',
        zona              VARCHAR(120) NOT NULL DEFAULT '',
        tipo_servicio     VARCHAR(60)  NOT NULL DEFAULT '',
        recoge_cliente    VARCHAR(255) NOT NULL DEFAULT '',
        recoge_nit        VARCHAR(32)  NOT NULL DEFAULT '',
        recoge_bodega     VARCHAR(120) NOT NULL DEFAULT '',
        fecha_recoleccion VARCHAR(40)  NOT NULL DEFAULT '',
        hora_recoleccion  VARCHAR(40)  NOT NULL DEFAULT '',
        que_recogemos     TEXT         NOT NULL,
        observaciones     TEXT         NOT NULL,
        persona_contacto  VARCHAR(190) NOT NULL DEFAULT '',
        telefono_contacto VARCHAR(40)  NOT NULL DEFAULT '',
        entrega_cliente   VARCHAR(255) NOT NULL DEFAULT '',
        entrega_nit       VARCHAR(32)  NOT NULL DEFAULT '',
        entrega_bodega    VARCHAR(120) NOT NULL DEFAULT '',
        adjuntos          JSON         NOT NULL,
        estado            VARCHAR(40)  NOT NULL DEFAULT 'Abierto',
        asignado_a        VARCHAR(190) NOT NULL DEFAULT '',
        asignado_correo   VARCHAR(190) NOT NULL DEFAULT '',
        conductor         VARCHAR(190) NOT NULL DEFAULT '',
        conductor_correo  VARCHAR(190) NOT NULL DEFAULT '',
        vehiculo          VARCHAR(120) NOT NULL DEFAULT '',
        placa             VARCHAR(20)  NOT NULL DEFAULT '',
        historial         JSON         NULL,
        creado_en         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        actualizado_en    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (codigo),
        KEY recolecciones_estado_idx (estado),
        KEY recolecciones_correo_idx (correo),
        KEY recolecciones_actualizado_idx (actualizado_en)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    // Tablas creadas antes de que existieran «tipo_servicio», «telefono_contacto»
    // o la asignación/historial de la recolección: se agregan aquí de forma
    // idempotente para no depender de pegar SQL en el hosting. Si la tabla es
    // nueva el CREATE ya las trae y estos ALTER fallan con «columna duplicada»
    // (código 1060), que se ignora.
    for (const alter of [
      "ALTER TABLE recolecciones ADD COLUMN tipo_servicio VARCHAR(60) NOT NULL DEFAULT '' AFTER zona",
      "ALTER TABLE recolecciones ADD COLUMN telefono_contacto VARCHAR(40) NOT NULL DEFAULT '' AFTER persona_contacto",
      "ALTER TABLE recolecciones ADD COLUMN asignado_a VARCHAR(190) NOT NULL DEFAULT '' AFTER estado",
      "ALTER TABLE recolecciones ADD COLUMN asignado_correo VARCHAR(190) NOT NULL DEFAULT '' AFTER asignado_a",
      "ALTER TABLE recolecciones ADD COLUMN conductor VARCHAR(190) NOT NULL DEFAULT '' AFTER asignado_correo",
      "ALTER TABLE recolecciones ADD COLUMN conductor_correo VARCHAR(190) NOT NULL DEFAULT '' AFTER conductor",
      "ALTER TABLE recolecciones ADD COLUMN vehiculo VARCHAR(120) NOT NULL DEFAULT '' AFTER conductor_correo",
      "ALTER TABLE recolecciones ADD COLUMN placa VARCHAR(20) NOT NULL DEFAULT '' AFTER vehiculo",
      "ALTER TABLE recolecciones ADD COLUMN historial JSON NULL AFTER asignado_correo",
    ]) {
      try {
        await pool.execute(alter)
      } catch (error) {
        const codigo = error?.code || error?.errno
        if (codigo !== 'ER_DUP_FIELDNAME' && codigo !== 1060 && codigo !== 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.error(`[Recolecciones] no se pudo agregar/quitar una columna: ${error?.message}`)
        }
      }
    }

    // Historial de recolecciones en TABLA propia, igual que el `historial` de
    // solicitudes: así queda consultable desde phpMyAdmin y el frontend recibe la
    // misma forma (array de entradas) que en «Mis solicitudes». Se crea sola en el
    // primer uso, sin pegar SQL en el hosting.
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS recoleccion_historial (
        id            CHAR(36)     NOT NULL,
        recoleccion   VARCHAR(32)  NOT NULL,
        campo         VARCHAR(20)  NOT NULL DEFAULT 'estado',
        anterior      TEXT         NOT NULL,
        nuevo         TEXT         NOT NULL,
        nota          TEXT         NOT NULL,
        referencia    TEXT         NOT NULL,
        adjunto       TEXT         NOT NULL,
        conductor     VARCHAR(190) NOT NULL DEFAULT '',
        vehiculo      VARCHAR(120) NOT NULL DEFAULT '',
        placa         VARCHAR(20)  NOT NULL DEFAULT '',
        evidencia_url TEXT         NOT NULL,
        encuesta      JSON         NULL,
        persona       VARCHAR(190) NOT NULL DEFAULT '',
        fecha         VARCHAR(40)  NOT NULL DEFAULT '',
        hora          VARCHAR(40)  NOT NULL DEFAULT '',
        creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY recoleccion_historial_rec_idx (recoleccion, creado_en),
        KEY recoleccion_historial_campo_idx (campo),
        CONSTRAINT recoleccion_historial_fk
          FOREIGN KEY (recoleccion) REFERENCES recolecciones (codigo) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Migración única: el historial que quedó guardado en la columna JSON de la
    // recolección se pasa a la tabla nueva. INSERT IGNORE por id lo hace
    // idempotente (un reinicio del server no duplica). Se tolera que la columna no
    // exista (instalación nueva o ya migrada).
    try {
      const [conHistorial] = await pool.execute(
        'SELECT codigo, historial FROM recolecciones WHERE historial IS NOT NULL'
      )
      for (const fila of conHistorial) {
        for (const e of aArrayJson(fila.historial)) {
          try {
            await pool.execute(
              `INSERT IGNORE INTO recoleccion_historial
                 (id, recoleccion, campo, anterior, nuevo, nota, referencia, adjunto,
                  conductor, vehiculo, placa, evidencia_url, encuesta, persona, fecha, hora)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                e.id || crypto.randomUUID(),
                fila.codigo,
                e.campo || 'estado',
                e.anterior || '',
                e.nuevo || '',
                e.nota || '',
                e.referencia || '',
                e.adjunto || '',
                e.conductor || '',
                e.vehiculo || '',
                e.placa || '',
                e.evidencia_url || '',
                e.encuesta === null || e.encuesta === undefined ? null : JSON.stringify(e.encuesta),
                e.persona || '',
                e.fecha || '',
                e.hora || '',
              ]
            )
          } catch (error) {
            console.error(`[Recolecciones] no se pudo migrar una entrada de historial: ${error?.message}`)
          }
        }
      }
    } catch (error) {
      console.error(`[Recolecciones] no se pudo migrar el historial JSON: ${error?.message}`)
    }

    await pool.execute(
      `INSERT INTO contadores (nombre, valor) VALUES ('recolecciones_codigo', 1)
         ON DUPLICATE KEY UPDATE nombre = nombre`
    )
    recoleccionesCreado = true
    return true
  } catch (error) {
    console.error(`[Recolecciones] no se pudo crear/verificar la tabla: ${error?.message}`)
    return false
  }
}

const COLUMNAS_RECOLECCION = [
  'fecha_subida', 'hora_subida', 'nombre_completo', 'correo', 'zona', 'tipo_servicio',
  'recoge_cliente', 'recoge_nit', 'recoge_bodega',
  'fecha_recoleccion', 'hora_recoleccion',
  'que_recogemos', 'observaciones', 'persona_contacto', 'telefono_contacto',
  'entrega_cliente', 'entrega_nit', 'entrega_bodega',
  'adjuntos', 'estado',
]

// Columnas del alta: además de las del formulario lleva el responsable que el
// solicitante eligió. En el UPDATE esas dos se tratan aparte (van con su propia
// validación y su entrada de historial), por eso no están en la lista base.
const COLUMNAS_ALTA_RECOLECCION = [...COLUMNAS_RECOLECCION, 'asignado_a', 'asignado_correo']

const textoRec = (v, max = 500) =>
  String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max)

// Texto de un textarea: conserva los saltos de línea (no los colapsa como textoRec).
const textoLargoRec = (v, max = 4000) =>
  String(v === undefined || v === null ? '' : v).trim().slice(0, max)

function leerRecoleccion(cuerpo) {
  const c = cuerpo || {}
  return {
    fecha_subida: textoRec(c.fecha_subida, 40),
    hora_subida: textoRec(c.hora_subida, 40),
    nombre_completo: textoRec(c.nombre_completo, 190),
    correo: textoRec(c.correo, 190).toLowerCase(),
    zona: textoRec(c.zona, 120),
    tipo_servicio: textoRec(c.tipo_servicio, 60),
    recoge_cliente: textoRec(c.recoge_cliente, 255),
    recoge_nit: textoRec(c.recoge_nit, 32),
    recoge_bodega: textoRec(c.recoge_bodega, 120),
    fecha_recoleccion: textoRec(c.fecha_recoleccion, 40),
    hora_recoleccion: textoRec(c.hora_recoleccion, 40),
    que_recogemos: textoLargoRec(c.que_recogemos),
    observaciones: textoLargoRec(c.observaciones),
    persona_contacto: textoRec(c.persona_contacto, 190),
    telefono_contacto: textoRec(c.telefono_contacto, 40),
    entrega_cliente: textoRec(c.entrega_cliente, 255),
    entrega_nit: textoRec(c.entrega_nit, 32),
    entrega_bodega: textoRec(c.entrega_bodega, 120),
    estado: P.ESTADOS_RECOLECCION.includes(c.estado) ? c.estado : 'Abierto',
  }
}

function filaRecoleccion(f) {
  return {
    ...f,
    adjuntos: aArrayJson(f.adjuntos),
    historial: aArrayJson(f.historial),
    creado_en: iso(f.creado_en),
    actualizado_en: iso(f.actualizado_en),
  }
}

// Nombre en disco del adjunto: marca única + nombre original (el guardado sanea
// los separadores). Evita que dos archivos con el mismo nombre se pisen.
function nombreAdjuntoRec(nombre) {
  const original = String(nombre || 'archivo').replace(/[/\\]+/g, '_').slice(0, 140)
  const marca = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `adj_${marca}_${original}`
}

const subidaRec = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: archivos.LIMITE_BYTES, files: 3 },
})

router.get(
  '/recolecciones',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.puedeVerRecolecciones(ctx)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    await asegurarRecolecciones()
    const filtro = P.filtroRecolecciones(ctx)
    const [filas] = await pool.execute(
      `SELECT * FROM recolecciones
        WHERE ${filtro.sql}
        ORDER BY creado_en DESC, codigo DESC`,
      filtro.params
    )

    // El historial vive en su propia tabla (igual que el de solicitudes): se trae
    // para las recolecciones de esta tanda y se adjunta a cada fila, que es la
    // forma que ya espera el frontend (cada recolección con su array `historial`).
    const porRecoleccion = new Map()
    for (let i = 0; i < filas.length; i += LOTE_CODIGOS) {
      const lote = filas.slice(i, i + LOTE_CODIGOS).map((f) => f.codigo)
      const [hist] = await pool.execute(
        `SELECT * FROM recoleccion_historial
          WHERE recoleccion IN (${lote.map(() => '?').join(',')})
          ORDER BY creado_en DESC, id DESC`,
        lote
      )
      for (const h of hist) {
        const arr = porRecoleccion.get(h.recoleccion) || []
        arr.push(filaHistorial(h))
        porRecoleccion.set(h.recoleccion, arr)
      }
    }

    res.json(filas.map((f) => filaRecoleccion({ ...f, historial: porRecoleccion.get(f.codigo) || [] })))
  })
)

router.get(
  '/recolecciones/siguiente',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.puedeVerRecolecciones(ctx)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    await asegurarRecolecciones()
    const [[fila]] = await pool.execute(
      'SELECT valor FROM contadores WHERE nombre = ?',
      ['recolecciones_codigo']
    )
    res.json({ codigo: formatearCodigoRec(fila ? fila.valor : 1) })
  })
)

router.post(
  '/recolecciones',
  subidaRec.array('archivos', 3),
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.permiteCrearRecoleccion(ctx)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    await asegurarRecolecciones()
    const datos = leerRecoleccion(req.body)
    if (!datos.recoge_cliente) {
      return res.status(400).json({ error: 'Falta el cliente de recolección' })
    }
    if (!datos.tipo_servicio) {
      return res.status(400).json({ error: 'Falta el tipo de servicio' })
    }
    if (!datos.que_recogemos) {
      return res.status(400).json({ error: 'Falta indicar qué se recoge' })
    }
    // Responsable obligatorio: el solicitante encarga la recolección a una de las
    // cuatro cuentas de operación. Si falta, o llega un correo fuera del listado,
    // se rechaza el alta en vez de guardarla, porque después nadie sabría quién la
    // tiene.
    const correoResponsable = textoRec(req.body?.asignado_correo, 190).toLowerCase()
    if (!correoResponsable) {
      return res.status(400).json({ error: 'Debes asignar un responsable a la recolección' })
    }
    const responsable = P.responsableRecoleccion(correoResponsable)
    if (!responsable) {
      return res.status(400).json({ error: 'El responsable no está en el listado permitido' })
    }
    const enviados = Array.isArray(req.files) ? req.files : []
    const usuario = String(ctx.nombre || ctx.correo || 'recolecciones').trim()

    const conexion = await pool.getConnection()
    const rutas = []
    let codigo = ''
    try {
      await conexion.beginTransaction()
      // Asegura la fila del contador antes de bloquearla (sin esto, el
      // SELECT ... FOR UPDATE no bloquearía nada y dos altas cogerían el mismo).
      await conexion.execute(
        `INSERT INTO contadores (nombre, valor) VALUES (?, 1)
           ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
        ['recolecciones_codigo']
      )
      const [cont] = await conexion.execute(
        'SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE',
        ['recolecciones_codigo']
      )
      const actual = cont[0] ? Number(cont[0].valor) : 1
      codigo = formatearCodigoRec(actual)
      await conexion.execute(
        'UPDATE contadores SET valor = ? WHERE nombre = ?',
        [actual + 1, 'recolecciones_codigo']
      )

      // La carpeta de la recolección se crea aunque no se suba ningún adjunto: es
      // donde después se guardan la guía de transporte y el documento de entrega,
      // y así queda lista desde el alta para que el operador guarde información.
      // Vive bajo `recolecciones/<solicitante>/<codigo>` (mismo criterio que
      // carpetaUsuario) para que todo lo de la recolección quede junto y separado
      // de las solicitudes.
      const duenio = String(datos.nombre_completo || usuario).trim()
      const carpetaRec = `recolecciones/${duenio}/${codigo}`
      archivos.crearCarpeta(carpetaRec)
      for (const f of enviados) {
        rutas.push(archivos.guardar(carpetaRec, nombreAdjuntoRec(f.originalname), f.buffer))
      }

      const fila = {
        ...datos,
        asignado_a: responsable.nombre,
        asignado_correo: responsable.correo,
        adjuntos: JSON.stringify(rutas),
      }
      await conexion.execute(
        `INSERT INTO recolecciones (codigo, ${COLUMNAS_ALTA_RECOLECCION.join(', ')})
         VALUES (?, ${COLUMNAS_ALTA_RECOLECCION.map(() => '?').join(', ')})`,
        [codigo, ...COLUMNAS_ALTA_RECOLECCION.map((c) => fila[c])]
      )
      await conexion.commit()
    } catch (error) {
      try { await conexion.rollback() } catch { /* sin transacción que deshacer */ }
      // Los archivos ya escritos no deben quedar huérfanos si la fila no llegó a
      // guardarse.
      for (const r of rutas) {
        try { archivos.borrar(r) } catch { /* basura en disco, no es fatal */ }
      }
      throw error
    } finally {
      conexion.release()
    }

    res.status(201).json({ ok: true, codigo, adjuntos: rutas })
  })
)

router.put(
  '/recolecciones/:codigo',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    await asegurarRecolecciones()
    const codigo = String(req.params.codigo || '')
    if (!esCodigoRecValido(codigo)) {
      return res.status(400).json({ error: 'Código inválido' })
    }
    const [filas] = await pool.execute(
      'SELECT * FROM recolecciones WHERE codigo = ? LIMIT 1',
      [codigo]
    )
    const actual = filas[0]
    if (!actual) return res.status(404).json({ error: 'No existe la recolección' })
    if (!P.permiteActualizarRecoleccion(ctx, actual)) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    // Solo se actualizan las columnas que llegaron en el cuerpo: así un cambio de
    // estado no borra el resto de los datos por no reenviarlos.
    const cuerpo = req.body || {}
    const tiene = (k) => Object.prototype.hasOwnProperty.call(cuerpo, k)
    const esPrivilegiado = P.esPrivilegiado(ctx.rol)
    const conductorAsignado = P.esConductorDeRecoleccion(ctx, actual)

    // Asignar responsable y asignar conductor (con vehículo y placa) son gestiones
    // de un privilegiado: los botones viven en el tab Recolecciones del
    // Administrador.
    const tocaAsignacion =
      tiene('asignado_a') || tiene('asignado_correo') ||
      tiene('conductor') || tiene('conductor_correo') ||
      tiene('vehiculo') || tiene('placa')
    if (tocaAsignacion && !esPrivilegiado) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    // Cambiar el estado: un privilegiado, o el conductor asignado sobre su propia
    // recogida (desde el tab «Recogidas»). El dueño no cambia el estado salvo para
    // REENVIAR su recolección devuelta: cuando está en «Devolución a Solicitante»
    // puede corregir los datos y volver a dejarla en «Abierto», igual que en las
    // solicitudes. Cualquier otro destino sigue vetado para él.
    const esDueno =
      Boolean(String(ctx.correo || '').trim()) &&
      String(actual.correo || '').trim().toLowerCase() === String(ctx.correo || '').trim().toLowerCase()
    const reenviaDevuelta =
      esDueno && actual.estado === 'Devolución a Solicitante' && cuerpo.estado === 'Abierto'
    if (tiene('estado') && !esPrivilegiado && !conductorAsignado && !reenviaDevuelta) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    // Un conductor solo mueve el estado (y su nota) de su recogida: se ignora
    // cualquier otra columna que intente escribir.
    const soloConductor = !esPrivilegiado && conductorAsignado

    // El responsable solo puede ser uno del listado cerrado: se valida el correo
    // y el nombre se toma del listado, para que no quede guardado un par
    // nombre/correo desalineado.
    let responsable = null
    if (tiene('asignado_correo')) {
      const correoNuevo = textoRec(cuerpo.asignado_correo, 190).toLowerCase()
      if (correoNuevo) {
        responsable = P.responsableRecoleccion(correoNuevo)
        if (!responsable) {
          return res.status(400).json({ error: 'El responsable no está en el listado permitido' })
        }
      }
    }

    // Conductor asignado (con vehículo y placa) al pasar a «En Tránsito»: solo lo
    // escribe un privilegiado. `null` significa «no vino en el cuerpo», distinto
    // de '' que sí desasigna.
    const conductorNuevo = tiene('conductor') ? textoRec(cuerpo.conductor, 190) : null
    const conductorCorreoNuevo = tiene('conductor_correo') ? textoRec(cuerpo.conductor_correo, 190).toLowerCase() : null
    const vehiculoNuevo = tiene('vehiculo') ? textoRec(cuerpo.vehiculo, 120) : null
    const placaNueva = tiene('placa') ? textoRec(cuerpo.placa, 20) : null

    // Prepara entradas de historial para cambios de estado y asignación
    const historialEntradas = []
    const ahora = new Date()
    const fechaHoy = ahora.toLocaleDateString('es-ES')
    const horaAhora = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const persona = ctx.nombre || ctx.correo || ''

    // Cambio de estado. El «N° de guía» del trámite llega como `referencia` y sus
    // PDF como `guiaUrls`: se guardan en la MISMA entrada de historial del estado,
    // igual que la factura/remisión de una solicitud.
    const referenciaGuia = textoRec(cuerpo.referencia, 190)
    const guiaUrls = aArrayJson(cuerpo.guiaUrls).filter((u) => typeof u === 'string' && u)
    const adjuntoGuia = guiaUrls.join(', ')
    const notaCambio = textoLargoRec(cuerpo.nota)
    if (tiene('estado')) {
      const nuevoEstado = cuerpo.estado
      if (!P.ESTADOS_RECOLECCION.includes(nuevoEstado)) {
        return res.status(400).json({ error: 'Estado inválido' })
      }
      // Entrada propia cuando cambia el estado, cuando se adjunta una guía nueva
      // o cuando se reaplica «En Trámite» con una observación (como en solicitudes).
      const reaplicaTramite = P.ESTADOS_TRAMITE.includes(nuevoEstado) && Boolean(notaCambio)
      if (nuevoEstado !== actual.estado || referenciaGuia || adjuntoGuia || reaplicaTramite) {
        historialEntradas.push({
          id: crypto.randomUUID(),
          recoleccion: codigo,
          campo: 'estado',
          anterior: actual.estado || 'Abierto',
          nuevo: nuevoEstado,
          nota: notaCambio,
          referencia: referenciaGuia,
          adjunto: adjuntoGuia,
          conductor: '',
          vehiculo: '',
          placa: '',
          evidencia_url: '',
          encuesta: null,
          persona,
          fecha: fechaHoy,
          hora: horaAhora,
        })
      }
    }

    // Cambio de asignación
    const asignadoActual = actual.asignado_a || ''
    const asignadoCorreoActual = actual.asignado_correo || ''
    const nuevoAsignado = responsable ? responsable.nombre : cuerpo.asignado_a
    const nuevoAsignadoCorreo = responsable ? responsable.correo : cuerpo.asignado_correo
    if (
      (Object.prototype.hasOwnProperty.call(cuerpo, 'asignado_a') && nuevoAsignado !== asignadoActual) ||
      (Object.prototype.hasOwnProperty.call(cuerpo, 'asignado_correo') && nuevoAsignadoCorreo !== asignadoCorreoActual)
    ) {
      historialEntradas.push({
        id: crypto.randomUUID(),
        recoleccion: codigo,
        campo: 'asignado',
        anterior: asignadoActual || 'Sin asignar',
        nuevo: nuevoAsignado || 'Sin asignar',
        nota: cuerpo.nota || '',
        referencia: '',
        adjunto: '',
        conductor: '',
        vehiculo: '',
        placa: '',
        evidencia_url: '',
        encuesta: null,
        persona,
        fecha: fechaHoy,
        hora: horaAhora,
      })
    }

    // Asignación de conductor (al pasar a «En Tránsito»): queda su entrada de
    // historial con el transporte, igual que en las solicitudes.
    if (conductorNuevo !== null && conductorNuevo !== (actual.conductor || '')) {
      historialEntradas.push({
        id: crypto.randomUUID(),
        recoleccion: codigo,
        campo: 'conductor',
        anterior: actual.conductor || 'Sin conductor',
        nuevo: conductorNuevo || 'Sin conductor',
        nota: cuerpo.nota || '',
        referencia: '',
        adjunto: '',
        conductor: conductorNuevo || '',
        vehiculo: vehiculoNuevo || '',
        placa: placaNueva || '',
        evidencia_url: '',
        encuesta: null,
        persona,
        fecha: fechaHoy,
        hora: horaAhora,
      })
    }

    const cambios = []
    const params = []
    for (const col of COLUMNAS_RECOLECCION) {
      if (!Object.prototype.hasOwnProperty.call(cuerpo, col)) continue
      // Un conductor solo escribe el estado de su recogida.
      if (soloConductor && col !== 'estado') continue
      let valor
      if (col === 'adjuntos') {
        valor = JSON.stringify(aArrayJson(cuerpo[col]))
      } else if (col === 'estado') {
        if (!P.ESTADOS_RECOLECCION.includes(cuerpo[col])) {
          return res.status(400).json({ error: 'Estado inválido' })
        }
        valor = cuerpo[col]
      } else if (col === 'que_recogemos' || col === 'observaciones') {
        valor = textoLargoRec(cuerpo[col])
      } else {
        valor = textoRec(cuerpo[col], 255)
      }
      cambios.push(`${col} = ?`)
      params.push(valor)
    }
    // Con responsable válido se escriben las dos columnas juntas (nombre y correo
    // salen del listado). Sin él se respeta lo que llegó, que puede ser un vacío
    // para desasignar.
    if (responsable) {
      cambios.push('asignado_a = ?', 'asignado_correo = ?')
      params.push(responsable.nombre, responsable.correo)
    } else {
      if (Object.prototype.hasOwnProperty.call(cuerpo, 'asignado_a')) {
        cambios.push('asignado_a = ?')
        params.push(textoRec(cuerpo.asignado_a, 190))
      }
      if (Object.prototype.hasOwnProperty.call(cuerpo, 'asignado_correo')) {
        cambios.push('asignado_correo = ?')
        params.push(textoRec(cuerpo.asignado_correo, 190).toLowerCase())
      }
    }
    // Columnas del conductor y su transporte (solo privilegiado; ya validado).
    if (conductorNuevo !== null) { cambios.push('conductor = ?'); params.push(conductorNuevo) }
    if (conductorCorreoNuevo !== null) { cambios.push('conductor_correo = ?'); params.push(conductorCorreoNuevo) }
    if (vehiculoNuevo !== null) { cambios.push('vehiculo = ?'); params.push(vehiculoNuevo) }
    if (placaNueva !== null) { cambios.push('placa = ?'); params.push(placaNueva) }
if (cambios.length === 0 && historialEntradas.length === 0) return res.json({ ok: true })

    // Se actualizan las columnas que cambiaron y se sella actualizado_en (la marca
    // que usa el polling del frontend para detectar cambios).
    params.push(codigo)
    await pool.execute(
      `UPDATE recolecciones
          SET ${cambios.length > 0 ? `${cambios.join(', ')}, ` : ''}actualizado_en = CURRENT_TIMESTAMP(3)
        WHERE codigo = ?`,
      params
    )

    // El historial se escribe en su tabla, una fila por cambio (como en
    // solicitudes), no en una columna JSON.
    for (const h of historialEntradas) {
      await pool.execute(
        `INSERT INTO recoleccion_historial
           (id, recoleccion, campo, anterior, nuevo, nota, referencia, adjunto,
            conductor, vehiculo, placa, evidencia_url, encuesta, persona, fecha, hora)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          h.id,
          h.recoleccion,
          h.campo,
          h.anterior || '',
          h.nuevo || '',
          h.nota || '',
          h.referencia || '',
          h.adjunto || '',
          h.conductor || '',
          h.vehiculo || '',
          h.placa || '',
          h.evidencia_url || '',
          h.encuesta === null || h.encuesta === undefined ? null : JSON.stringify(h.encuesta),
          h.persona || '',
          h.fecha || '',
          h.hora || '',
        ]
      )
    }

    res.json({ ok: true })
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
// Ajustes: módulos visibles para los solicitantes
// ---------------------------------------------------------------------------
// Tabla clave/valor creada en el primer uso (mismo criterio que recolecciones e
// inventario: un hosting desplegado no necesita pegar SQL). Para los solicitantes
// la lista de módulos es configurable desde «Usuarios y claves»: hay módulos
// nuevos que se activan para el resto de roles pero se ocultan a los solicitantes.
let ajustesCreado = false

async function asegurarAjustes() {
  if (ajustesCreado) return true
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ajustes (
        clave          VARCHAR(64) NOT NULL,
        valor          TEXT        NOT NULL,
        actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                    ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (clave)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    ajustesCreado = true
    return true
  } catch (error) {
    console.error(`[Ajustes] no se pudo crear/verificar la tabla: ${error?.message}`)
    return false
  }
}

const CLAVE_MODULOS_SOLICITANTE = 'modulos_solicitante'

async function leerModulosSolicitante() {
  await asegurarAjustes()
  const [filas] = await pool.execute(
    'SELECT valor FROM ajustes WHERE clave = ? LIMIT 1',
    [CLAVE_MODULOS_SOLICITANTE]
  )
  return P.normalizarModulosSolicitante(filas[0]?.valor)
}

// La lee cualquier usuario con sesión: el frontend necesita saber qué módulos
// mostrar antes de pintar el menú y los guards.
router.get(
  '/ajustes/modulos-solicitante',
  ruta(async (_req, res) => {
    res.json({ modulos: await leerModulosSolicitante() })
  })
)

// La escribe un privilegiado o la cuenta de sistemas (la misma que abre el modal
// «Usuarios y claves»). La lista se normaliza: se descartan valores desconocidos
// e Inicio nunca se puede quitar.
router.put(
  '/ajustes/modulos-solicitante',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esPrivilegiado(ctx.rol) && ctx.correo !== CORREO_SISTEMAS) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const modulos = P.normalizarModulosSolicitante(req.body?.modulos)
    await asegurarAjustes()
    await pool.execute(
      `INSERT INTO ajustes (clave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [CLAVE_MODULOS_SOLICITANTE, JSON.stringify(modulos)]
    )
    console.log(`[Ajustes] módulos de solicitante: ${modulos.join(', ')} (por ${ctx.correo})`)
    res.json({ ok: true, modulos })
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
  const visibles = new Set(filas.map((f) => f.codigo))

  // Los adjuntos de una recolección viven bajo su propio código (Rec-xxxxx),
  // así que se autorizan contra la tabla recolecciones con el mismo criterio de
  // visibilidad. El try/catch cubre el caso de una instalación recién nacida en
  // la que la tabla todavía no existe (se crea sola en el primer uso).
  if (P.puedeVerRecolecciones(ctx)) {
    try {
      const filtroRec = P.filtroRecolecciones(ctx)
      const [recs] = await pool.execute(
        `SELECT codigo FROM recolecciones
          WHERE ${filtroRec.sql} AND codigo IN (${marcas})`,
        [...filtroRec.params, ...unicos]
      )
      for (const r of recs) visibles.add(r.codigo)
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.errno !== 1146) throw error
    }
  }
  return visibles
}

// Localiza el código de la solicitud dentro de una ruta. Con la estructura
// {usuario}/{codigo}/{tipo}/{nombre} el código ya NO es el primer segmento, así
// que se busca el que tenga forma CTPLOG-#####. Sirve igual para rutas antiguas
// sin carpeta de usuario (el primer segmento ya es el código).
function codigoDeRuta(ruta) {
  const limpio = String(ruta || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const partes = limpio.split('/').filter(Boolean)
  const encontrado = partes.find((p) => /^(CTPLOG|Rec)-\d+/i.test(p))
  return encontrado || partes[0] || ''
}

// Carpeta de usuario bajo la que vive la solicitud. Es el DUEÑO (solicitante), no
// quien sube el archivo, para que todos los documentos de un pedido queden juntos
// aunque los suba después un admin o el conductor. Se resuelve del servidor, nunca
// del cliente, así que no se puede falsear. En la reserva inicial la fila aún no
// existe y quien crea ES el solicitante, así que se usa su nombre de sesión.
async function carpetaUsuario(codigoSolicitud, ctx) {
  // Las recolecciones viven bajo su propia raíz (`recolecciones/<solicitante>/…`)
  // para que sus guías y documentos de entrega no se revuelvan con los adjuntos
  // de las solicitudes NI caigan en la carpeta de quien sube el archivo (p. ej.
  // el admin que gestiona el trámite). El dueño se resuelve del servidor, nunca
  // del cliente. Antes esto caía al nombre de la sesión y generaba dos rutas
  // distintas para la misma recolección.
  if (/^Rec-/i.test(String(codigoSolicitud || ''))) {
    const [[rec]] = await pool.execute(
      'SELECT nombre_completo, correo FROM recolecciones WHERE codigo = ? LIMIT 1',
      [codigoSolicitud]
    )
    if (rec) {
      const nombre = String(rec.nombre_completo || '').trim()
      if (nombre) return `recolecciones/${nombre}`
      const correo = String(rec.correo || '').trim()
      if (correo) {
        const [[usuario]] = await pool.execute(
          'SELECT nombre FROM usuarios WHERE correo = ? LIMIT 1',
          [correo]
        )
        if (usuario && usuario.nombre) return `recolecciones/${usuario.nombre}`
      }
    }
    const propio = String(ctx.nombre || '').trim()
    return propio ? `recolecciones/${propio}` : 'recolecciones'
  }

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

// Extrae la ruta cruda de lo que venga del cliente. El store guarda el
// `adjunto` como ruta al subirlo, pero al RE-descargar las solicitudes lo guarda
// ya firmado (/api/archivos/ver?ruta=…), y de ahí hay que volver a la ruta para
// poder compararla con lo que hay en la base y borrar el archivo de disco.
function rutaCruda(valor) {
  const v = String(valor || '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v)
      return u.searchParams.get('ruta') || u.searchParams.get('id') || ''
    } catch {
      return ''
    }
  }
  return v
}

// Quita una factura o remisión mal cargada mientras la solicitud sigue en
// «En Trámite» o «En Trámite Parcial», para que quepa subir la correcta sin
// desbordar el tope de 3 PDFs por solicitud.
//
// El orden de la limpieza importa: PRIMERO la base y DESPUÉS el disco. Si el
// disco llegara a fallar quedaría un archivo sin referencias, que es solo
// basura; al revés, la base quedaría apuntando a un archivo que ya no existe y
// el visor abriría un 404 en la lista de documentos.
//
// Toca solo `historial.adjunto` (donde viven las facturas del trámite) y
// `solicitudes.adjuntos` por si una fila antigua la trae; la evidencia de la
// entrega (evidencia_url) no se toca, que es de otra etapa del ciclo.
router.post(
  '/archivos/borrar',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const objetivo = rutaCruda(req.body?.ruta)
    if (!objetivo) return res.status(400).json({ error: 'Falta la ruta del archivo' })
    // Subir y borrar facturas es cosa de administrador/superadmin: el mismo
    // panel (EstadosModal) que las sube es el que las borra.
    if (!P.esPrivilegiado(ctx.rol)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const limpio = String(objetivo).replace(/\\/g, '/').replace(/^\/+/, '')
    if (/^https?:\/\//i.test(limpio)) {
      return res.status(400).json({ error: 'Ruta no válida' })
    }
    // Sin segmentos '.' ni '..': rutaSegura solo impide salir de la raíz de
    // evidencias, así que sin este filtro un '../Evidencias/foto.jpg' seguiría
    // dentro y se colaría por la comprobación de la carpeta de facturas.
    if (limpio.split('/').some((seg) => seg === '.' || seg === '..')) {
      return res.status(400).json({ error: 'Ruta no válida' })
    }
    // El borrado se limita a la carpeta de facturas/remisiones (solicitudes) y a
    // la de guías de transporte (recolecciones): los adjuntos de la creación y la
    // evidencia de la entrega no se pueden tirar por aquí.
    const esFactura = /(^|\/)FacturasoRemisiones\//i.test(limpio)
    const esGuia = /(^|\/)GuiasTransporte\//i.test(limpio)
    if (!esFactura && !esGuia) {
      return res.status(400).json({ error: 'Solo se pueden borrar facturas, remisiones o guías de transporte del trámite' })
    }
    if (!archivos.rutaSegura(limpio)) {
      return res.status(400).json({ error: 'Ruta no válida' })
    }

    const codigo = codigoDeRuta(limpio)
    const visibles = await codigosVisibles(ctx, [codigo])
    if (!visibles.has(codigo)) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const conexion = await pool.getConnection()
    let quitadas = 0
    try {
      await conexion.beginTransaction()

      // Una guía de transporte lleva código Rec- y su referencia vive en
      // recoleccion_historial; el resto es el trámite de una solicitud (historial).
      if (/^Rec-/i.test(codigo)) {
        const [recs] = await conexion.execute(
          'SELECT estado FROM recolecciones WHERE codigo = ? LIMIT 1',
          [codigo]
        )
        if (!recs[0]) {
          await conexion.rollback()
          return res.status(404).json({ error: 'No existe la recolección' })
        }
        if (!P.ESTADOS_TRAMITE.includes(recs[0].estado)) {
          await conexion.rollback()
          return res.status(409).json({ error: 'La recolección no está en trámite' })
        }
        const [regsRec] = await conexion.execute(
          'SELECT id, adjunto FROM recoleccion_historial WHERE recoleccion = ?',
          [codigo]
        )
        for (const reg of regsRec) {
          const entradas = String(reg.adjunto || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
          if (entradas.length === 0) continue
          const restantes = entradas.filter((e) => rutaCruda(e) !== limpio)
          if (restantes.length === entradas.length) continue
          quitadas += entradas.length - restantes.length
          await conexion.execute('UPDATE recoleccion_historial SET adjunto = ? WHERE id = ?', [
            restantes.join(', '),
            reg.id,
          ])
        }
        if (quitadas > 0) {
          await conexion.execute(
            'UPDATE recolecciones SET actualizado_en = CURRENT_TIMESTAMP(3) WHERE codigo = ?',
            [codigo]
          )
        }
      } else {
        const [filas] = await conexion.execute(
          'SELECT estado FROM solicitudes WHERE codigo = ? LIMIT 1',
          [codigo]
        )
        if (!filas[0]) {
          await conexion.rollback()
          return res.status(404).json({ error: 'No existe la solicitud' })
        }
        // Fuera de los estados de trámite no hay facturas que corregir y borrar
        // documentos aquí rompería el registro de lo que se entregó.
        if (!P.ESTADOS_TRAMITE.includes(filas[0].estado)) {
          await conexion.rollback()
          return res.status(409).json({ error: 'La solicitud no está en trámite' })
        }

        // El adjunto es un CSV separado por ', ' con las varias facturas de una
        // misma tanda, así que se filtra la ruta y se reescribe la celda. Se
        // normaliza cada entrada porque puede estar guardada como URL firmada.
        const [registros] = await conexion.execute(
          'SELECT id, adjunto FROM historial WHERE solicitud = ?',
          [codigo]
        )
        for (const reg of registros) {
          const entradas = String(reg.adjunto || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
          if (entradas.length === 0) continue
          const restantes = entradas.filter((e) => rutaCruda(e) !== limpio)
          if (restantes.length === entradas.length) continue
          quitadas += entradas.length - restantes.length
          await conexion.execute('UPDATE historial SET adjunto = ? WHERE id = ?', [
            restantes.join(', '),
            reg.id,
          ])
        }

        // La lista de adjuntos de la solicitud no guarda facturas en el flujo
        // normal, pero una fila antigua podría traerla: se limpia también para que
        // no quede un enlace muerto en el visor de documentos.
        const [sols] = await conexion.execute(
          'SELECT adjuntos FROM solicitudes WHERE codigo = ? LIMIT 1',
          [codigo]
        )
        const adjuntos = aArrayJson(sols[0]?.adjuntos)
        const restantesAdj = adjuntos.filter((u) => rutaCruda(u) !== limpio)
        if (restantesAdj.length !== adjuntos.length) {
          quitadas += adjuntos.length - restantesAdj.length
          await conexion.execute('UPDATE solicitudes SET adjuntos = ? WHERE codigo = ?', [
            JSON.stringify(restantesAdj),
            codigo,
          ])
        }

        // La marca de agua es lo que hace que los demás dispositivos re-descarguen
        // el historial de ESTA solicitud en el siguiente tick de 8 s. Sin subirla
        // seguirían con la referencia vieja en local y, al guardar cualquier cosa
        // desde allí, la devolverían a la base con el upsert del historial.
        if (quitadas > 0) {
          await conexion.execute(
            'UPDATE solicitudes SET actualizado_en = CURRENT_TIMESTAMP(3) WHERE codigo = ?',
            [codigo]
          )
        }
      }

      await conexion.commit()
    } catch (error) {
      await conexion.rollback()
      throw error
    } finally {
      conexion.release()
    }

    // El disco va después del commit, con try/catch: si falla, la base ya no
    // apunta al archivo y el error no debe tumbar la operación (queda un
    // archivo huérfano que se registra en el log).
    try {
      archivos.borrar(limpio)
    } catch (error) {
      console.warn(`[Archivos] no se pudo borrar ${limpio}:`, error?.message)
    }

    console.info(`[Archivos] factura ${limpio} quitada de ${codigo} (${quitadas} referencia(s))`)
    res.json({ ok: true, quitadas })
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
