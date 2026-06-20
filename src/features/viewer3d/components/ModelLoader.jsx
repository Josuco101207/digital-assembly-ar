import React, { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useViewerStore } from '../../../store/useViewerStore';
import * as THREE from 'three';

// Justificación Arquitectónica: Cargador dinámico de modelos GLTF/GLB.
// En lugar de mapear nodos a componentes React (lo cual es lento con ensambles gigantes),
// procesamos el árbol completo de Three.js (scene.traverse) una sola vez al inicio.
// El evento onClick se inyecta en el <primitive> raíz, permitiendo que R3F maneje la delegación.

export const ModelLoader = ({ url }) => {
  const { scene } = useGLTF(url);
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
        // Mejoramos calidad visual de fábrica
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Clonamos material para evitar que el hover en una pieza afecte a instancias idénticas
        if (child.material) {
          child.material = child.material.clone();
        }

        // Computar Bounding Box mundial para análisis espacial
        const box = new THREE.Box3().setFromObject(child);
        const bottomY = box.min.y;

        // LIMPIEZA DE SUFIJOS
        let cleanName = child.name.replace(/_\d+$/, '');
        const lastDashIndex = cleanName.lastIndexOf('-');
        if (lastDashIndex > 0) {
          cleanName = cleanName.substring(0, lastDashIndex);
        }

        // Inyectamos metadatos en userData
        child.userData = {
          id: cleanName,
          rawId: child.name,
          bottomY: bottomY, // Guardamos la altura de inicio
          requiredLevel: 1, // Se asignará en el paso de clustering
          originalEmissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
          originalPosition: child.position.clone()
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

  // Loop de Animación de Alto Rendimiento (60 FPS)
  useFrame((state, delta) => {
    meshesRef.current.forEach((mesh) => {
      // 1. Lógica de Secuencia de Armado (Caída en Y)
      const isVisible = assemblyLevel >= mesh.userData.requiredLevel;
      
      const targetPos = mesh.userData.originalPosition.clone();
      if (isExploded) {
        // Expandimos radialmente
        targetPos.multiplyScalar(2.0); 
      }

      if (isVisible) {
        mesh.visible = true;
        mesh.position.lerp(targetPos, delta * 5); // Cae hacia su posición objetivo
      } else {
        mesh.visible = false;
        // La pieza espera arriba en el aire
        targetPos.y += 10;
        // Forzamos la posición inicial para que cuando se vuelva visible, empiece desde arriba
        mesh.position.copy(targetPos);
      }
      
      // Mantenemos la escala siempre en 1
      mesh.scale.setScalar(1);

      // (Lógica de Despiece ya cubierta en el bloque anterior)

      // 3. Feedback Visual de Selección
      const isSelected = selectedPartId === mesh.userData.id;
      if (isSelected && mesh.material) {
        mesh.material.emissive.setHex(0x0ea5e9); // Industrial Accent
        mesh.material.emissiveIntensity = 0.5;
      } else if (mesh.material) {
        mesh.material.emissive.copy(mesh.userData.originalEmissive);
        mesh.material.emissiveIntensity = 0;
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
