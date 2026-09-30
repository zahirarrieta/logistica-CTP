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

Botón **Continuar** / **Importar**. Después repite con el otro archivo,
**en este orden**:

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `server/sql/schema.mysql.sql` | Tablas, índices, contador, claves foráneas |
| 2 | `server/sql/seed_clientes.mysql.sql` | 223 clientes del catálogo |

Los dos son idempotentes: si algo falla y hay que reintentar, se puede volver a
subir sin duplicar nada.

**No importes `seed_usuarios.mysql.sql`.** Es de la época en que las cuentas
llegaban de Microsoft: inserta usuarios sin `password_hash`, y con la columna en
`NULL` no pueden iniciar sesión nunca. Las cuentas se crean solas con el formulario
de registro (todas como `solicitante`) y la primera de administración se crea en
el paso 2.4.

Si phpMyAdmin se queda pensando (los archivos son pequeños, no debería), usa la
opción B.

### Opción B · por línea de comandos (SSH)

Sube los tres `.sql` a `/home/TU_USUARIO/` por FTP y:

```bash
mysql -u pedroct1_logistica -p pedroct1_logistica < schema.mysql.sql
mysql -u pedroct1_logistica -p pedroct1_logistica < seed_clientes.mysql.sql
```

### Comprobar que quedó bien

En phpMyAdmin, pestaña **SQL**, pega y ejecuta:

```sql
SELECT 'usuarios' t, COUNT(*) n FROM usuarios
UNION ALL SELECT 'clientes',   COUNT(*) FROM clientes
UNION ALL SELECT 'solicitudes',COUNT(*) FROM solicitudes
UNION ALL SELECT 'historial',  COUNT(*) FROM historial;
```

Debe dar **0 · 223 · 0 · 0**. `usuarios` en 0 es lo correcto: todavía no se ha
registrado nadie. Si `clientes` sale en 0, el seed 2 no corrió.

Y que el contador esté en 1 (todavía no hay solicitudes):

```sql
SELECT * FROM contadores;   -- solicitudes_codigo | 1
```

### 2.4 Crear la primera cuenta de administración

Si la tabla `usuarios` **ya existía** de la época de Microsoft, le falta la
columna `password_hash` (el `CREATE TABLE IF NOT EXISTS` del schema no la añade a
una tabla que ya está). Pega esto en la pestaña **SQL** de phpMyAdmin:

```sql
SELECT COUNT(*) AS tiene_password_hash
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'usuarios'
   AND COLUMN_NAME = 'password_hash';
```

Si sale **0**, ejecuta esto (añade la columna solo si no está):

```sql
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE usuarios ADD COLUMN password_hash VARCHAR(255) NULL AFTER nombre',
    'SELECT 1')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'usuarios'
   AND COLUMN_NAME = 'password_hash'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

Después genera el `INSERT` del admin. El script **no necesita base de datos**
para imprimirlos, así que se puede ejecutar en tu máquina:

```bash
cd server
node sql/crear-admin.js "tu@correo.com" "Tu Nombre" "TuClaveFuerte" superadmin
```

Copia el `INSERT` que imprime y pégalo en phpMyAdmin > **SQL**. El script no hace
falta en el hosting: solo genera el hash, y el backend no lo usa.

Comprobación:

```sql
SELECT correo, nombre, rol, activo FROM usuarios;
-- tu@correo.com | Tu Nombre | superadmin | 1
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
| `password_hash` no existe | Tabla usuarios era de la época Microsoft | Ver apartado 2.4 |
| `FIRMA_SECRET es obligatorio en producción` | Falta esa variable | Sección 3, variables de entorno |
| La API da 401 en todo | `DB_USER`/`DB_NAME` sin el prefijo de cPanel | Copia los nombres exactos de la lista de bases |
| La API da 500 al leer | Usuario MySQL sin privilegios | cPanel > MySQL > **Privilegios** > *All Privileges* |

