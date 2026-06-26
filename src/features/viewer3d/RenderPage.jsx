import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RenderScene } from './RenderScene';
import { getGameById, downloadModelChunked } from '../../services/supabase/gameService';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const RenderPage = () => {
  const { juegoId } = useParams();
  const navigate = useNavigate();
  const currentJuegoId = useRef(null);
  
  const [modelUrl, setModelUrl] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGame = async () => {
      if (juegoId && currentJuegoId.current !== juegoId) {
        currentJuegoId.current = juegoId;
        
        setModelUrl(null);
        setGameData(null);
        setError('');
        
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

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-900 relative">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate('/')}
          className="pointer-events-auto bg-slate-800/80 hover:bg-slate-700/80 text-white p-3 rounded-full backdrop-blur shadow-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold pr-2">Volver</span>
        </button>
        
        {gameData && (
          <div className="bg-slate-800/80 text-white px-4 py-2 rounded-full backdrop-blur shadow-lg border border-slate-700">
            <span className="font-bold">{gameData.name}</span>
            <span className="text-slate-400 text-sm ml-2">Render Mode</span>
          </div>
        )}
      </div>

      {/* Main 3D Canvas */}
      {modelUrl ? (
        <RenderScene modelUrl={modelUrl} />
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
