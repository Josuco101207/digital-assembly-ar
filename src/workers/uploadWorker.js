import * as tus from 'tus-js-client';

self.onmessage = async (e) => {
  const { file, supabaseUrl, supabaseAnonKey, accessToken, uniquePrefix } = e.data;

  try {
    const bucketName = 'models';
    const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
    
    // Note: Since File is structured clonable, it can be passed to workers directly!
    const uploadName = `${uniquePrefix}.glb`;

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
        'x-upsert': 'true', // Overwrite if it exists
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true, // Clean up local storage metadata
      metadata: {
        bucketName: bucketName,
        objectName: uploadName,
        contentType: 'model/gltf-binary',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunk size recommended by Supabase TUS
      onError: function (error) {
        self.postMessage({ type: 'error', error: error.message });
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        self.postMessage({ 
          type: 'progress', 
          percentage, 
          bytesUploaded, 
          bytesTotal 
        });
      },
      onSuccess: function () {
        self.postMessage({ type: 'success', uploadName: uploadName });
      },
    });

    upload.findPreviousUploads().then(function (previousUploads) {
      // Si se encuentra una subida anterior, continuarla. Si no, iniciar de cero.
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
    
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
