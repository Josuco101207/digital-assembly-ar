import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, Save, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { registerGame, uploadModelChunked } from '../../services/supabase/gameService';
import localforage from 'localforage';

export const RegisterGame = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [bomItems, setBomItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileObj, setFileObj] = useState(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fileObj) {
      setError("Por favor sube un archivo 3D antes de registrar.");
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      // Subimos en pedazos para evadir límite de 50MB
      const modelUrl = await uploadModelChunked(fileObj, setUploadStatus);
      
      setUploadStatus('Sincronizando BOM y metadatos con la nube maestra (Supabase)...');
      const gameData = {
        name,
        sku,
        modelUrl,
        bomItems
      };
      
      await registerGame(gameData);
      
      setIsSaving(false);
      setUploadStatus('');
      navigate('/');
    } catch (err) {
      console.error("Error al guardar:", err);
      setError(err.message || "Error desconocido al guardar en la nube.");
      setIsSaving(false);
      setUploadStatus('');
    }
  };



  const removeBomItem = (index) => {
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  const processFile = (file) => {
    if (!file) return;
    
    const isGlbOrGltf = file.name.endsWith('.glb') || file.name.endsWith('.gltf');
    const isObj = file.name.toLowerCase().endsWith('.obj');
    
    if (!isGlbOrGltf && !isObj) {
      setError('Formato no soportado. Por favor sube un archivo .glb, .gltf o .obj');
      return;
    }

    setError(null);
    setFileName(file.name);
    setFileObj(file);
    setIsParsing(true);
    
    const objectUrl = URL.createObjectURL(file);
    
    const onParseComplete = (sceneGroup) => {
      const partsCount = {};
      const geometryGroups = new Map();
      const processedMeshes = [];
      
      sceneGroup.traverse((child) => {
        if (child.isMesh) {
          let cleanName = child.name || "";
          
          cleanName = cleanName.replace(/_\d+$/, '');
          
          if (/^(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i.test(cleanName) && child.parent) {
            cleanName = child.parent.name || cleanName;
            cleanName = cleanName.replace(/_\d+$/, '');
          }
          
          cleanName = cleanName.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');
          cleanName = cleanName.replace(/[-_]\d+$/, '');
          
          let previousName = "";
          while (cleanName !== previousName) {
            previousName = cleanName;
            cleanName = cleanName.replace(/^.*?-\d+(?=[A-Z])/i, '');
          }

          cleanName = cleanName || `Pieza_Sin_Nombre_${child.uuid ? child.uuid.substring(0,4) : Math.random().toString(36).substring(2,6)}`;

          // Reglas de limpieza específicas para Inventor Frame Generator (Caso ROLADO y longitudes pegadas)
          // 1. Quitar dígitos después de texto al final (ej. ROLADO1 -> ROLADO)
          cleanName = cleanName.replace(/([A-Za-z]+)\d{1,3}$/, '$1');
          
          // 2. Si termina en muchísimos números (ej. 115814), asumimos que los últimos 1 o 2 son la instancia de Frame Generator
          // OJO: Solo lo hacemos si el bloque numérico es muy largo (> 4 dígitos) para no romper el TBO-42-450.
          if (/(-\d{5,})$/.test(cleanName)) {
             // Es un número de 5+ dígitos al final. Quitamos los últimos 1-2
             cleanName = cleanName.replace(/(\d{4})\d{1,2}$/, '$1');
          }

          if (!child.userData) child.userData = {};
          child.userData.tempName = cleanName;

          let gSize = new THREE.Vector3();
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          child.geometry.boundingBox.getSize(gSize);
          const dims = [gSize.x, gSize.y, gSize.z].sort((a,b) => a-b);
          const sig = `${child.geometry.attributes.position.count}_${dims[0].toFixed(3)}_${dims[1].toFixed(3)}_${dims[2].toFixed(3)}`;
          
          if (!geometryGroups.has(sig)) geometryGroups.set(sig, []);
          geometryGroups.get(sig).push(child);
          
          processedMeshes.push(child);
        }
      });

      geometryGroups.forEach((meshes, sig) => {
        if (meshes.length > 1) {
          const names = Array.from(new Set(meshes.map(m => m.userData.tempName)));
          if (names.length > 1) {
             let prefix = names[0];
             for (let i = 1; i < names.length; i++) {
                 while (names[i].indexOf(prefix) !== 0) {
                     prefix = prefix.substring(0, prefix.length - 1);
                     if (!prefix) break;
                 }
             }
             let lcp = prefix.replace(/[-_]$/, ''); 
             
             let isValid = true;
             for (const name of names) {
               const remainder = name.substring(lcp.length);
               if (remainder.length > 0 && !/^[-_]?\d+$/.test(remainder)) {
                 isValid = false;
                 break;
               }
             }
             
             if (isValid && lcp.length > 2) {
               meshes.forEach(m => m.userData.tempName = lcp);
             }
          }
        }
      });

      processedMeshes.forEach(child => {
          const cleanName = child.userData.tempName;
          if (partsCount[cleanName]) {
            partsCount[cleanName]++;
          } else {
            partsCount[cleanName] = 1;
          }
      });

      const newBomItems = Object.entries(partsCount).map(([id, qty]) => ({ id, qty }));
      
      if (newBomItems.length === 0) {
        setError("El archivo 3D no contiene piezas de geometría reconocibles (BOM vacío). Verifique cómo se exportó el archivo.");
        setFileObj(null);
        setFileName("");
      } else {
        setBomItems(newBomItems);
      }
      
      setIsParsing(false);
      
      // Liberar memoria
      URL.revokeObjectURL(objectUrl);
    };

    const onParseError = (err) => {
      console.error("Error parseando archivo 3D:", err);
      setError("Error al leer el archivo 3D.");
      setIsParsing(false);
      URL.revokeObjectURL(objectUrl);
    };

    if (isGlbOrGltf) {
      const loader = new GLTFLoader();
      loader.load(objectUrl, (gltf) => onParseComplete(gltf.scene), undefined, onParseError);
    } else if (isObj) {
      import('three/examples/jsm/loaders/OBJLoader').then(({ OBJLoader }) => {
        const loader = new OBJLoader();
        loader.load(objectUrl, (group) => onParseComplete(group), undefined, onParseError);
      }).catch(onParseError);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  return (
    <div className="min-h-screen bg-industrial-dark text-slate-200 font-sans p-8">
      <header className="max-w-4xl mx-auto mb-10 flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Registrar Nuevo Ensamble</h1>
          <p className="text-sm font-mono text-slate-400">ENGINEERING_HUB // NEW_ENTRY</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Tarjeta de Información General */}
          <section className="bg-slate-900/80 border border-slate-700/60 rounded-3xl p-8 backdrop-blur-md shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 border-b border-slate-700/50 pb-4">1. Identificación del Gemelo Digital</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Proyecto / Ensamble</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Motor V8 Fase 1" 
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-industrial-accent focus:ring-1 focus:ring-industrial-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SKU o ID Único</label>
                <input 
                  type="text" 
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej. motor-v8-f1" 
                  className="w-full bg-slate-800 border border-slate-600 text-white font-mono rounded-xl px-4 py-3 focus:outline-none focus:border-industrial-accent focus:ring-1 focus:ring-industrial-accent transition-all"
                />
              </div>
            </div>
          </section>

          {/* Tarjeta de Archivo 3D */}
          <section className="bg-slate-900/80 border border-slate-700/60 rounded-3xl p-8 backdrop-blur-md shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 border-b border-slate-700/50 pb-4">2. Archivo Geométrico (.GLB / .GLTF / .OBJ)</h2>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer overflow-hidden ${
                isDragging ? 'border-industrial-accent bg-industrial-accent/10' : 'border-slate-600 hover:border-industrial-accent bg-slate-800/50'
              }`}
            >
              <input
                type="file"
                accept=".glb,.gltf,.obj"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Sube tu archivo GLB/GLTF/OBJ"
              />

              {isParsing ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 text-industrial-accent animate-spin" />
                  <p className="text-slate-300 font-mono text-sm animate-pulse">Extrayendo topología y metadata...</p>
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full mb-2">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="font-bold text-white">{fileName}</p>
                  <p className="text-xs text-emerald-400 font-mono">¡Geometría parseada exitosamente!</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center group">
                  <div className="p-4 bg-slate-700/50 rounded-full inline-block mb-4 group-hover:bg-industrial-accent/20 transition-colors">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-industrial-accent" />
                  </div>
                  <p className="font-bold text-slate-300 mb-1">Arrastra el archivo maestro de SolidWorks</p>
                  <p className="text-xs font-mono text-slate-500">Soporta .glb, .gltf y .obj</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
          </section>

          {/* Tarjeta de BOM */}
          <section className="bg-slate-900/80 border border-slate-700/60 rounded-3xl p-8 backdrop-blur-md shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
              <h2 className="text-lg font-bold text-white">3. Estructura de Materiales (BOM)</h2>
            </div>

            <div className="space-y-3">
              {/* Encabezados de Tabla */}
              <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center text-center">
                <div className="col-span-2">N.º DE ELEMENTO</div>
                <div className="col-span-6 text-left">N.º DE PIEZA</div>
                <div className="col-span-3">CANTIDAD</div>
                <div className="col-span-1"></div>
              </div>
              
              {bomItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-center bg-slate-800/80 p-2 rounded-xl border border-slate-700/50 hover:border-industrial-accent/50 transition-colors">
                  <div className="col-span-2 text-center font-mono text-slate-400 font-bold">
                    {index + 1}
                  </div>
                  <div className="col-span-6">
                    <input 
                      type="text" 
                      placeholder="Ej. LVL1_BASE" 
                      defaultValue={item.id}
                      className="w-full bg-transparent border-none text-sm font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      min="1"
                      defaultValue={item.qty}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-industrial-accent text-center font-bold"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button 
                      type="button"
                      onClick={() => removeBomItem(index)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Acciones */}
          <div className="flex flex-col items-end pt-4">
            {uploadStatus && (
              <p className="text-industrial-accent text-sm font-mono mb-4 animate-pulse">
                {uploadStatus}
              </p>
            )}
            <button 
              type="submit"
              disabled={isSaving}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-1 ${
                isSaving ? 'bg-slate-600 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_10px_30px_rgba(16,185,129,0.4)]'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">PROCESANDO...</span>
              ) : (
                <><Save className="w-5 h-5" /> REGISTRAR ENSAMBLE</>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
