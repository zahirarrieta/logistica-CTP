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
const archivos = require('./archivos')

const router = express.Router()

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

const LOTE_CODIGOS = 200

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
router.post(
  '/codigos/reservar',
  ruta(async (req, res) => {
    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()
      const [filas] = await conexion.execute(
        'SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE',
        ['solicitudes_codigo']
      )
      const actual = filas[0] ? Number(filas[0].valor) : 1
      await conexion.execute(
        'UPDATE contadores SET valor = ? WHERE nombre = ?',
        [actual + 1, 'solicitudes_codigo']
      )
      await conexion.commit()
      res.json({ codigo: formatearCodigo(actual) })
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
// Clientes (catálogo de lectura; solo privileged escribe)
// ---------------------------------------------------------------------------
router.get(
  '/clientes',
  ruta(async (req, res) => {
    await conContexto(req)
    const [filas] = await pool.query(
      'SELECT nit, nombre, bodega, zona FROM clientes ORDER BY nombre'
    )
    res.json(filas)
  })
)

router.post(
  '/clientes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!P.esPrivilegiado(ctx.rol)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const { nit, nombre = '', bodega = '', zona = '' } = req.body || {}
    if (!nit) return res.status(400).json({ error: 'Falta el NIT' })
    await pool.execute(
      'INSERT INTO clientes (nit, nombre, bodega, zona) VALUES (?, ?, ?, ?)',
      [nit, nombre, bodega, zona]
    )
    res.status(201).json({ ok: true })
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

// Alta automática al entrar por primera vez (equivalente al
// `from('usuarios').upsert({correo, nombre}, {ignoreDuplicates:true})`).
router.post(
  '/usuarios/registro',
  ruta(async (req, res) => {
    const { nombre = '' } = req.body || {}
    await pool.execute(
      `INSERT INTO usuarios (id, correo, nombre) VALUES (UUID(), ?, ?)
         ON DUPLICATE KEY UPDATE nombre = IF(activo = 1, VALUES(nombre), nombre)`,
      [req.correo, nombre]
    )
    res.json({ ok: true })
  })
)

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
router.post(
  '/solicitudes',
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    const { fila: entrada, historial = [] } = req.body || {}
    if (!entrada || !entrada.codigo) {
      return res.status(400).json({ error: 'Falta el código de la solicitud' })
    }

    const fila = prepararFila(entrada)
    if (!P.permiteGuardarSolicitud(ctx, fila)) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const conexion = await pool.getConnection()
    try {
      await conexion.beginTransaction()

      const [existentes] = await conexion.execute(
        'SELECT codigo, solicitante_correo, estado FROM solicitudes WHERE codigo = ? FOR UPDATE',
        [fila.codigo]
      )
      const actual = existentes[0]

      if (actual) {
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
        await conexion.execute(
          `INSERT INTO solicitudes (codigo, ${COLUMNAS_SOLICITUD.join(', ')})
           VALUES (?, ${COLUMNAS_SOLICITUD.map(() => '?').join(', ')})`,
          [fila.codigo, ...COLUMNAS_SOLICITUD.map((c) => fila[c])]
        )
      }

      const okHistorial = await escribirHistorial(conexion, historial, ctx)
      if (!okHistorial) {
        await conexion.rollback()
        return res.status(403).json({ error: 'No autorizado' })
      }

      await conexion.commit()
      return res.json({ ok: true, codigo: fila.codigo })
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

// La primera carpeta de la ruta es el código de la solicitud: así las construye
// archivos.guardar (`{codigo}/{nombre}`).
function codigoDeRuta(ruta) {
  const limpio = String(ruta || '').replace(/\\/g, '/').replace(/^\/+/, '')
  return limpio.split('/')[0] || ''
}

router.post(
  '/archivos/evidencia',
  subida.single('archivo'),
  ruta(async (req, res) => {
    const ctx = await conContexto(req)
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' })
    const { codigo = '', nombre = '' } = req.body || {}
    if (!codigo) return res.status(400).json({ error: 'Falta el código de la solicitud' })
    const visibles = await codigosVisibles(ctx, [codigo])
    if (!visibles.has(String(codigo))) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    const rutaRel = archivos.guardar(codigo, nombre || req.file.originalname, req.file.buffer)
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
// firma HMAC es la que autoriza. Por eso esta ruta NO pasa por autenticar().
router.get('/archivos/ver', (req, res) => {
  const { ruta = '', exp = '', firma = '' } = req.query
  if (!archivos.verificarFirma(ruta, exp, firma)) {
    return res.status(403).send('Enlace inválido o vencido')
  }
  const destino = archivos.rutaSegura(ruta)
  if (!destino || !archivos.existe(ruta)) return res.status(404).send('No encontrado')
  res.sendFile(destino)
})

// ---------------------------------------------------------------------------
// Salud
// ---------------------------------------------------------------------------
router.get('/salud', ruta(async (req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true, hora: new Date().toISOString() })
}))

module.exports = router
