import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'https://earlobe-feeble-aground.ngrok-free.dev', changeOrigin: true, headers: { 'ngrok-skip-browser-warning': '1' } }
    }
  }
})
