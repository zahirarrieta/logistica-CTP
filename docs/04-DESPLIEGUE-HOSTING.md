# ============================================================================
# DESPLIEGUE · Latinoamérica Hosting
# Guía paso a paso para dejar la app corriendo en el hosting compartido,
# fuera de Vercel y de Supabase.
#
#   Frontend  → Vite build estático  → public_html
#   Backend   → Node.js + Express   → subdominio api. (Node.js Selector)
#   Datos     → MySQL               → 1 de las 30 bases del plan
#   Evidencias→ disco               → JetBackup diario
# ============================================================================

## 0. Requisitos del plan

El plan Hosting Empresarial E1 sirve: 100 GB SSD, 3 vCPU, 4 GB RAM, 2 TB de
transferencia, 5 dominios, 30 bases de datos.

Dos avisos:

- **Las 30 bases son MySQL**, no PostgreSQL. Por eso el schema se reescribió
  (`server/sql/schema.mysql.sql`) y las políticas RLS de Supabase pasaron a
  código en `server/src/permisos.js`.
- **No hay WebSockets**, así que el tiempo real de Supabase se reemplazó por
  re-sincronización incremental cada 8 s.

## 1. Crear la base de datos y el usuario

cPanel > **Bases de datos MySQL** > Crear nueva base de datos y luego Crear
nuevo usuario de MySQL, asignándole TODOS los privilegios sobre esa base.

El nombre final lleva el prefijo de la cuenta. En este proyecto la cuenta de
cPanel es `pedroct1` y la base se creó como `logistica`, así que:

```
base:    pedroct1_logistica
usuario: pedroct1_logistica
```

Anota la contraseña: va en `DB_PASSWORD` del backend.

| | |
|---|---|
| Frontend | https://pedro-ctpmedica.com |
| API | https://api.pedro-ctpmedica.com |

## 2. Importar el schema y los datos iniciales

Hay **dos formas** de llegar las tablas a la base. Elige una, no las dos.

### Opción A · phpMyAdmin (lo normal)

cPanel > **Bases de datos MySQL** > tu base > **Administrar** (abre phpMyAdmin) >
selecciona la base en la barra izquierda > pestaña **Importar**.

| Campo | Valor |
|---|---|
| Archivo | `server/sql/schema.mysql.sql` |
| Formato | SQL |
| **Detalle del formato** | **MySQL** (esto importa: phpMyAdmin a veces asume otra cosa) |
| Prefijo de tabla | *(vacío)* |

Botón **Continuar** / **Importar**. Después repite con los otros dos archivos,
**en este orden**:

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `server/sql/schema.mysql.sql` | Tablas, índices, contador, claves foráneas |
| 2 | `server/sql/seed_clientes.mysql.sql` | 223 clientes del catálogo |
| 3 | `server/sql/seed_usuarios.mysql.sql` | 10 usuarios con su rol |

Los tres son idempotentes: si algo falla y hay que reintentar, se puede volver a
subir sin duplicar nada.

Si phpMyAdmin se queda pensando (los archivos son pequeños, no debería), usa la
opción B.

### Opción B · por línea de comandos (SSH)

Sube los tres `.sql` a `/home/TU_USUARIO/` por FTP y:

```bash
mysql -u pedroct1_logistica -p pedroct1_logistica < schema.mysql.sql
mysql -u pedroct1_logistica -p pedroct1_logistica < seed_clientes.mysql.sql
mysql -u pedroct1_logistica -p pedroct1_logistica < seed_usuarios.mysql.sql
```

### Comprobar que quedó bien

En phpMyAdmin, pestaña **SQL**, pega y ejecuta:

```sql
SELECT 'usuarios' t, COUNT(*) n FROM usuarios
UNION ALL SELECT 'clientes',   COUNT(*) FROM clientes
UNION ALL SELECT 'solicitudes',COUNT(*) FROM solicitudes
UNION ALL SELECT 'historial',  COUNT(*) FROM historial;
```

Debe dar **10 · 223 · 0 · 0**. Si `clientes` sale en 0, el seed 2 no corrió.

Y que el contador esté en 1 (todavía no hay solicitudes):

