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
  cedula             text not null default '',
  orden_compra       text not null default '',
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

-- Correo del conductor asignado (aditivo). Permite filtrar/avisar por correo
-- (único) además del nombre; los registros antiguos siguen usando solo `conductor`.
alter table public.solicitudes add column if not exists conductor_correo text not null default '';
create index if not exists solicitudes_conductor_correo_idx on public.solicitudes (conductor_correo);

-- Cédula (solicitudes administrativas) y número de orden de compra (ventas
-- directas). Aditivos: los registros antiguos simplemente quedan en blanco.
alter table public.solicitudes add column if not exists cedula text not null default '';
alter table public.solicitudes add column if not exists orden_compra text not null default '';

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

-- Reserva el siguiente código de forma GLOBAL por RPC (SECURITY DEFINER, ignora
-- RLS). Así todos los usuarios ven y usan el mismo próximo ID aunque su rol no
-- les permita leer las solicitudes de los demás (solicitantes solo sus propias,
-- conductores solo tránsito). La secuencia es atómica: nunca se repite un ID.
create or replace function public.proximo_codigo()
returns text
language sql
security definer
set search_path = public
as $$
  select 'CTPLOG-' || lpad(nextval('public.solicitudes_codigo_seq')::text, 5, '0');
$$;

grant execute on function public.proximo_codigo() to anon, authenticated;

-- Ver el próximo código SIN consumirlo (solo lee la secuencia): al abrir el
-- modal o actualizar, el número no avanza. Solo `proximo_codigo()` (nextval)
-- avanza, así que el contador sube únicamente al crear una solicitud.
create or replace function public.siguiente_codigo()
returns text
language sql
security definer
set search_path = public
as $$
  select 'CTPLOG-' || lpad(
    (last_value + case when is_called then 1 else 0 end)::text, 5, '0')
  from public.solicitudes_codigo_seq;
$$;

grant execute on function public.siguiente_codigo() to anon, authenticated;

-- Reinicia el contador de IDs en el servidor (solo admin/super): deja la
-- secuencia lista para el siguiente código = máximo existente + 1. Tras borrar
-- todas las solicitudes el siguiente vuelve a CTPLOG-00001.
create or replace function public.reiniciar_contador()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_privilegiado() then
    raise exception 'No autorizado';
  end if;
  perform setval('public.solicitudes_codigo_seq',
    greatest(
      coalesce((
        select max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::bigint)
        from public.solicitudes
      ), 0) + 1,
      1
    ),
    false);
end;
$$;

grant execute on function public.reiniciar_contador() to authenticated;

