import React, { useCallback, useState } from 'react';
import { useViewerStore } from '../../../store/useViewerStore';
import { UploadCloud, FileBox, AlertCircle, Loader2 } from 'lucide-react';

export const ModelUploader = () => {
  const setModelUrl = useViewerStore((state) => state.setModelUrl);
  const setIsModelLoading = useViewerStore((state) => state.setIsModelLoading);
  const isModelLoading = useViewerStore((state) => state.isModelLoading);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [conversionProgress, setConversionProgress] = useState(null);

  const processFile = async (file) => {
    if (!file) return;
    
    // Validar extensión
    const isGlb = file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf');
    const isSkp = file.name.toLowerCase().endsWith('.skp');
    
    if (!isGlb && !isSkp) {
      setError('Formato no soportado. Por favor sube un archivo .skp, .glb o .gltf');
      return;
    }

    setError(null);

    if (isSkp) {
      try {
        setIsModelLoading(true);
        setConversionProgress('Analizando archivo de SketchUp...');
        
        // Dynamic import so we don't bloat the initial page load
        const openskp = await import('openskp');
        
        setConversionProgress('Extrayendo geometría y materiales...');
        const arrayBuffer = await file.arrayBuffer();
        
        // Parse the Sketchup file
        const model = openskp.parseSkp(arrayBuffer);
        
        setConversionProgress('Convirtiendo a formato GLB (Web)...');
        // Export to GLB format binary
        const glbBuffer = openskp.toGLB(model);
        
        // Create Blob and URL
        const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
        const objectUrl = URL.createObjectURL(blob);
        
        setConversionProgress(null);
        setIsModelLoading(false);
        setModelUrl(objectUrl);
      } catch (err) {
        console.error("Error al convertir SKP:", err);
        setError('Error al procesar el archivo .skp. Asegúrate de que es versión 2021 o superior y no está corrupto.');
        setConversionProgress(null);
        setIsModelLoading(false);
      }
    } else {
      // GLB or GLTF
      const objectUrl = URL.createObjectURL(file);
      setModelUrl(objectUrl);
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  return (
    <div className="w-screen h-screen bg-industrial-dark flex flex-col items-center justify-center p-6 text-slate-200">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">Digital Twin Inicializador</h1>
          <p className="text-slate-400 font-mono">BOM_INSPECTION_SYS // Módulo de Carga</p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative overflow-hidden border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 ease-out bg-slate-800/40 backdrop-blur-sm ${
            isDragging 
              ? 'border-industrial-accent bg-industrial-accent/10 scale-105 shadow-[0_0_40px_rgba(14,165,233,0.3)]' 
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/60'
          }`}
        >
          <input
            type="file"
            accept=".skp,.glb,.gltf"
            onChange={handleFileChange}
            className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${isModelLoading ? 'hidden' : ''}`}
            title="Sube tu archivo SKP/GLB/GLTF"
            disabled={isModelLoading}
          />
          
          <div className="flex flex-col items-center justify-center pointer-events-none space-y-6">
            {isModelLoading ? (
              <>
                <div className="p-6 rounded-full bg-industrial-accent/20 text-industrial-accent animate-pulse">
                  <Loader2 className="w-16 h-16 animate-spin" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white mb-2">
                    Procesando Archivo
                  </p>
                  <p className="text-industrial-accent text-sm font-mono animate-pulse">
                    {conversionProgress || 'Extrayendo geometría...'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className={`p-6 rounded-full transition-colors duration-300 ${isDragging ? 'bg-industrial-accent/20 text-industrial-accent' : 'bg-slate-700/50 text-slate-400'}`}>
                  <UploadCloud className="w-16 h-16" />
                </div>
                
                <div>
                  <p className="text-xl font-bold text-white mb-2">
                    Arrastra tu ensamble aquí
                  </p>
                  <p className="text-slate-400 text-sm">
                    o haz clic para explorar tus archivos locales
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700/50">
                  <FileBox className="w-4 h-4" />
                  Soporta formatos nativos .SKP, .GLB y .GLTF
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 p-4 bg-red-950/50 border border-red-500/50 rounded-xl text-red-200 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="mt-12 text-center border-t border-slate-800 pt-8">
          <p className="text-xs text-slate-500 font-mono">
            * El modelo se procesará localmente en la memoria de la tablet (URL efímera).<br/>
            Al recargar la página, deberás volver a seleccionarlo.
          </p>
        </div>
      </div>
    </div>
  );
};
