import { db, storage } from './config';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import * as fflate from 'fflate';

const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB chunks

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
    
    const chunkName = `models/${uniquePrefix}.part${i}`;
    const chunkRef = ref(storage, chunkName);
    const chunkBlob = new Blob([chunk]);
    
    await uploadBytes(chunkRef, chunkBlob, { cacheControl: 'public, max-age=3600' });
  }
  
  return `chunked://${uniquePrefix}|${totalChunks}`;
};

export const downloadModelChunked = async (modelUrl, setUploadStatus) => {
  const dataString = modelUrl.split('chunked://')[1];
  const [prefix, totalChunksStr] = dataString.split('|');
  const totalChunks = parseInt(totalChunksStr, 10);
  
  const chunks = [];
  let totalLength = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    if (setUploadStatus) setUploadStatus(`Descargando fragmento ${i + 1} de ${totalChunks}...`);
    const chunkName = `models/${prefix}.part${i}`;
    const chunkRef = ref(storage, chunkName);
    
    const arrayBuffer = await getBytes(chunkRef);
    const uint8Arr = new Uint8Array(arrayBuffer);
    chunks.push(uint8Arr);
    totalLength += uint8Arr.length;
  }
  
  if (setUploadStatus) setUploadStatus('Uniendo y descomprimiendo archivo 3D...');
  
  const combinedData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combinedData.set(chunk, offset);
    offset += chunk.length;
  }
  
  chunks.length = 0; // Free memory
  
  const decompressedData = fflate.gunzipSync(combinedData);
  const blob = new Blob([decompressedData.buffer]);
  
  return URL.createObjectURL(blob);
};

export const registerGame = async (gameData) => {
  const docRef = await addDoc(collection(db, 'assemblies'), {
    name: gameData.name,
    sku: gameData.sku,
    modelUrl: gameData.modelUrl,
    bomItems: gameData.bomItems,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getGames = async () => {
  const q = query(collection(db, 'assemblies'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const getGameById = async (id) => {
  const docRef = doc(db, 'assemblies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error("No existe el ensamblaje!");
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  };
};

export const updateGame = async (id, updates) => {
  const docRef = doc(db, 'assemblies', id);
  await updateDoc(docRef, {
    name: updates.name,
    sku: updates.sku
  });
  return { id, ...updates };
};

export const deleteGame = async (id, modelUrl) => {
  await deleteDoc(doc(db, 'assemblies', id));
  
  if (modelUrl && modelUrl.startsWith('chunked://')) {
    try {
      const dataString = modelUrl.split('chunked://')[1];
      const [prefix, totalChunksStr] = dataString.split('|');
      const totalChunks = parseInt(totalChunksStr, 10);
      
      for(let i=0; i<totalChunks; i++) {
        const chunkRef = ref(storage, `models/${prefix}.part${i}`);
        await deleteObject(chunkRef);
      }
    } catch(err) {
      console.warn("Could not delete storage chunks", err);
    }
  }
};
