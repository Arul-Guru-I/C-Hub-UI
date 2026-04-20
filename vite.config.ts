import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["easter-patents-world-joel.trycloudflare.com"],
    proxy: {
      '/auth': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/performance': 'http://localhost:8000',
      '/forum': 'http://localhost:8000',
      '/feedbacks': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/webhook': 'http://localhost:8000',
    }
  }
})
