import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
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
    },
    define,
  }
})