Los dos archivos son idempotentes, así que corregir y volver a subir es seguro.

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
DB_POOL=10
SESSION_SECRET=<genera uno: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
FIRMA_SECRET=<genera otro, distinto>
SESSION_TTL=28800
CORS_ORIGENES=https://pedro-ctpmedica.com
```

`SESSION_SECRET` y `FIRMA_SECRET` son **imprescindibles**: `config.js` lanza y la
app no arranca si falta alguno. Los dos comandos generan 32 bytes aleatorios, pero
**uno para cada variable y nunca el mismo valor**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

No hay variables de Azure ni de Microsoft: la autenticación es propia, con hash
`scrypt` y un JWT que firma la propia API.

**Ojo con `DB_USER` y `DB_NAME`:** el hosting les antepone tu usuario de cPanel.
Si creaste la base como `logistica` y tu usuario de cPanel es `pedroct1`,
el nombre real es `pedroct1_logistica`. cPanel te lo muestra en la lista de
bases de datos; cópialo tal cual.

Guarda y dale a **Restart**.

El log de arranque dice si quedó bien (`cPanel > Errors`):

```
[Config] listo: {"node":"v20.x","entorno":"production",
  "base":"pedroct1_logistica@localhost:3306/pedroct1_logistica",
  "sesion":"secreta definida","firma":"definida","cors":"https://pedro-ctpmedica.com"}
```

Si en vez de eso sale el bloque `FALTAN VARIABLES DE ENTORNO`, el propio mensaje
dice cuál falta.

## 4. Probar la API

```bash
curl https://api.pedro-ctpmedica.com/api/salud
# {"ok":true,"deploy":"2026-09-30-login-propio"}
```

Que responda 200 sin token es lo esperado: es el único endpoint abierto. Un 401 en
cualquier otro endpoint también es correcto, es la falta de sesión.

Si en lugar de JSON devuelve una página de error, el problema no es el código:
cPanel devuelve HTML cuando la aplicación Node.js está detenida o el subdominio
no está apuntando a ella.

Prueba también el registro desde otro equipo (o desde una ventana privada):

```bash
curl -X POST https://api.pedro-ctpmedica.com/api/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Prueba","correo":"prueba@ctpmedica.com","contrasena":"Clave12345"}'
```

Si responde con un token, el alta de cuentas funciona.

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

## 6. Orígenes permitidos

`CORS_ORIGENES` decide qué sitios pueden llamar a la API. El valor tiene que
coincidir **exacto** con el origen del navegador, con esquema y `www`
incluidos:

```
CORS_ORIGENES=https://pedro-ctpmedica.com
```

Si la app se entra por `www`, sepáralos con una coma y añade también el segundo:

```
CORS_ORIGENES=https://pedro-ctpmedica.com,https://www.pedro-ctpmedica.com
```

Un origen mal escrito no da un error claro: el navegador bloquea la respuesta y
la pantalla muestra "no hay conexión con el servidor". Si el login funciona en
un sitio y en otro no, es casi siempre esto.

## 7. Permisos de las evidencias

Las evidencias de respaldo se guardan en `server/storage/evidencias/`. Esa
carpeta tiene que existir y ser escribible por el usuario de la app. Crea un
`storage/evidencias` vacío y dale permisos `755` (o `775` si Passenger lo
necesita). JetBackup la incluye en las copias si está dentro de `home/`.

## 8. Verificación final

| Prueba | Cómo |
|---|---|
| Registro | Abre `/`, pulsa "Regístrate aquí" y crea una cuenta: entra directo |
| Login | Cierra sesión y entra con esa cuenta: llega a `/inicio` |
| Roles | Un solicitante solo ve sus solicitudes; un administrador, todas |
| Conductor | Solo ve lo que está en tránsito y sus entregas |
| Crear | Crea una solicitud y comprueba que el código sigue la secuencia |
| Adjuntos | Sube un PDF y ábrelo: debe salir desde `api.pedro-ctpmedica.com` |
| Evidencia | Entrega con foto: se guarda en el disco del servidor |
| Multiusuario | Dos navegadores a la vez: el segundo ve el cambio en ~8 s |

Una cuenta creada por registro **siempre** es `solicitante`. Para darle más
permisos, promociona desde el panel de administrador o vuelve a correr
`crear-admin.js` con el rol que corresponda.

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

Sin `.env` el backend arranca igual, pero avisa de que falta `DB_USER` y
`DB_NAME` y usa secretos de sesión temporales: sirve para comprobar el arranque y
el 401 de `/api/auth/yo`, no para trabajar con datos.
