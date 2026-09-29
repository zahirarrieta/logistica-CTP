# 01 · Arquitectura

## Diagrama general

```
 ┌────────────┐   MSAL (Azure AD)    ┌──────────────────────────┐
 │  Usuario   │ ───────────────────► │  Microsoft (login/token) │
 └─────┬──────┘                      └──────────────────────────┘
       │
       ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ NAVEGADOR (SPA + PWA)                                            │
 │                                                                  │
 │  main.jsx ─► ErrorBoundary ─► BrowserRouter ─► App.jsx           │
 │                                                  │               │
 │                          Rutas lazy + guard «Protegida» (roles)  │
 │        ┌──────────────┬──────────────┬──────────────┬─────────┐  │
 │        ▼              ▼              ▼              ▼         │  │
 │     Login          Home /      Administrador    Conductor     │  │
 │                  Solicitudes        │              │          │  │
 │        └──────────────┴──────┬───────┴──────────────┘          │  │
 │                              ▼                                 │  │
 │              Componentes compartidos (tablas, modales, filtros)│  │
 │                              │                                 │  │
 │                              ▼                                 │  │
 │        solicitudesStore.js  (STORE LOCAL-FIRST + pub/sub)      │  │
 │         localStorage ◄──────┼──────► polling cada 8 s          │  │
 │                              ▼                                 │  │
  │        services/  solicitudesApi · apiClient ·              │  │
 │                   oneDriveApi · notificaciones · enviarCorreo  │  │
 └──────────────┬───────────────────────────────┬─────────────────┘
                ▼                               ▼
      ┌──────────────────┐            ┌─────────────────────────┐
      │ API propia        │            │  Microsoft Graph        │
      │ Express+MySQL    │            │  OneDrive/SharePoint    │
      │ disco+polling    │            │  carpeta «solicitudes»  │
      │ permisos en      │            │  + Mail.Send (alertas)  │
      │ cada query        │            └─────────────────────────┘
      └──────────────────┘
```

## Patrón

- **Feature/pages-based**: cada módulo vive en `src/pages/<Modulo>` con sus propios
  componentes y modales; lo transversal en `src/components` y `src/services`.
- **Local-first store con pub/sub**: `solicitudesStore.js` es la única fuente de
  verdad en el cliente. No hay Redux/Zustand: el store es un módulo vanilla con
  suscriptores (`suscribir(cb)`) y las pantallas se re-renderizan con `useState` +
  `useEffect(suscribir)`.
- **Unidireccional**: UI → acciones del store (`saveSolicitud`, `updateSolicitud`,
  `corregirSolicitud`) → `escribir` (localStorage) → `empujar` (API REST) →
  `notificar` (suscriptores). Los cambios remotos entran por el polling →
  `sincronizarInicial` → fusión → `notificar`.

## Capas y responsabilidades

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Entrada | `main.jsx`, `App.jsx`, `index.html`, `sw.js` | Boot, rutas lazy, guards por rol, registro SW, PWA |
| Auth | `auth/msal.js`, `authConfig.js`, `AuthContext.jsx`, `roles.js`, `user.js` | Login Microsoft, carga del rol desde tabla `usuarios`, permisos por ruta |
| UI | `pages/**`, `components/**`, `loader/` | Pantallas, tablas, modales, filtros, loaders |
| Store | `store/solicitudesStore.js`, `store/planillaStore.js` | Estado local, cola offline, avisos en vivo, borradores, ventana de corrección (5 min) |
| Servicios | `services/*.js` | API propia (token de Microsoft + fetch), OneDrive/Graph, notificaciones (sileo), PDF, correo de calidad |
| Backend | `server/src/**` + `server/sql/*.sql` | API Express, permisos por rol en cada consulta, MySQL (`solicitudes`, `historial`, `usuarios`, `clientes`, `contadores`), archivos en disco |

## Flujo de datos y sincronización

1. **Escritura**: toda mutación local marca la solicitud, escribe en `localStorage`
   y llama `empujarSolicitud` (upsert de fila + historial). Si no hay red, queda
   `pendienteSync: true` y se reintenta en `sincronizarPendientes` al volver.
2. **Marca de agua**: `sincronizarInicial(desde)` pide a la API las solicitudes
   visibles para el rol y solo el historial de las filas con `actualizado_en > watermark`
   (el backend lo pagina en lotes de 200 códigos). Los pendientes locales ganan
   sobre lo remoto.
3. **Polling**: `iniciarTiempoReal` programa un `sincronizarInicial` incremental
   cada 8 s, más uno al volver a la pestaña (`focus`). Reemplaza al canal Realtime
   de Supabase porque el hosting compartido no tiene WebSockets. Un flag impide
   que dos sincronizaciones se solapen.
4. **Supresión de ecos**: `marcarEchoLocal` guarda un fingerprint por solicitud para
   que los cambios hechos por ESTA sesión no disparen toasts duplicados.
