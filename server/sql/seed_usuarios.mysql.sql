-- ============================================================================
-- Seed de usuarios (MySQL) — generado desde supabase/seed_usuarios.sql
-- Asigna el correo, rol, vehículo y placa de cada integrante del equipo.
-- Importar DESPUÉS de schema.mysql.sql. Seguro de re-ejecutar.
--
-- es_conductor = 1 marca a quienes hacen entregas, aunque su rol principal
-- sea otro (p. ej. los administradores que también conducen moto). Aparecen en
-- la lista de conductores de los modales.
-- ============================================================================

SET NAMES utf8mb4;

INSERT INTO usuarios (id, correo, nombre, rol, vehiculo, placa, es_conductor) values
  (UUID(), 'pedidos@ctpmedica.com',              'Hernán García',    'administrador', '',          '',        0),
  (UUID(), 'pedidos2@ctpmedica.com',             'Daniel Chamorro',  'administrador', '',          '',        0),
  (UUID(), 'operacionescali@ctpmedica.com',      'Sebastián Rojas',  'administrador', 'Moto',      'YSQ-59G', 1),
  (UUID(), 'operacionesmedellin@ctpmedica.com',  'Duber Sepúlveda',  'administrador', 'Moto',      'REK-31D', 1),
  (UUID(), 'facturacion@ctpmedica.com',          'Laura Puentes',    'administrador', '',          '',        0),
  (UUID(), 'despachos@ctpmedica.com',            'Yonathan Ortiz',   'administrador', '',          '',        0),
  (UUID(), 'almacen@ctpmedica.com',              'Camilo Melo',      'administrador', '',          '',        0),
  (UUID(), 'conductorbogota@ctpmedica.com',      'Reinel Peña',      'conductor',     'Camioneta', 'PRY-590', 1),
  (UUID(), 'mensajeroadmin@ctpmedica.com',       'Robert Diaz',      'conductor',     'Moto',      'UHU-29D', 1),
  (UUID(), 'operacionesbogota@ctpmedica.com',    'Diego Peña',       'conductor',     'Carro',     'KWL-381', 1)
ON DUPLICATE KEY UPDATE
     nombre = VALUES(nombre),
     rol = VALUES(rol),
     vehiculo = VALUES(vehiculo),
     placa = VALUES(placa),
     es_conductor = VALUES(es_conductor),
     activo = 1;
