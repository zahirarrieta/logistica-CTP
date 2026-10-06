-- ============================================================================
-- Logística CTP · Base de datos MySQL (Latinoamérica Hosting)
-- Pegar completo en cPanel > phpMyAdmin > Importar / SQL.
-- Seguro de re-ejecutar: usa CREATE TABLE IF NOT EXISTS.
--
-- Sustituye al schema de Supabase (Postgres + RLS + RPC). Aquí no hay RLS:
-- los permisos los aplica el backend (server/src/permisos.js) en cada consulta.
-- ============================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. USUARIOS (uno por cada cuenta creada en la pantalla de registro)
-- ----------------------------------------------------------------------------
-- password_hash guarda el hash scrypt de la contraseña, NUNCA la contraseña. Es
-- NULL en las cuentas que venían de Microsoft y que aún no se han registrado
-- con contraseña: se pueden convertir después con el script crear-admin.js.
CREATE TABLE IF NOT EXISTS usuarios (
  id            CHAR(36)      NOT NULL,
  correo        VARCHAR(190)  NOT NULL,
  nombre        VARCHAR(190)  NOT NULL DEFAULT '',
  password_hash VARCHAR(255)  NULL,
  rol           VARCHAR(20)   NOT NULL DEFAULT 'solicitante',
  vehiculo      VARCHAR(120)  NOT NULL DEFAULT '',
  placa         VARCHAR(20)   NOT NULL DEFAULT '',
  es_conductor  TINYINT(1)    NOT NULL DEFAULT 0,
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY usuarios_correo_uq (correo),
  KEY usuarios_rol_idx (rol),
  CONSTRAINT usuarios_rol_ck
    CHECK (rol IN ('solicitante', 'administrador', 'conductor', 'superadmin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Añade password_hash a una tabla usuarios que ya existía sin ella (la que se
-- creó cuando el login era con Microsoft). Es seguro de re-ejecutar: MySQL no
-- admite "ADD COLUMN IF NOT EXISTS", así que se consulta information_schema
-- primero. Pégalo y ejecuta UNA VEZ si la tabla ya tiene filas.
--
-- SELECT COUNT(*) AS existe
--   FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
--    AND COLUMN_NAME = 'password_hash';
--
-- ALTER TABLE usuarios
--   ADD COLUMN password_hash VARCHAR(255) NULL AFTER nombre;

-- ----------------------------------------------------------------------------
-- 2. CLIENTES (catálogo de 223 registros; la PK es (nit, bodega) porque un
--    mismo NIT puede tener varias sedes con bodega distinta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id      INT AUTO_INCREMENT NOT NULL,
  nit     VARCHAR(32)  NOT NULL,
  nombre  VARCHAR(255) NOT NULL DEFAULT '',
  bodega  VARCHAR(120) NOT NULL DEFAULT '',
  zona    VARCHAR(120) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY clientes_nit_bodega_uq (nit, bodega),
  KEY clientes_nombre_idx (nombre),
  KEY clientes_zona_idx (zona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. SOLICITUDES
--    codigo = el id local de la app (CTPLOG-00001). Si llega vacío lo genera.
--    Las fechas van en texto porque la app ya las formatea en español.
--    adjuntos es un array de rutas de archivo en el servidor (JSON) — antes era
--    text[] con URLs de OneDrive.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes (
  codigo             VARCHAR(32)   NOT NULL,
  fecha_subida       VARCHAR(40)   NOT NULL DEFAULT '',
  hora_subida        VARCHAR(40)   NOT NULL DEFAULT '',
  tipo_solicitud     VARCHAR(120)  NOT NULL DEFAULT '',
  cliente            VARCHAR(255)  NOT NULL DEFAULT '',
  nit                VARCHAR(32)   NOT NULL DEFAULT '',
  bodega             VARCHAR(120)  NOT NULL DEFAULT '',
  zona               VARCHAR(120)  NOT NULL DEFAULT '',
  cedula             VARCHAR(40)   NOT NULL DEFAULT '',
  orden_compra       VARCHAR(60)   NOT NULL DEFAULT '',
  observaciones      TEXT          NOT NULL,
  adjuntos           JSON          NOT NULL,
  solicitante_nombre VARCHAR(190)  NOT NULL DEFAULT '',
  solicitante_correo VARCHAR(190)  NOT NULL DEFAULT '',
  estado             VARCHAR(40)   NOT NULL DEFAULT 'Abierto',
  asignado_a         VARCHAR(190)  NOT NULL DEFAULT '',
  asignado_correo    VARCHAR(190)  NOT NULL DEFAULT '',
  conductor          VARCHAR(190)  NOT NULL DEFAULT '',
  conductor_correo   VARCHAR(190)  NOT NULL DEFAULT '',
  vehiculo           VARCHAR(120)  NOT NULL DEFAULT '',
  placa              VARCHAR(20)   NOT NULL DEFAULT '',
  numero_referencia  VARCHAR(60)   NOT NULL DEFAULT '',
  creado_por         VARCHAR(190)  NOT NULL DEFAULT '',
  creado_en          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  pendiente_sync     TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (codigo),
  KEY solicitudes_estado_idx (estado),
  KEY solicitudes_conductor_idx (conductor),
  KEY solicitudes_conductor_correo_idx (conductor_correo),
  KEY solicitudes_solicitante_idx (solicitante_correo),
  KEY solicitudes_actualizado_idx (actualizado_en),
  CONSTRAINT solicitudes_estado_ck CHECK (estado IN (
    'Abierto',
    'Pendiente por Autorización',
    'Devolución a Solicitante',
    'Retenido por Cartera',
    'En Trámite',
    'En Tránsito',
    'En Tránsito Parcial',
    'Entregado Parcial',
    'Entregado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3b. CONTADOR DE CÓDIGOS
--     Reemplaza la secuencia de Postgres. `valor` es el PRÓXIMO número libre
--     (no el último usado), lo que simplifica las 3 operaciones:
--       - ver sin consumir  → SELECT valor
--       - consumir          → UPDATE valor = valor + 1 (dentro de transacción)
--       - sincronizar       → valor = max(código existente) + 1
--     El bloqueo FOR UPDATE sobre la fila garantiza que dos usuarios que
--     presionen «crear» al mismo tiempo nunca reciban el mismo código.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contadores (
  nombre VARCHAR(40) NOT NULL,
  valor  BIGINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO contadores (nombre, valor) VALUES ('solicitudes_codigo', 1)
  ON DUPLICATE KEY UPDATE nombre = nombre;

-- ----------------------------------------------------------------------------
-- 3c. CÓDIGOS RESERVADOS
--     Una reserva se crea al pedir un código (POST /api/codigos/reservar) y se
--     consume al crear la solicitud. Sirve para dos cosas:
--       · que un cliente no pueda reclamar el código que el servidor le entregó
--         a otro (el POST valida que la reserva sea suya),
--       · recuperar los códigos que quedaron a medias: si el proceso se reinicia
--         entre reservar y guardar, la reserva envejece y al siguiente pedido se
--         libera. Sin esta tabla, un número consumido a la mitad se perdía para
--         siempre y el contador nunca volvía atrás.
--     La libera `liberarReservasVencidas` (routes.js) al reservar el siguiente.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codigos_reservados (
  codigo    VARCHAR(32)  NOT NULL,
  correo    VARCHAR(190) NOT NULL DEFAULT '',
  creado_en DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (codigo),
  KEY codigos_reservados_vencimiento_idx (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. HISTORIAL (auditoría + datos de la entrega; de aquí sale «Detalles»)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial (
  id            CHAR(36)     NOT NULL,
  solicitud     VARCHAR(32)  NOT NULL,
  campo         VARCHAR(20)  NOT NULL DEFAULT 'estado',
  anterior      TEXT         NOT NULL,
  nuevo         TEXT         NOT NULL,
  nota          TEXT         NOT NULL,
  referencia    TEXT         NOT NULL,
  adjunto       TEXT         NOT NULL,
  conductor     VARCHAR(190) NOT NULL DEFAULT '',
  vehiculo      VARCHAR(120) NOT NULL DEFAULT '',
  placa         VARCHAR(20)  NOT NULL DEFAULT '',
  evidencia_url TEXT         NOT NULL,
  encuesta      JSON         NULL,
  persona       VARCHAR(190) NOT NULL DEFAULT '',
  fecha         VARCHAR(40)  NOT NULL DEFAULT '',
  hora          VARCHAR(40)  NOT NULL DEFAULT '',
  creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY historial_solicitud_idx (solicitud, creado_en),
  KEY historial_campo_idx (campo),
  CONSTRAINT historial_campo_ck
    CHECK (campo IN ('estado', 'asignado', 'conductor')),
  CONSTRAINT historial_solicitud_fk
    FOREIGN KEY (solicitud) REFERENCES solicitudes (codigo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. CORREOS ENVIADOS (control de duplicados de los avisos automáticos)
--     El frontend manda el historial COMPLETO de la solicitud en cada guardado,
--     no solo lo nuevo. Sin esta tabla, la misma encuesta de mala calificación
--     (o el mismo paso por 'Retenido por Cartera') volvería a avisar en cada
--     guardado posterior de ese pedido.
--
--     La clave es el id del registro de historial, que el navegador genera una
--     sola vez con crypto.randomUUID y reenvía siempre igual. INSERT IGNORE
--     sobre la clave primaria hace la reserva atómica: dos guardados
--     simultáneos del mismo pedido compiten por la fila y solo uno manda el aviso.
--
--     No hace falta crearla a mano: server/src/correo.js la crea sola la primera
--     vez que hace falta, con el mismo usuario de MySQL que ya tiene todos los
--     privilegios sobre esta base. Está aquí para que quede documentada y por si
--     se prefiere crearla desde phpMyAdmin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correos_enviados (
  clave        VARCHAR(190) NOT NULL,
  tipo         VARCHAR(40)  NOT NULL DEFAULT '',
  solicitud    VARCHAR(32)  NOT NULL DEFAULT '',
  destinatario VARCHAR(190) NOT NULL DEFAULT '',
  asunto       VARCHAR(255) NOT NULL DEFAULT '',
  enviado_en   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clave),
  KEY correos_enviados_solicitud_idx (solicitud),
  KEY correos_enviados_fecha_idx (enviado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para ver qué avisos han salido (útil al depurar en el hosting):
--   SELECT tipo, solicitud, destinatario, asunto, enviado_en
--     FROM correos_enviados ORDER BY enviado_en DESC LIMIT 50;

-- Los avisos se reintentan solos en el siguiente guardado del pedido: si el envío
-- falló, correo.js borra la fila para que la clave vuelva a estar libre. Si lo
-- que se quiere es reenviar un aviso concreto, se borra su fila y se vuelve a
-- guardar la solicitud desde la app:
--   DELETE FROM correos_enviados WHERE clave = 'cartera:<id-del-registro>';

-- ----------------------------------------------------------------------------
-- 6. SUSCRIPCIONES PUSH (notificaciones con la app cerrada)
--     Una fila por dispositivo: el "endpoint" es el identificador que da el
--     navegador al suscribirse, y las claves con las que el servicio de push
--     (Mozilla, Google o Apple) cifra el mensaje para ese dispositivo y solo
--     para él.
--
--     El servidor NUNCA ve el contenido del aviso: va cifrado de extremo a
--     extremo. Aquí solo se guarda a quién mandárselo.
--
--     No hace falta crearla a mano: server/src/push.js la crea sola la primera
--     vez que alguien activa las notificaciones. Está aquí para documentarla y
--     por si se prefiere crearla desde phpMyAdmin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_suscripciones (
  id            INT AUTO_INCREMENT NOT NULL,
  correo        VARCHAR(190) NOT NULL,
  endpoint      VARCHAR(500) NOT NULL,
  clave_publica VARCHAR(255) NOT NULL,
  clave_privada VARCHAR(255) NOT NULL,
  agente        VARCHAR(255) NOT NULL DEFAULT '',
  creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ultimo_envio_ok_en DATETIME(3)  NULL,
  PRIMARY KEY (id),
  -- endpoint(191) y no endpoint entero: MySQL no indexa VARCHAR(500) completo
  -- con utf8mb4 (pasará de los 3072 bytes de límite de clave).
  UNIQUE KEY push_endpoint_uq (endpoint(191)),
  KEY push_correo_idx (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para ver quién tiene notificaciones activas y en cuántos equipos:
--   SELECT correo, COUNT(*) AS equipos, MAX(visto_en) AS ultimo
--     FROM push_suscripciones GROUP BY correo ORDER BY ultimo DESC;
--
-- Las suscripciones que el navegador ya no reconoce (404/410) se borran solas al
-- intentar enviar; esta consulta es para limpiar a mano las de cuentas dadas de
-- baja:
--   DELETE FROM push_suscripciones WHERE correo = 'correo@dominio.com';

-- ----------------------------------------------------------------------------
-- 6b. INVENTARIO (artículos, lotes y vencimientos por bodega)
--     Una fila por artículo del reporte que pega el administrador en el
--     módulo Inventario. Solo se guardan las columnas ORIGINALES: las
--     calculadas (Estado, Días de Vigencia y Días de Inventario por rangos)
--     las calcula el navegador al mostrarlas, para que siempre reflejen la
--     fecha de hoy sin volver a subir el reporte.
--
--     No hace falta crearla a mano: server/src/routes.js la crea sola en la
--     primera subida (igual que push_suscripciones y correos_enviados). Está
--     aquí para documentarla y por si se prefiere crearla desde phpMyAdmin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario (
  id                INT AUTO_INCREMENT NOT NULL,
  numero_articulo   VARCHAR(64)   NOT NULL DEFAULT '',
  descripcion       VARCHAR(500)  NOT NULL DEFAULT '',
  lote              VARCHAR(64)   NOT NULL DEFAULT '',
  fecha_vencimiento DATE          NULL,
  -- Texto y no número: la cantidad se muestra tal cual se pegó (con su
  -- separador de miles/decimales original) y así no se altera al guardarla.
  cantidad          VARCHAR(64)   NOT NULL DEFAULT '',
  dias_inventario   INT           NULL,
  bodega            VARCHAR(120)  NOT NULL DEFAULT '',
  nombre_bodega     VARCHAR(255)  NOT NULL DEFAULT '',
  zona              VARCHAR(120)  NOT NULL DEFAULT '',
  grupo_articulos   VARCHAR(255)  NOT NULL DEFAULT '',
  tipo_bodega       VARCHAR(120)  NOT NULL DEFAULT '',
  comercial         VARCHAR(255)  NOT NULL DEFAULT '',
  creado_en         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY inventario_vencimiento_idx (fecha_vencimiento),
  KEY inventario_articulo_idx (numero_articulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. ROLES INICIALES
--     El alta ya no se hace por SQL: la pantalla de registro crea las cuentas y
--     les asigna el rol 'solicitante'. Para la PRIMERA cuenta con permisos de
--     administración usa el script que genera el hash, y pega el INSERT de abajo
--     con ese hash:
--
--       cd server
--       node sql/crear-admin.js "admin@ctpmedica.com" "Administrador" "TU CONTRASEÑA"
--
--     Roles: solicitante (Inicio + Solicitudes), conductor (Inicio + Conductor),
--     administrador (todos los módulos; ve sin asignar + sus propias asignaciones),
--     superadmin (todos los módulos y TODAS las solicitudes).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 7. SINCRONIZAR EL CONTADOR
--     Deja el contador a la par del código más alto existente (idempotente).
--     Correrlo UNA VEZ después de importar los datos de Postgres.
--
--     Se usa SUBSTRING_INDEX y no REGEXP_REPLACE a propósito: REGEXP_REPLACE
--     solo existe desde MySQL 8.0, y buena parte del hosting compartido sigue
--     en 5.7 (o en MariaDB, donde sí existe pero con otro comportamiento). Con
--     SUBSTRING_INDEX esto funciona en 5.7, 8.0 y MariaDB por igual.
-- ----------------------------------------------------------------------------
UPDATE contadores
   SET valor = GREATEST(
     COALESCE((
       SELECT MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED))
         FROM solicitudes
        WHERE codigo LIKE 'CTPLOG-%'
     ), 0) + 1,
     1
   )
 WHERE nombre = 'solicitudes_codigo';
