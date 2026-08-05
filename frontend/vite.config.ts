import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/predict': 'http://localhost:5001',
      '/predict-sample': 'http://localhost:5001',
      '/health': 'http://localhost:5001',
      '/explain': 'http://localhost:5001',
      '/summarize': 'http://localhost:5001',
    },
  },
})
