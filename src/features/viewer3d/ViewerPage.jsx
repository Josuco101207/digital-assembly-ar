import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ViewerScene } from './ViewerScene';
import { AssemblyControls } from '../assembly/controls/AssemblyControls';
import { PickingList } from '../picking/PickingList';
import { ModelUploader } from './components/ModelUploader';
import { useViewerStore } from '../../store/useViewerStore';
import { Layers, Info, Box, Loader2, Camera, ChevronLeft, ChevronRight, CheckCircle2, ListChecks, Cuboid, Upload, ArrowLeft, Scissors } from 'lucide-react';
import { getGameById, downloadModelChunked } from '../../services/firebase/gameService';
import localforage from 'localforage';

export const ViewerPage = () => {
  const { juegoId } = useParams();
  const navigate = useNavigate();
  
  const attemptedAutoLoad = useRef(false);

  const fetchBOM = useViewerStore((state) => state.fetchBOM);
  const bomData = useViewerStore((state) => state.bomData);
  const setModelUrl = useViewerStore((state) => state.setModelUrl);
  const setModelIsObj = useViewerStore((state) => state.setModelIsObj);
  const modelUrl = useViewerStore((state) => state.modelUrl);
  const setAssemblyBOM = useViewerStore((state) => state.setAssemblyBOM);
  const selectedPartId = useViewerStore((state) => state.selectedPartId);
  const viewMode = useViewerStore((state) => state.viewMode);
  const setViewMode = useViewerStore((state) => state.setViewMode);
  const isLoadingBOM = useViewerStore((state) => state.isLoadingBOM);
  const assemblyBOM = useViewerStore((state) => state.assemblyBOM);
  const subModels = useViewerStore((state) => state.subModels);
  const activeSubModelId = useViewerStore((state) => state.activeSubModelId);
  const setActiveSubModelId = useViewerStore((state) => state.setActiveSubModelId);
  const setSplitRequest = useViewerStore((state) => state.setSplitRequest);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');

  useEffect(() => {
    fetchBOM();
  }, [fetchBOM]);

  const currentJuegoId = useRef(null);

  // Carga dinámica desde la base de datos
  useEffect(() => {
    const fetchGame = async () => {
      // Solo ejecutamos si hay un juegoId y es diferente al que ya cargamos
      if (juegoId && currentJuegoId.current !== juegoId) {
        currentJuegoId.current = juegoId;
        
        // LIMPIEZA DEL ESTADO ANTERIOR (Crucial para cambiar de modelo sin bugs)
        setModelUrl(null);
        setAssemblyBOM([]);
        useViewerStore.getState().setGridLines({ x: [], z: [] });
        useViewerStore.getState().setSelectedPartId(null, null);
        useViewerStore.getState().setAssemblyLevel(1);
        useViewerStore.getState().setSubModels([]);
        useViewerStore.getState().setActiveSubModelId(null);
        setGameData(null);
        
        try {
          const game = await getGameById(juegoId);
          setGameData(game);
          
          if (game.modelUrl) {
            setModelIsObj(game.modelUrl.toLowerCase().includes('.obj'));
          }

          if (game.bomItems) {
            // Limpieza y consolidación automática de BOM para proyectos antiguos
            const cleanBom = {};
            game.bomItems.forEach(item => {
              let cleanId = item.id;
              // 1. Limpieza estricta de SolidWorks GLTF (solo instanciamientos y genéricos)
              cleanId = cleanId.replace(/_\d+$/, '');
              cleanId = cleanId.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');
              
              // 2. Consolidar cantidades sumando duplicados reparados
              if (cleanBom[cleanId]) {
                cleanBom[cleanId].qty += item.qty;
              } else {
                cleanBom[cleanId] = { id: cleanId, qty: item.qty };
              }
            });
            setAssemblyBOM(Object.values(cleanBom));
          }
          
          if (game.modelUrl && game.modelUrl.startsWith('chunked://')) {
            const url = await downloadModelChunked(game.modelUrl, setDownloadStatus);
            setModelUrl(url);
            setDownloadStatus('');
          } else {
            setModelUrl(game.modelUrl);
          }
        } catch (err) {
          console.error("Error cargando el juego desde BD:", err);
          setDownloadStatus('Error al cargar el modelo 3D.');
        }
      }
    };
    fetchGame();
    
    // Limpieza de caché para liberar RAM (OPTIMIZACIÓN EXTREMA)
    return () => {
      if (useViewerStore.getState().modelUrl) {
        URL.revokeObjectURL(useViewerStore.getState().modelUrl);
        // Intentar limpiar las cachés globales de Three.js
        import('@react-three/fiber').then(({ useLoader }) => {
           import('three/examples/jsm/loaders/OBJLoader').then(({ OBJLoader }) => {
              try { useLoader.clear(OBJLoader, useViewerStore.getState().modelUrl); } catch(e){}
           });
           import('three/examples/jsm/loaders/GLTFLoader').then(({ GLTFLoader }) => {
              try { useLoader.clear(GLTFLoader, useViewerStore.getState().modelUrl); } catch(e){}
           });
        });
      }
    };
  }, [juegoId, setModelUrl, setModelIsObj, setAssemblyBOM]);

  const partData = useMemo(() => {
    if (!selectedPartId) return null;
    
    // Buscar si existe metadata en el catálogo maestro ERP
    const masterData = bomData[selectedPartId];
    // Buscar la pieza en la lista de materiales real del ensamble actual
    const assemblyPart = assemblyBOM.find(item => item.id === selectedPartId);
    
    if (masterData) {
      return { ...masterData, quantity: assemblyPart?.qty || 1 };
    }
    
    if (assemblyPart) {
      return { 
        name: assemblyPart.id, 
        type: 'Geometría CAD', 
        dimensions: 'S/D', 
        material: 'Por Definir', 
        weight: 'S/D',
        quantity: assemblyPart.qty 
      };
    }
    
    return { name: selectedPartId || 'Pieza Desconocida', type: 'N/A', dimensions: 'N/A', material: 'N/A', weight: 'N/A', quantity: 1 };
  }, [selectedPartId, bomData, assemblyBOM]);

  const handleCameraClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <>
      {downloadStatus ? (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-white text-slate-700 p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-dicrejart-violet mb-4" />
          <p className="font-mono text-lg text-dicrejart-violet mb-2">Reconstruyendo Ensamble 3D</p>
          <p className="text-dicrejart-violet text-sm animate-pulse">{downloadStatus}</p>
        </div>
      ) : !modelUrl ? (
        <ModelUploader />
      ) : (
        <div className="w-screen h-screen overflow-hidden bg-white font-sans text-slate-800 relative">
      
      {/* Botón para volver al Home */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 md:top-6 md:left-6 z-40 p-2 md:p-3 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors shadow-lg"
      >
        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />
      </button>

      {/* Visor 3D Principal */}
      <main className="absolute inset-0 z-0" style={{ display: viewMode === '3d' ? 'block' : 'none' }}>
        <ViewerScene />
      </main>

      {/* Vista de Inventario / Picking List */}
      {viewMode === 'picking' && <PickingList />}

      {/* Botón Central: Toggle View Mode */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-md p-1 rounded-full border border-slate-300 shadow-xl flex items-center">
        <button
          onClick={() => setViewMode('3d')}
          className={`flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all ${
            viewMode === '3d' ? 'bg-dicrejart-red text-dicrejart-violet shadow-md' : 'text-slate-600 hover:text-dicrejart-violet'
          }`}
        >
          <Cuboid className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Ensamble 3D</span><span className="sm:hidden">3D</span>
        </button>
        <button
          onClick={() => setViewMode('picking')}
          className={`flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all ${
            viewMode === 'picking' ? 'bg-emerald-600 text-dicrejart-violet shadow-md' : 'text-slate-600 hover:text-dicrejart-violet'
          }`}
        >
          <ListChecks className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Picking List</span><span className="sm:hidden">List</span>
        </button>
      </div>

      {/* Sub-Model Tabs */}
      {subModels.length > 1 && viewMode === '3d' && (
        <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-md p-1 rounded-lg border border-slate-300 shadow-lg flex items-center gap-1 overflow-x-auto max-w-[90vw] snap-x scrollbar-hide">
          <button
            onClick={() => setActiveSubModelId('all')}
            className={`flex-shrink-0 px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all snap-center whitespace-nowrap ${
              activeSubModelId === 'all' 
                ? 'bg-dicrejart-red text-dicrejart-violet shadow-sm' 
                : 'text-slate-600 hover:text-dicrejart-violet hover:bg-slate-100'
            }`}
          >
            Todos
          </button>
          {subModels.map((sub, idx) => (
            <button
              key={sub.id}
              onClick={() => setActiveSubModelId(sub.id)}
              className={`flex-shrink-0 px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all snap-center whitespace-nowrap ${
                activeSubModelId === sub.id 
                  ? 'bg-dicrejart-red text-dicrejart-violet shadow-sm' 
                  : 'text-slate-600 hover:text-dicrejart-violet hover:bg-slate-100'
              }`}
            >
              Módulo {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Botón Toggle Sidebar (Mobile/Tablet) */}
      <button 
        style={{ display: viewMode === '3d' ? 'block' : 'none' }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-16 left-4 md:top-20 md:left-6 z-30 p-2 md:p-3 bg-dicrejart-red rounded-full shadow-[0_0_15px_rgba(14,165,233,0.5)] text-dicrejart-violet hover:scale-105 transition-transform border border-sky-400/50"
      >
        {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
      </button>

      {/* Sidebar de Inspección */}
      <aside 
        className={`absolute top-16 left-0 bottom-32 z-20 w-[85vw] sm:w-80 sm:left-4 md:left-6 md:top-36 md:bottom-40 backdrop-blur-xl bg-white/80 border border-slate-300/60 rounded-r-2xl sm:rounded-[2rem] p-4 md:p-6 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col gap-6 ${
          isSidebarOpen && viewMode === '3d' ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-300/80 pb-4">
          <div className="p-2 bg-dicrejart-red/20 rounded-lg border border-dicrejart-red/30">
            <Layers className="text-dicrejart-violet w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-dicrejart-violet tracking-wide">{gameData ? gameData.name : (juegoId ? juegoId.toUpperCase() : 'Digital Twin')}</h1>
            <p className="text-xs text-slate-600 font-mono">SKU: {gameData ? gameData.sku : 'N/A'}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-dicrejart-violet mb-4 flex items-center gap-2 uppercase tracking-widest text-slate-700">
              <Info className="w-4 h-4 text-dicrejart-violet" /> Datos de Componente
            </h2>
            
            {isLoadingBOM ? (
              <div className="h-40 flex flex-col items-center justify-center bg-slate-100/50 rounded-2xl border border-slate-300/50 p-4">
                <Loader2 className="w-10 h-10 text-dicrejart-violet animate-spin mb-3" />
                <p className="text-sm text-slate-600 font-mono animate-pulse">SYNC_ERP_DATA...</p>
              </div>
            ) : selectedPartId && partData ? (
              <div className="bg-slate-100/90 rounded-2xl border border-dicrejart-red/40 p-5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-5 pb-4 border-b border-slate-300/80">
                  <span className="text-[11px] font-mono tracking-widest text-dicrejart-violet font-bold bg-dicrejart-red/10 px-2 py-1 rounded">
                    ID: {selectedPartId}
                  </span>
                  <h3 className="text-lg font-bold text-dicrejart-violet mt-3 leading-tight">{partData.name}</h3>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex justify-between items-center bg-white/50 p-3 rounded-lg border border-slate-300/50">
                      <p className="text-slate-600 text-[10px] uppercase tracking-wider">Cantidad Requerida</p>
                      <p className="font-mono font-bold text-dicrejart-violet text-xl">x{partData.quantity}</p>
                    </div>
                    {partData.quantity > 1 && (
                      <button 
                        onClick={() => setSplitRequest(selectedPartId)}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Scissors className="w-3 h-3" /> Separar Grupo
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1">Tipo / Categoría</p>
                    <p className="font-semibold text-slate-800">{partData.type}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1">Dimensiones Físicas</p>
                    <p className="font-mono text-dicrejart-violet">{partData.dimensions}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1">Especificación de Material</p>
                    <p className="font-medium text-slate-800">{partData.material}</p>
                  </div>
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded-lg border border-slate-300/50 mt-2">
                    <p className="text-slate-600 text-[10px] uppercase tracking-wider">Peso Bruto</p>
                    <p className="font-mono font-bold text-dicrejart-violet text-lg">{partData.weight}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center bg-slate-100/30 rounded-2xl border border-slate-300/50 border-dashed text-center p-6 transition-colors hover:bg-slate-100/50">
                <Box className="w-10 h-10 text-slate-500 mb-3 opacity-50" />
                <p className="text-sm text-slate-600 leading-relaxed">Intercepta un modelo 3D para revelar especificaciones técnicas.</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Controles del Reproductor Flotantes */}
      {viewMode === '3d' && <AssemblyControls />}

      {/* FAB QC Camera */}
      <button 
        style={{ display: viewMode === '3d' ? 'flex' : 'none' }}
        onClick={handleCameraClick}
        title="Registro de Control de Calidad"
        className="absolute bottom-36 md:bottom-10 right-4 md:right-10 z-30 p-3 md:p-5 bg-emerald-600 hover:bg-emerald-500 text-dicrejart-violet rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.4)] transition-all transform hover:scale-110 active:scale-95 border-2 border-emerald-400/30 group items-center justify-center flex"
      >
        <Camera className="w-6 h-6 md:w-8 md:h-8 group-hover:animate-pulse" />
      </button>

      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-6 right-6 md:right-10 z-50 flex items-center gap-4 bg-slate-100/95 backdrop-blur-md text-dicrejart-violet px-6 py-4 rounded-2xl shadow-2xl border border-emerald-500/50 animate-in fade-in slide-in-from-right-8 duration-300">
          <div className="p-2 bg-emerald-500/20 rounded-full">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-emerald-50">Control de Calidad</h4>
            <p className="text-xs text-slate-700 font-mono mt-1">Lente activada. Esperando captura...</p>
          </div>
        </div>
      )}

      {/* Botón flotante para subir otro modelo */}
      <button 
        onClick={() => setModelUrl(null)}
        title="Subir Nuevo Ensamble"
        className="absolute bottom-36 md:bottom-10 left-4 md:left-10 z-30 p-3 md:p-4 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-dicrejart-violet rounded-full shadow-lg transition-all border border-slate-200 flex items-center justify-center gap-2"
      >
        <Upload className="w-5 h-5" />
      </button>

    </div>
      )}
    </>
  );
};
