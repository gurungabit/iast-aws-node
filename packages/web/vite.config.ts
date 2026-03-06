import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../../',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/ping': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/sessions': 'http://localhost:3000',
      '/history': 'http://localhost:3000',
      '/ast-configs': 'http://localhost:3000',
      '/auto-launchers': 'http://localhost:3000',
      '/auto-launcher-runs': 'http://localhost:3000',
      '/schedules': 'http://localhost:3000',
      '/docs': 'http://localhost:3000',
    },
  },
})
