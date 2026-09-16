# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Backend en Excel Online (Microsoft Graph)

La app guarda todo en el navegador y, cuando está configurada, replica cada solicitud
en un libro de Excel Online (SharePoint/Teams o OneDrive) usando el token de la sesión
de Microsoft del usuario. No hay servidor propio.

1. En Azure Entra ID, en el registro de la app, agrega permisos delegados de Microsoft Graph:
   `Files.ReadWrite` (OneDrive) y/o `Sites.ReadWrite.All` (SharePoint/Teams).
2. Crea o abre el archivo Excel y copia su id (el GUID que aparece en la URL de Excel Online)
   o su ruta dentro del drive.
3. Copia `.env.example` a `.env.local` y completa `VITE_EXCEL_SITIO`, `VITE_EXCEL_ARCHIVO`
   (o `VITE_EXCEL_RUTA`), `VITE_EXCEL_HOJA` y `VITE_EXCEL_TABLA`.

Al guardar, la fila se crea o se actualiza por `ID`; sin conexión los cambios quedan en cola
(`ctp_excel_cola` en localStorage) y se suben solos cuando vuelve la red. La primera vez que
se abre "Mis solicitudes" con la configuración lista se sube el histórico completo.
Implementación: `src/services/excelGraph.js` (llamadas a Graph) y `src/services/excelSync.js`
(columnas, cola y disparadores).
