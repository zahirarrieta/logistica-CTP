import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const define = {}

  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || env.SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY

  if (url && !env.VITE_SUPABASE_URL) {
    define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(url)
  }
  if (key && !env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
    define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] = JSON.stringify(key)
  }

  return {
    plugins: [react()],
    base: '/',
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
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('react-icons')) return 'icons'
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf'
            if (id.includes('animejs') || /node_modules[\\/]anime[\\/]/.test(id)) return 'anime'
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
    define,
  }
})
