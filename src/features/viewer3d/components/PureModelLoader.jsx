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

      let packClusters = [];
      
      const groupsMap = new Map();
      
      meshes.forEach(mesh => {
         const topNodeId = mesh.userData.topNodeId;
         if (!groupsMap.has(topNodeId)) {
            groupsMap.set(topNodeId, { meshes: [], box: new THREE.Box3() });
         }
         const group = groupsMap.get(topNodeId);
         group.meshes.push(mesh);
         if (!mesh.userData.packBox.isEmpty()) {
            group.box.union(mesh.userData.packBox);
         }
      });
      
      packClusters = Array.from(groupsMap.values());
      packClusters = packClusters.filter(c => c.meshes.length > 2 && !c.box.isEmpty());

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
