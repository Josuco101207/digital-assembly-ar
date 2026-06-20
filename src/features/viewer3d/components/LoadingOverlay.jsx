import React from 'react';
import { Html, useProgress } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

// Justificación Arquitectónica: Evita que el usuario vea un canvas negro mientras 
// los modelos de varios MB se descargan. Usamos <Html> de Drei para renderizar DOM
// tradicional sobre el canvas WebGL.

export const LoadingOverlay = () => {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center p-8 bg-industrial-dark/95 rounded-2xl border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md w-64">
        <Loader2 className="w-12 h-12 text-industrial-accent animate-spin mb-4" />
        <h3 className="text-white font-bold text-lg mb-1 whitespace-nowrap">Cargando Modelo 3D</h3>
        <p className="text-slate-400 text-sm mb-4 text-center">Optimizando texturas y geometría...</p>
        
        {/* Barra de progreso de descarga */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
          <div 
            className="bg-industrial-accent h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-industrial-accent font-mono text-xs mt-2 font-bold">{progress.toFixed(0)}%</p>
      </div>
    </Html>
  );
};
