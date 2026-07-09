import React, { useEffect, useRef, useMemo } from 'react';
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
const defaultStandard = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.6 });

const ModelCore = ({ scene }) => {
  const selectedPartId = useViewerStore((state) => state.selectedPartId);
  const selectedMeshUuid = useViewerStore((state) => state.selectedMeshUuid);
  const setSelectedPartId = useViewerStore((state) => state.setSelectedPartId);
  const assemblyLevel = useViewerStore((state) => state.assemblyLevel);
  const setMaxAssemblyLevel = useViewerStore((state) => state.setMaxAssemblyLevel);
  // Escuchamos el estado de explosión directamente
  const isExploded = useViewerStore((state) => state.isExploded);
  const modelOpacity = useViewerStore((state) => state.modelOpacity);

  // Referencia mutable para iterar meshes eficientemente en useFrame sin re-renderizar
  const meshesRef = useRef([]);
  const centroidRef = useRef(new THREE.Vector3());


  // Aplicar opacidad al cambiar el slider
  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      const isTrans = modelOpacity < 1.0;
      const setOpacity = (mat) => {
        if (!mat) return;
        mat.transparent = isTrans;
        mat.opacity = modelOpacity;
        mat.needsUpdate = true;
      };
      setOpacity(mesh.userData.originalMaterial);
      setOpacity(mesh.userData.primaryMaterial);
      setOpacity(mesh.userData.groupMaterial);
      setOpacity(mesh.material);
    });
  }, [modelOpacity]);

  const memoData = useMemo(() => {
    const processedMeshes = [];
    const geometryGroups = new Map(); // Para LCP
    
    // Recorremos la escena original del GLB/GLTF
    scene.traverse((child) => {
      // 1. Limpieza visual: Ocultar líneas, puntos, bocetos y grillas de Inventor
      if (child.isLine || child.isLineLoop || child.isLineSegments || child.isPoints || child.isSprite) {
        child.visible = false;
        return;
      }

      if (child.isMesh) {
        child.matrixAutoUpdate = false;
        // Ocultar mallas que sean claramente textos o grillas por nombre
        const n = (child.name || "").toLowerCase();
        if (n.includes('text') || n.includes('grid') || n.includes('sketch') || n.includes('boceto') || n.includes('axis') || n.includes('eje') || n.includes('annotation')) {
          child.visible = false;
          return;
        }

        // Desactivamos sombras individuales para piezas pequeñas para no saturar la GPU en tablets
        child.castShadow = false;
        child.receiveShadow = false;

        // Optimizaciones de Memoria Extremas para Tablets
        if (child.geometry.attributes.uv) child.geometry.deleteAttribute('uv');
        if (child.geometry.attributes.color) child.geometry.deleteAttribute('color');

        if (child.material) {
           if (!materialCache.has(child.material)) {
              const baseColor = child.material.color || new THREE.Color(0x333333);
              const newMat = new THREE.MeshStandardMaterial({ 
                 color: baseColor,
                 roughness: 0.4,
                 metalness: 0.6,
                 side: child.material.side !== undefined ? child.material.side : THREE.DoubleSide
              });
              materialCache.set(child.material, newMat);
           }
           child.material = materialCache.get(child.material);
        } else {
           child.material = defaultStandard;
        }

        // LIMPIEZA DE SUFIJOS BÁSICA
        let cleanName = child.name || "";
        cleanName = cleanName.replace(/_\d+$/, '');
        
        if (/^(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i.test(cleanName) && child.parent) {
          cleanName = child.parent.name || cleanName;
          cleanName = cleanName.replace(/_\d+$/, '');
        }
        
        cleanName = cleanName.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');
        
        cleanName = cleanName || `Pieza_Sin_Nombre_${child.uuid ? child.uuid.substring(0,4) : ""}`;

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
      
      let currentLevel = 0;

      processedMeshes.forEach((mesh) => {
        currentLevel++;
        mesh.userData.requiredLevel = currentLevel;
      });

      // Actualizar el UI para mostrar exactamente cuántos niveles se detectaron
      setMaxAssemblyLevel(currentLevel);
      useViewerStore.getState().setAssemblyLevel(currentLevel);
      
      // === EXTRACCIÓN DE POSTES PARA LA CUADRÍCULA ===
      const rawX = [];
      const rawZ = [];
      
      processedMeshes.forEach(m => {
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        
        // Heurística: Un "poste" es significativamente más alto (Y) que ancho (X) y profundo (Z)
        if (size.y > size.x * 2 && size.y > size.z * 2) {
          const center = box.getCenter(new THREE.Vector3());
          rawX.push(center.x);
          rawZ.push(center.z);
        }
      });

      // Función para agrupar (1D clustering) y sacar el promedio exacto
      const cluster1D = (arr, tolerance) => {
         if (arr.length === 0) return [];
         arr.sort((a, b) => a - b);
         const clusters = [];
         let currentCluster = [arr[0]];
         
         for (let i = 1; i < arr.length; i++) {
            if (arr[i] - currentCluster[currentCluster.length - 1] <= tolerance) {
               currentCluster.push(arr[i]);
            } else {
               const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
               clusters.push(avg);
               currentCluster = [arr[i]];
            }
         }
         const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
         clusters.push(avg);
         return clusters;
      };

      let uniqueX = cluster1D(rawX, 0.3);
      let uniqueZ = cluster1D(rawZ, 0.3);
      
      // Fallback si la heurística no encuentra postes (ensamble raro)
      if (uniqueX.length === 0 || uniqueZ.length === 0) {
        // Usar los extremos del bounding box global en lugar de todas las piezas
        const globalBox = new THREE.Box3();
        processedMeshes.forEach(m => globalBox.expandByObject(m));
        const gMin = globalBox.min;
        const gMax = globalBox.max;
        // Crear solo 4-6 líneas de referencia equidistantes
        const xSteps = 5;
        const zSteps = 5;
        uniqueX = [];
        uniqueZ = [];
        for (let i = 0; i <= xSteps; i++) uniqueX.push(gMin.x + (gMax.x - gMin.x) * i / xSteps);
        for (let i = 0; i <= zSteps; i++) uniqueZ.push(gMin.z + (gMax.z - gMin.z) * i / zSteps);
      }
      
      // === ALGORITMO DE CLUSTERING GEOMÉTRICO (DISTANCIA 3D) ===
      // Pre-calcular cajas para cada malla y calcular tamaño global
      const globalBox = new THREE.Box3();
      processedMeshes.forEach(m => {
          m.userData.box = new THREE.Box3().setFromObject(m);
          if (!m.userData.box.isEmpty()) {
              globalBox.expandByObject(m);
          }
      });

      const centroid = new THREE.Vector3();
      globalBox.getCenter(centroid);

      const globalSize = globalBox.getSize(new THREE.Vector3());
      // Tolerancia dinámica: 5% del tamaño máximo del ensamblaje, mínimo 0.5 unidades
      const DISTANCE_TOLERANCE = Math.max(Math.max(globalSize.x, globalSize.y, globalSize.z) * 0.05, 0.5);

      let clusters = [];

      processedMeshes.forEach(mesh => {
         const meshBox = mesh.userData.box;
         if (meshBox.isEmpty()) return;

         const expandedBox = meshBox.clone().expandByScalar(DISTANCE_TOLERANCE);
         const overlappingClusters = clusters.filter(c => c.box.intersectsBox(expandedBox));
         
         if (overlappingClusters.length > 0) {
            const mainCluster = overlappingClusters[0];
            mainCluster.meshes.push(mesh);
            mainCluster.box.union(meshBox);
            
            for (let i = 1; i < overlappingClusters.length; i++) {
               mainCluster.meshes.push(...overlappingClusters[i].meshes);
               mainCluster.box.union(overlappingClusters[i].box);
               clusters = clusters.filter(c => c !== overlappingClusters[i]);
            }
         } else {
            clusters.push({
               meshes: [mesh],
               box: meshBox.clone()
            });
         }
      });
      
      // Filtrar clusters muy pequeños (basura/outliers de sketchup)
      clusters = clusters.filter(c => c.meshes.length > 2);
      
      // Ordenar clusters por cantidad de mallas de mayor a menor (los más grandes primero)
      clusters.sort((a, b) => b.meshes.length - a.meshes.length);

      let detectedSubModels = [];
      if (clusters.length > 1) {
         detectedSubModels = clusters.map((c, idx) => {
            // Asignar ID a las mallas de este cluster
            c.meshes.forEach(m => m.userData.subModelId = `sub_${idx}`);
            return {
               id: `sub_${idx}`,
               name: `Módulo ${idx + 1} (${c.meshes.length} pzs)`,
               box: c.box,
               minX: c.box.min.x,
               maxX: c.box.max.x,
               minZ: c.box.min.z,
               maxZ: c.box.max.z
            }
         });
      }
      
      // Store on memo for useEffect
      processedMeshes.forEach(m => {
          m.userData.originalParent = m.parent;
          m.userData.box = new THREE.Box3().setFromObject(m);
      });

      // === INSTANCED MESH GENERATION ===
      const instancedMeshes = [];
      geometryGroups.forEach((meshes, sig) => {
          const baseMesh = meshes[0];
          // Material base blanco para que setColorAt funcione correctamente
          const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.6 });
          const im = new THREE.InstancedMesh(baseMesh.geometry, baseMaterial, meshes.length);
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          
          meshes.forEach((mesh, index) => {
              mesh.userData.im = im;
              mesh.userData.instanceId = index;
              
              mesh.updateWorldMatrix(true, false);
              im.setMatrixAt(index, mesh.matrixWorld);
              
              const color = mesh.material && mesh.material.color ? mesh.material.color : new THREE.Color(0x333333);
              im.setColorAt(index, color);
              
              mesh.visible = false; // El original no se dibuja
          });
          
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.userData.instances = meshes;
          
          // Sombras off
          im.castShadow = false;
          im.receiveShadow = false;
          
          instancedMeshes.push(im);
      });

      return { pMeshes: processedMeshes, detectedSubModels, allUniqueX: uniqueX, allUniqueZ: uniqueZ, instancedMeshes, centroid };
    }
    
    return { pMeshes: [], detectedSubModels: [], allUniqueX: [], allUniqueZ: [], instancedMeshes: [], centroid: new THREE.Vector3() };
  }, [scene]);

  const activeSubModelId = useViewerStore(state => state.activeSubModelId);
  const subModels = useViewerStore(state => state.subModels);

  // Sync detected submodels to store ONCE when model loads
  useEffect(() => {
     if (memoData && memoData.detectedSubModels.length > 0) {
        useViewerStore.getState().setSubModels(memoData.detectedSubModels);
        useViewerStore.getState().setActiveSubModelId(memoData.detectedSubModels[0].id);
     } else {
        useViewerStore.getState().setSubModels([]);
        useViewerStore.getState().setActiveSubModelId(null);
     }
  }, [memoData]);

  // Filter meshes whenever active submodel changes
  useEffect(() => {
      if (!memoData || memoData.pMeshes.length === 0) return;
      const { pMeshes, detectedSubModels, allUniqueX, allUniqueZ, instancedMeshes, centroid } = memoData;
      
      if (centroid) centroidRef.current.copy(centroid);
      
      const activeSub = detectedSubModels.find(s => s.id === activeSubModelId);
      
      pMeshes.forEach(m => {
         let isVisibleInSubmodel = true;
         if (activeSub && m.userData.subModelId !== activeSub.id) {
             isVisibleInSubmodel = false;
         }
         
         m.userData.isVisibleInSubmodel = isVisibleInSubmodel;
         m.userData.isSleeping = false; // Despertar para aplicar escala
      });
      
      if (activeSub) {
         // Generar grid local para el submodelo
         const stepX = (activeSub.maxX - activeSub.minX) / 5;
         const stepZ = (activeSub.maxZ - activeSub.minZ) / 5;
         const subX = [];
         const subZ = [];
         for(let i=0; i<=5; i++) subX.push(activeSub.minX + stepX * i);
         for(let i=0; i<=5; i++) subZ.push(activeSub.minZ + stepZ * i);
         
         useViewerStore.getState().setGridLines({ x: subX, z: subZ });
      } else {
         useViewerStore.getState().setGridLines({ x: allUniqueX, z: allUniqueZ });
      }

      // Aplicar la opacidad almacenada en el estado a los nuevos materiales de InstancedMesh
      const currentOpacity = useViewerStore.getState().modelOpacity;
      const isTrans = currentOpacity < 1.0;
      instancedMeshes.forEach(im => {
         im.material.transparent = isTrans;
         im.material.opacity = currentOpacity;
         im.material.needsUpdate = true;
      });

      meshesRef.current = pMeshes;
  }, [memoData, activeSubModelId, modelOpacity]);

  const splitRequest = useViewerStore(state => state.splitRequest);

  useEffect(() => {
    if (splitRequest && meshesRef.current.length > 0) {
      const newIds = [];
      let index = 1;
      meshesRef.current.forEach(m => {
        if (m.userData.id === splitRequest) {
          const newId = `${m.userData.id}_#${index}`;
          m.userData.id = newId;
          m.userData.selectionState = 0; // Reset visual state
          const c = m.userData.originalMaterial && m.userData.originalMaterial.color ? m.userData.originalMaterial.color : new THREE.Color(0x333333);
          m.userData.im.setColorAt(m.userData.instanceId, c);
          m.userData.im.instanceColor.needsUpdate = true;
          newIds.push(newId);
          index++;
        }
      });
      if (newIds.length > 0) {
        useViewerStore.getState().applySplitToBOM(splitRequest, newIds);
      }
    }
  }, [splitRequest]);

  // Efecto para "despertar" las piezas cuando cambia la animación o la selección
  useEffect(() => {
    meshesRef.current.forEach(mesh => {
      mesh.userData.isSleeping = false;
    });
  }, [assemblyLevel, isExploded, selectedPartId, selectedMeshUuid]);

  // Instanciamos un solo vector temporal fuera del loop para evitar Garbage Collection
  const _tempVec = new THREE.Vector3();

  // Loop de Animación de Alto Rendimiento (60 FPS)
  useFrame((state, delta) => {
    let matricesNeedUpdate = new Set();
    let colorsNeedUpdate = new Set();

    meshesRef.current.forEach((mesh) => {
      // Modo hibernación para no matar la batería/CPU de la tablet si ya llegó a su sitio
      if (mesh.userData.isSleeping) return;

      // 1. Lógica de Secuencia de Armado (Caída en Y)
      const isVisible = (assemblyLevel >= mesh.userData.requiredLevel) && (mesh.userData.isVisibleInSubmodel !== false);
      
      // Reutilizamos el vector en lugar de usar .clone() que mata la memoria
      _tempVec.copy(mesh.userData.originalPosition);
      if (isExploded) {
        // Calculamos la dirección desde el centroide y aplicamos el factor de explosión (2.0)
        _tempVec.sub(centroidRef.current);
        _tempVec.multiplyScalar(2.0);
        _tempVec.add(centroidRef.current);
      }

      if (isVisible) {
        // Recuperar el tamaño normal
        if (mesh.scale.x < 1.0) {
            // Asegurar que si estaban en 0, empiecen desde arriba para la animación de caída
            if (mesh.scale.x === 0) {
                mesh.position.copy(_tempVec);
                mesh.position.y += 10;
            }
            mesh.scale.set(1, 1, 1);
        }
        
        const dist = mesh.position.distanceToSquared(_tempVec);
        if (dist > 0.0001) {
          mesh.position.lerp(_tempVec, delta * 5);
          mesh.updateWorldMatrix(true, false);
          mesh.userData.im.setMatrixAt(mesh.userData.instanceId, mesh.matrixWorld);
          matricesNeedUpdate.add(mesh.userData.im);
        } else {
          if (dist > 0) {
            mesh.position.copy(_tempVec); // Fijar si ya llegó
            mesh.updateWorldMatrix(true, false);
            mesh.userData.im.setMatrixAt(mesh.userData.instanceId, mesh.matrixWorld);
            matricesNeedUpdate.add(mesh.userData.im);
          }
          // ¡Llegó a su destino! Poner a dormir la pieza
          mesh.userData.isSleeping = true;
        }
      } else {
        // Ocultar la pieza si no pertenece al paso actual
        if (mesh.scale.x > 0) {
           mesh.scale.set(0, 0, 0); 
           mesh.updateWorldMatrix(true, false);
           mesh.userData.im.setMatrixAt(mesh.userData.instanceId, mesh.matrixWorld);
           matricesNeedUpdate.add(mesh.userData.im);
        }
        mesh.userData.isSleeping = true;
      }

      // 3. Feedback Visual de Selección OPTIMIZADO (usando setColorAt en InstancedMesh)
      const isSelectedGroup = selectedPartId === mesh.userData.id;
      const isSelectedPrimary = selectedMeshUuid === mesh.uuid;
      
      let selectionState = 0; // 0: Normal, 1: Grupo (Secundario), 2: Principal (Clickeado)
      if (isSelectedPrimary) selectionState = 2;
      else if (isSelectedGroup) selectionState = 1;
      
      // Solo hacer el cambio de color si el estado acaba de cambiar
      if (selectionState !== mesh.userData.selectionState) {
        mesh.userData.selectionState = selectionState;
        
        let targetColor = mesh.userData.originalMaterial && mesh.userData.originalMaterial.color 
            ? mesh.userData.originalMaterial.color 
            : new THREE.Color(0x333333);
            
        if (selectionState === 2) {
            targetColor = new THREE.Color(0xfacc15); // Amarillo vibrante
        } else if (selectionState === 1) {
            targetColor = new THREE.Color(0x06b6d4); // Cian vibrante
        }
        
        mesh.userData.im.setColorAt(mesh.userData.instanceId, targetColor);
        colorsNeedUpdate.add(mesh.userData.im);
      }
    });

    // Subir a la GPU las matrices y colores que cambiaron en este frame
    matricesNeedUpdate.forEach(im => im.instanceMatrix.needsUpdate = true);
    colorsNeedUpdate.forEach(im => im.instanceColor.needsUpdate = true);
  });

  // Delegación de eventos R3F: intercepta el click del objeto intersectado
  const handleClick = (e) => {
    // Si el usuario movió el ratón/dedo más de 2 píxeles, fue un arrastre (paneo/rotación), NO un clic.
    if (e.delta > 2) return; 

    e.stopPropagation(); // Evita clics a través de la geometría
    if (e.instanceId !== undefined && e.object.userData.instances) {
      const originalMesh = e.object.userData.instances[e.instanceId];
      if (originalMesh && originalMesh.userData.id) {
        setSelectedPartId(originalMesh.userData.id, originalMesh.uuid);
      }
    } else if (e.object && e.object.userData.id) {
      // Fallback por si acaso
      setSelectedPartId(e.object.userData.id, e.object.uuid);
    }
  };

  const handlePointerMissed = () => {
    setSelectedPartId(null, null);
  };

  return (
    <group>
      <primitive object={scene} visible={true} /> 
      {memoData && memoData.instancedMeshes && memoData.instancedMeshes.map((im, idx) => (
         <primitive 
           key={`im_${idx}`} 
           object={im} 
           onClick={handleClick}
           onPointerMissed={handlePointerMissed}
         />
      ))}
    </group>
  );
};
