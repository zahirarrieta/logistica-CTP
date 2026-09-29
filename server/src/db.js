'use strict'

// Pool de conexiones MySQL. En cPanel el host suele ser 'localhost' y el usuario
// tiene el prefijo de la cuenta (ej. 'ctp_usuario'); ambos vienen por entorno.
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // MySQL no tiene 'timestamptz': fijamos la sesión en UTC para que
  // CURRENT_TIMESTAMP(3) y las fechas que devuelve el driver coincidan con los
  // ISO que ya maneja el frontend.
  timezone: 'Z',
  dateStrings: false,
})

// Sin esto, CURRENT_TIMESTAMP(3) usaría la zona horaria del servidor MySQL y las
// marcas de agua de `actualizado_en` quedarían desfasadas entre sí.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'")
})

// execute devuelve [filas, campos]; es lo que usan casi todas las consultas.
function query(sql, params) {
  return pool.execute(sql, params)
}

module.exports = { pool, query }
