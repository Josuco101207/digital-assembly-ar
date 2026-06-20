import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Justificación Arquitectónica: Archivo de entrada limpio, sin importar CSS innecesario extra
// (como el App.css de Vite) para depender exclusivamente de Tailwind.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
