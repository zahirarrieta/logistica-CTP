import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: '/',
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
