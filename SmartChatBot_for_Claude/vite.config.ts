import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    hmr: {
      clientPort: 443
    },
    allowedHosts: ['.replit.dev', '.repl.co', 'localhost', '0.0.0.0'],
    proxy: {
      '/api-backend': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-backend/, '')
      }
    }
  }
})
