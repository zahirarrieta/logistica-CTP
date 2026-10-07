-- ============================================================================
-- Migración: ampliar el CHECK de solicitudes.estado
--
-- Problema: la restricción `solicitudes_estado_ck` solo permitía 9 valores y le
-- faltaban 'En Trámite Parcial' y 'Cancelado'. Al intentar pasar un pedido a uno
-- de esos estados, el motor rechazaba el UPDATE/INSERT, la API lo traducía a un
-- 500 «Error interno del servidor» y el frontend pausaba la subida ("[API]
-- pendientes en pausa"). Como el cambio de estado nunca se guardaba, los pedidos
-- cancelados tampoco aparecían en el dashboard.
--
-- Motor: MariaDB (usado en producción). OJO: MariaDB NO admite `DROP CHECK`
-- (esa sintaxis es de MySQL 8.0.16+). Para quitar una restricción se usa
-- `DROP CONSTRAINT`, disponible desde MariaDB 10.2.22 / 10.3.13 / 10.4.3+.
--
-- Aplicar una sola vez sobre la base de datos de producción, bien por
-- phpMyAdmin o por consola:
--   mariadb -u <usuario> -p <base> < server/sql/migracion-estados.mysql.sql
--
-- Si `DROP CONSTRAINT` fallara porque el nombre no coincide, primero averigua
-- el nombre real (ver PASO 0) y úsalo en el PASO 1.
-- ============================================================================

-- PASO 0 (opcional, para confirmar el nombre de la restricción):
--   SELECT CONSTRAINT_NAME
--     FROM information_schema.TABLE_CONSTRAINTS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'solicitudes'
--      AND CONSTRAINT_TYPE = 'CHECK';

-- PASO 1: quita la restricción vieja para poder recrearla.
ALTER TABLE solicitudes DROP CONSTRAINT solicitudes_estado_ck;

-- PASO 2: la recrea con la lista completa, alineada con ESTADOS del frontend
-- (src/utils/estadoColors.js).
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_ck CHECK (estado IN (
  'Abierto',
  'Pendiente por Autorización',
  'Devolución a Solicitante',
  'Retenido por Cartera',
  'En Trámite',
  'En Trámite Parcial',
  'En Tránsito',
  'En Tránsito Parcial',
  'Entregado Parcial',
  'Entregado',
  'Cancelado'
));