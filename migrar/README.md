# Migración de datos: Supabase (Postgres) → MySQL del hosting

Herramienta de **una sola vez**. Sirve para traerse las solicitudes, el historial,
los usuarios y los clientes que ya están en Supabase.

## Orden

1. **Importar el schema y los seeds en MySQL** (phpMyAdmin), en este orden:
   - `server/sql/schema.mysql.sql`
   - `server/sql/seed_clientes.mysql.sql`
   - `server/sql/seed_usuarios.mysql.sql`
2. **Exportar desde Supabase** (esto lee, no borra).
3. **Importar a MySQL.**
4. Verificar que la app muestre las solicitudes igual que antes.
5. Recién entonces, dar de baja el proyecto en Supabase.

## 2. Exportar

```bash
npm install
```

Copia la *Connection string* de **Supabase > Settings > Database > Connection
string > URI (session mode)** y:

```bash
PG_CONNECTION="postgresql://postgres.xxxx:TU_CLAVE@aws-0-...pooler.supabase.com:5432/postgres" npm run exportar
```

Deja `datos.json` en esta carpeta.

## 3. Importar

```bash
MYSQL_HOST=localhost \
MYSQL_USER=ctp_logistica \
MYSQL_PASSWORD='TU_CLAVE' \
MYSQL_DATABASE=ctp_logistica \
npm run importar
```

Escribe con `INSERT IGNORE`, así que se puede repetir sin duplicar filas. Al
final sincroniza el contador de códigos con el `CTPLOG-` más alto importado.

## Qué NO se migra

| Elemento | Motivo |
|---|---|
| Archivos de Supabase Storage | Los adjuntos y evidencias viven en **OneDrive/SharePoint**, no en Supabase. El bucket solo se usaba como respaldo de la evidencia y ya no se necesita: las evidencias nuevas se suben al disco del hosting. |
| Sesiones de autenticación | Se re-crean: ahora la identidad es el token de Microsoft, no un JWT de Supabase. |
| RLS, RPC, triggers | Los permisos y la lógica equivalenten están en `server/src/permisos.js` y en las rutas de `server/src/routes.js`. |

## Si algo sale mal

El importador **no borra nada**: se puede borrar la base y volver a correr
`schema.mysql.sql` + seeds + `importar-mysql.mjs` sin perder la fuente, porque
`datos.json` y Supabase siguen intactos hasta el paso 5.
