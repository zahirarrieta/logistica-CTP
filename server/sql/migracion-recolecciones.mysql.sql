-- ============================================================================
-- Migración: ampliar el CHECK de recolecciones.estado + completar el esquema
--            del módulo de recolecciones
--
-- Problema: la restricción `recolecciones_estado_ck` solo permitía los 4 estados
-- viejos ('Abierto', 'Trámite', 'Fallido', 'Entregado'). El módulo pasó a usar
-- los mismos estados que las solicitudes más «Fallido» (ver
-- server/src/permisos.js → ESTADOS_RECOLECCION), así que al cambiar una
-- recolección a 'En Trámite', 'En Tránsito', 'Cancelado' o 'Devolución a
-- Solicitante' el motor rechazaba el UPDATE, la API lo traducía a un
-- 500 «Error interno del servidor» y en el navegador se veía
-- "[Admin] error cambiando estado recolección: ApiError: Error interno del
-- servidor". Con 'Abierto' y 'Fallido' sí funcionaba, porque esos dos valores
-- están en las dos listas: por eso el fallo parecía intermitente.
--
-- Es el mismo caso que ya se corrigió para solicitudes en
-- migracion-estados.mysql.sql.
--
-- Motor: MariaDB (usado en producción). OJO: MariaDB NO admite `DROP CHECK`
-- (esa sintaxis es de MySQL 8.0.16+). Para quitar una restricción se usa
-- `DROP CONSTRAINT`, disponible desde MariaDB 10.2.22 / 10.3.13 / 10.4.3+.
-- Si la base resultara ser MySQL 8 y no MariaDB, cambia `DROP CONSTRAINT` por
-- `DROP CHECK` en el PASO 2 y quita el `IF NOT EXISTS` de las columnas del
-- PASO 1 (MySQL 8 no lo admite; ahí un error 1060 «Duplicate column name»
-- significa que la columna ya existía y se puede ignorar).
--
-- Aplicar una sola vez sobre la base de datos de producción, por phpMyAdmin o
-- por consola:
--   mariadb -u <usuario> -p <base> < server/sql/migracion-recolecciones.mysql.sql
--
-- Todo el archivo es idempotente salvo el PASO 2 (DROP CONSTRAINT), que falla
-- si la restricción ya no existe: en ese caso ese error es inofensivo, se
-- continúa con el PASO 3.
--
-- OJO: el PASO 2b MODIFICA DATOS (renombra el estado heredado 'Trámite' a
-- 'En Trámite'). Conviene mirar antes cuántas filas toca:
--   SELECT estado, COUNT(*) FROM recolecciones GROUP BY estado;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 0 (opcional, para confirmar el nombre real de la restricción):
--   SELECT CONSTRAINT_NAME
--     FROM information_schema.TABLE_CONSTRAINTS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'recolecciones'
--      AND CONSTRAINT_TYPE = 'CHECK';
-- Si el nombre no coincide con `recolecciones_estado_ck`, úsalo en el PASO 2.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- PASO 1: columnas que el código agrega solo al arrancar (ver
-- `asegurarRecolecciones` en server/src/routes.js). Se ponen aquí para que el
-- esquema SQL quede completo y no dependa de que el servidor haya arrancado.
-- `IF NOT EXISTS` es de MariaDB: si la columna ya existe no hace nada.
-- ----------------------------------------------------------------------------
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS asignado_a        VARCHAR(190) NOT NULL DEFAULT '' AFTER estado;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS asignado_correo   VARCHAR(190) NOT NULL DEFAULT '' AFTER asignado_a;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS conductor         VARCHAR(190) NOT NULL DEFAULT '' AFTER asignado_correo;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS conductor_correo  VARCHAR(190) NOT NULL DEFAULT '' AFTER conductor;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS vehiculo          VARCHAR(120) NOT NULL DEFAULT '' AFTER conductor_correo;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS placa             VARCHAR(20)  NOT NULL DEFAULT '' AFTER vehiculo;
ALTER TABLE recolecciones ADD COLUMN IF NOT EXISTS historial         JSON NULL AFTER placa;

-- ----------------------------------------------------------------------------
-- PASO 2: quita la restricción vieja para poder recrearla.
-- ----------------------------------------------------------------------------
ALTER TABLE recolecciones DROP CONSTRAINT recolecciones_estado_ck;

-- ----------------------------------------------------------------------------
-- PASO 2b: datos heredados. 'Trámite' es el nombre viejo de 'En Trámite', así
-- que se renombra: si no, quedaría fuera de la lista nueva y el ALTER del
-- PASO 3 fallaría por las filas ya guardadas (además de no tener color en la
-- etiqueta del frontend).
-- ----------------------------------------------------------------------------
UPDATE recolecciones SET estado = 'En Trámite' WHERE estado = 'Trámite';

-- ----------------------------------------------------------------------------
-- PASO 3: la recrea con la lista vigente, alineada con ESTADOS_RECOLECCION
-- (server/src/permisos.js) y con el espejo del frontend (src/auth/roles.js).
--
-- 'Entregado' se mantiene como valor heredado: el módulo ya no lo ofrece, pero
-- pueden existir recolecciones cerradas con ese estado y hay que dejarlas
-- válidas (la etiqueta verde ya existe en src/utils/estadoColors.js). Si se
-- prefiere una lista estricta de 6 estados, primero se migran esas filas, p. ej.
--   UPDATE recolecciones SET estado = 'En Tránsito' WHERE estado = 'Entregado';
-- y luego se quita 'Entregado' de la lista de abajo.
-- ----------------------------------------------------------------------------
ALTER TABLE recolecciones ADD CONSTRAINT recolecciones_estado_ck CHECK (estado IN (
  'Abierto',
  'Devolución a Solicitante',
  'En Trámite',
  'En Tránsito',
  'Cancelado',
  'Fallido',
  'Entregado'
));

-- ----------------------------------------------------------------------------
-- PASO 4: tabla del historial de recolecciones. Faltaba en el esquema SQL: la
-- crea el código al arrancar, pero se deja aquí para que una instalación nueva
-- quede completa desde el SQL. Idéntica a la de server/src/routes.js.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recoleccion_historial (
  id            CHAR(36)     NOT NULL,
  recoleccion   VARCHAR(32)  NOT NULL,
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
  KEY recoleccion_historial_rec_idx (recoleccion, creado_en),
  KEY recoleccion_historial_campo_idx (campo),
  CONSTRAINT recoleccion_historial_fk
    FOREIGN KEY (recoleccion) REFERENCES recolecciones (codigo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- PASO 5: contador de la secuencia Rec-00001 (mismo patrón que
-- solicitudes_codigo). No consume número si ya existe.
-- ----------------------------------------------------------------------------
INSERT INTO contadores (nombre, valor) VALUES ('recolecciones_codigo', 1)
  ON DUPLICATE KEY UPDATE nombre = nombre;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN: la restricción debe quedar con los 7 valores admitidos y no
-- debe quedar ninguna fila en un estado fuera de la lista.
--   SELECT estado, COUNT(*) FROM recolecciones GROUP BY estado;
--   SELECT CONSTRAINT_NAME
--     FROM information_schema.TABLE_CONSTRAINTS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'recolecciones'
--      AND CONSTRAINT_TYPE = 'CHECK';
-- ----------------------------------------------------------------------------
