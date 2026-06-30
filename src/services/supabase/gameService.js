import { supabase } from './config';
import * as fflate from 'fflate';

const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB chunks para no pasarnos de 50MB

export const uploadModelChunked = async (file, setUploadStatus) => {
  if (!file) throw new Error("No file provided");
  
  if (setUploadStatus) setUploadStatus('Comprimiendo archivo 3D localmente...');
  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  
  // Comprimir con GZIP
  const compressedData = fflate.gzipSync(fileData, { level: 6 });
  
  const totalChunks = Math.ceil(compressedData.length / CHUNK_SIZE);
  const uniquePrefix = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, compressedData.length);
    const chunk = compressedData.slice(start, end);
    
    if (setUploadStatus) setUploadStatus(`Subiendo fragmento ${i + 1} de ${totalChunks}...`);
    
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
  }
  
  // Retornamos un indicador personalizado que la web usará para saber que es chunked
  return `chunked://${uniquePrefix}|${totalChunks}`;
};

import localforage from 'localforage';

const fetchChunkWithRetry = async (chunkName, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from('models')
        .download(chunkName);
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn(`Intento ${attempt} fallido para ${chunkName}:`, err);
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

export const downloadModelChunked = async (modelUrl, setUploadStatus) => {
  // modelUrl format: chunked://prefix|totalChunks
  const dataString = modelUrl.split('chunked://')[1];
  const [prefix, totalChunksStr] = dataString.split('|');
  const totalChunks = parseInt(totalChunksStr, 10);
  
  // Revisar caché local primero
  const cacheKey = `model_cache_${prefix}`;
  try {
    const cachedData = await localforage.getItem(cacheKey);
    if (cachedData) {
      if (setUploadStatus) setUploadStatus('Cargando desde caché local...');
      const decompressedData = await new Promise((resolve, reject) => {
        fflate.gunzip(cachedData, (err, dat) => {
          if (err) reject(err);
          else resolve(dat);
        });
      });
      const blob = new Blob([decompressedData.buffer]);
      return URL.createObjectURL(blob);
    }
  } catch(e) {
    console.warn("Error leyendo caché:", e);
  }

  const chunks = [];
  let totalLength = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    if (setUploadStatus) setUploadStatus(`Descargando fragmento ${i + 1} de ${totalChunks}...`);
    const chunkName = `${prefix}.part${i}`;
    
    try {
      const data = await fetchChunkWithRetry(chunkName);
      const arrayBuffer = await data.arrayBuffer();
      const uint8Arr = new Uint8Array(arrayBuffer);
      chunks.push(uint8Arr);
      totalLength += uint8Arr.length;
    } catch (error) {
      console.error(`Error descargando chunk ${i}:`, error);
      throw new Error(`Fallo al descargar el fragmento ${i + 1}`);
    }
  }
  
  if (setUploadStatus) setUploadStatus('Uniendo y procesando...');
  
  // Unir los fragmentos
  const combinedData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combinedData.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Liberar arreglo de chunks de la RAM antes de descomprimir
  chunks.length = 0;
  
  // Guardar en caché asíncronamente
  try {
    localforage.setItem(cacheKey, combinedData).catch(e => console.warn("Error guardando en caché:", e));
  } catch (e) {}

  // Descomprimir de forma asíncrona para no congelar/crashear tablets
  if (setUploadStatus) setUploadStatus('Descomprimiendo modelo 3D...');
  
  const decompressedData = await new Promise((resolve, reject) => {
    fflate.gunzip(combinedData, (err, dat) => {
      if (err) reject(err);
      else resolve(dat);
    });
  });
  
  const blob = new Blob([decompressedData.buffer]);
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
  
  if (modelUrl && modelUrl.startsWith('chunked://')) {
    try {
      const dataString = modelUrl.split('chunked://')[1];
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
