# 00 · Overview — Logística CTP-PEDRO

## Qué hace el proyecto

**Logística CTP-PEDRO** es una aplicación web interna de CTP Médica para gestionar
solicitudes de logística y transporte de última milla. Los usuarios del área comercial
(solicitantes) crean pedidos con cliente, tipo de solicitud y adjuntos (facturas,
remisiones); los administradores los revisan, los pasan por estados (En Trámite,
Retenido, En Tránsito, Devolución…) y los asignan a conductores; los conductores ven
sus entregas asignadas, consultan el documento a entregar y registran la entrega con
hasta 3 fotos de evidencia y una encuesta de satisfacción. Todo el ciclo se refleja
**en vivo** para los demás roles mediante notificaciones en tiempo real.

La app es **local-first**: cada cambio se guarda primero en el navegador
(`localStorage`) y luego se sincroniza con la API propia (Node.js + MySQL).
Funciona sin conexión (los cambios quedan en cola y se suben al volver la red) y es
instalable como PWA. Los archivos (adjuntos, facturas y evidencias) viajan a la
carpeta compartida de OneDrive/SharePoint de la organización vía Microsoft Graph, con
el disco del servidor como respaldo para las evidencias.

## Stack y por qué

| Pieza | Tecnología | Motivo |
|---|---|---|
| UI | **React 19** + **Vite 7** (JavaScript, sin TS) | Iteración rápida, HMR, build por chunks |
| Estilos | **Tailwind CSS 3.4** | Utilidades + tema de marca (`brand-*`) en `tailwind.config.js` |
| Rutas | **react-router-dom 7.9** (lazy + Suspense) | Un bundle por módulo: Login, Home, Solicitudes, Administrador, Conductor |
| Auth | **@azure/msal-browser 5** (Azure AD) | La empresa opera con cuentas Microsoft 365 |
| Backend | **Node.js + Express + MySQL** (`server/`) | Un solo proveedor; el hosting solo ofrece MySQL, así que los permisos por rol se aplican en el código (`server/src/permisos.js`) |
| Archivos | **Microsoft Graph (OneDrive/SharePoint)** + disco | La carpeta compartida `solicitudes` ya es el archivo oficial del equipo; el disco es el respaldo |
| Toasts | **sileo** | Notificaciones ligeras con sonido |
| PDF | **jspdf + html2canvas-pro** (importación dinámica) | Exportar informes/planillas sin pesar en el arranque |
| Iconos | **react-icons** (subset `md`/`fi`) | Un solo chunk `icons` |
| Testing | *(pendiente — ver riesgos en 01-ARQUITECTURA)* | |

## Roles de usuario

Definidos en `src/auth/roles.js` y en la tabla `usuarios` (la base es la fuente
de verdad; un admin puede cambiar permisos sin tocar el frontend):

- **solicitante** — Inicio + Mis Solicitudes (solo las suyas).
- **conductor** — Inicio + Módulo Conductor (solo entregas en tránsito asignadas a él).
- **administrador** — Todos los módulos; ve solicitudes sin asignar y sus asignaciones.
- **superadmin** — Todos los módulos y TODAS las solicitudes.

## Casos de uso principales

1. **Crear solicitud**: botón «Nueva solicitud» → se reserva un código atómico
   `CTPLOG-XXXXX` (`POST /api/codigos/reservar`) → adjuntos a OneDrive → guardado
   local + push a la API → notificación a admin/super.
2. **Corregir devolución**: el admin devuelve la solicitud marcando campos por corregir;
   el solicitante tiene **5 minutos** para editar solo esos campos y reenviar.
3. **Asignar y despachar**: el admin cambia el estado (EstadosModal), asigna responsable
   y conductor (con vehículo/placa); el conductor recibe aviso al entrar en tránsito.
4. **Entregar**: el conductor registra entrega con 1–3 fotos (evidencia) y encuesta de
   3 estrellas; solicitante/admin/super reciben el toast «Pedido entregado». Una
   calificación ≤ 2.5 dispara aviso por correo al solicitante y a las áreas internas.
5. **Retener por cartera**: el admin marca `Retenido por Cartera` y el solicitante
   recibe un aviso por correo con el motivo registrado; también a las áreas internas.
6. **Consultar y exportar**: tablas filtrables por estado/cliente/zona, seguimiento con
   historial completo, dashboard y exportación a PDF en Administrador.

## Documentos

- [01-ARQUITECTURA.md](./01-ARQUITECTURA.md) — capas, flujo de datos, sincronización, seguridad.
- [02-ESTRUCTURA-CARPETAS.md](./02-ESTRUCTURA-CARPETAS.md) — árbol comentado del proyecto.
- [04-DESPLIEGUE-HOSTING.md](./04-DESPLIEGUE-HOSTING.md) — despliegue en Latinoamérica Hosting.
- [../migrar/README.md](../migrar/README.md) — passage de datos de Supabase a MySQL.
