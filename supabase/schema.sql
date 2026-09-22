-- ============================================================================
-- Logística CTP · Backend Supabase
-- Pegar completo en Supabase Studio > SQL Editor y ejecutar.
-- Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. USUARIOS (uno por cada cuenta de Microsoft que entra a la app)
-- ----------------------------------------------------------------------------
create table if not exists public.usuarios (
  id         uuid primary key default gen_random_uuid(),
  correo     text not null unique,
  nombre     text not null default '',
  rol        text not null default 'solicitante'
             check (rol in ('solicitante', 'administrador', 'conductor', 'superadmin')),
  vehiculo   text not null default '',
  placa      text not null default '',
  es_conductor boolean not null default false,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Permite volver a correr sobre una BD existente: amplía el check para aceptar
-- el rol 'superadmin' (ve todos los módulos y todas las solicitudes).
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check
  check (rol in ('solicitante', 'administrador', 'conductor', 'superadmin'));

-- Marca usuarios que además conducen (p. ej. administradores que también hacen
-- entregas). Aparecen en la lista de conductores sin dejar de ser administradores.
alter table public.usuarios add column if not exists es_conductor boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. CLIENTES (los 224 registros de clientesData.js, se cargan una sola vez)
--    Un mismo NIT puede tener varias sedes (bodega distinta), así que la PK
--    es la combinación (nit, bodega).
-- ----------------------------------------------------------------------------
create table if not exists public.clientes (
  id      serial primary key,
  nit     text not null,
  nombre  text not null default '',
  bodega  text not null default '',
  zona    text not null default '',
  unique (nit, bodega)
);

create index if not exists clientes_nombre_idx on public.clientes (nombre);
create index if not exists clientes_zona_idx   on public.clientes (zona);

-- ----------------------------------------------------------------------------
-- 3. SOLICITUDES
--    codigo = el id local de la app (CTPLOG-00001). Si llega vacío lo genera.
--    Las fechas van en texto porque la app ya las formatea en español.
-- ----------------------------------------------------------------------------
create sequence if not exists public.solicitudes_codigo_seq start 1;

create table if not exists public.solicitudes (
  codigo             text primary key,
  fecha_subida       text not null default '',
  hora_subida        text not null default '',
  tipo_solicitud     text not null default '',
  cliente            text not null default '',
  nit                text not null default '',
  bodega             text not null default '',
  zona               text not null default '',
  observaciones      text not null default '',
  adjuntos           text[] not null default '{}',
  solicitante_nombre text not null default '',
  solicitante_correo text not null default '',
  estado             text not null default 'Abierto' check (estado in (
                       'Abierto',
                       'Pendiente por Autorización',
                       'Devolución a Solicitante',
                       'Retenido por Cartera',
                       'En Trámite',
                       'En Tránsito',
                       'En Tránsito Parcial',
                       'Entregado Parcial',
                       'Entregado')),
  asignado_a         text not null default '',
  asignado_correo    text not null default '',
  conductor          text not null default '',
  vehiculo           text not null default '',
  placa              text not null default '',
  numero_referencia  text not null default '',
  creado_por         text not null default '',
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  pendiente_sync     boolean not null default false
);

create index if not exists solicitudes_estado_idx       on public.solicitudes (estado);
create index if not exists solicitudes_conductor_idx    on public.solicitudes (conductor);
create index if not exists solicitudes_solicitante_idx  on public.solicitudes (solicitante_correo);
create index if not exists solicitudes_actualizado_idx  on public.solicitudes (actualizado_en desc);

-- Permite volver a correr sobre una BD existente: agrega el correo del responsable
-- asignado (aditivo; los registros antiguos siguen usando solo asignado_a).
alter table public.solicitudes add column if not exists asignado_correo text not null default '';

create or replace function public.asignar_codigo()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'CTPLOG-' || lpad(nextval('public.solicitudes_codigo_seq')::text, 5, '0');
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists solicitudes_codigo_trg on public.solicitudes;
create trigger solicitudes_codigo_trg
  before insert or update on public.solicitudes
  for each row execute function public.asignar_codigo();

-- Alinea la secuencia con los códigos que ya existan (correr después de migrar datos).
create or replace function public.sincronizar_secuencia_codigos()
returns void
language sql
as $$
  select setval(
    'public.solicitudes_codigo_seq',
    greatest(
      coalesce((
        select max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::bigint)
        from public.solicitudes
      ), 0),
      1
    )
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. HISTORIAL (auditoría + datos de la entrega; de aquí sale "Detalles")
-- ----------------------------------------------------------------------------
create table if not exists public.historial (
  id             uuid primary key default gen_random_uuid(),
  solicitud      text not null references public.solicitudes (codigo) on delete cascade,
  campo          text not null default 'estado'
                 check (campo in ('estado', 'asignado', 'conductor')),
  anterior       text not null default '',
  nuevo          text not null default '',
  nota           text not null default '',
  referencia     text not null default '',
  adjunto        text not null default '',
  conductor      text not null default '',
  vehiculo       text not null default '',
  placa          text not null default '',
  evidencia_url  text not null default '',
  encuesta       jsonb,
  persona        text not null default '',
  fecha          text not null default '',
  hora           text not null default '',
  creado_en      timestamptz not null default now()
);

create index if not exists historial_solicitud_idx on public.historial (solicitud, creado_en desc);
create index if not exists historial_campo_idx    on public.historial (campo);

-- ----------------------------------------------------------------------------
-- 5. IDENTIDAD ACTIVA
--    El token solo carga el correo (user_metadata). El rol vive en la tabla
--    usuarios, así un administrador lo cambia sin tocar el frontend.
--    SECURITY DEFINER evita recursión al leer usuarios desde sus propias políticas.
-- ----------------------------------------------------------------------------
create or replace function public.correo_actual()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'correo', ''),
    ''
  );
