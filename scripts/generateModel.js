import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Justificación Arquitectónica: Para renderizar o exportar un GLB en el servidor (Node.js) sin
// abrir un navegador, inyectamos un entorno de DOM falso (JSDOM).
// Esto permite a GLTFExporter utilizar clases nativas del navegador (Blob, FileReader)
// para compilar el array de bytes binario (.glb).

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.Blob = dom.window.Blob;
global.FileReader = dom.window.FileReader;

// 1. Instanciamos la Escena Virtual
const scene = new THREE.Scene();

// 2. Definimos Materiales Base
const matBase = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.3 }); // Gris oscuro
const matPoste = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 }); // Aluminio
const matCople = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 }); // Acero galvanizado

// === NIVEL 1: CIMENTACIÓN (BASES) ===
const baseGeo = new THREE.BoxGeometry(0.6, 0.2, 0.6);

const base1 = new THREE.Mesh(baseGeo, matBase);
base1.position.set(-2, 0, 0);
base1.name = "LVL1_BASE-01"; // Regla estricta de nomenclatura
scene.add(base1);

const base2 = new THREE.Mesh(baseGeo, matBase);
base2.position.set(2, 0, 0);
base2.name = "LVL1_BASE-02";
scene.add(base2);

// === NIVEL 2: POSTES Y MARCOS ===
const posteGeo = new THREE.CylinderGeometry(0.15, 0.15, 4, 16);

const poste1 = new THREE.Mesh(posteGeo, matPoste);
poste1.position.set(-2, 2.1, 0);
poste1.name = "LVL2_POSTE-V1";
scene.add(poste1);

const poste2 = new THREE.Mesh(posteGeo, matPoste);
poste2.position.set(2, 2.1, 0);
poste2.name = "LVL2_POSTE-V2";
scene.add(poste2);

// === NIVEL 3: COPLES HORIZONTALES ===
const copleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4.3, 16);

const cople1 = new THREE.Mesh(copleGeo, matCople);
cople1.position.set(0, 3.5, 0);
cople1.rotation.set(0, 0, Math.PI / 2);
cople1.name = "LVL3_COPLE-X1";
scene.add(cople1);


// 3. Exportación a archivo binario (.glb)
const exporter = new GLTFExporter();

const outputPath = path.resolve('./public/models/ensamble.glb');

console.log("Compilando el ensamble a GLB...");

exporter.parse(
  scene,
  (gltfBuffer) => {
    // Convierte el ArrayBuffer a Buffer de Node.js
    const buffer = Buffer.from(gltfBuffer);
    
    // Si la carpeta no existe, la creamos
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
    console.log(`\n¡Éxito! Archivo guardado en: ${outputPath}`);
    console.log(`Tamaño: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
  },
  (err) => {
    console.error("Error al exportar:", err);
  },
  { binary: true } // binary: true genera un .glb. binary: false genera un .gltf
);
