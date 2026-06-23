import { supabase, supabaseUrl, supabaseKey } from './config';
import * as fflate from 'fflate';

export const uploadModelChunked = (file, setUploadStatus) => {
  return new Promise(async (resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    
    if (setUploadStatus) setUploadStatus('Iniciando Web Worker para subida TUS...');
    
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    const uniquePrefix = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    
    // Iniciar Web Worker
    const worker = new Worker(new URL('../../workers/uploadWorker.js', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      const { type, percentage, error, uploadName } = e.data;
      
      if (type === 'progress') {
        if (setUploadStatus) setUploadStatus(`Subiendo archivo a máxima velocidad (TUS)... ${percentage}%`);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(`Error en Worker TUS: ${error}`));
      } else if (type === 'success') {
        worker.terminate();
        // Devolvemos el prefijo con un indicador "tus://" para saber que no está particionado
        resolve(`tus://${uploadName}`);
      }
    };
    
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Fallo fatal en Web Worker: ${err.message}`));
    };
    
    worker.postMessage({
      file,
      supabaseUrl,
      supabaseAnonKey: supabaseKey,
      accessToken,
      uniquePrefix
    });
  });
};

export const downloadModelChunked = async (modelUrl, setUploadStatus) => {
  // Manejo de compatibilidad hacia atrás
  const isRaw = modelUrl.startsWith('rawchunked://');
  const isChunked = modelUrl.startsWith('chunked://');
  
  if (isRaw || isChunked) {
    const dataString = modelUrl.replace('rawchunked://', '').replace('chunked://', '');
    const [prefix, totalChunksStr] = dataString.split('|');
    const totalChunks = parseInt(totalChunksStr, 10);
    
    let completedDownloads = 0;
    const CONCURRENCY = 5;
    const chunkIndices = Array.from({length: totalChunks}, (_, i) => i);
    const downloadedChunks = [];
    
    const downloadChunk = async (i) => {
      const chunkName = `${prefix}.part${i}`;
      const { data, error } = await supabase.storage.from('models').download(chunkName);
      if (error) throw new Error(`Fallo al descargar el fragmento ${i + 1}`);
      const arrayBuffer = await data.arrayBuffer();
      completedDownloads++;
      if (setUploadStatus) setUploadStatus(`Descargando fragmentos antiguos... (${completedDownloads} de ${totalChunks})`);
      return { index: i, data: new Uint8Array(arrayBuffer) };
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
    const combinedData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    let finalData = combinedData;
    if (isChunked) {
      if (setUploadStatus) setUploadStatus('Descomprimiendo archivo 3D...');
      finalData = fflate.gunzipSync(combinedData);
    }
    
    const blob = new Blob([finalData]);
    return URL.createObjectURL(blob);
  }
  
  // Nueva lógica TUS (es un solo archivo directo en el bucket)
  const isTus = modelUrl.startsWith('tus://');
  const fileName = isTus ? modelUrl.replace('tus://', '') : modelUrl;
  
  if (setUploadStatus) setUploadStatus('Descargando modelo completo (TUS)...');
  
  const { data, error } = await supabase.storage.from('models').download(fileName);
  if (error) throw new Error('Fallo al descargar el modelo completo.');
  
  return URL.createObjectURL(data);
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
  } else if (modelUrl && modelUrl.startsWith('tus://')) {
    try {
      const fileName = modelUrl.replace('tus://', '');
      await supabase.storage.from('models').remove([fileName]);
    } catch(err) {
      console.warn("Could not delete TUS storage file", err);
    }
  }
};