5. **Avisos por rol** (`avisarCambiosRemotes`): solicitud nueva → admin/super;
   asignación → asignado; tránsito con conductor → `entregaAsignada`; estado
   Entregado/Entregado Parcial → `entregaRealizada` a privilegiados y al dueño;
   devolución → `solicitudDevuelta` con motivo. Invariante del producto: **todo cambio
   de estado/asignación/entrega debe notificar en vivo a todos los roles afectados**.
6. **Códigos de solicitud**: `GET /api/codigos/siguiente` (ver sin consumir) y
   `POST /api/codigos/reservar` (reserva atómica al crear, con bloqueo de fila).
   Sin backend, derivación local `CTPLOG-#####` por contador + máximo de la lista.

## Archivos y evidencia

- Adjuntos/facturas: `oneDriveApi.js` los sube a
  `solicitudes/{usuario}/{CTPLOG-XXXXX}[/FacturasoRemisiones|/DocEntregas]` en la
  carpeta compartida (resuelta por sharedWithMe → enlace oficial → drive propio).
- Evidencia de entrega: hasta **3 imágenes** unidas por `SEP_EVIDENCIA = '|'`
  (carácter ausente en dataUrls y URLs). Se intenta OneDrive primero; respaldo en
  el disco del hosting (`server/storage/evidencias/`) servido con URLs firmadas
  HMAC de 24 h, igual que las `createSignedUrls` que daba Supabase.
- Las facturas «En Trámite» viven **solo** en la entrada de historial
  (`campo='estado'`, `nuevo='En Trámite'`, campo `adjunto`, unidas por coma).

## Seguridad

- **Permisos por rol en el backend** (`server/src/permisos.js`): traducción
  literal de las 15 políticas RLS de Supabase a fragmentos `WHERE` parametrizados.
  MySQL no tiene RLS, así que **toda** consulta debe pasar por un filtro de ese
  módulo; una consulta sin filtro vería todo.
- **Identidad**: el backend valida el token de Microsoft contra el JWKS del tenant
  (firma, emisor, audiencia, expiración) y saca el correo de ahí. No hay sesiones
  anónimas ni JWT propios. El rol se lee de la tabla `usuarios`, nunca del token,
  para que un admin cambie permisos sin desplegar.
- **Autorización de escritura**: `permiteGuardarSolicitud` reproduce la
  comprobación de la antigua RPC `guardar_solicitud` (que corría como SECURITY
  DEFINER saltándose RLS). Solicitud e historial se escriben en una transacción.
- **Archivos**: los nombres se generan en el servidor y se sanean; la descarga
  exige una firma HMAC válida y vigente. No hay rutas de archivo controladas por
  el cliente.
- **Secretos**: la contraseña de MySQL, `FIRMA_SECRET` y los IDs de Entra ID viven
  solo en las variables de entorno del servidor. `FIRMA_SECRET` sin definir
  genera uno temporal en cada arranque, y el backend lo advierte por log.
- **DB-first**: cualquier cambio de `server/sql/*.sql` se importa en MySQL
  **antes** de desplegar el código que lo usa.

## PWA y despliegue

- `sw.js`: precarga del shell (v5) + network-first para assets (nunca sirve bundle
  viejo); excluye `/api/` para que el service worker no cachee respuestas de la
  API. `ErrorBoundary` detecta chunks huérfanos post-deploy y recarga una vez.
- Build Vite con `manualChunks`: `msal`, `icons`, `pdf` (lazy), `router`,
  `react`, `vendor`. jspdf/html2canvas solo se cargan al exportar.
- Frontend: `dist/` estático en `public_html` + `public/.htaccess` (reemplaza al
  `vercel.json`: fuerza `index.html` en las rutas de la SPA).
- Backend: Node.js Selector de cPanel sobre Phusion Passenger; `server/app.js`
  es el startup file. Ver `docs/04-DESPLIEGUE-HOSTING.md`.

## Riesgos conocidos / deuda

- **Sin tests**: los flujos críticos (crear/corregir/entregar/sync) no tienen red de
  seguridad. Candidatos a primeros tests (Vitest): `siguienteNumero`,
  `parsearMotivoDevolucion`, fusión de `sincronizarInicial`, `resolverEvidencia`.
  En el backend, lo más crítico de cubrir son los filtros de
  `server/src/permisos.js` (un `?` desalineado abriría datos).
- `solicitudesStore.js` (~1000 líneas) concentra storage+sync+polling+avisos;
  candidato a dividirse en `storage/sync/polling/avisos` cuando crezca.
- El polling cada 8 s re-descarga por marca de agua en vez de recibir un push
  (simple y confiable; el hosting no tiene WebSockets, así que no hay alternativa
  sin montar un VPS).
- `sileo` está en versión temprana (0.1.x): fijar versión y probar al actualizar.
