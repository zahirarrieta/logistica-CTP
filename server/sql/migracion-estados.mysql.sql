-- ============================================================================
-- Migración: ampliar el CHECK de solicitudes.estado
--
-- Problema: la restricción `solicitudes_estado_ck` (creada en MySQL 8.0.16+)
-- solo permitía 9 valores y le faltaban 'En Trámite Parcial' y 'Cancelado'.
-- Al intentar pasar un pedido a uno de esos estados, MySQL rechazaba el
-- UPDATE/INSERT, la API lo traducía a un 500 «Error interno del servidor» y el
-- frontend pausaba la subida ("[API] pendientes en pausa"). Como el cambio de
-- estado nunca se guardaba, los pedidos cancelados tampoco aparecían en el
-- dashboard.
--
-- Aplicar una sola vez sobre la base de datos de producción:
--   mysql -u <usuario> -p <base> < server/sql/migracion-estados.mysql.sql
--
-- Es idempotente: primero elimina la restricción si existe y luego la recrea
-- con la lista completa. Requiere MySQL 8.0.16 o superior (soporte de CHECK).
-- ============================================================================

-- Quita la restricción vieja (si existe) para poder recrearla.
ALTER TABLE solicitudes DROP CHECK solicitudes_estado_ck;

-- Lista completa, alineada con ESTADOS del frontend (src/utils/estadoColors.js).
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