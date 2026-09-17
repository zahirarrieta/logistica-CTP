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
             check (rol in ('solicitante', 'administrador', 'conductor')),
  vehiculo   text not null default '',
  placa      text not null default '',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

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
    correo = public.correo_actual() or public.rol_actual() = 'administrador'
  );

drop policy if exists usuarios_upsert on public.usuarios;
create policy usuarios_upsert on public.usuarios
  for insert with check (correo = public.correo_actual());

drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update using (
    correo = public.correo_actual() or public.rol_actual() = 'administrador'
  );

-- clientes: catálogo de lectura pública.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select using (true);

drop policy if exists clientes_admin_write on public.clientes;
create policy clientes_admin_write on public.clientes
  for all using (public.rol_actual() = 'administrador')
  with check (public.rol_actual() = 'administrador');

-- solicitudes
drop policy if exists solicitudes_select on public.solicitudes;
create policy solicitudes_select on public.solicitudes
  for select using (
    public.rol_actual() = 'administrador'
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial'))
  );

drop policy if exists solicitudes_insert on public.solicitudes;
create policy solicitudes_insert on public.solicitudes
  for insert with check (
    public.rol_actual() in ('solicitante', 'administrador')
    or solicitante_correo = public.correo_actual()
  );

drop policy if exists solicitudes_update on public.solicitudes;
create policy solicitudes_update on public.solicitudes
  for update using (
    public.rol_actual() = 'administrador'
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial'))
  );

drop policy if exists solicitudes_delete on public.solicitudes;
create policy solicitudes_delete on public.solicitudes
  for delete using (
    public.rol_actual() = 'administrador' or solicitante_correo = public.correo_actual()
  );

-- historial: se lee/ escribe siguiendo la visibilidad de su solicitud.
drop policy if exists historial_select on public.historial;
create policy historial_select on public.historial
  for select using (
    exists (
      select 1 from public.solicitudes s
      where s.codigo = historial.solicitud
        and (public.rol_actual() = 'administrador'
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
        and (public.rol_actual() in ('administrador', 'conductor')
             or s.solicitante_correo = public.correo_actual())
    )
  );

-- Un reintento de subida hace upsert sobre la misma fila, así que quien puede
-- insertar también puede actualizar su propia entrada.
drop policy if exists historial_update on public.historial;
create policy historial_update on public.historial
  for update using (
    public.rol_actual() = 'administrador'
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
-- ----------------------------------------------------------------------------
-- insert into public.usuarios (correo, nombre, rol) values
--   ('admin@ctpmedica.com',   'Administrador', 'administrador'),
--   ('conductor@ctpmedica.com', 'Reinel Peña', 'conductor')
-- on conflict (correo) do update
--   set rol = excluded.rol, nombre = excluded.nombre;

-- select public.sincronizar_secuencia_codigos();
