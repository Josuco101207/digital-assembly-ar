import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Box, Cuboid, ArrowRight, Settings, Loader2, Edit2, Check, X, Trash2 } from 'lucide-react';
import { getGames, updateGame, deleteGame } from '../../services/supabase/gameService';

export const Home = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para la edición
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const data = await getGames();
        setGames(data);
      } catch (error) {
        console.error("Error al cargar ensambles:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const handleEditClick = (e, game) => {
    e.stopPropagation(); // Evitar navegar al viewer
    setEditingId(game.id);
    setEditName(game.name);
    setEditSku(game.sku);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleSaveEdit = async (e, id) => {
    e.stopPropagation();
    if (!editName.trim() || !editSku.trim()) return;
    
    setIsSaving(true);
    try {
      await updateGame(id, { name: editName, sku: editSku });
      // Actualizar estado local para que se refleje de inmediato
      setGames(games.map(g => g.id === id ? { ...g, name: editName, sku: editSku } : g));
      setEditingId(null);
    } catch (error) {
      console.error("Error al actualizar ensamble:", error);
      alert("Hubo un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (e, game) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de que deseas eliminar el ensamble "${game.name}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteGame(game.id, game.modelUrl);
        setGames(games.filter(g => g.id !== game.id));
      } catch (error) {
        console.error("Error al eliminar ensamble:", error);
        alert("Hubo un error al eliminar el ensamble.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-industrial-dark text-slate-200 font-sans p-4 md:p-8">
      {/* Header / Navbar */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-12 border-b border-slate-700/50 pb-4 md:pb-6 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-2 md:p-3 bg-industrial-accent/20 rounded-xl border border-industrial-accent/30 shadow-[0_0_20px_rgba(14,165,233,0.2)]">
            <Cuboid className="w-6 h-6 md:w-8 md:h-8 text-industrial-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Digital Twin Hub</h1>
            <p className="text-sm font-mono text-slate-400">BOM_INSPECTION_SYS // PORTFOLIO</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar ENSAMBLE_ID..." 
              className="w-full bg-slate-900/50 border border-slate-700 text-sm text-white rounded-full pl-10 pr-4 py-2 focus:outline-none focus:border-industrial-accent focus:ring-1 focus:ring-industrial-accent transition-all"
            />
          </div>

          <button 
            onClick={() => navigate('/registro')}
            className="flex items-center gap-2 bg-industrial-accent hover:bg-sky-400 text-white px-4 py-2 md:px-5 rounded-full font-bold shadow-lg transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Registrar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-4 md:mb-8">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white mb-1">Ensambles Activos</h2>
            <p className="text-sm text-slate-400">Selecciona un gemelo digital para abrir el visor interactivo.</p>
          </div>
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Grid de Tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-industrial-accent mb-4" />
              <p className="font-mono text-sm">Sincronizando con Firebase...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="col-span-full text-center p-12 border border-slate-700/50 rounded-2xl bg-slate-800/20">
              <p className="text-slate-400">No hay ensambles registrados aún en la base de datos.</p>
            </div>
          ) : (
            games.map((game) => {
              const isEditing = editingId === game.id;
              
              return (
                <div 
                  key={game.id}
                  onClick={() => !isEditing && navigate(`/viewer/${game.id}`)}
                  className={`group bg-slate-800/40 border ${isEditing ? 'border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'border-slate-700 hover:border-industrial-accent/50'} rounded-2xl p-4 md:p-6 ${!isEditing ? 'cursor-pointer hover:bg-slate-800/80 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]' : ''} transition-all relative`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-slate-900/80 rounded-xl text-slate-300 group-hover:text-industrial-accent transition-colors">
                      <Box className="w-6 h-6" />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {!isEditing && (
                        <>
                          <button 
                            onClick={(e) => handleEditClick(e, game)}
                            className="p-1.5 bg-slate-700/50 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Editar información"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteClick(e, game)}
                            className="p-1.5 bg-slate-700/50 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                            title="Eliminar ensamble"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30`}>
                        ONLINE
                      </span>
                    </div>
                  </div>
                  
                  {isEditing ? (
                    <div className="mb-2" onClick={e => e.stopPropagation()}>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-industrial-accent"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h3 className="text-lg font-bold text-white mb-2">{game.name}</h3>
                  )}
                  
                  <div className={`flex items-center justify-between mt-6 pt-4 border-t border-slate-700/50`}>
                    {isEditing ? (
                      <div className="w-full" onClick={e => e.stopPropagation()}>
                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">SKU/ID</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={editSku}
                            onChange={(e) => setEditSku(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-600 text-white font-mono text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-industrial-accent"
                          />
                          <button 
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            className="p-1.5 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={(e) => handleSaveEdit(e, game.id)}
                            disabled={isSaving}
                            className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400 rounded-lg transition-colors"
                          >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">SKU/ID</span>
                          <span className="font-mono text-sm text-slate-300">{game.sku}</span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-industrial-accent transition-colors group-hover:translate-x-1" />
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Tarjeta para Crear Nuevo */}
          <div 
            onClick={() => navigate('/registro')}
            className="flex flex-col items-center justify-center bg-slate-800/20 border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-4 md:p-6 cursor-pointer transition-all hover:bg-slate-800/40 min-h-[160px] md:min-h-[220px]"
          >
            <div className="p-4 bg-slate-900/50 rounded-full mb-4 text-slate-500">
              <Plus className="w-8 h-8" />
            </div>
            <p className="font-bold text-slate-400">Registrar Nuevo Ensamble</p>
          </div>
        </div>
      </main>
    </div>
  );
};
