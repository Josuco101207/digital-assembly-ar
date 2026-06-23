import { createClient } from '@supabase/supabase-js';

self.onmessage = async (e) => {
  const { file, supabaseUrl, supabaseAnonKey, accessToken, uniquePrefix } = e.data;

  try {
    // Inicializamos un cliente ligero de supabase solo para el worker
    // Le pasamos el token de acceso para que tenga permisos de subida
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken || supabaseAnonKey}`
        }
      }
    });

    const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB (Menor a los 50MB de límite gratuito)
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
    let completedUploads = 0;
    const CONCURRENCY = 6; 
    const chunkIndices = Array.from({length: totalChunks}, (_, i) => i);

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
        throw error;
      }
      
      completedUploads++;
      const percentage = ((completedUploads / totalChunks) * 100).toFixed(0);
      self.postMessage({ 
        type: 'progress', 
        percentage, 
        completed: completedUploads, 
        total: totalChunks 
      });
    };

    // Subir en paralelo
    for (let i = 0; i < totalChunks; i += CONCURRENCY) {
      const batch = chunkIndices.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(index => uploadChunk(index)));
    }

    self.postMessage({ type: 'success', uploadName: uniquePrefix, totalChunks });

  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
