import { supabase } from './config';
import * as fflate from 'fflate';

const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB chunks

export const uploadModelChunked = async (file, setUploadStatus) => {
  if (!file) throw new Error("No file provided");
  
  if (setUploadStatus) setUploadStatus('Preparando archivo 3D localmente...');
  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  
  // No comprimimos con GZIP para ahorrar RAM y evitar congelar la página.
  // Los GLB ya son binarios eficientes.
  const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
  const uniquePrefix = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  
  let completedUploads = 0;
  const CONCURRENCY = 6; // Todos los pedazos simultáneos
  const chunkIndices = Array.from({length: totalChunks}, (_, i) => i);
  
  if (setUploadStatus) setUploadStatus(`Iniciando subida al servidor (0 de ${totalChunks} fragmentos)...`);

  const uploadChunk = async (i) => {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileData.length);
    const chunk = fileData.slice(start, end);
    
    const chunkName = `${uniquePrefix}.part${i}`;
    const chunkBlob = new Blob([chunk]);
    
    const { error } = await supabase.storage
      .from('models')
      .upload(chunkName, chunkBlob, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(`Error subiendo chunk ${i}:`, error);
      throw new Error(`Fallo al subir el fragmento ${i + 1}`);
    }
    
    completedUploads++;
    if (setUploadStatus) setUploadStatus(`Subiendo fragmentos a máxima velocidad... (${completedUploads} de ${totalChunks})`);
  };

  for (let i = 0; i < totalChunks; i += CONCURRENCY) {
    const batch = chunkIndices.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(index => uploadChunk(index)));
  }
  
  // Retornamos un indicador personalizado que la web usará para saber que es chunked sin compresión
  return `rawchunked://${uniquePrefix}|${totalChunks}`;
};

export const downloadModelChunked = async (modelUrl, setUploadStatus) => {
  const isRaw = modelUrl.startsWith('rawchunked://');
  const dataString = modelUrl.replace('rawchunked://', '').replace('chunked://', '');
  const [prefix, totalChunksStr] = dataString.split('|');
  const totalChunks = parseInt(totalChunksStr, 10);
  
  let completedDownloads = 0;
  const CONCURRENCY = 5;
  const chunkIndices = Array.from({length: totalChunks}, (_, i) => i);
  const downloadedChunks = [];
  
  const downloadChunk = async (i) => {
    const chunkName = `${prefix}.part${i}`;
    
    const { data, error } = await supabase.storage
      .from('models')
      .download(chunkName);
      
    if (error) {
      console.error(`Error descargando chunk ${i}:`, error);
      throw new Error(`Fallo al descargar el fragmento ${i + 1}`);
    }
    
    const arrayBuffer = await data.arrayBuffer();
    const uint8Arr = new Uint8Array(arrayBuffer);
    
    completedDownloads++;
    if (setUploadStatus) setUploadStatus(`Descargando fragmentos... (${completedDownloads} de ${totalChunks})`);
    
    return { index: i, data: uint8Arr };
  };

  for (let i = 0; i < totalChunks; i += CONCURRENCY) {
    const batch = chunkIndices.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(index => downloadChunk(index)));
    downloadedChunks.push(...results);
  }
  
  downloadedChunks.sort((a, b) => a.index - b.index);
  const chunks = downloadedChunks.map(c => c.data);
  let totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  
  if (setUploadStatus) setUploadStatus('Uniendo archivo 3D...');
  
  // Unir los fragmentos
  const combinedData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combinedData.set(chunk, offset);
    offset += chunk.length;
  }
  
  let finalData = combinedData;
  // Solo descomprimir si NO es raw
  if (!isRaw) {
    if (setUploadStatus) setUploadStatus('Descomprimiendo archivo 3D...');
    finalData = fflate.gunzipSync(combinedData);
  }
  
  // Crear Blob URL
  const blob = new Blob([finalData]);
  return URL.createObjectURL(blob);
};

export const registerGame = async (gameData) => {
  // gameData: { name, sku, modelUrl, bomItems }
  // Supabase automáticamente creará el id y created_at si la tabla está bien configurada
  const { data, error } = await supabase
    .from('assemblies')
    .insert([
      { 
        name: gameData.name, 
        sku: gameData.sku, 
        model_url: gameData.modelUrl, 
        bom_items: gameData.bomItems 
      }
    ])
    .select();
    
  if (error) throw error;
  
  return data[0].id;
};

export const getGames = async () => {
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  // Transformar de snake_case a camelCase para el frontend
  return data.map(game => ({
    id: game.id,
    name: game.name,
    sku: game.sku,
    modelUrl: game.model_url,
    bomItems: game.bom_items,
    createdAt: game.created_at
  }));
};

export const getGameById = async (id) => {
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    modelUrl: data.model_url,
    bomItems: data.bom_items,
    createdAt: data.created_at
  };
};

export const updateGame = async (id, updates) => {
  const { data, error } = await supabase
    .from('assemblies')
    .update({ name: updates.name, sku: updates.sku })
    .eq('id', id)
    .select();
    
  if (error) throw error;
  return data[0];
};

export const deleteGame = async (id, modelUrl) => {
  const { error } = await supabase
    .from('assemblies')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
  
  if (modelUrl && (modelUrl.startsWith('chunked://') || modelUrl.startsWith('rawchunked://'))) {
    try {
      const dataString = modelUrl.replace('rawchunked://', '').replace('chunked://', '');
      const [prefix, totalChunksStr] = dataString.split('|');
      const totalChunks = parseInt(totalChunksStr, 10);
      const filesToDelete = [];
      for(let i=0; i<totalChunks; i++) {
        filesToDelete.push(`${prefix}.part${i}`);
      }
      await supabase.storage.from('models').remove(filesToDelete);
    } catch(err) {
      console.warn("Could not delete storage chunks", err);
    }
  }
};
