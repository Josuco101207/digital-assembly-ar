import React from 'react';
import { useViewerStore } from '../../../store/useViewerStore';
import { SkipBack, SkipForward, Maximize, Eye, EyeOff } from 'lucide-react';

// Justificación Arquitectónica: UI Tablet-First. Controles manuales "Paso a Paso"
// optimizados para que el operador avance a su propio ritmo.

export const AssemblyControls = () => {
  const { 
    assemblyLevel, setAssemblyLevel, 
    maxAssemblyLevel, 
    isExploded, toggleExplode, 
    isControlsVisible, toggleControls,
    arScale, setArScale,
    isOrthographic, toggleOrthographic
  } = useViewerStore();

  const handlePrev = () => {
    if (assemblyLevel > 1) setAssemblyLevel(assemblyLevel - 1);
  };

  const handleNext = () => {
    if (assemblyLevel < maxAssemblyLevel) setAssemblyLevel(assemblyLevel + 1);
  };

  return (
    <>
      {/* Botón Flotante para Ocultar/Mostrar Controles */}
      <button
        onClick={toggleControls}
        className={`absolute z-[100] transition-all duration-500 p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600 shadow-lg backdrop-blur-md ${
          isControlsVisible ? 'bottom-[220px] md:bottom-[240px] left-1/2 -translate-x-1/2' : 'bottom-6 left-1/2 -translate-x-1/2'
        }`}
        title={isControlsVisible ? "Ocultar Controles" : "Mostrar Controles"}
      >
        {isControlsVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {/* Panel de Controles Principal */}
      <div 
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[95%] sm:w-[80%] md:w-[500px] backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 sm:gap-5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isControlsVisible ? 'translate-y-0 opacity-100 visible' : 'translate-y-[150%] opacity-0 invisible'
        }`}
      >
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
            Progreso de Ensamble
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-mono drop-shadow-[0_0_12px_rgba(14,165,233,0.6)]">
              PASO {assemblyLevel}
            </span>
            <span className="text-slate-500 text-xl font-mono">
              / {maxAssemblyLevel}
            </span>
          </div>
        </div>
        <span className="text-industrial-accent font-mono font-bold text-lg">
          {maxAssemblyLevel > 1 ? Math.round(((assemblyLevel - 1) / (maxAssemblyLevel - 1)) * 100) : 100}%
        </span>
      </div>

      {/* Barra de progreso sleek (sin scrollbar fea) */}
      <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-900/80">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(56,189,248,0.8)]"
          style={{ width: `${maxAssemblyLevel > 1 ? ((assemblyLevel - 1) / (maxAssemblyLevel - 1)) * 100 : 100}%` }}
        />
      </div>

      {/* Controles de Escala AR y Cámara */}
      <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
        <button 
          onClick={toggleOrthographic}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-colors ${
            isOrthographic 
              ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {isOrthographic ? 'PARALELO' : 'PERSPECTIVA'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-mono pr-2 tracking-widest hidden sm:inline">AR SCL</span>
          <button 
            onClick={() => setArScale(arScale - 0.1)} 
            className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-slate-200 font-mono text-lg transition-colors"
          >
            -
          </button>
          <span className="text-sky-400 font-mono font-bold w-12 text-center text-sm">{arScale.toFixed(2)}</span>
          <button 
            onClick={() => setArScale(arScale + 0.1)} 
            className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-slate-200 font-mono text-lg transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Controles Tablet-First */}
      <div className="flex justify-between items-center mt-2">
        <button 
          onClick={handlePrev}
          disabled={assemblyLevel === 1}
          className="group flex items-center justify-center p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-300 border border-slate-600 hover:border-slate-500 shadow-md w-20"
        >
          <SkipBack className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={toggleExplode}
          title="Vista de Despiece"
          className={`group flex items-center gap-2 px-6 py-4 rounded-2xl transition-all border shadow-md font-semibold tracking-wide text-sm ${
            isExploded 
              ? 'bg-industrial-accent/20 text-sky-400 border-sky-400/50 shadow-[0_0_15px_rgba(14,165,233,0.2)]' 
              : 'bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 border-slate-600/50 hover:border-slate-500'
          }`}
        >
          <Maximize className={`w-5 h-5 ${isExploded ? 'text-sky-400' : 'text-slate-400 group-hover:text-white'}`} />
          {isExploded ? 'UNIR PIEZAS' : 'DESPIECE'}
        </button>

        <button 
          onClick={handleNext}
          disabled={assemblyLevel === maxAssemblyLevel}
          className="group flex items-center justify-center p-4 rounded-2xl bg-industrial-accent hover:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)] transition-all border-2 border-sky-300/30 hover:border-white/50 w-20"
        >
          <SkipForward className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
    </>
  );
};
