import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Demo sürümü herhangi bir alt dizinden (ör. GitHub Pages) yayınlanabilir.
  base: mode === 'demo' ? './' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
}))
