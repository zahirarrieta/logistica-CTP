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
 │         localStorage ◄──────┼──────► Realtime (canal)          │  │
 │                              ▼                                 │  │
 │        services/  solicitudesApi · supabaseClient ·            │  │
 │                   oneDriveApi · notificaciones · enviarCorreo  │  │
 └──────────────┬───────────────────────────────┬─────────────────┘
                ▼                               ▼
      ┌──────────────────┐            ┌─────────────────────────┐
      │     Supabase     │            │  Microsoft Graph        │
      │ Postgres + RLS   │            │  OneDrive/SharePoint    │
      │ Realtime+Storage │            │  carpeta «solicitudes»  │
      │ RPC (SECURITY    │            │  + Mail.Send (alertas)  │
      │  DEFINER)        │            └─────────────────────────┘
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
  `corregirSolicitud`) → `escribir` (localStorage) → `empujar` (Supabase) →
  `notificar` (suscriptores). Los cambios remotos entran por Realtime →
  `sincronizarInicial` → fusión → `notificar`.

## Capas y responsabilidades

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Entrada | `main.jsx`, `App.jsx`, `index.html`, `sw.js` | Boot, rutas lazy, guards por rol, registro SW, PWA |
| Auth | `auth/msal.js`, `authConfig.js`, `AuthContext.jsx`, `roles.js`, `user.js` | Login Microsoft, carga del rol desde tabla `usuarios`, permisos por ruta |
| UI | `pages/**`, `components/**`, `loader/` | Pantallas, tablas, modales, filtros, loaders |
| Store | `pages/Home/Components/solicitudesStore.js`, `pages/Administrador/Components/planillaStore.js` | Estado local, cola offline, avisos en vivo, borradores, ventana de corrección (5 min) |
| Servicios | `services/*.js` | Supabase (sesión anónima + API), OneDrive/Graph, notificaciones (sileo), PDF, correo de calidad |
| Backend | `supabase/schema.sql` + seeds | Tablas `solicitudes`, `historial`, `usuarios`, `clientes`, RLS, RPC, publication Realtime |

## Flujo de datos y sincronización

1. **Escritura**: toda mutación local marca la solicitud, escribe en `localStorage`
   y llama `empujarSolicitud` (upsert de fila + historial). Si no hay red, queda
   `pendienteSync: true` y se reintenta en `sincronizarPendientes` al volver.
2. **Marca de agua**: `sincronizarInicial(desde)` descarga solicitudes **paginadas**
   (`.range()` de 1000) y solo el historial de las filas con `actualizado_en > watermark`
   (lotes de 200 códigos). Los pendientes locales ganan sobre lo remoto.
3. **Realtime**: canal `solicitudes-tiempo-real` (`postgres_changes`, event `*`). Cada
   evento programa un re-sync con debounce de 600 ms; al re-suscribirse también.
4. **Supresión de ecos**: `marcarEchoLocal` guarda un fingerprint por solicitud para
   que los cambios hechos por ESTA sesión no disparen toasts duplicados.
5. **Avisos por rol** (`avisarCambiosRemotes`): solicitud nueva → admin/super;
   asignación → asignado; tránsito con conductor → `entregaAsignada`; estado
   Entregado/Entregado Parcial → `entregaRealizada` a privilegiados y al dueño;
   devolución → `solicitudDevuelta` con motivo. Invariante del producto: **todo cambio
   de estado/asignación/entrega debe notificar en vivo a todos los roles afectados**.
6. **Códigos de solicitud**: RPC `siguiente_codigo` (ver sin consumir) y
   `proximo_codigo` (reserva atómica al crear). Sin backend, derivación local
   `CTPLOG-#####` por contador + máximo de la lista.

## Archivos y evidencia

- Adjuntos/facturas: `oneDriveApi.js` los sube a
  `solicitudes/{usuario}/{CTPLOG-XXXXX}[/FacturasoRemisiones|/DocEntregas]` en la
  carpeta compartida (resuelta por sharedWithMe → enlace oficial → drive propio).
- Evidencia de entrega: hasta **3 imágenes** unidas por `SEP_EVIDENCIA = '|'`
  (carácter ausente en dataUrls y URLs). Se intenta OneDrive primero; respaldo
  Supabase Storage bucket `evidencias` con URLs firmadas (24 h) al descargar.
- Las facturas «En Trámite» viven **solo** en la entrada de historial
  (`campo='estado'`, `nuevo='En Trámite'`, campo `adjunto`, unidas por coma).

## Seguridad

- **RLS por rol** con helpers SQL (`correo_actual()`, `rol_actual()`,
  `es_privilegiado()`); la app usa **sesión anónima** de Supabase con metadata
  `{correo, nombre}` — la identidad real viene del JWT de Microsoft.
- **RPC SECURITY DEFINER**: `guardar_solicitud` (respaldo del conductor ante 42501),
  `proximo_codigo`, `reiniciar_contador`. ⚠️ Toda modificación de estas funciones debe
  validar el rol **en el servidor**; son el único camino que salta RLS.
- Claves: solo publishable/anon en el cliente. La **secret key nunca** va al frontend
  ni a `.env*` del cliente.
- **DB-first**: cualquier cambio de schema/RLS/RPC se ejecuta en Supabase **antes** de
  desplegar el código que lo usa.

## PWA y despliegue

- `sw.js`: precarga del shell (v3) + network-first para assets (nunca sirve bundle
  viejo); `ErrorBoundary` detecta chunks huérfanos post-deploy y recarga una vez.
- Build Vite con `manualChunks`: `msal`, `supabase`, `icons`, `pdf` (lazy), `router`,
  `react`, `vendor`. jspdf/html2canvas solo se cargan al exportar.

## Riesgos conocidos / deuda

- **Sin tests**: los flujos críticos (crear/corregir/entregar/sync) no tienen red de
  seguridad. Candidatos a primeros tests (Vitest): `siguienteNumero`,
  `parsearMotivoDevolucion`, fusión de `sincronizarInicial`, `resolverEvidencia`.
- `solicitudesStore.js` (~1000 líneas) concentra storage+sync+realtime+avisos;
  candidato a dividirse en `storage/sync/realtime/avisos` cuando crezca.
- Realtime re-descarga por marca de agua en vez de parchear con el payload (simple y
  confiable; optimizable si el volumen de eventos crece).
- `sileo` está en versión temprana (0.1.x): fijar versión y probar al actualizar.
