import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
