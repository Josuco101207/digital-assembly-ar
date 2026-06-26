import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';

const processScene = (baseScene, activeClusterIndex, onClustersFound) => {
  if (!baseScene) return null;
  const cloned = baseScene.clone(true);
  
  const meshes = [];
  cloned.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
         child.material.side = THREE.DoubleSide;
         if (child.material.metalness !== undefined) {
           child.material.roughness = Math.max(0.2, child.material.roughness);
           child.material.envMapIntensity = 1.2;
           child.material.needsUpdate = true;
         }
      }
      child.geometry.computeBoundingBox();
      child.userData.box = new THREE.Box3().setFromObject(child);
      meshes.push(child);
    }
  });

  if (meshes.length > 0) {
    let clusters = [];
    const DISTANCE_TOLERANCE = 100;
    
    meshes.forEach(mesh => {
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
          clusters.push({ meshes: [mesh], box: meshBox.clone() });
       }
    });

    if (clusters.length > 1) {
      clusters.sort((a,b) => b.meshes.length - a.meshes.length);
      clusters.forEach((c, idx) => {
         c.meshes.forEach(m => m.userData.clusterIndex = idx);
      });
      if (onClustersFound) {
        setTimeout(() => onClustersFound(clusters.length), 0);
      }
    }
  }

  if (activeClusterIndex !== null && activeClusterIndex !== undefined) {
     meshes.forEach(m => {
        if (m.userData.clusterIndex !== undefined) {
           m.visible = (m.userData.clusterIndex === activeClusterIndex);
        }
     });
  } else {
     meshes.forEach(m => m.visible = true);
  }

  return cloned;
};

const ObjModel = ({ url, activeClusterIndex, onClustersFound }) => {
  const objData = useLoader(OBJLoader, url);
  const scene = useMemo(() => processScene(objData, activeClusterIndex, onClustersFound), [objData, activeClusterIndex, onClustersFound]);
  return <primitive object={scene} />;
};

const GltfModel = ({ url, activeClusterIndex, onClustersFound }) => {
  const { scene: gltfScene } = useGLTF(url);
  const scene = useMemo(() => processScene(gltfScene, activeClusterIndex, onClustersFound), [gltfScene, activeClusterIndex, onClustersFound]);
  return <primitive object={scene} />;
};

export const PureModelLoader = ({ url, activeClusterIndex, onClustersFound }) => {
  if (!url) return null;
  const isObj = url.toLowerCase().includes('.obj');
  return isObj ? <ObjModel url={url} activeClusterIndex={activeClusterIndex} onClustersFound={onClustersFound} /> : <GltfModel url={url} activeClusterIndex={activeClusterIndex} onClustersFound={onClustersFound} />;
};
