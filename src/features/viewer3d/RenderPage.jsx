import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RenderScene } from './RenderScene';
import { getGameById, downloadModelChunked } from '../../services/supabase/gameService';
import { ArrowLeft, Loader2, Layers } from 'lucide-react';

export const RenderPage = () => {
  const { juegoId } = useParams();
  const navigate = useNavigate();
  const currentJuegoId = useRef(null);
  
  const [modelUrl, setModelUrl] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState('');
  
  const [numClusters, setNumClusters] = useState(0);
  const [activeClusterIndex, setActiveClusterIndex] = useState(0);

  useEffect(() => {
    const fetchGame = async () => {
      if (juegoId && currentJuegoId.current !== juegoId) {
        currentJuegoId.current = juegoId;
        
        setModelUrl(null);
        setGameData(null);
        setError('');
        setNumClusters(0);
        setActiveClusterIndex(0);
        
        try {
          const game = await getGameById(juegoId);
          setGameData(game);
          
          if (game.modelUrl && game.modelUrl.startsWith('chunked://')) {
            const url = await downloadModelChunked(game.modelUrl, setDownloadStatus);
            setModelUrl(url);
            setDownloadStatus('');
          } else {
            setModelUrl(game.modelUrl);
          }
        } catch (err) {
          console.error("Error cargando el juego:", err);
          setError('Error al cargar el modelo 3D.');
          setDownloadStatus('');
        }
      }
    };

    fetchGame();
  }, [juegoId]);

  const [lightIntensity, setLightIntensity] = useState(1.5);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-900 relative">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate('/')}
          className="pointer-events-auto bg-slate-800/80 hover:bg-slate-700/80 text-white p-3 rounded-full backdrop-blur shadow-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold pr-2 hidden md:inline">Volver</span>
        </button>
        
        {/* Light Controls */}
        <div className="pointer-events-auto bg-slate-800/80 p-3 rounded-2xl backdrop-blur shadow-lg border border-slate-700 flex items-center gap-3">
           <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">Luz</span>
           <input 
              type="range" 
              min="0" max="3" step="0.1" 
              value={lightIntensity} 
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
              className="w-24 md:w-32 accent-sky-400"
           />
           <span className="text-white text-xs font-mono w-6">{lightIntensity.toFixed(1)}</span>
        </div>

        {gameData && (
          <div className="pointer-events-auto bg-slate-800/80 text-white px-4 py-2 rounded-full backdrop-blur shadow-lg border border-slate-700 hidden md:block">
            <span className="font-bold">{gameData.name}</span>
            <span className="text-slate-400 text-sm ml-2">Render Mode</span>
          </div>
        )}
      </div>

      {/* Tabs para Submodelos (si hay más de 1) */}
      {numClusters > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="bg-slate-800/90 backdrop-blur shadow-2xl border border-slate-700 p-1.5 rounded-full flex gap-1 items-center max-w-[90vw] overflow-x-auto no-scrollbar">
            {Array.from({ length: numClusters }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveClusterIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  activeClusterIndex === idx 
                    ? 'bg-sky-500 text-white shadow-lg' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="font-medium text-sm">Modelo {idx + 1}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button
              onClick={() => setActiveClusterIndex(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                activeClusterIndex === null
                  ? 'bg-purple-500 text-white shadow-lg' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span className="font-medium text-sm">Ver Todo</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 3D Canvas */}
      {modelUrl ? (
        <RenderScene 
           modelUrl={modelUrl} 
           lightIntensity={lightIntensity} 
           activeClusterIndex={activeClusterIndex} 
           onClustersFound={setNumClusters} 
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-white">
          {error ? (
            <div className="text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">{error}</div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-sky-400" />
              <p className="text-lg font-mono">{downloadStatus || 'Preparando entorno...'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