-- Guarda una solicitud (y su historial) saltándose RLS, pero con una verificación
-- de autorización propia en el servidor. Existe porque el camino de escritura de
-- RLS (INSERT/UPDATE ... WITH CHECK) rechaza la entrega del conductor con 42501
-- aun cuando las políticas lo permiten; aquí la comprobación se hace por lectura
-- (que sí funciona) y la escritura la ejecuta el dueño de la tabla (bypass RLS).
-- Refleja la misma intención de solicitudes_insert / solicitudes_update.
create or replace function public.guardar_solicitud(
  p_fila jsonb,
  p_historial jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol    text := public.rol_actual();
  v_correo text := public.correo_actual();
  v_estado text := coalesce(p_fila ->> 'estado', 'Abierto');
  v_rec    public.solicitudes;
  v_h      jsonb;
begin
  if not (
        v_rol in ('solicitante', 'administrador', 'superadmin')
     or nullif(p_fila ->> 'solicitante_correo', '') = v_correo
     or (v_rol = 'conductor'
         and v_estado in ('En Tránsito', 'En Tránsito Parcial',
                          'Entregado', 'Entregado Parcial'))
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  v_rec := jsonb_populate_record(null::public.solicitudes, p_fila);
  -- jsonb_populate_record deja en NULL las columnas ausentes en el JSON; la app
  -- no envía creado_en/actualizado_en, así que se rellenan para no violar el
  -- not-null (el trigger ya refresca actualizado_en de todos modos).
  if v_rec.creado_en is null then v_rec.creado_en := now(); end if;
  if v_rec.actualizado_en is null then v_rec.actualizado_en := now(); end if;

  insert into public.solicitudes values (v_rec.*)
  on conflict (codigo) do update set
    fecha_subida       = excluded.fecha_subida,
    hora_subida        = excluded.hora_subida,
    tipo_solicitud     = excluded.tipo_solicitud,
    cliente            = excluded.cliente,
    nit                = excluded.nit,
    bodega             = excluded.bodega,
    zona               = excluded.zona,
    cedula             = excluded.cedula,
    orden_compra       = excluded.orden_compra,
    observaciones      = excluded.observaciones,
    adjuntos           = excluded.adjuntos,
    solicitante_nombre = excluded.solicitante_nombre,
    solicitante_correo = excluded.solicitante_correo,
    estado             = excluded.estado,
    asignado_a         = excluded.asignado_a,
    asignado_correo    = excluded.asignado_correo,
    conductor          = excluded.conductor,
    conductor_correo   = excluded.conductor_correo,
    vehiculo           = excluded.vehiculo,
    placa              = excluded.placa,
    numero_referencia  = excluded.numero_referencia,
    creado_por         = excluded.creado_por,
    pendiente_sync     = excluded.pendiente_sync,
    actualizado_en     = now();

  if jsonb_typeof(p_historial) = 'array' then
    for v_h in select * from jsonb_array_elements(p_historial) loop
      insert into public.historial (
        id, solicitud, campo, anterior, nuevo, nota, referencia, adjunto,
        conductor, vehiculo, placa, evidencia_url, encuesta, persona, fecha, hora
      ) values (
        (v_h ->> 'id')::uuid,
        v_h ->> 'solicitud',
        coalesce(v_h ->> 'campo', 'estado'),
        coalesce(v_h ->> 'anterior', ''),
        coalesce(v_h ->> 'nuevo', ''),
        coalesce(v_h ->> 'nota', ''),
        coalesce(v_h ->> 'referencia', ''),
        coalesce(v_h ->> 'adjunto', ''),
        coalesce(v_h ->> 'conductor', ''),
        coalesce(v_h ->> 'vehiculo', ''),
        coalesce(v_h ->> 'placa', ''),
        coalesce(v_h ->> 'evidencia_url', ''),
        case when jsonb_typeof(v_h -> 'encuesta') = 'null' then null else v_h -> 'encuesta' end,
        coalesce(v_h ->> 'persona', ''),
        coalesce(v_h ->> 'fecha', ''),
        coalesce(v_h ->> 'hora', '')
      )
      on conflict (id) do update set
        campo         = excluded.campo,
        anterior      = excluded.anterior,
        nuevo         = excluded.nuevo,
        nota          = excluded.nota,
        referencia    = excluded.referencia,
        adjunto       = excluded.adjunto,
        conductor     = excluded.conductor,
        vehiculo      = excluded.vehiculo,
        placa         = excluded.placa,
        evidencia_url = excluded.evidencia_url,
        encuesta      = excluded.encuesta,
        persona       = excluded.persona,
        fecha         = excluded.fecha,
        hora          = excluded.hora;
    end loop;
  end if;
end;
$$;

grant execute on function public.guardar_solicitud(jsonb, jsonb) to authenticated;

-- Deja la secuencia a la par del código más alto existente (idempotente).
select public.sincronizar_secuencia_codigos();

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

-- Nombre del usuario actual (tabla usuarios). Se usa en RLS para emparejar las
-- solicitudes asignadas a un conductor por nombre cuando el registro es antiguo
-- y aún no tiene conductor_correo.
create or replace function public.nombre_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.nombre from public.usuarios u
      where u.correo = public.correo_actual() and u.activo),
    ''
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
        and (
          estado in ('En Tránsito', 'En Tránsito Parcial')
          -- Ya entregadas: solo las suyas, para que el conductor vea su
          -- historial de entregas al refrescar (por correo o, en registros
          -- antiguos sin conductor_correo, por nombre).
          or (estado in ('Entregado', 'Entregado Parcial')
              and (nullif(conductor_correo, '') = public.correo_actual()
                   or nullif(conductor, '') = public.nombre_actual()))
        ))
  );

-- La app sube con upsert (insert ... on conflict do update). Postgres evalúa
-- la política INSERT sobre la fila propuesta incluso cuando termina en UPDATE,
-- así que hay que permitir que un conductor «inserte» su entrega (estado
-- Entregado/Entregado Parcial) sobre una solicitud que ya tiene en tránsito.
drop policy if exists solicitudes_insert on public.solicitudes;
create policy solicitudes_insert on public.solicitudes
  for insert with check (
    public.rol_actual() in ('solicitante', 'administrador', 'superadmin')
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial',
                       'Entregado', 'Entregado Parcial'))
  );

-- USING = qué fila puede tocar el conductor (solo las que están en tránsito).
-- WITH CHECK = qué puede dejar escrito en la fila resultante. Es obligatorio
-- declararlo: si se omite, Postgres reutiliza USING contra la NUEVA fila y el
-- conductor nunca podría pasarla a Entregado (el estado ya no está en tránsito).
drop policy if exists solicitudes_update on public.solicitudes;
create policy solicitudes_update on public.solicitudes
  for update using (
    public.es_privilegiado()
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial'))
  )
  with check (
    public.es_privilegiado()
    or solicitante_correo = public.correo_actual()
    or (public.rol_actual() = 'conductor'
        and estado in ('En Tránsito', 'En Tránsito Parcial',
                       'Entregado', 'Entregado Parcial'))
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
-- 6b. REAL TIME
--    Publica los cambios de solicitudes/historial para que las pantallas
--    abiertas se actualicen al instante (aviso de solicitud nueva incluido).
--    Sin esto el navegador solo vería cambios al refrescar la página.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('solicitudes', 'historial')
  ) then
    alter publication supabase_realtime add table public.solicitudes, public.historial;
  end if;
end $$;

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
