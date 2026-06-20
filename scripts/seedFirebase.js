import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCb3JeNms-YI-sXNX9hZN7ODclQJ4ypS1k",
  authDomain: "papoi-5f83b.firebaseapp.com",
  projectId: "papoi-5f83b",
  storageBucket: "papoi-5f83b.firebasestorage.app",
  messagingSenderId: "932241297833",
  appId: "1:932241297833:web:f094f445b0fcd4bcc034b8",
  measurementId: "G-CPL9KEB1BX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BOM_DATA = {
  "LVL1_BASE-01": {
    name: "Base de Cimentación Primaria Izquierda",
    type: "Placa Base",
    material: "Acero Inoxidable 316L",
    dimensions: "50x50x5 cm",
    weight: "25 kg",
    quantity: 1,
    status: "pending"
  },
  "LVL1_BASE-02": {
    name: "Base de Cimentación Primaria Derecha",
    type: "Placa Base",
    material: "Acero Inoxidable 316L",
    dimensions: "50x50x5 cm",
    weight: "25 kg",
    quantity: 1,
    status: "pending"
  },
  "LVL2_POSTE-V1": {
    name: "Poste Vertical Estructural A",
    type: "Perfil Tubular",
    material: "Aluminio T6-6061",
    dimensions: "10x10x200 cm",
    weight: "12 kg",
    quantity: 1,
    status: "pending"
  },
  "LVL2_POSTE-V2": {
    name: "Poste Vertical Estructural B",
    type: "Perfil Tubular",
    material: "Aluminio T6-6061",
    dimensions: "10x10x200 cm",
    weight: "12 kg",
    quantity: 1,
    status: "pending"
  },
  "LVL3_COPLE-H1": {
    name: "Viga Horizontal de Conexión",
    type: "Cople Estructural",
    material: "Aluminio T6-6061",
    dimensions: "150x10x5 cm",
    weight: "8 kg",
    quantity: 1,
    status: "pending"
  }
};

async function seedDatabase() {
  console.log("Iniciando conexión con Firestore...");
  let count = 0;
  
  for (const [id, data] of Object.entries(BOM_DATA)) {
    try {
      const docRef = doc(db, "materials_bom", id);
      await setDoc(docRef, data);
      console.log(`[OK] Documento ${id} guardado correctamente.`);
      count++;
    } catch (error) {
      console.error(`[ERROR] Falló al guardar ${id}:`, error);
    }
  }
  
  console.log(`\\n¡Surtido completado! ${count}/${Object.keys(BOM_DATA).length} piezas insertadas en 'materials_bom'.`);
  process.exit(0);
}

seedDatabase();
