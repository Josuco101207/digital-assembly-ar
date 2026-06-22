import { create } from 'zustand';
import { fetchMaterialsBOM } from '../services/supabase/bomService';

// Justificación Arquitectónica: Usamos Zustand para el estado 3D porque 
// evita re-renderizados innecesarios del DOM en React cuando cambian valores
// continuos (como niveles de despiece) dentro de useFrame.

export const useViewerStore = create((set) => ({
  // URL del modelo 3D cargado (null = sin modelo)
  modelUrl: null,
  setModelUrl: (url) => set({ modelUrl: url }),
  modelIsObj: false,
  setModelIsObj: (isObj) => set({ modelIsObj: isObj }),

  // Líneas de la cuadrícula adaptables (extraídas de las posiciones de los postes)
  gridLines: { x: [], z: [] },
  setGridLines: (lines) => set({ gridLines: lines }),

  // Nivel de despiece de 0 a 100
  explodeLevel: 0,
  setExplodeLevel: (level) => set({ explodeLevel: level }),

  // ID de la pieza actualmente seleccionada por raycasting (el grupo de piezas iguales)
  selectedPartId: null,
  // UUID exacto de la malla (mesh) clickeada físicamente
  selectedMeshUuid: null,
  setSelectedPartId: (id, uuid = null) => set({ selectedPartId: id, selectedMeshUuid: uuid }),

  // Nivel de secuencia de armado actual (1, 2, 3...)
  assemblyLevel: 1,
  setAssemblyLevel: (level) => set({ assemblyLevel: level }),
  
  // Nivel MÁXIMO de secuencia detectado automáticamente por el algoritmo espacial
  maxAssemblyLevel: 1,
  setMaxAssemblyLevel: (maxLevel) => set({ maxAssemblyLevel: maxLevel }),
  
  // Estado del Despiece (Explode View)
  isExploded: false,
  toggleExplode: () => set((state) => ({ isExploded: !state.isExploded })),

  // Estado para la visibilidad de los controles (UI Hide/Show)
  isControlsVisible: true,
  toggleControls: () => set((state) => ({ isControlsVisible: !state.isControlsVisible })),

  // Modos de Vista: '3d' o 'picking'
  viewMode: '3d',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Modo de Proyección de Cámara: Perspectiva (false) u Ortográfica/Paralela (true)
  isOrthographic: false,
  toggleOrthographic: () => set((state) => ({ isOrthographic: !state.isOrthographic })),

  // BOM específico del ensamble actual (extraído del CAD)
  assemblyBOM: [],
  setAssemblyBOM: (items) => set({ assemblyBOM: items }),

  // Datos reales del ERP (Catálogo Maestro)
  bomData: {},
  isLoadingBOM: false,
  fetchBOM: async () => {
    set({ isLoadingBOM: true });
    try {
      const data = await fetchMaterialsBOM();
      set({ bomData: data, isLoadingBOM: false });
    } catch (error) {
      console.error("Failed to load BOM", error);
      set({ isLoadingBOM: false });
    }
  },

  // Estado de carga del modelo global
  isModelLoading: false,
  setIsModelLoading: (isLoading) => set({ isModelLoading: isLoading }),

  // Escala definida por el usuario para el AR
  arScale: 1.0,
  setArScale: (scale) => set({ arScale: Math.max(0.001, scale) }),

  // Offset que <Center> aplica al modelo (para alinear la cuadrícula)
  centerOffset: [0, 0, 0],
  setCenterOffset: (offset) => set({ centerOffset: offset }),
}));
