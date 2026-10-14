// Responsables de una recolección. Es un listado operativo cerrado de cuatro
// cuentas (no sale de la tabla usuarios): el solicitante elige a quién le encarga
// el pedido al crearlo y el administrador solo puede reasignarlo dentro de estas
// cuatro. Espejo de P.RESPONSABLES_RECOLECCION del backend, que es quien valida
// el correo al guardar.
export const RESPONSABLES_RECOLECCION = [
  { nombre: 'Yonathan Ortiz', correo: 'despachos@ctpmedica.com' },
  { nombre: 'Daniel Chamorro', correo: 'pedidos2@ctpmedica.com' },
  { nombre: 'Duber Sepúlveda', correo: 'operacionesmedellin@ctpmedica.com' },
  { nombre: 'Sebastián Rojas', correo: 'operacionescali@ctpmedica.com' },
]
