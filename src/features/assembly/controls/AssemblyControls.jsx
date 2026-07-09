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
    isOrthographic, toggleOrthographic,
    showGrid, toggleGrid
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
        className={`absolute z-[100] transition-all duration-500 p-3 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-lg backdrop-blur-md ${
          isControlsVisible ? 'bottom-[180px] md:bottom-[220px] left-1/2 -translate-x-1/2' : 'bottom-4 md:bottom-6 left-1/2 -translate-x-1/2'
        }`}
        title={isControlsVisible ? "Ocultar Controles" : "Mostrar Controles"}
      >
        {isControlsVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {/* Panel de Controles Principal */}
      <div 
        className={`absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-20 w-[95%] sm:w-[80%] md:w-[500px] backdrop-blur-xl bg-white/80 border border-slate-300/50 rounded-3xl p-3 sm:p-5 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 sm:gap-5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isControlsVisible ? 'translate-y-0 opacity-100 visible' : 'translate-y-[150%] opacity-0 invisible'
        }`}
      >
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
            Progreso de Ensamble
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-4xl font-bold text-dicrejart-violet font-mono drop-shadow-[0_0_12px_rgba(14,165,233,0.6)]">
              PASO {assemblyLevel}
            </span>
            <span className="text-slate-500 text-xl font-mono">
              / {maxAssemblyLevel}
            </span>
          </div>
        </div>
        <span className="text-dicrejart-violet font-mono font-bold text-base md:text-lg">
          {maxAssemblyLevel > 1 ? Math.round(((assemblyLevel - 1) / (maxAssemblyLevel - 1)) * 100) : 100}%
        </span>
      </div>

      {/* Barra de progreso interactiva (Slider) */}
      <div className="relative w-full h-4 flex items-center group">
        <input
          type="range"
          min="1"
          max={maxAssemblyLevel || 1}
          value={assemblyLevel}
          onChange={(e) => setAssemblyLevel(parseInt(e.target.value))}
          className="absolute z-10 w-full h-full opacity-0 cursor-pointer"
          title="Arrastra para saltar a un paso específico"
        />
        <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-300">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-dicrejart-blue to-sky-300 transition-all duration-150 ease-out shadow-[0_0_10px_rgba(0,153,204,0.6)]"
            style={{ width: `${maxAssemblyLevel > 1 ? ((assemblyLevel - 1) / (maxAssemblyLevel - 1)) * 100 : 100}%` }}
          />
        </div>
        {/* Thumb visual */}
        <div 
          className="absolute w-4 h-4 bg-white border-2 border-dicrejart-blue rounded-full shadow-md pointer-events-none transition-all duration-150 group-hover:scale-125"
          style={{ 
            left: `calc(${maxAssemblyLevel > 1 ? ((assemblyLevel - 1) / (maxAssemblyLevel - 1)) * 100 : 100}% - 8px)` 
          }}
        />
      </div>

      {/* Controles de Escala AR, Cámara y Opacidad */}
      <div className="flex flex-col gap-2 bg-slate-100/50 p-2 md:p-3 rounded-xl border border-slate-300/50">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleOrthographic}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold tracking-widest transition-colors ${
                  isOrthographic 
                    ? 'bg-sky-500 text-dicrejart-violet shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-600 hover:text-white'
                }`}
              >
                {isOrthographic ? 'PARALELO' : 'PERSPECTIVA'}
              </button>
              <button 
                onClick={toggleGrid}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold tracking-widest transition-colors ${
                  showGrid 
                    ? 'bg-sky-500 text-dicrejart-violet shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-600 hover:text-white'
                }`}
                title="Mostrar/Ocultar Cuadrícula"
              >
                MALLA
              </button>
            </div>
            
            {/* Controles de Nivel Gerencial / Mantenimiento */}
            <div className="flex items-center gap-2">
              <button 
                onClick={useViewerStore.getState().toggleHeatmapMode}
                className={`flex-1 px-2 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold tracking-widest transition-colors ${
                  useViewerStore((state) => state.isHeatmapMode)
                    ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-600 hover:text-white'
                }`}
              >
                MAPA CALOR
              </button>
              <button 
                onClick={useViewerStore.getState().toggleReportMode}
                className={`flex-1 px-2 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold tracking-widest transition-colors ${
                  useViewerStore((state) => state.isReportMode)
                    ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-600 hover:text-white'
                }`}
              >
                REPORTE AR
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs font-mono pr-2 tracking-widest hidden sm:inline">AR SCL</span>
            <button 
              onClick={() => setArScale(arScale - 0.1)} 
              className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-slate-800 font-mono text-lg transition-colors"
            >
              -
            </button>
            <span className="text-sky-400 font-mono font-bold w-10 text-xs md:w-12 text-center md:text-sm">{arScale.toFixed(2)}</span>
            <button 
              onClick={() => setArScale(arScale + 0.1)} 
              className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-slate-800 font-mono text-lg transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-300/50 mt-1">
          <span className="text-slate-600 text-[10px] font-bold tracking-widest uppercase w-20">Transp.</span>
          <input 
            type="range" 
            min="0.1" 
            max="1.0" 
            step="0.05"
            value={useViewerStore((state) => state.modelOpacity)}
            onChange={(e) => useViewerStore.getState().setModelOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400"
          />
          <span className="text-sky-400 font-mono font-bold text-xs w-10 text-right">
            {Math.round(useViewerStore((state) => state.modelOpacity) * 100)}%
          </span>
        </div>
      </div>

      {/* Controles Tablet-First */}
      <div className="flex justify-between items-center mt-2">
        <button 
          onClick={handlePrev}
          disabled={assemblyLevel === 1}
          className="group flex items-center gap-2 justify-center rounded-2xl bg-slate-100/80 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-700 border border-slate-200 hover:border-slate-500 shadow-md w-auto font-semibold p-3 md:p-4 px-4 md:px-6 text-xs md:text-sm"
        >
          <SkipBack className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:inline">ANTERIOR</span>
        </button>

        <button 
          onClick={toggleExplode}
          title="Vista de Despiece"
          className={`group flex items-center gap-2 rounded-2xl transition-all border shadow-md font-semibold tracking-wide px-4 py-3 md:px-6 md:py-4 text-xs md:text-sm ${
            isExploded 
              ? 'bg-dicrejart-red/20 text-sky-400 border-sky-400/50 shadow-[0_0_15px_rgba(14,165,233,0.2)]' 
              : 'bg-slate-100/50 hover:bg-slate-200/80 text-slate-700 border-slate-200/50 hover:border-slate-500'
          }`}
        >
          <Maximize className={`w-5 h-5 ${isExploded ? 'text-sky-400' : 'text-slate-600 group-hover:text-dicrejart-violet'}`} />
          {isExploded ? 'UNIR PIEZAS' : 'DESPIECE'}
        </button>

        <button 
          onClick={handleNext}
          disabled={assemblyLevel === maxAssemblyLevel}
          className="group flex items-center gap-2 justify-center rounded-2xl bg-dicrejart-red hover:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 text-dicrejart-violet shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)] transition-all border-2 border-sky-300/30 hover:border-white/50 w-auto font-semibold p-3 md:p-4 px-4 md:px-6 text-xs md:text-sm"
        >
          <span className="hidden sm:inline">SIGUIENTE</span>
          <SkipForward className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
    </>
  );
};