```sql
SELECT * FROM contadores;   -- solicitudes_codigo | 1
```

### Si ya tienes solicitudes en Supabase

Los tres archivos de arriba dejan la app **vacía pero funcional**. Para traerte
las solicitudes que ya tienes, usa la herramienta de `migrar/` (ver
`migrar/README.md`): exporta desde Supabase a un `datos.json` y lo importa aquí.
Hazlo **después** de los tres archivos.

Antes de subir nada puedes pasarlo por `npm run verificar:sql` en `server/`: eso
contrasta las columnas que usa el backend contra el schema y avisa si usas
funciones que no existen en MySQL 5.7.

### Si el import falla

| Error en phpMyAdmin | Causa | Qué hacer |
|---|---|---|
| `#1064 ... error in your SQL syntax` | Formato del archivo mal interpretado | En *Detalle del formato* elige **MySQL** |
| `Table 'x_pedroct1_logistica.solicitudes' doesn't exist` | Corriste un seed antes del schema | Sube primero `schema.mysql.sql` |
| `Unknown character set: 'utf8mb4'` | MySQL 5.5 o anterior | Dímelo: el schema hay que bajarlo a `utf8` |
| `Column count doesn't match value count` | Seed de usuarios de una versión vieja | Descarga el repo otra vez: se corrigió para declarar `id` |
| `FIRMA_SECRET es obligatorio en producción` | Falta esa variable | Sección 3, variables de entorno |
| La API da 401 en todo | `DB_USER`/`DB_NAME` sin el prefijo de cPanel | Copia los nombres exactos de la lista de bases |
| La API da 500 al leer | Usuario MySQL sin privilegios | cPanel > MySQL > **Privilegios** > *All Privileges* |

Los tres archivos son idempotentes, así que corregir y volver a subir es seguro.

## 3. Subir el backend

Crea un **subdominio** desde cPanel (p. ej. `api.pedro-ctpmedica.com`) para que la
API no compita con el frontend por el mismo dominio.

Luego cPanel > **Setup Node.js App** (Node.js Selector):

| Campo | Valor |
|---|---|
| Node.js version | 18.x o superior (LTS) |
| Application mode | Production |
| Application root | `server` |
| Application URL | `api.pedro-ctpmedica.com` |
| Application startup file | `app.js` |

Presiona **Create Application**. Después sube el contenido de `server/` (sin
`node_modules` ni `.env`) por FTP/SSH a `/home/TU_USUARIO/server`.

Vuelve a Setup Node.js App y usa **Run NPM Install** para instalar
`express`, `mysql2`, `jose`, `multer` y `cors`.

### Variables de entorno

En el mismo formulario, en **Environment variables**, agrega:

```
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=pedroct1_logistica
DB_PASSWORD=<la contraseña del paso 1>
DB_NAME=pedroct1_logistica
AZURE_TENANT_ID=0294e0dd-589f-4476-b787-4e6f5f291e6f
AZURE_CLIENT_ID=6924d555-d956-4f27-90f8-4d5486a1adb8
FIRMA_SECRET=<genera uno: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
CORS_ORIGENES=https://pedro-ctpmedica.com
```

**Ojo con `DB_USER` y `DB_NAME`:** el hosting les antepone tu usuario de cPanel.
Si creaste la base como `logistica` y tu usuario de cPanel es `pedroct1`,
el nombre real es `pedroct1_logistica`. cPanel te lo muestra en la lista de
bases de datos; cópialo tal cual.

Guarda y dale a **Restart**.

`AZURE_TENANT_ID` y `AZURE_CLIENT_ID` deben coincidir con los de
`src/auth/authConfig.js`; si no, la API rechaza todos los tokens (401).

## 4. Probar la API

```bash
curl https://api.pedro-ctpmedica.com/api/salud
# {"ok":true}
```

Que responda 200 sin token es lo esperado: es el único endpoint abierto. Un 401
en cualquier otro endpoint es correcto (falta el token de Microsoft).

## 5. Construir y subir el frontend

En tu máquina:

```bash
npm install
# .env.local:
#   VITE_API_URL=https://api.pedro-ctpmedica.com
npm run build
```

