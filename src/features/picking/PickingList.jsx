import React, { useMemo, useState } from 'react';
import { useViewerStore } from '../../store/useViewerStore';
import { CheckSquare, Square, PackageCheck, ClipboardList, ShieldCheck } from 'lucide-react';

// Justificación Arquitectónica: Componente dedicado a la consolidación de inventario.
// Complejidad O(N) para consolidar los documentos de Firestore que comparten nombre/sku.
// Diseño enfocado en el operador (tarjetas anchas, tipografía clara, checkboxes de área grande).

export const PickingList = () => {
  const { bomData, assemblyBOM, setViewMode } = useViewerStore();
  
  // 1. Consolidación de Datos (El Reto Staff Engineer)
  // Cruzamos el BOM del ensamble (assemblyBOM) con la metadata maestra del ERP (bomData)
  const consolidatedList = useMemo(() => {
    if (!assemblyBOM || assemblyBOM.length === 0) return [];
    
    return assemblyBOM.map(item => {
      const masterPart = bomData[item.id] || {};
      return {
        name: item.id,
        quantity: item.qty,
        material: masterPart.material || 'Acero Estructural (S/D)',
        dimensions: masterPart.dimensions || 'Varias',
        locations: ['Área de Producción 1']
      };
    });
  }, [assemblyBOM, bomData]);

  // 2. Estado local para los checkboxes
  const [checkedItems, setCheckedItems] = useState(new Set());

  const handleToggle = (key) => {
    const next = new Set(checkedItems);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCheckedItems(next);
  };

  const isAllChecked = consolidatedList.length > 0 && checkedItems.size === consolidatedList.length;

  return (
    <div className="absolute inset-0 z-40 bg-industrial-dark overflow-y-auto custom-scrollbar flex flex-col items-center py-6 px-3 md:py-10 md:px-10">
      
      {/* Cabecera */}
      <div className="w-full max-w-4xl mb-4 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4 md:pb-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-3 tracking-wide">
            <ClipboardList className="w-6 h-6 md:w-8 md:h-8 text-industrial-accent" />
            Lista de Surtido<span className="hidden sm:inline"> (Picking List)</span>
          </h1>
          <p className="text-sm text-slate-400 font-mono mt-2">ORDEN: ORD-9932-B | ENSAMBLE ESTRUCTURAL</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-slate-400">PROGRESO DE SURTIDO</p>
          <p className="text-xl md:text-2xl font-bold text-industrial-accent">
            {checkedItems.size} <span className="text-slate-500 text-lg">/ {consolidatedList.length}</span>
          </p>
        </div>
      </div>

      {/* Grid de Tarjetas Consolidadas */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-24 md:mb-32">
        {consolidatedList.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 font-mono">
            Esperando sincronización de BOM...
          </div>
        ) : (
          consolidatedList.map((item) => {
            const isChecked = checkedItems.has(item.name);
            
            return (
              <div 
                key={item.name}
                onClick={() => handleToggle(item.name)}
                className={`cursor-pointer transition-all duration-300 rounded-2xl border p-3 md:p-5 shadow-lg relative overflow-hidden flex items-center gap-4 ${
                  isChecked 
                    ? 'bg-emerald-900/20 border-emerald-500/50 scale-[0.98] opacity-75' 
                    : 'bg-slate-800/80 border-slate-700 hover:border-sky-500/50 hover:bg-slate-800'
                }`}
              >
                {/* Glow de selección */}
                {isChecked && <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay"></div>}
                
                {/* Checkbox Icon */}
                <div className="shrink-0 z-10">
                  {isChecked ? (
                    <CheckSquare className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <Square className="w-8 h-8 text-slate-500" />
                  )}
                </div>

                {/* Info Consolidada */}
                <div className="flex-1 z-10">
                  <h3 className={`text-base md:text-lg font-bold ${isChecked ? 'text-emerald-100 line-through' : 'text-white'}`}>
                    {item.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1">Material: {item.material}</p>
                  <p className="text-xs font-mono text-slate-400">Dim: {item.dimensions}</p>
                </div>

                {/* Cantidad Gigante */}
                <div className="shrink-0 text-center z-10">
                  <span className="block text-[10px] text-slate-400 tracking-widest uppercase mb-1">Cant</span>
                  <span className={`text-2xl md:text-3xl font-bold font-mono ${isChecked ? 'text-emerald-500/70' : 'text-industrial-accent'}`}>
                    x{item.quantity}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Botón de Surtido Completado (Flotante) */}
      <div className={`fixed bottom-10 transition-all duration-500 transform ${isAllChecked ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => setViewMode('3d')}
          className="flex items-center gap-3 px-6 py-3 md:px-10 md:py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-base md:text-lg shadow-[0_15px_40px_rgba(16,185,129,0.5)] border border-emerald-400 transition-transform active:scale-95"
        >
          <ShieldCheck className="w-7 h-7" />
          Surtido Completado - Iniciar Ensamble 3D
        </button>
      </div>

    </div>
  );
};
