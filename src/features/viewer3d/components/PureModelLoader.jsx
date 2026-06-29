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
        clone.castShadow = false;
        clone.receiveShadow = false;
        
        // OPTIMIZATION: Downgrade to Lambert to retain shading but improve performance
        if (child.material) {
             clone.material = new THREE.MeshLambertMaterial({
                color: child.material.color,
                map: child.material.map,
                transparent: child.material.transparent,
                opacity: child.material.opacity,
                side: THREE.DoubleSide,
                name: child.material.name
             });
        }
        
        clone.matrixAutoUpdate = false;
        
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

      // 2. Scale-Independent Bimodal K-Means Clustering
      let packClusters = [];
      const nodes = meshes.map(m => {
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
          const clusterMeshes = [];
          g.forEach(n => {
              box.union(n.box);
              clusterMeshes.push(n.mesh);
          });
          return { meshes: clusterMeshes, box, center: box.getCenter(new THREE.Vector3()) };
      });

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