$$;

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.rol from public.usuarios u
      where u.correo = public.correo_actual() and u.activo),
    'solicitante'
  );
$$;

-- true si el usuario actual es administrador o superadmin. Ambos ven y gestionan
-- todo; el superadmin además ve TODAS las solicitudes (abiertas/cerradas/asignadas).
create or replace function public.es_privilegiado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.rol_actual() in ('administrador', 'superadmin')
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.usuarios   enable row level security;
alter table public.clientes   enable row level security;
alter table public.solicitudes enable row level security;
alter table public.historial  enable row level security;

-- usuarios: cada quien ve y crea su propio registro; administrador ve todo.
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using (
    correo = public.correo_actual() or public.es_privilegiado()
  );

drop policy if exists usuarios_upsert on public.usuarios;
create policy usuarios_upsert on public.usuarios
  for insert with check (correo = public.correo_actual());

drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update using (
    correo = public.correo_actual() or public.es_privilegiado()
  );

-- clientes: catálogo de lectura pública.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select using (true);

drop policy if exists clientes_admin_write on public.clientes;
create policy clientes_admin_write on public.clientes
  for all using (public.es_privilegiado())
  with check (public.es_privilegiado());

-- solicitudes
drop policy if exists solicitudes_select on public.solicitudes;
create policy solicitudes_select on public.solicitudes
  for select using (
    public.es_privilegiado()
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial'))
  );

drop policy if exists solicitudes_insert on public.solicitudes;
create policy solicitudes_insert on public.solicitudes
  for insert with check (
    public.rol_actual() in ('solicitante', 'administrador', 'superadmin')
    or solicitante_correo = public.correo_actual()
  );

drop policy if exists solicitudes_update on public.solicitudes;
create policy solicitudes_update on public.solicitudes
  for update using (
    public.es_privilegiado()
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial'))
  );

drop policy if exists solicitudes_delete on public.solicitudes;
create policy solicitudes_delete on public.solicitudes
  for delete using (
    public.es_privilegiado() or solicitante_correo = public.correo_actual()
  );

-- historial: se lee/ escribe siguiendo la visibilidad de su solicitud.
drop policy if exists historial_select on public.historial;
create policy historial_select on public.historial
  for select using (
    exists (
      select 1 from public.solicitudes s
      where s.codigo = historial.solicitud
        and (public.es_privilegiado()
             or s.solicitante_correo = public.correo_actual()
             or (public.rol_actual() = 'conductor'
                 and s.estado in ('En Tránsito', 'En Tránsito Parcial',
                                  'Entregado', 'Entregado Parcial')))
    )
  );

drop policy if exists historial_insert on public.historial;
create policy historial_insert on public.historial
  for insert with check (
    exists (
      select 1 from public.solicitudes s
      where s.codigo = historial.solicitud
        and (public.rol_actual() in ('administrador', 'superadmin', 'conductor')
             or s.solicitante_correo = public.correo_actual())
    )
  );

-- Un reintento de subida hace upsert sobre la misma fila, así que quien puede
-- insertar también puede actualizar su propia entrada.
drop policy if exists historial_update on public.historial;
create policy historial_update on public.historial
  for update using (
    public.es_privilegiado()
    or exists (
      select 1 from public.solicitudes s
      where s.codigo = historial.solicitud
        and (public.rol_actual() = 'conductor'
             or s.solicitante_correo = public.correo_actual())
    )
  );

-- ----------------------------------------------------------------------------
-- 7. BUCKETS PRIVADOS (adjuntos de la solicitud y evidencia de la entrega)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('adjuntos',   'adjuntos',   false, 10485760),
  ('evidencias', 'evidencias', false, 10485760)
on conflict (id) do nothing;

drop policy if exists adjuntos_write on storage.objects;
create policy adjuntos_write on storage.objects
  for insert with check (
    bucket_id in ('adjuntos', 'evidencias')
    and auth.role() in ('anon', 'authenticated')
  );

drop policy if exists adjuntos_read on storage.objects;
create policy adjuntos_read on storage.objects
  for select using (bucket_id in ('adjuntos', 'evidencias'));

-- ----------------------------------------------------------------------------
-- 8. ROLES INICIALES
--    Cambia los correos por los reales y ejecuta este bloque una sola vez.
--    Roles: solicitante (Inicio + Solicitudes), conductor (Inicio + Conductor),
--    administrador (todos los módulos; ve sin asignar + sus propias asignaciones),
--    superadmin (todos los módulos y TODAS las solicitudes).
-- ----------------------------------------------------------------------------
-- insert into public.usuarios (correo, nombre, rol) values
--   ('superadmin@ctpmedica.com',  'Super Admin',   'superadmin'),
--   ('admin@ctpmedica.com',       'Administrador', 'administrador'),
--   ('conductor@ctpmedica.com',   'Reinel Peña',   'conductor')
-- on conflict (correo) do update
--   set rol = excluded.rol, nombre = excluded.nombre;

-- select public.sincronizar_secuencia_codigos();
