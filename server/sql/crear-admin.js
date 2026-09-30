'use strict'

// ============================================================================
// CREAR ADMINISTRADOR (o convertir una cuenta existente)
//
//   cd server
//   node sql/crear-admin.js "admin@ctpmedica.com" "Administrador" "su contraseña"
//   node sql/crear-admin.js "admin@ctpmedica.com" "Super Admin" "su contraseña" superadmin
//
// Qué hace: calcula el hash de la contraseña y escribe el INSERT listo para
// pegar en phpMyAdmin, o lo ejecuta directamente contra la base si las variables
// de entorno están definidas (ver más abajo).
//
// Por qué un script y no un endpoint: el alta de la primera cuenta con
// privilegios tiene que poder hacerse con la aplicación YA desplegada, sin
// exponer ninguna ruta que conceda permisos. Un endpoint "el primer usuario que
// se registra es superadmin" se convierte en la puerta de entrada del sistema
// para quien llegue antes que tú.
//
// Con SESSION_SQL_SOLO_IMPRIMIR=1 (o sin credenciales de MySQL) solo imprime el
// INSERT, para pegarlo en cPanel > phpMyAdmin. Es el modo por defecto si no hay
// .env, porque en el hosting el servidor web no tiene acceso a la base desde la
// consola.
// ============================================================================

const crypto = require('crypto')
const path = require('path')

// Se carga config.js para leer el .env de desarrollo y validar el entorno, pero
// NO se exige que arranque: si falta DB_USER solo hay que avisar. Por eso el
// require va dentro de un try: config.js lanza si en producción falta algo, y
// eso no debe impedir que se imprima el INSERT.
let config
try {
  config = require(path.join(__dirname, '..', 'src', 'config'))
} catch (error) {
  config = null
  console.warn(`[crear-admin] no se pudo leer la configuración: ${error.message.split('\n')[0]}`)
}

const contrasenas = require(path.join(__dirname, '..', 'src', 'contrasenas'))

const [correoArg, nombreArg, contrasenaArg, rolArg] = process.argv.slice(2)

const ROLES = ['solicitante', 'administrador', 'conductor', 'superadmin']

function escapar(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/'/g, "''")
}

async function main() {
  if (!correoArg || !nombreArg || !contrasenaArg) {
    console.error('')
    console.error('Uso:')
    console.error('  node sql/crear-admin.js <correo> <nombre> "<contraseña>" [rol]')
    console.error('')
    console.error('Ejemplo:')
    console.error('  node sql/crear-admin.js "admin@ctpmedica.com" "Administrador" "MiClave123" superadmin')
    console.error('')
    console.error(`Roles válidos: ${ROLES.join(', ')}  (por defecto: superadmin)`)
    return 1
  }

  const correo = contrasenas.normalizarCorreo(correoArg)
  const nombre = String(nombreArg).trim()
  const rol = String(rolArg || 'superadmin').trim().toLowerCase()

  if (!ROLES.includes(rol)) {
    console.error(`[crear-admin] el rol "${rol}" no existe. Usa uno de: ${ROLES.join(', ')}`)
    return 1
  }

  const problemaCorreo = contrasenas.problemaCorreo(correo)
  if (problemaCorreo) {
    console.error(`[crear-admin] ${problemaCorreo}`)
    return 1
  }

  const problemaClave = contrasenas.problema(contrasenaArg)
  if (problemaClave) {
    console.error(`[crear-admin] ${problemaClave}`)
    return 1
  }

  const hash = await contrasenas.hashear(contrasenaArg)
  const id = crypto.randomUUID()

  // INSERT con ON DUPLICATE KEY UPDATE: se puede volver a ejecutar para cambiar la
  // contraseña de un administrador o resetar una cuenta. Si la cuenta no existía la
  // crea; si existía, actualiza el hash, el nombre y el rol, y la deja activa
  // (activo = 1) por si estaba desactivada.
  const sql = `INSERT INTO usuarios (id, correo, nombre, password_hash, rol, activo)
       VALUES ('${id}', '${correo}', '${escapar(nombre)}', '${hash}', '${rol}', 1)
     ON DUPLICATE KEY UPDATE
       nombre = VALUES(nombre),
       password_hash = VALUES(password_hash),
       rol = VALUES(rol),
       activo = 1;`

  // ¿Se escribe contra la base o solo se imprime? Tres condiciones y solo falta la
  // primera antes: SESSION_SQL_SOLO_IMPRIMIR, que existe para probar el script sin
  // tocar datos reales.
  const soloImprimir =
    String(process.env.SESSION_SQL_SOLO_IMPRIMIR || '').trim() === '1' ||
    !config ||
    !config.db.user ||
    !config.db.name

  if (soloImprimir) {
    if (String(process.env.SESSION_SQL_SOLO_IMPRIMIR || '').trim() === '1') {
      console.log('[crear-admin] SESSION_SQL_SOLO_IMPRIMIR=1: no se escribe nada.')
    } else {
      console.log('')
      console.log('No hay credenciales de MySQL disponibles: imprime el INSERT para')
      console.log('pegarlo en cPanel > phpMyAdmin > SQL.')
    }
    console.log('')
    console.log(sql)
    console.log('')
    return 0
  }

  const { pool } = require(path.join(__dirname, '..', 'src', 'db'))

  try {
    await pool.execute(sql)
    const [filas] = await pool.execute(
      'SELECT correo, nombre, rol, activo FROM usuarios WHERE correo = ? LIMIT 1',
      [correo]
    )
    await pool.end()
    const f = filas[0] || {}
    console.log('')
    console.log('[crear-admin] cuenta lista:')
    console.log(`  correo: ${f.correo || correo}`)
    console.log(`  nombre: ${f.nombre || nombre}`)
    console.log(`  rol:    ${f.rol || rol}`)
    console.log(`  activo: ${f.activo}`)
    console.log('')
    if (f.rol !== 'superadmin' && f.rol !== 'administrador') {
      console.warn('[crear-admin] OJO: el rol no es de administración, esa cuenta no entra al panel.')
    }
    return 0
  } catch (error) {
    console.error(`[crear-admin] falló la escritura: ${error.message}`)
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('  Probable causa: falta la columna password_hash en usuarios.')
      console.error('  Ejecuta primero el ALTER TABLE del punto 1 de sql/schema.mysql.sql.')
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  No se pudo conectar con MySQL. Pega el INSERT de arriba en phpMyAdmin,')
      console.error('  o revisa DB_HOST / DB_USER / DB_PASSWORD / DB_NAME en server/.env.')
    }
    await pool.end().catch(() => {})
    return 1
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (error) => {
    console.error(`[crear-admin] error inesperado: ${error.message}`)
    process.exit(1)
  }
)
