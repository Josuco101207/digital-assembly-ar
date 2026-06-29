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
const defaultLambert = new THREE.MeshLambertMaterial({ color: 0xcccccc });

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
      const geometryGroups = new Map(); 
      
      // 1. Flatten the scene into a new root group to avoid hierarchy transform issues
      const flatScene = new THREE.Group();
      scene.updateMatrixWorld(true);
      
      scene.traverse((child) => {
        if (child.isMesh) {
          // OPTIMIZATION: Downgrade PBR materials to Basic for massive mobile performance boost (Potato Mode)
          if (child.material && (child.material.isMeshStandardMaterial || child.material.type === 'MeshStandardMaterial' || child.material.isMeshLambertMaterial)) {
             child.material = new THREE.MeshBasicMaterial({
                color: child.material.color,
                map: child.material.map,
                transparent: child.material.transparent,
                opacity: child.material.opacity,
                side: child.material.side,
                name: child.material.name
             });
          }
          child.castShadow = false;
          child.receiveShadow = false;
          child.matrixAutoUpdate = false; // Solo se actualiza la matriz cuando se mueve

          if (child.isLine || child.isLineLoop || child.isLineSegments || child.isPoints || child.isSprite) {
            return;
          }
  
          const n = (child.name || "").toLowerCase();
          if (n.includes('text') || n.includes('grid') || n.includes('sketch') || n.includes('boceto') || n.includes('axis') || n.includes('eje') || n.includes('annotation')) {
            return;
          }
  
          const clone = child.clone();
          child.getWorldPosition(clone.position);
          child.getWorldQuaternion(clone.quaternion);
          child.getWorldScale(clone.scale);
          
          clone.castShadow = false;
          clone.receiveShadow = false;
          clone.matrixAutoUpdate = true; // Temporarily true for packing
  
          if (clone.geometry.attributes.uv) clone.geometry.deleteAttribute('uv');
          if (clone.geometry.attributes.color) clone.geometry.deleteAttribute('color');
  
          if (clone.material) {
             if (!materialCache.has(clone.material)) {
                const baseColor = clone.material.color || new THREE.Color(0xcccccc);
                const newMat = new THREE.MeshLambertMaterial({ 
                   color: baseColor,
                   side: clone.material.side !== undefined ? clone.material.side : THREE.DoubleSide
                });
                materialCache.set(clone.material, newMat);
             }
             clone.material = materialCache.get(clone.material);
          } else {
             clone.material = defaultLambert;
          }
  
          let cleanName = child.name || "";
          cleanName = cleanName.replace(/_\d+$/, '');
          
          if (/^(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i.test(cleanName) && child.parent) {
            cleanName = child.parent.name || cleanName;
            cleanName = cleanName.replace(/_\d+$/, '');
          }
          
          cleanName = cleanName.replace(/[-_]?(Sólido|Solid|Sup|Body|Cuerpo|Mesh|Node)\s*\d*$/i, '');
          cleanName = cleanName || `Pieza_Sin_Nombre_${child.uuid ? child.uuid.substring(0,4) : ""}`;
  
          let topNode = child;
          // Subir hasta que el padre sea el 'scene' original o no tenga padre
          while (topNode.parent && topNode.parent !== scene && topNode.parent.type !== 'Scene') {
              topNode = topNode.parent;
          }
          
          clone.userData.tempName = cleanName;
          clone.userData.originalParentName = child.parent ? child.parent.name : '';
          clone.userData.topNodeId = topNode.uuid || topNode.name || 'Root';
  
          flatScene.add(clone);
          processedMeshes.push(clone);
        }
      });
  
      // 2. Density-based Spatial Clustering (Chaining-resistant)
      let packClusters = [];
      if (processedMeshes.length > 0) {
        processedMeshes.forEach(m => {
           m.updateMatrixWorld(true);
           m.userData.packBox = new THREE.Box3().setFromObject(m);
        });
  
      // 2. Scale-Independent Bimodal K-Means Clustering
      let packClusters = [];
      if (processedMeshes.length > 0) {
          const nodes = processedMeshes.map(m => {
              m.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(m);
              m.userData.packBox = box;
              return { mesh: m, center: box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()), box };
          }).filter(n => !n.box.isEmpty());

          const kMeansSplit = (group) => {
              if (group.length < 5) return [group];
              
              let maxDist = 0;
              let n1 = group[0], n2 = group[1];
              for(let i=0; i<group.length; i++) {
                  for(let j=i+1; j<group.length; j++) {
                      const d = group[i].center.distanceTo(group[j].center);
                      if (d > maxDist) { maxDist = d; n1 = group[i]; n2 = group[j]; }
                  }
              }
              
              if (maxDist === 0) return [group];

              let c1 = n1.center.clone();
              let c2 = n2.center.clone();
              let g1 = [], g2 = [];
              
              for (let iter=0; iter<10; iter++) {
                  g1 = []; g2 = [];
                  group.forEach(n => {
                      if (n.center.distanceTo(c1) < n.center.distanceTo(c2)) g1.push(n);
                      else g2.push(n);
                  });
                  if (g1.length > 0) {
                      c1.set(0,0,0);
                      g1.forEach(n => c1.add(n.center));
                      c1.divideScalar(g1.length);
                  }
                  if (g2.length > 0) {
                      c2.set(0,0,0);
                      g2.forEach(n => c2.add(n.center));
                      c2.divideScalar(g2.length);
                  }
              }
              
              if (g1.length === 0 || g2.length === 0) return [group];

              let r1 = 0, r2 = 0;
              g1.forEach(n => r1 += n.center.distanceTo(c1));
              g2.forEach(n => r2 += n.center.distanceTo(c2));
              r1 /= g1.length;
              r2 /= g2.length;
              
              const centroidDist = c1.distanceTo(c2);
              
              if (centroidDist > (r1 + r2) * 1.8) {
                  return [...kMeansSplit(g1), ...kMeansSplit(g2)];
              }
              
              return [group];
          };

          const finalGroups = kMeansSplit(nodes);
          
          packClusters = finalGroups.map(g => {
              const box = new THREE.Box3();
              const meshes = [];
              g.forEach(n => {
                  box.union(n.box);
                  meshes.push(n.mesh);
              });
              return { meshes, box, center: box.getCenter(new THREE.Vector3()) };
          });
      console.log("PACKING ALGORITHM: Detected", packClusters.length, "K-Means clusters.");

        if (packClusters.length > 1) {
          packClusters.sort((a,b) => b.meshes.length - a.meshes.length);
          let currentX = 0;
          const SPACING = 15; // 15 unidades de separación real
  
          packClusters.forEach((cluster, idx) => {
             // Calcular una caja robusta ignorando mallas absurdamente grandes (ej. líneas de construcción)
             const robustBox = new THREE.Box3();
             cluster.meshes.forEach(m => {
                const mSize = m.userData.packBox.getSize(new THREE.Vector3());
                if (mSize.x < 500 && mSize.z < 500 && mSize.y < 500) {
                   robustBox.union(m.userData.packBox);
                }
             });
             
             // Si todo es gigante, fallback a la original
             if (robustBox.isEmpty()) robustBox.copy(cluster.box);
             
             const center = robustBox.getCenter(new THREE.Vector3());
             const size = robustBox.getSize(new THREE.Vector3());
             
             if (idx === 0) {
                const shiftX = -center.x;
                const shiftZ = -center.z;
                cluster.meshes.forEach(m => {
                   m.position.x += shiftX;
                   m.position.z += shiftZ;
                   m.updateMatrixWorld(true);
                });
                currentX = (size.x / 2) + SPACING;
             } else {
                const targetX = currentX + (size.x / 2);
                const shiftX = targetX - center.x;
                const shiftZ = -center.z;
                cluster.meshes.forEach(m => {
                   m.position.x += shiftX;
                   m.position.z += shiftZ;
                   m.updateMatrixWorld(true);
                });
                currentX = targetX + (size.x / 2) + SPACING;
             }
          });
        }
      }
  
      // 3. Update signatures and standard metadata after packing
      processedMeshes.forEach(child => {
          let gSize = new THREE.Vector3();
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          child.geometry.boundingBox.getSize(gSize);
          const dims = [gSize.x, gSize.y, gSize.z].sort((a,b) => a-b);
          const sig = `${child.geometry.attributes.position.count}_${dims[0].toFixed(3)}_${dims[1].toFixed(3)}_${dims[2].toFixed(3)}`;
          
          if (!geometryGroups.has(sig)) geometryGroups.set(sig, []);
          geometryGroups.get(sig).push(child);
      });
  
      // LCP Normalization
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
  
      processedMeshes.forEach(child => {
          child.matrixAutoUpdate = false; // Freeze again
          const cleanName = child.userData.tempName;
          const box = new THREE.Box3().setFromObject(child);
          
          child.userData = {
            id: cleanName,
            rawId: child.name,
            bottomY: box.min.y,
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
          // Redondeamos con tolerancia alta (0.5) para agrupar postes cercanos en la misma línea
          const roundTo = (num, step) => Math.round(num / step) * step;
          xSet.add(roundTo(center.x, 0.5));
          zSet.add(roundTo(center.z, 0.5));
        }
      });
      
      let uniqueX = Array.from(xSet).sort((a, b) => a - b);
      let uniqueZ = Array.from(zSet).sort((a, b) => a - b);
      
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
      
      // Segundo pase: eliminar líneas demasiado cercanas entre sí (< 0.3 unidades)
      const filterClose = (arr, minDist) => {
        if (arr.length <= 1) return arr;
        const result = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
          if (arr[i] - result[result.length - 1] >= minDist) {
            result.push(arr[i]);
          }
        }
        return result;
      };
      uniqueX = filterClose(uniqueX, 0.3);
      uniqueZ = filterClose(uniqueZ, 0.3);
      
      // === ALGORITMO DE CLUSTERING GEOMÉTRICO (REUSO DE PACKING) ===
      // Ya detectamos los clusters en el paso de empacado.
      // Re-evaluamos sus bounding boxes ahora que han sido movidos.
      
      let detectedSubModels = [];
      if (packClusters.length > 1) {
         // Filtrar basura pequeña
         packClusters = packClusters.filter(c => c.meshes.length > 2);
         // Ordenar de mayor a menor
         packClusters.sort((a, b) => b.meshes.length - a.meshes.length);
         
         packClusters.forEach(c => {
             c.box = new THREE.Box3();
             c.meshes.forEach(m => c.box.expandByObject(m));
         });

         detectedSubModels = packClusters.map((c, idx) => {
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

      return { pMeshes: processedMeshes, detectedSubModels, allUniqueX: uniqueX, allUniqueZ: uniqueZ };
    }
    }
    
    return { pMeshes: [], detectedSubModels: [], allUniqueX: [], allUniqueZ: [] };
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
      const { pMeshes, detectedSubModels, allUniqueX, allUniqueZ } = memoData;
      
      const activeSub = detectedSubModels.find(s => s.id === activeSubModelId);
      const currentOpacity = useViewerStore.getState().modelOpacity;
      const isTrans = currentOpacity < 1.0;
      
      pMeshes.forEach(m => {
         if (activeSub) {
            m.visible = (m.userData.subModelId === activeSub.id);
         } else {
            m.visible = true;
         }
         
         // Apply transparency
         if (m.material) {
            m.material.transparent = isTrans;
            m.material.opacity = currentOpacity;
            m.material.needsUpdate = true;
         }
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
      
      meshesRef.current = pMeshes;
  }, [memoData, activeSubModelId, modelOpacity]);

  // Instanciamos un solo vector temporal fuera del loop para evitar Garbage Collection
  const _tempVec = new THREE.Vector3();

  // Loop de Animación de Alto Rendimiento (60 FPS)
  useFrame((state, delta) => {
    meshesRef.current.forEach((mesh) => {
      const isVisibleInAssembly = assemblyLevel >= mesh.userData.requiredLevel;
      const currentActiveSubModel = useViewerStore.getState().activeSubModelId;
      const isVisibleInSubModel = currentActiveSubModel ? (mesh.userData.subModelId === currentActiveSubModel) : true;
      const shouldBeVisible = isVisibleInAssembly && isVisibleInSubModel;
      
      // Reutilizamos el vector en lugar de usar .clone() que mata la memoria
      _tempVec.copy(mesh.userData.originalPosition);
      if (isExploded) {
        // Expandimos radialmente pero solo en X y Z para no arruinar el sorting Y
        _tempVec.x *= 1.5; 
        _tempVec.z *= 1.5;
      }

      if (shouldBeVisible) {
        mesh.visible = true;
        if (mesh.position.distanceToSquared(_tempVec) > 0.0001) {
          mesh.position.lerp(_tempVec, delta * 5);
          mesh.updateMatrix();
        } else {
          if (mesh.position.distanceToSquared(_tempVec) > 0) {
            mesh.position.copy(_tempVec); // Fijar si ya llegó
            mesh.updateMatrix();
          }
        }
      } else {
        mesh.visible = false;
        // La pieza espera arriba en el aire
        _tempVec.y += 10;
        if (mesh.position.distanceToSquared(_tempVec) > 0) {
          mesh.position.copy(_tempVec);
          mesh.updateMatrix();
        }
      }

      // 3. Feedback Visual de Selección OPTIMIZADO con Distinción Principal/Secundaria
      const isSelectedGroup = selectedPartId === mesh.userData.id;
      const isSelectedPrimary = selectedMeshUuid === mesh.uuid;
      
      let selectionState = 0; // 0: Normal, 1: Grupo (Secundario), 2: Principal (Clickeado)
      if (isSelectedPrimary) selectionState = 2;
      else if (isSelectedGroup) selectionState = 1;
      
      // Solo hacer el cambio de material si el estado acaba de cambiar
      if (selectionState !== mesh.userData.selectionState) {
        mesh.userData.selectionState = selectionState;
        
        if (selectionState === 2 && mesh.userData.originalMaterial) {
          // Principal: Amarillo Neón (Muy fuerte)
          if (!mesh.userData.primaryMaterial) {
            mesh.userData.primaryMaterial = mesh.userData.originalMaterial.clone();
            mesh.userData.primaryMaterial.emissive = new THREE.Color(0xfacc15); // Amarillo brillante
            mesh.userData.primaryMaterial.emissiveIntensity = 0.9;
          }
          mesh.material = mesh.userData.primaryMaterial;
        } else if (selectionState === 1 && mesh.userData.originalMaterial) {
          // Grupo (Idénticos): Cian Fuerte (Muy visible)
          if (!mesh.userData.groupMaterial) {
            mesh.userData.groupMaterial = mesh.userData.originalMaterial.clone();
            mesh.userData.groupMaterial.emissive = new THREE.Color(0x06b6d4); // Cian vibrante
            mesh.userData.groupMaterial.emissiveIntensity = 0.7; // Subimos la intensidad para que sea súper visible
          }
          mesh.material = mesh.userData.groupMaterial;
        } else {
          // Normal
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  });

  // Delegación de eventos R3F: intercepta el click del objeto intersectado
  const handleClick = (e) => {
    e.stopPropagation(); // Evita clics a través de la geometría
    if (e.object && e.object.userData.id) {
      setSelectedPartId(e.object.userData.id, e.object.uuid);
    }
  };

  const handlePointerMissed = () => {
    setSelectedPartId(null, null);
  };

  return (
    <group dispose={null} onClick={handleClick} onPointerMissed={handlePointerMissed}>
      {memoData.pMeshes.map((mesh) => (
         <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
};
