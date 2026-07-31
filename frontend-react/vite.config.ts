import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/predict': 'http://localhost:5000',
      '/predict-sample': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/explain': 'http://localhost:5000',
      '/summarize': 'http://localhost:5000',
    },
  },
})
