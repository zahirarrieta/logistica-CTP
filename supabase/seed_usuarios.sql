-- ============================================================================
-- Seed data for public.usuarios
-- Asigna el correo y el rol de cada integrante del equipo.
-- Pegar completo en Supabase Studio > SQL Editor y ejecutar.
-- Seguro de re-ejecutar: usa ON CONFLICT (correo) DO UPDATE.
-- ============================================================================

insert into public.usuarios (correo, nombre, rol) values
  ('pedidos@ctpmedica.com',              'Hernán García',    'administrador'),
  ('pedidos2@ctpmedica.com',             'Daniel Chamorro',  'administrador'),
  ('operacionescali@ctpmedica.com',      'Sebastián Rojas',  'administrador'),
  ('operacionesmedellin@ctpmedica.com',  'Duber Sepúlveda',  'administrador'),
  ('facturacion@ctpmedica.com',          'Laura Puentes',    'administrador'),
  ('despachos@ctpmedica.com',            'Yonathan Ortiz',   'administrador'),
  ('almacen@ctpmedica.com',              'Camilo Melo',      'administrador'),
  ('conductorbogota@ctpmedica.com',      'Reinel Peña',      'conductor'),
  ('mensajeroadmin@ctpmedica.com',       'Robert',           'conductor'),
  ('operacionesbogota@ctpmedica.com',    'Diego Peña',       'conductor')
on conflict (correo) do update
  set nombre = excluded.nombre,
      rol    = excluded.rol,
      activo = true;
