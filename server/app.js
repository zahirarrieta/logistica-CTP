// ============================================================================
// Archivo de arranque para Node.js Selector (cPanel + Phusion Passenger).
//
// En el panel, en "Application startup file" se pone: app.js
// Application root: server
//
// Passenger carga este archivo y expone la app en el dominio. El código real
// vive en src/index.js; este archivo solo existe porque el valor del campo
// "startup file" de cPanel no admite rutas con carpetas.
// ============================================================================

module.exports = require('./src/index.js')
