'use strict'

// ============================================================================
// API Logística CTP
// Arranque para Node.js Selector de cPanel (Phusion Passenger). No llama a
// app.listen: Passenger levanta el servidor y enruta las peticiones; si defines
// PORT, Passenger lo inyecta y el listen es un no-op.
// ============================================================================

const express = require('express')
const cors = require('cors')

// Se carga primero: valida el entorno y se detiene aquí, con el listado
// completo, si falta algo. Si fallara más tarde, el error sería confuso.
const config = require('./config')
const { autenticar } = require('./auth')
const rutas = require('./routes')

const app = express()

// Passenger/cPanel terminan TLS en el proxy: sin esto `req.protocol` sale como
// http y las URLs firmadas de archivos se generarían sin https.
app.set('trust proxy', true)
app.disable('x-powered-by')

app.use(
  cors({
    origin: config.cors.origenes.length > 0 ? config.cors.origenes : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

// Las evidencias pueden llegar como base64 desde el conductor, así que el límite
// es holgado; multer recorta cada archivo a 10 MB (el mismo file_size_limit que
// tenían los buckets de Supabase).
app.use(express.json({ limit: '25mb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

// Sonda de vida. El `deploy` se incrementa con cada cambio de código y sirve
// para confirmar desde fuera qué build está corriendo en el hosting: durante una
// migración es normal dudar de si el ZIP nuevo llegó a pisar el anterior, y
// hasta ahora la respuesta era idéntica en todas las versiones.
const DEPLOY = '2026-09-30-clave-fresca'

app.get('/api/salud', (req, res) => res.json({ ok: true, deploy: DEPLOY }))

// Raíz del subdominio. Antes caía en el 404 "Endpoint no encontrado", que en
// una pantalla de mantenimiento parece un fallo de la app.
app.get('/', (req, res) =>
  res.json({
    servicio: 'API de Logística CTP',
    deploy: DEPLOY,
    estado: 'activo',
    documentacion: '/docs/04-DESPLIEGUE-HOSTING.md',
  })
)

// Todo lo demás exige un token válido de Microsoft.
app.use('/api', autenticar, rutas)

app.use((req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }))

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error('[API] error:', error)
  const esMulter = error?.code === 'LIMIT_FILE_SIZE'
  const maximoMB = Math.round(config.firma.maxBytes / 1024 / 1024)
  res.status(esMulter ? 413 : 500).json({
    error: esMulter
      ? `El archivo supera el máximo de ${maximoMB} MB`
      : 'Error interno del servidor',
  })
})

// Node.js Selector de cPanel levanta la app con Phusion Passenger: el archivo de
// arranque tiene que EXPORTAR la app, no escuchar en un puerto. Passenger enruta
// las peticiones y expone la app en el dominio, y siempre corre con
// NODE_ENV=production, así que esta rama nunca se ejecuta allí. Para desarrollo
// local, `node src/index.js` sí levanta un servidor en PORT (3000 por defecto).
if (!config.esProduccion) {
  const PUERTO = Number(process.env.PORT) || 3000
  app.listen(PUERTO, () => {
    console.log(`[API] servidor local en http://localhost:${PUERTO}`)
  })
}

module.exports = app
