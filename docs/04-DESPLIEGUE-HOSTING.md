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

### Avisos por correo (mala calificación y retención por cartera)

La API manda dos avisos automáticos. Los dos salen **desde el servidor**, no desde
el navegador, por dos razones: hay una sola identidad remitente (si los mandara el
frontend, cualquier usuario con una sesión abierta podría escribir en nombre de la
empresa) y queda escrito en el log del hosting quién pidió cada envío.

| Aviso | A quién | Cuándo |
|---|---|---|
| Mala calificación | solicitante + 5 áreas internas en copia | la encuesta de satisfacción queda en **2.5 o menos** |
| Retención por cartera | solicitante + áreas internas en copia | la solicitud **pasa a** `Retenido por Cartera` |

Lo decide `server/src/correo.js` al confirmar el guardado de la entrega, que es la
única puerta por la que entran el cambio de estado y la encuesta. Por eso también
funciona sin conexión: si el conductor guardó sin red, el aviso sale solo cuando la
cola se sincroniza.

**Paso 1 · Crear el buzón.** Si la cuenta de correo ya existe, sáltalo. cPanel >
**Correo electrónico > Crear buzón de correo**. Un buzón del propio hosting es lo
normal aquí (`operaciones@pedro-ctpmedica.com` o el de la empresa si el dominio ya
tiene correo). Se anota la contraseña.

**Paso 2 · Averiguar el servidor SMTP.** cPanel > **Correo electrónico > Conexiones
de correo electrónico**:

| Campo | Valor |
|---|---|
| Servidor SMTP | `mail.pedro-ctpmedica.com` (a veces `mail.DOMINIO.com`) |
| Puerto SSL/TLS | **465** |
| Puerto STARTTLS | **587** |

Se usa el 465 por defecto porque el más antiguo va con cifrado directo. Si solo
tienes el 587, pon `MAIL_PORT=587` y `MAIL_SECURE=false`.

**Paso 3 · Las variables.** En **Setup Node.js App > Environment variables**, agrega:

```
MAIL_HOST=mail.pedro-ctpmedica.com
MAIL_PORT=465
MAIL_USER=operaciones@pedro-ctpmedica.com
MAIL_PASSWORD=<la del paso 1>
MAIL_FROM=operaciones@pedro-ctpmedica.com
MAIL_FROM_NAME=Logística CTP
```

`MAIL_SECURE` no hace falta: se deduce del puerto (465 = cifrado directo, 587 =
STARTTLS).

> **Si los correos llegan a spam**, no es la aplicación. Es que el servidor no sabe
> que `ctpmedica.com` puede enviar desde esa casilla. Opciones, de menos a más
> trabajo: cambiar `MAIL_FROM` por una dirección del propio hosting, o pedir que
> agreguen el hosting a los registros **SPF** y **DKIM** del dominio (lo publica el
> panel de correo del hosting). Con DKIM firmado los clientes llegan directo.

**Paso 4 · Destinatarios internos.** La lista por defecto trae cinco áreas (operaciones,
almacén, servicio al cliente, cotizaciones y gestión de calidad) y la de cartera
trae tres. Para cambiarlas sin volver a desplegar, dos variables más, separadas por
coma:

```
CORREOS_ALERTA_CALIDAD=operaciones@pedro-ctpmedica.com,almacen@pedro-ctpmedica.com
CORREOS_REENCION_CARTERA=operaciones@pedro-ctpmedica.com
```

> **Aviso importante sobre casillas que no existen.** El servidor de correo rechaza el
> mensaje **entero** con `550 No such user` si una sola dirección de la lista no
> existe. Como aquí solo está creada `operaciones@pedro-ctpmedica.com`, un envío
> único dejaría al cliente sin su aviso por culpa de un buzón ajeno.
>
> Por eso cada aviso sale en **dos envíos**:
>
> | # | Para | En copia |
> |---|---|---|
> | 1 | el solicitante | la casilla operativa |
> | 2 | la casilla operativa | el resto de áreas internas |
>
> Así el solicitante y operaciones se enteran **siempre**, y las demás áreas se
> enteran en cuanto se creen sus buzones. Cada envío va por separado en el log.
>
> La casilla operativa es `MAIL_USER` salvo que pongas `MAIL_OPERATIVO`.

