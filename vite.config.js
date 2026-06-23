import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10MB para AlvaAR
      },
      manifest: {
        name: 'Digital Twin Hub',
        short_name: 'TwinHub',
        description: 'BOM_INSPECTION_SYS // PORTFOLIO',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    // Fragmentación inteligente de paquetes (Chunking)
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separar la librería principal 3D (pesada) en su propio chunk
          if (id.includes('node_modules/three/')) {
            return 'three-vendor';
          }
          // Separar el ecosistema de React Three Fiber y Drei
          if (id.includes('node_modules/@react-three/')) {
            return 'r3f-vendor';
          }
          // Separar Firebase para que cargue en paralelo
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase-vendor';
          }
          // El resto de dependencias (Zustand, Lucide, React) irán en un chunk general
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    // Elevar el límite de advertencia de tamaño (Three.js es grande por naturaleza)
    chunkSizeWarningLimit: 1000 
  }
})
