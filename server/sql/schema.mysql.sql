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
-- 4b. SESIONES RECORDADAS («recordar este equipo»)
--     Lo que permite entrar con un clic sin volver a escribir la contraseña.
--
--     Aquí NO se guarda ninguna contraseña: se guarda el HASH de un token opaco
--     que el servidor entrega al iniciar sesión si el usuario marca la casilla.
--     El token vive en el navegador; en la tabla solo su SHA-256. Así una copia
--     de esta tabla no sirve para entrar, y la fila se puede borrar para revocar
--     el acceso (de eso sirve «olvidar este equipo» y «salir de todos los
--     dispositivos»).
--
--     El token canjea una sesión normal: no es un JWT, no tiene firma y no
--     sirve para nada más que esto, que es justo lo que se busca. Por eso la
--     fila en la tabla es obligatoria: un token sin fila se considera inválido.
--
--     `expira_en` no lo aplica el token, sino la consulta: aunque el token no
--     caduque por sí mismo, buscar la fila por hash y exigir que siga viva hace
--     que revocar sea inmediato.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones_recordadas (
  id         CHAR(36)     NOT NULL,
  correo     VARCHAR(190) NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  agente     VARCHAR(255) NOT NULL DEFAULT '',
  creado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ultimo_uso DATETIME(3)  NULL DEFAULT NULL,
  expira_en  DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sesiones_recordadas_hash_uq (token_hash),
  KEY sesiones_recordadas_correo_idx (correo),
  KEY sesiones_recordadas_expira_idx (expira_en),
  -- Sin esto, dar de baja a un usuario (borrar su fila) dejaría vivo su token
  -- de confianza: seguiría entrando sin contraseña aunque la cuenta ya no
  -- exista. El CASCADE lo resuelve en la misma operación.
  CONSTRAINT sesiones_recordadas_correo_fk
    FOREIGN KEY (correo) REFERENCES usuarios (correo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. ROLES INICIALES
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
-- 6. SINCRONIZAR EL CONTADOR
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