**Paso 5 · Reiniciar y comprobar.** *Save* + **Restart**. El log de arranque
(`cPanel > Errors`) dice si el correo quedó bien configurado:

```
[Config] listo: {..., "correo":"autenticado en mail.pedro-ctpmedica.com:465 (SMTPS) desde operaciones@pedro-ctpmedica.com"}
```

Si sale `"correo":"sin configurar"`, falta `MAIL_HOST` o `MAIL_FROM`.

**Paso 6 · Probarlo de verdad.** No hay ningún endpoint para mandar un correo de
prueba a propósito: sería una vía abierta para que cualquiera con una cuenta
escribiera en nombre de la empresa. La prueba es la real:

1. Entra como **conductor** y entrega un pedido.
2. Responde la encuesta de satisfacción con **1 o 2 estrellas** en todo.
3. El solicitante y las áreas internas reciben el aviso.
4. Repite con una encuesta de **3 estrellas**: no debe llegar nada.

Y para el segundo aviso: entra como **administrador**, abre un pedido y ponlo en
**Retenido por Cartera**. El solicitante recibe el correo con el motivo.

Cada envío deja rastro en el log (`cPanel > Errors`). Como cada aviso son dos
mensajes, aparecen dos líneas:

```
[Correo] enviado (cartera) · «AVISO · Solicitud CTPLOG-00042 retenida por cartera · Acme» · para ana@acme.com · copia: operaciones@pedro-ctpmedica.com
[Correo] enviado (cartera) · «AVISO · Solicitud CTPLOG-00042 retenida por cartera · Acme» · para operaciones@pedro-ctpmedica.com · copia: cotizacionesylicitaciones@pedro-ctpmedica.com
```

Si el aviso no sale, ese mismo log dice por qué:

| Lo que dice el log | Qué pasó |
|---|---|
| `[Correo] aviso de <tipo> sin destinatario en CTPLOG-…` | la solicitud no tiene `solicitante_correo` |
| `[Correo] sin SMTP configurado: se habría enviado…` | faltan `MAIL_HOST` o `MAIL_FROM` |
| `[Correo] FALLÓ un envío … 535 Authentication failed` | `MAIL_USER`/`MAIL_PASSWORD` no coinciden |
| `[Correo] FALLÓ un envío … ETIMEDOUT` | el puerto está cerrado: prueba con el 587 y `MAIL_SECURE=false` |
| `[Correo] FALLÓ un envío … 550 Sender not allowed` | `MAIL_FROM` no es una casilla de ese servidor |
| `[Correo] el solicitante … no recibió el aviso` | su dirección está mal o el buzón no existe |
| `[Correo] el aviso … no llegó a <lista>` | esas casillas internas aún no existen (es normal: se crean aparte) |

Un fallo de correo **no** hace perder el guardado: la entrega ya está en la base. Si
**ningún** envío salió, el aviso se reintenta en el siguiente guardado del pedido; si
salió al menos uno, se da por entregado y no se repite.

**Tabla de enviados.** Para ver qué ha salido y depurar, en phpMyAdmin > **SQL**:

```sql
SELECT tipo, solicitud, destinatario, asunto, enviado_en
  FROM correos_enviados ORDER BY enviado_en DESC LIMIT 50;
```

La tabla la crea la propia API la primera vez que hace falta, con el mismo usuario
de MySQL que ya tiene todos los privilegios. Si prefieres crearla antes, está
definida en `server/sql/schema.mysql.sql` (sección 5) y también se la puedes pegar tal
cual en phpMyAdmin. Para reenviar un aviso concreto, borra su fila y vuelve a
guardar la solicitud desde la app:

```sql
DELETE FROM correos_enviados WHERE clave = 'cartera:<id-del-registro>';
```

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
