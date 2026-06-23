self.onmessage = async (e) => {
  const { file, supabaseUrl, supabaseAnonKey, accessToken, uniquePrefix } = e.data;

  try {
    const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
    let completedUploads = 0;
    const CONCURRENCY = 3; // Reducido a 3 para evitar saturar el router/módem del usuario y evitar ECONNRESET
    const chunkIndices = Array.from({length: totalChunks}, (_, i) => i);

    const uploadChunk = async (i, retries = 3) => {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileData.length);
      const chunk = fileData.slice(start, end);
      
      const chunkName = `${uniquePrefix}.part${i}`;
      const chunkBlob = new Blob([chunk], { type: 'application/octet-stream' });
      
      const url = `${supabaseUrl}/storage/v1/object/models/${chunkName}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken || supabaseAnonKey}`,
            'x-upsert': 'false'
          },
          body: chunkBlob
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Status ${response.status}: ${errText}`);
        }
      } catch (err) {
        if (retries > 0) {
          console.warn(`Reintentando chunk ${i} por error de red:`, err);
          await new Promise(r => setTimeout(r, 2000)); // Esperar 2s
          return uploadChunk(i, retries - 1);
        }
        throw new Error(`Fallo al subir el fragmento ${i} tras reintentos: ${err.message}`);
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
