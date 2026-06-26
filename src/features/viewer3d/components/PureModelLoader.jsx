import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export const PureModelLoader = ({ url }) => {
  const { scene } = useGLTF(url);
  
  const packedMeshes = useMemo(() => {
    if (!scene) return [];
    
    // 1. Flatten the scene
    const flatScene = new THREE.Group();
    scene.updateMatrixWorld(true);
    
    const meshes = [];
    scene.traverse((child) => {
      if (child.isLine || child.isLineLoop || child.isLineSegments || child.isPoints || child.isSprite) {
        return;
      }
      
      if (child.isMesh) {
        const n = (child.name || "").toLowerCase();
        if (n.includes('text') || n.includes('grid') || n.includes('sketch') || n.includes('boceto') || n.includes('axis') || n.includes('eje') || n.includes('annotation')) {
          return;
        }

        const clone = child.clone();
        child.getWorldPosition(clone.position);
        child.getWorldQuaternion(clone.quaternion);
        child.getWorldScale(clone.scale);
        
        clone.castShadow = true;
        clone.receiveShadow = true;
        clone.matrixAutoUpdate = true;

        if (clone.material) {
           clone.material.side = THREE.DoubleSide;
           if (clone.material.metalness !== undefined) {
             clone.material.roughness = Math.max(0.2, clone.material.roughness);
             clone.material.envMapIntensity = 1.2;
             clone.material.needsUpdate = true;
           }
        }
        
        let topNode = child;
        while (topNode.parent && topNode.parent !== scene && topNode.parent.type !== 'Scene') {
            topNode = topNode.parent;
        }
        clone.userData.topNodeId = topNode.uuid || topNode.name || 'Root';
        
        flatScene.add(clone);
        meshes.push(clone);
      }
    });

    // 2. Spatial Clustering & Packing
    if (meshes.length > 0) {
      meshes.forEach(m => {
         m.updateMatrixWorld(true);
         m.userData.packBox = new THREE.Box3().setFromObject(m);
      });

      // 2. Density-based Spatial Clustering (Chaining-resistant)
      let packClusters = [];
      
      const CORE_TOLERANCE = 15;
      let cores = [];
      meshes.forEach(mesh => {
         const meshBox = mesh.userData.packBox;
         if (meshBox.isEmpty()) return;
         const size = meshBox.getSize(new THREE.Vector3());
         if (size.x > 400 || size.z > 400) return;

         const expandedBox = meshBox.clone().expandByScalar(CORE_TOLERANCE);
         const overlapping = cores.filter(c => c.box.intersectsBox(expandedBox));
         
         if (overlapping.length > 0) {
            const main = overlapping[0];
            main.meshes.push(mesh);
            main.box.union(meshBox);
            for (let i = 1; i < overlapping.length; i++) {
               main.meshes.push(...overlapping[i].meshes);
               main.box.union(overlapping[i].box);
               cores = cores.filter(c => c !== overlapping[i]);
            }
         } else {
            cores.push({ meshes: [mesh], box: meshBox.clone() });
         }
      });

      let solidCores = cores.filter(c => c.meshes.length > 10);
      if (solidCores.length === 0) solidCores = [cores.sort((a,b)=>b.meshes.length - a.meshes.length)[0]];

      const MERGE_TOLERANCE = 250; 
      let mainClusters = [];
      solidCores.forEach(core => {
         const expandedBox = core.box.clone().expandByScalar(MERGE_TOLERANCE);
         const overlapping = mainClusters.filter(c => c.box.intersectsBox(expandedBox));
         if (overlapping.length > 0) {
            const main = overlapping[0];
            main.meshes.push(...core.meshes);
            main.box.union(core.box);
            for (let i = 1; i < overlapping.length; i++) {
               main.meshes.push(...overlapping[i].meshes);
               main.box.union(overlapping[i].box);
               mainClusters = mainClusters.filter(c => c !== overlapping[i]);
            }
         } else {
            mainClusters.push({ meshes: [...core.meshes], box: core.box.clone() });
         }
      });

      mainClusters.forEach(c => c.center = c.box.getCenter(new THREE.Vector3()));
      
      let finalClusters = mainClusters.map(c => ({ meshes: [], box: new THREE.Box3(), center: c.center }));
      
      meshes.forEach(mesh => {
          if (mesh.userData.packBox.isEmpty()) return;
          const center = mesh.userData.packBox.getCenter(new THREE.Vector3());
          
          let minDist = Infinity;
          let bestCluster = finalClusters[0];
          
          finalClusters.forEach(c => {
              const dist = center.distanceTo(c.center);
              if (dist < minDist) {
                  minDist = dist;
                  bestCluster = c;
              }
          });
          
          bestCluster.meshes.push(mesh);
          bestCluster.box.union(mesh.userData.packBox);
      });
      
      packClusters = finalClusters;

      if (packClusters.length > 1) {
        packClusters.sort((a,b) => b.meshes.length - a.meshes.length);
        let currentX = 0;
        const SPACING = 15;

        packClusters.forEach((cluster, idx) => {
           const robustBox = new THREE.Box3();
           cluster.meshes.forEach(m => {
              const mSize = m.userData.packBox.getSize(new THREE.Vector3());
              if (mSize.x < 500 && mSize.z < 500 && mSize.y < 500) {
                 robustBox.union(m.userData.packBox);
              }
           });
           
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
    
    meshes.forEach(m => m.matrixAutoUpdate = false);
    return meshes;
  }, [scene]);

  return (
    <group dispose={null}>
      {packedMeshes.map(mesh => (
         <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
};
