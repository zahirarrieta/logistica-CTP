# 02 · Estructura de carpetas

Árbol completo comentado (post-limpieza de la auditoría de septiembre 2026).
Convención: ✅ en uso · ⚙️ configuración · 📄 documentación.

```
logistica-CTP/
├── index.html                  ⚙️ Entrada HTML: meta PWA, manifest, theme-color,
│                                  fuentes Google no bloqueantes, mount #root
├── vite.config.js              ⚙️ Build: fallbacks de env, base '/', manualChunks
│                                  (msal · supabase · icons · pdf · router · react · vendor)
├── tailwind.config.js          ⚙️ Tema de marca: colores brand-*, screens xs475→3xl,
│                                  sombras cyanGlow/brandGlow, animaciones, fuentes
├── postcss.config.js           ⚙️ PostCSS (tailwindcss + autoprefixer)
├── eslint.config.js            ⚙️ Lint flat-config: js.recommended + react-hooks +
│                                  react-refresh; no-unused-vars (ignora ^[A-Z_])
├── package.json                ⚙️ Scripts: dev · build · lint · preview
├── vercel.json                 ⚙️ Deploy Vercel: rewrite SPA → /index.html
├── .env.example                ⚙️ Plantilla de variables (Azure AD + Supabase publishable)
├── .env.local                  🔒 Valores reales locales (gitignored vía *.local)
│
├── docs/                       📄 Documentación interna
│   ├── 00-OVERVIEW.md             Qué hace, stack, roles, casos de uso
│   ├── 01-ARQUITECTURA.md         Capas, flujo de datos, sync, seguridad, riesgos
│   └── 02-ESTRUCTURA-CARPETAS.md  (este archivo)
│
├── public/                     ✅ Estáticos sin procesar (se sirven tal cual)
│   ├── manifest.webmanifest       PWA: nombre, start_url /inicio, icono, theme_color
│   ├── sw.js                      Service Worker: precarga shell v3 + network-first
│   ├── CTP.png                    Favicon / logo no cuadrado (500×383)
│   ├── CTPM.png                   Logo cuadrado 346×346 (icono PWA + botón flotante)
│   ├── Principal/                 Imágenes del hero (carrusel Home) y camiones de botones
│   │   ├── PEDRO.png · PRY-590.png · CARDIO.png · MUNDO.png …
│   └── ITitulos/                  Iconos de título por módulo
│       ├── SolicitudI.png · ConductorI.png · AdministradorI.png · SuperAdminI.png
│
├── supabase/                   ✅ Backend como código (ejecutar ANTES de desplegar)
│   ├── schema.sql                 Tablas solicitudes/historial/usuarios/clientes,
│   │                              RLS por rol, RPC (proximo_codigo, siguiente_codigo,
│   │                              guardar_solicitud, reiniciar_contador), publication realtime
│   ├── seed_clientes.sql          Carga inicial de clientes
│   ├── seed_usuarios.sql          Carga inicial de usuarios/roles
│   └── functions/                 (vacía — reservada para Edge Functions)
│
└── src/
    ├── main.jsx                ✅ Raíz React: StrictMode › ErrorBoundary ›
    │                              BrowserRouter › App + registro del SW en PROD
    ├── App.jsx                 ✅ Rutas lazy (/inicio /solicitudes /administrador
    │                              /conductor), guard «Protegida» por rol, marca de
    │                              sesión (sessionStorage), arranque de sync + Realtime
    ├── index.css               ✅ Tailwind base + utilidades globales
    │
    ├── assets/                 ✅ Recursos estáticos procesados por Vite
    │   └── estado/                Iconos de estado (Abierto, Tránsito, DevoSol…)
    │
    ├── auth/                   ✅ Autenticación y permisos
    │   ├── msal.js                Instancia MSAL, handleRedirectPromise, msalReady
    │   ├── authConfig.js          Client/tenant Azure AD, scopes (Graph, Mail.Send)
    │   ├── AuthContext.jsx        Provider: account, usuario (tabla usuarios), rol, login/logout
    │   ├── roles.js               ROLES, rutas, puedeVer/rutaInicial, esAsignadoA, esConductorDe
    │   └── user.js                shortName(account) — nombre corto para saludos
    │
    ├── components/             ✅ UI compartida entre módulos
    │   ├── Header.jsx             Menú superior por rol + identidad
    │   ├── Footer.jsx             Pie de página
    │   ├── Modal.jsx              Shell base de modal (overlay z-[1000] + blur +
    │   │                          cierre por click fuera; overlayClassName p/ variantes)
    │   ├── SolicitudesTable.jsx   Tabla/cards de solicitudes (usada por los 3 módulos);
    │   │                          badges de estado/asignado/conductor, pill «Documento
    │   │                          a entregar» del conductor, adjuntos visibles
    │   ├── EstadoFilter.jsx · AsignadoFilter.jsx · SearchFilters.jsx   Filtros de tabla
    │   ├── DetalleModal.jsx       Detalle completo de una solicitud
    │   ├── ObservacionesModal.jsx Visor de observaciones
    │   ├── AdjuntosModal.jsx · AdjuntoFileCard.jsx · AdjuntoEnlace.jsx  Adjuntos y enlaces
    │   ├── VisorPdfModal.jsx · EvidenciaVisor.jsx    Vista previa de PDF/evidencias
    │   ├── EntregaInfo.jsx        Info de entrega (evidencias separadas por '|', encuesta)
    │   ├── CuentaRegresivaDevolucion.jsx  Contador de la ventana de corrección (5 min)
    │   ├── ConfirmarEliminarModal.jsx     Confirmación destructiva
    │   ├── IndicadorSinConexion.jsx       Aviso offline / cola pendiente
    │   ├── NotificationsPanel.jsx         Panel de notificaciones
    │   ├── StarRating.jsx (+ starRating.css)  Estrellas de la encuesta (configurable a 3)
    │   └── ErrorBoundary.jsx      Captura errores; recarga 1 vez si es chunk viejo
    │
    ├── store/                  ✅ Estado global local-first (no pertenece a una página)
    │   ├── solicitudesStore.js ★ STORE central: localStorage + cola offline +
    │   │                          sync por marca de agua + Realtime + avisos por
    │   │                          rol + borradores de entrega + ventana 5 min +
    │   │                          códigos CTPLOG y contactos de encuesta
    │   └── planillaStore.js     Store de planillas (mismo patrón local-first)
    │
    ├── utils/                  ✅ Utilidades y constantes puras compartidas
    │   ├── estadoColors.js        Paletas de colores por estado (ESTADOS, badges…)
    │   ├── dashboardUtils.js      Cálculos del dashboard (ESTADOS_FINALES, parseStamp…)
    │   └── pdfUtils.js            esPdfUrl, esUrlFactura, soloAdjuntosSolicitud,
    │                              nombrePdfFromUrl (pure utils, sin jspdf)
    │
    ├── hooks/
    │   └── useUsuarios.js      ✅ Carga usuarios activos (correo, nombre, rol,
    │                              vehiculo, placa, es_conductor) al abrir un modal
    │
    ├── loader/
    │   ├── Loader.jsx          ✅ Spinner de pantalla completa
    │   └── loader.css             Animaciones del loader
    │
    ├── pages/
    │   ├── Login/
    │   │   ├── Login.jsx       ✅ Pantalla de entrada (botón Microsoft)
    │   │   └── login.css          Estilos específicos
    │   │
    │   ├── Home/               ✅ Módulo solicitante
    │   │   ├── Home.jsx           Landing: hero con carrusel, badge de rol,
    │   │   │                      botón Nueva solicitud / Módulo conductor
    │   │   ├── Solicitudes.jsx    «Mis solicitudes»: tabla filtrable + modales
    │   │   │                      crear / corregir / seguimiento
    │   │   └── Components/
    │   │       ├── FormField.jsx      Input/select/textarea con label flotante
    │   │       └── modals/
    │   │           ├── SolicitudModal.jsx    Crear / corregir solicitud (adjuntos ≤3,
    │   │           │                         reserva de código, subida a OneDrive)
    │   │           ├── ClientPickerModal.jsx Buscador de clientes (tabla clientes)
    │   │           ├── SeguimientoModal.jsx  Historial + estado + acciones del solicitante
    │   │           └── AgregarUsuarioModal.jsx Alta de usuarios (admin)
    │   │
    │   ├── Administrador/      ✅ Módulo admin/superadmin
    │   │   ├── Administrador.jsx   Tabs: pedidos, dashboard, planillas, usuarios
    │   │   └── Components/
    │   │       ├── DashboardTab.jsx     Métricas y barras por asignado
    │   │       ├── PlanillasTab.jsx     Gestión de planillas
    │   │       └── modals/
    │   │           ├── EstadosModal.jsx           Cambiar estado + devolución con campos
    │   │           │                              por corregir + motivo obligatorio
    │   │           ├── AsignarUsuarioModal.jsx    Asignar responsable
    │   │           ├── AsignarConductorModal.jsx  Asignar conductor (+admins conductores,
    │   │           │                              vehículo/placa autoguardados)
    │   │           ├── PedidoDetalleModal.jsx     Detalle ampliado + export PDF
    │   │           ├── PedidosListaModal.jsx      Lista filtrada desde dashboard
    │   │           ├── EtapaPedidosModal.jsx      Pedidos por etapa
    │   │           ├── HistorialModal.jsx         Historial completo
    │   │           ├── EntregaDetallesModal.jsx   Evidencias + encuesta de la entrega
    │   │           └── PlanillaModal.jsx          Alta/edición de planilla
    │   │
    │   └── Conductor/          ✅ Módulo conductor
    │       ├── Conductor.jsx       Entregas en tránsito asignadas (+ propias entregadas)
    │       └── Components/
    │           ├── ConductorDashboard.jsx  Resumen del día
    │           └── modals/
    │               └── EntregaConductor.jsx  Registrar entrega: 1–3 fotos (resized,
    │                                         '|'-unidas), encuesta 3 estrellas,
    │                                         borrador local, subida OneDrive/Storage
    │
    └── services/               ✅ Integraciones externas
        ├── supabaseClient.js      Cliente Supabase + sesión anónima por usuario
        │                          (metadata correo/nombre), cierre al cambiar de cuenta
        ├── solicitudesApi.js      API de datos: descargar (paginada + watermark),
        │                          empujar (upsert + RPC fallback 42501), borrar,
        │                          clientes/usuarios, evidencias (subida/firmado '|')
        ├── oneDriveApi.js         Microsoft Graph: resolver carpeta compartida,
        │                          subir adjuntos/facturas/evidencias por pedido
        ├── oneDriveVisor.js       Resolver URLs/enlaces/nombres viejos a blob visible
        ├── notificaciones.jsx     Todos los toasts (sileo) + sonidos por tipo de evento
        ├── enviarCorreo.js        Alerta de calidad por Graph Mail.Send (promedio ≤ 2.5)
        ├── exportarInforme.js     PDF de informe del dashboard (jspdf lazy)
        └── planillaPdf.js         PDF de planilla (jspdf lazy)
```

## Reglas de ubicación (para código nuevo)

- Una pantalla nueva → `src/pages/<Modulo>/` + ruta lazy en `App.jsx` + permiso en
  `auth/roles.js` (+ RLS en `supabase/schema.sql` si toca datos).
- Un modal de un módulo → `pages/<Modulo>/Components/modals/` (usar `components/Modal.jsx`
  como shell; `overlayClassName` solo si el modal necesita un overlay distinto).
- UI usada por ≥2 módulos → `src/components/`.
- Estado global / stores local-first → `src/store/`.
- Utilidades y constantes puras usadas por ≥2 capas → `src/utils/`.
- Imágenes importadas desde código → `src/assets/` (las de `public/` se sirven tal cual).
- Llamadas a Supabase/Graph/correo → `src/services/` (nunca dentro de componentes).
- Reglas de negocio del flujo de solicitudes → `store/solicitudesStore.js` (no en la UI).
- Todo cambio de esquema/RLS/RPC → `supabase/schema.sql` **y ejecutarlo en la base
  antes de desplegar** (política DB-first del proyecto).
- Textos de formularios y observaciones en **MAYÚSCULAS** (transformar el valor
  guardado, no solo CSS).