Sube el contenido de `dist/` a `public_html` del dominio principal. El archivo
`public/.htaccess` se copia solo al build: es el reemplazo del `vercel.json`
(fuerza `index.html` en las rutas de la SPA, para que `/conductor` y
`/administrador` funcionen al recargar).

## 6. En Microsoft Entra ID

### 6.1 Redirect URIs

En **App registrations** > tu app > **Authentication** > **Single-page
application** > Redirect URIs, agrega los orígenes por los que se entra:

```
https://pedro-ctpmedica.com
http://localhost:5173          (desarrollo)
```

Quita el de Vercel cuando el corte esté hecho. Si usas `www`, agrégalo también:
`https://www.pedro-ctpmedica.com`. Ojo: el origen tiene que coincidir **exacto**
con el del navegador (esquema y `www` incluidos), o Microsoft rechazará el login.

### 6.2 Publicar el scope de la API (recomendado)

El frontend pide el token con el scope `api://<client-id>/access_as_user`, y el
backend espera que la audiencia del token sea el id de la app. Ese scope tiene
que existir:

1. **Expose an API** > *Application ID URI*: deja el que ya proposes
   (`api://6924d555-d956-4f27-90f8-4d5486a1adb8`).
2. **Add a scope** > `access_as_user` > *Authorized client applications*:
   agrega tu propia app.
3. **API permissions** > **Add a permission** > *My APIs* > esa misma app >
   `access_as_user` > *Grant admin consent*.

Mientras no lo hagas, **no pasa nada**: el backend también acepta la audiencia
de Microsoft Graph, así que los tokens que ya devuelve MSAL funcionan igual.

Ojo, mientras el scope no exista hay que dejar `VITE_USAR_SCOPE_API=0`, que es el
valor por defecto. Con `1` el frontend pide `access_as_user` y Microsoft rechaza
el login con AADSTS500011, obligando a entrar dos veces.

Cuando termines los tres pasos, **reconstruye** con la variable en `1`:

```
VITE_USAR_SCOPE_API=1
```

y vuelve a subir el build. A partir de ahí el login pide el scope propio desde el
primer intento. Más adelante, cuando te acostumbres, puedes quitar
`GRAPH_AUDIENCE` y `GRAPH_AUDIENCE_V2` de la lista en `server/src/auth.js`.

### 6.3 Allowed origin types

Deja **Single-tenant** como estaba: la API y el frontend usan el mismo tenant
(`0294e0dd-…`) y así ningún token de otra organización entra.

## 7. Permisos de las evidencias

Las evidencias de respaldo se guardan en `server/storage/evidencias/`. Esa
carpeta tiene que existir y ser escribible por el usuario de la app. Crea un
`storage/evidencias` vacío y dale permisos `755` (o `775` si Passenger lo
necesita). JetBackup la incluye en las copias si está dentro de `home/`.

## 8. Verificación final

| Prueba | Cómo |
|---|---|
| Login | Entra con una cuenta de Microsoft y llega a `/inicio` |
| Roles | Un solicitante solo ve sus solicitudes; un administrador, todas |
| Conductor | Solo ve lo que está en tránsito y sus entregas |
| Crear | Crea una solicitud y comprueba que el código sigue la secuencia |
| Adjuntos | Sube un PDF: debe aparecer en la carpeta compartida de OneDrive |
| Evidencia | Entrega con foto: sube a OneDrive y, si Microsoft falla, al disco |
| Multiusuario | Dos navegadores a la vez: el segundo ve el cambio en ~8 s |

## 9. Apagar Vercel y Supabase

Solo cuando el paso 8 esté completo:

- Supabase: exportar por si acaso, luego pausar o eliminar el proyecto.
- Vercel: desvincular el repositorio o eliminar el proyecto.

## Desarrollo local

Dos terminales:

```bash
# 1. Base de datos (cualquier MySQL 8 con el schema importado)
#    y las variables de server/.env
cd server && node src/index.js        # http://localhost:3000

# 2. Frontend
#    .env.local con VITE_API_URL=http://localhost:3000
npm run dev
```

El login de Microsoft exige que `http://localhost:5173` esté en los Redirect URIs
de la app en Entra ID.
