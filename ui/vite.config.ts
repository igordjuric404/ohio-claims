import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => {
          if (path.startsWith('/api/admin')) {
            return path.replace('/api/', '/');
          }
          if (path.startsWith('/api/reviewer')) {
            return path.replace('/api/', '/');
          }
          return path.replace('/api/', '/edge/');
        },
      },
      '/internal': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/edge': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
