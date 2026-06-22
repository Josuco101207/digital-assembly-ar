import React, { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { useViewerStore } from '../../../store/useViewerStore';
import * as THREE from 'three';

// Justificación Arquitectónica: Cargador dinámico de modelos GLTF/GLB.
// En lugar de mapear nodos a componentes React (lo cual es lento con ensambles gigantes),
// procesamos el árbol completo de Three.js (scene.traverse) una sola vez al inicio.
// El evento onClick se inyecta en el <primitive> raíz, permitiendo que R3F maneje la delegación.

export const ModelLoader = ({ url }) => {
  const modelIsObj = useViewerStore((state) => state.modelIsObj);
  return modelIsObj ? <OBJModel url={url} /> : <GLTFModel url={url} />;
};

const GLTFModel = ({ url }) => {
  const { scene } = useGLTF(url);
  return <ModelCore scene={scene} />;
};

const OBJModel = ({ url }) => {
  const scene = useLoader(OBJLoader, url);
  return <ModelCore scene={scene} />;
};

// Caché global para compartir materiales y ahorrar VRAM
const materialCache = new Map();
const defaultLambert = new THREE.MeshLambertMaterial({ color: 0xcccccc });

const ModelCore = ({ scene }) => {
  const selectedPartId = useViewerStore((state) => state.selectedPartId);
  const setSelectedPartId = useViewerStore((state) => state.setSelectedPartId);
  const assemblyLevel = useViewerStore((state) => state.assemblyLevel);
  const setMaxAssemblyLevel = useViewerStore((state) => state.setMaxAssemblyLevel);
  // Escuchamos el estado de explosión directamente
  const isExploded = useViewerStore((state) => state.isExploded);

  // Referencia mutable para iterar meshes eficientemente en useFrame sin re-renderizar
  const meshesRef = useRef([]);

  useEffect(() => {
    const processedMeshes = [];
    const geometryGroups = new Map(); // Para LCP
    
    // Recorremos la escena original del GLB/GLTF
    scene.traverse((child) => {
      if (child.isMesh) {
        // Desactivamos sombras individuales para piezas pequeñas para no saturar la GPU en tablets
        child.castShadow = false;
        child.receiveShadow = false;

        // Optimizaciones de Memoria Extremas para Tablets
        if (child.geometry.attributes.uv) child.geometry.deleteAttribute('uv');
        if (child.geometry.attributes.color) child.geometry.deleteAttribute('color');

        if (child.material) {
           if (!materialCache.has(child.material)) {
              const baseColor = child.material.color || new THREE.Color(0xcccccc);
              const newMat = new THREE.MeshLambertMaterial({ 
                 color: baseColor,
                 side: child.material.side !== undefined ? child.material.side : THREE.DoubleSide
              });
              materialCache.set(child.material, newMat);
           }
           child.material = materialCache.get(child.material);
        } else {
           child.material = defaultLambert;
        }

        // LIMPIEZA DE SUFIJOS BÁSICA
        let cleanName = child.name || "";
        cleanName = cleanName.replace(/_\d+$/, '');
        
        if (/^(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i.test(cleanName) && child.parent) {
          cleanName = child.parent.name || cleanName;
          cleanName = cleanName.replace(/_\d+$/, '');
        }
        
        cleanName = cleanName.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');
        cleanName = cleanName.replace(/[-_]\d+$/, '');
        
        let previousName = "";
        while (cleanName !== previousName) {
          previousName = cleanName;
          cleanName = cleanName.replace(/^.*?-\d+(?=[A-Z])/i, '');
        }

        cleanName = cleanName || `Pieza_Sin_Nombre_${child.uuid ? child.uuid.substring(0,4) : ""}`;

        // Reglas de limpieza específicas para Inventor Frame Generator (Caso ROLADO y longitudes pegadas)
        // 1. Quitar dígitos después de texto al final (ej. ROLADO1 -> ROLADO)
        cleanName = cleanName.replace(/([A-Za-z]+)\d{1,3}$/, '$1');
        
        // 2. Si termina en muchísimos números (ej. 115814), asumimos que los últimos 1 o 2 son la instancia de Frame Generator
        if (/(-\d{5,})$/.test(cleanName)) {
           cleanName = cleanName.replace(/(\d{4})\d{1,2}$/, '$1');
        }

        child.userData.tempName = cleanName;

        // Computar firma geométrica para agrupar clones perfectos y evitar bugs de Inventor
        let gSize = new THREE.Vector3();
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        child.geometry.boundingBox.getSize(gSize);
        const dims = [gSize.x, gSize.y, gSize.z].sort((a,b) => a-b);
        const sig = `${child.geometry.attributes.position.count}_${dims[0].toFixed(3)}_${dims[1].toFixed(3)}_${dims[2].toFixed(3)}`;
        
        if (!geometryGroups.has(sig)) geometryGroups.set(sig, []);
        geometryGroups.get(sig).push(child);

        processedMeshes.push(child);
      }
    });

    // === NORMALIZACIÓN INTELIGENTE DE NOMBRES (LCP) ===
    // Resuelve el bug de Inventor donde borra los ":" y une los números de instancia al nombre base
    geometryGroups.forEach((meshes, sig) => {
      if (meshes.length > 1) {
        const names = Array.from(new Set(meshes.map(m => m.userData.tempName)));
        if (names.length > 1) {
           let prefix = names[0];
           for (let i = 1; i < names.length; i++) {
               while (names[i].indexOf(prefix) !== 0) {
                   prefix = prefix.substring(0, prefix.length - 1);
                   if (!prefix) break;
               }
           }
           let lcp = prefix.replace(/[-_]$/, ''); 
           
           let isValid = true;
           for (const name of names) {
             const remainder = name.substring(lcp.length);
             // El remainder debe ser solo dígitos o separador+dígitos
             if (remainder.length > 0 && !/^[-_]?\d+$/.test(remainder)) {
               isValid = false;
               break;
             }
           }
           
           if (isValid && lcp.length > 2) {
             meshes.forEach(m => m.userData.tempName = lcp);
           }
        }
      }
    });

    // Inyectamos los metadatos finales
    processedMeshes.forEach(child => {
        const cleanName = child.userData.tempName;
        const box = new THREE.Box3().setFromObject(child);
        const bottomY = box.min.y;

        child.userData = {
          id: cleanName,
          rawId: child.name,
          bottomY: bottomY,
          requiredLevel: 1,
          originalPosition: child.position.clone(),
          originalMaterial: child.material,
          wasSelected: false
        };
    });

    // === ALGORITMO DE CLUSTERING ESPACIAL (BOTTOM-UP) ===
    if (processedMeshes.length > 0) {
      // 1. Ordenar todas las piezas desde la más baja a la más alta
      processedMeshes.sort((a, b) => a.userData.bottomY - b.userData.bottomY);
      
      const globalMinY = processedMeshes[0].userData.bottomY;
      
      // Encontrar la altura máxima total del ensamble
      let globalMaxY = globalMinY;
      processedMeshes.forEach(m => {
        const box = new THREE.Box3().setFromObject(m);
        if (box.max.y > globalMaxY) globalMaxY = box.max.y;
      });
      
      const totalHeight = globalMaxY - globalMinY;
      
      // Al solicitar el usuario que vaya de "poco a poco aunque sean varios pasos", 
      // utilizamos una tolerancia vertical minúscula (2 cm aprox) en lugar de dividir en 6 bloques.
      const dynamicTolerance = 0.02;

      let currentLevel = 1;
      let currentLevelMinY = globalMinY;

      processedMeshes.forEach((mesh) => {
        // Si la pieza empieza significativamente más arriba que el grupo actual, es un nuevo nivel
        if (mesh.userData.bottomY > currentLevelMinY + dynamicTolerance) {
          currentLevel++;
          currentLevelMinY = mesh.userData.bottomY;
        }
        mesh.userData.requiredLevel = currentLevel;
      });

      // Actualizar el UI para mostrar exactamente cuántos niveles se detectaron
      setMaxAssemblyLevel(currentLevel);
      useViewerStore.getState().setAssemblyLevel(currentLevel);
      
      // === EXTRACCIÓN DE POSTES PARA LA CUADRÍCULA ===
      const xSet = new Set();
      const zSet = new Set();
      
      processedMeshes.forEach(m => {
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        
        // Heurística: Un "poste" es significativamente más alto (Y) que ancho (X) y profundo (Z)
        if (size.y > size.x * 2 && size.y > size.z * 2) {
          const center = box.getCenter(new THREE.Vector3());
          // Redondeamos para agrupar postes en la misma línea (tolerancia de 0.05)
          const roundTo = (num, step) => Math.round(num / step) * step;
          xSet.add(roundTo(center.x, 0.05));
          zSet.add(roundTo(center.z, 0.05));
        }
      });
      
      let uniqueX = Array.from(xSet).sort((a, b) => a - b);
      let uniqueZ = Array.from(zSet).sort((a, b) => a - b);
      
      // Fallback si la heurística no encuentra postes (ensamble raro), usamos todas las piezas
      if (uniqueX.length === 0 || uniqueZ.length === 0) {
        processedMeshes.forEach(m => {
          const box = new THREE.Box3().setFromObject(m);
          const center = box.getCenter(new THREE.Vector3());
          const roundTo = (num, step) => Math.round(num / step) * step;
          xSet.add(roundTo(center.x, 0.05));
          zSet.add(roundTo(center.z, 0.05));
        });
        uniqueX = Array.from(xSet).sort((a, b) => a - b);
        uniqueZ = Array.from(zSet).sort((a, b) => a - b);
      }
      
      useViewerStore.getState().setGridLines({ x: uniqueX, z: uniqueZ });
    }

    meshesRef.current = processedMeshes;
  }, [scene]);

  // Instanciamos un solo vector temporal fuera del loop para evitar Garbage Collection
  const _tempVec = new THREE.Vector3();

  // Loop de Animación de Alto Rendimiento (60 FPS)
  useFrame((state, delta) => {
    meshesRef.current.forEach((mesh) => {
      // 1. Lógica de Secuencia de Armado (Caída en Y)
      const isVisible = assemblyLevel >= mesh.userData.requiredLevel;
      
      // Reutilizamos el vector en lugar de usar .clone() que mata la memoria
      _tempVec.copy(mesh.userData.originalPosition);
      if (isExploded) {
        // Expandimos radialmente
        _tempVec.multiplyScalar(2.0); 
      }

      if (isVisible) {
        mesh.visible = true;
        // Solo calcular lerp si aún no ha llegado a su destino (mejora rendimiento CPU)
        if (mesh.position.distanceToSquared(_tempVec) > 0.0001) {
          mesh.position.lerp(_tempVec, delta * 5);
        } else {
          mesh.position.copy(_tempVec); // Fijar si ya llegó
        }
      } else {
        mesh.visible = false;
        // La pieza espera arriba en el aire
        _tempVec.y += 10;
        mesh.position.copy(_tempVec);
      }

      // 3. Feedback Visual de Selección OPTIMIZADO
      const isSelected = selectedPartId === mesh.userData.id;
      
      // Solo hacer el cambio de material si el estado acaba de cambiar
      if (isSelected !== mesh.userData.wasSelected) {
        mesh.userData.wasSelected = isSelected;
        
        if (isSelected && mesh.userData.originalMaterial) {
          // Si no hemos creado el material de selección para esta pieza, lo clonamos ahora
          if (!mesh.userData.selectedMaterial) {
            mesh.userData.selectedMaterial = mesh.userData.originalMaterial.clone();
            mesh.userData.selectedMaterial.emissive = new THREE.Color(0x0ea5e9);
            mesh.userData.selectedMaterial.emissiveIntensity = 0.5;
          }
          mesh.material = mesh.userData.selectedMaterial;
        } else if (mesh.userData.originalMaterial) {
          // Restauramos la referencia al material original (recupera Draw Calls compartidos)
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  });

  // Delegación de eventos R3F: intercepta el click del objeto intersectado
  const handleClick = (e) => {
    e.stopPropagation(); // Evita clics a través de la geometría
    if (e.object && e.object.userData.id) {
      setSelectedPartId(e.object.userData.id);
    }
  };

  const handlePointerMissed = () => {
    setSelectedPartId(null);
  };

  return (
    <primitive 
      object={scene} 
      onClick={handleClick}
      onPointerMissed={handlePointerMissed}
    />
  );
};
