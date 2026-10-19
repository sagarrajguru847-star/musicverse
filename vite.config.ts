import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-vendor'
          if (id.includes('/node_modules/@react-three/')) return 'react-three'
          if (id.includes('/node_modules/gsap/')) return 'gsap'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8000,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
