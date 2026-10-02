import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Versión única de verdad: public/version.json. Se sirve en vivo (la app la
// sondea para detectar una versión nueva) y a la vez se inyecta en el bundle con
// `define`, para que el código cargado sepa qué versión ES y la compare con la
// que hay en el servidor. Cambiar solo el JSON en el próximo deploy ya dispara el
// aviso de actualización en todos los clientes.
const versionJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./public/version.json', import.meta.url)), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(versionJson.version),
  },
  server: {
    port: 5173,
    // Proxy SOLO del dev server: reenvía /api a la API real para que el navegador
    // hable con el mismo origen (localhost:5173) y no haya bloqueo por CORS. Con
    // changeOrigin el Host que ve el servidor es el de la API, así las URLs
    // firmadas de archivos salen correctas. No afecta al build de producción, que
    // usa la URL absoluta de VITE_API_URL (ver .env).
    proxy: {
      '/api': {
        target: 'https://api.pedro-ctpmedica.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // El chunk `pdf` (jspdf + html2canvas) se carga de forma dinámica solo al
    // exportar, así que su tamaño no afecta el arranque; se sube el umbral para
    // no generar un aviso cosmético en cada build.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@azure') || id.includes('msal')) return 'msal'
          if (id.includes('react-icons')) return 'icons'
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf'
          // La librería de hojas de cálculo también entra por import() dinámico,
          // solo al abrir una. Sin esta línea se iría al bloque final de abajo y
          // acabaría en 'vendor', que sí se descarga siempre: manualChunks tiene
          // prioridad sobre el corte del import dinámico, así que el trozo se
          // cargaría con la app en vez de cuando haga falta.
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('react-router')) return 'router'
          if (
            id.includes('node_modules/react/')
            || id.includes('node_modules/react-dom/')
            || id.includes('node_modules/scheduler/')
          ) return 'react'
          return 'vendor'
        },
      },
    },
  },
}))
