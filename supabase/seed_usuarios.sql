-- ============================================================================
-- Seed data for public.usuarios
-- Asigna el correo, rol, vehículo y placa de cada integrante del equipo.
-- Pegar completo en Supabase Studio > SQL Editor y ejecutar.
-- Seguro de re-ejecutar: usa ON CONFLICT (correo) DO UPDATE.
--
-- es_conductor = true marca a quienes hacen entregas, aunque su rol principal
-- sea otro (p. ej. Sebastián Rojas y Duber Sepúlveda son administradores y
-- también conducen moto). Aparecen en la lista de conductores de los modales.
-- ============================================================================

-- Asegura que la columna exista aunque no se haya corrido schema.sql primero.
alter table public.usuarios add column if not exists es_conductor boolean not null default false;

insert into public.usuarios (correo, nombre, rol, vehiculo, placa, es_conductor) values
  ('pedidos@ctpmedica.com',              'Hernán García',    'administrador', '',          '',        false),
  ('pedidos2@ctpmedica.com',             'Daniel Chamorro',  'administrador', '',          '',        false),
  ('operacionescali@ctpmedica.com',      'Sebastián Rojas',  'administrador', 'Moto',      'YSQ-59G', true),
  ('operacionesmedellin@ctpmedica.com',  'Duber Sepúlveda',  'administrador', 'Moto',      'REK-31D', true),
  ('facturacion@ctpmedica.com',          'Laura Puentes',    'administrador', '',          '',        false),
  ('despachos@ctpmedica.com',            'Yonathan Ortiz',   'administrador', '',          '',        false),
  ('almacen@ctpmedica.com',              'Camilo Melo',      'administrador', '',          '',        false),
  ('conductorbogota@ctpmedica.com',      'Reinel Peña',      'conductor',     'Camioneta', 'PRY-590', true),
  ('mensajeroadmin@ctpmedica.com',       'Robert Diaz',      'conductor',     'Moto',      'UHU-29D', true),
  ('operacionesbogota@ctpmedica.com',    'Diego Peña',       'conductor',     'Carro',     'KWL-381', true)
on conflict (correo) do update
  set nombre       = excluded.nombre,
      rol          = excluded.rol,
      vehiculo     = excluded.vehiculo,
      placa        = excluded.placa,
      es_conductor = excluded.es_conductor,
      activo       = true;
