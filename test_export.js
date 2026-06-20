import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import { JSDOM } from 'jsdom';

// Mocks para Node.js
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.Blob = dom.window.Blob;
global.FileReader = dom.window.FileReader;

const scene = new THREE.Scene();

const mat1 = new THREE.MeshStandardMaterial({ color: 0x334155 });
const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), mat1);
box.name = "LVL1_BASE-01";
scene.add(box);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltf) => {
    // Para binary (GLB), exporter devuelve un ArrayBuffer
    const buffer = Buffer.from(gltf);
    fs.writeFileSync('public/models/ensamble.glb', buffer);
    console.log("Generado public/models/ensamble.glb con éxito.");
  },
  (err) => console.error("Error", err),
  { binary: true }
);
