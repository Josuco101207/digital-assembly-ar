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
    
    // Recorremos la escena original del GLB/GLTF
    scene.traverse((child) => {
      if (child.isMesh) {
        // Desactivamos sombras individuales para piezas pequeñas para no saturar la GPU en tablets
        child.castShadow = false;
        child.receiveShadow = false;

        // LIMPIEZA DE SUFIJOS (SolidWorks GLTF)
        let cleanName = child.name;
        cleanName = cleanName.replace(/_\d+$/, '');
        
        let previousName = "";
        while (cleanName !== previousName) {
          previousName = cleanName;
          cleanName = cleanName.replace(/^.*?-\d+(?=[A-Z])/i, '');
        }

        // Computar Bounding Box mundial para análisis espacial
        const box = new THREE.Box3().setFromObject(child);
        const bottomY = box.min.y;

        // Inyectamos metadatos en userData
        child.userData = {
          id: cleanName,
          rawId: child.name,
          bottomY: bottomY, // Guardamos la altura de inicio
          requiredLevel: 1, // Se asignará en el paso de clustering
          originalPosition: child.position.clone(),
          originalMaterial: child.material, // Guardamos referencia al original sin clonar
          wasSelected: false // Caché de estado
        };

        processedMeshes.push(child);
      }
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
