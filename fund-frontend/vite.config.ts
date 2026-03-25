import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  define: {
    __VITE_API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || 'http://localhost:3000/api')
  }
})
