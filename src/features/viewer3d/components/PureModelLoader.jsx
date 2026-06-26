import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';

export const PureModelLoader = ({ url }) => {
  const isObj = url?.toLowerCase().includes('.obj');

  // Load OBJ
  const objData = useLoader(isObj ? OBJLoader : () => null, isObj ? url : null);
  
  // Load GLTF
  const { scene: gltfScene } = useGLTF(!isObj && url ? url : '');

  const scene = useMemo(() => {
    let baseScene = null;
    
    if (isObj && objData) {
      baseScene = objData;
    } else if (!isObj && gltfScene) {
      baseScene = gltfScene;
    }

    if (!baseScene) return null;

    // Clone to avoid mutating cached geometry
    const cloned = baseScene.clone(true);

    // Center the geometry roughly and ensure shadows
    cloned.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Improve materials for realistic rendering
        if (child.material) {
           child.material.side = THREE.DoubleSide;
           if (child.material.metalness !== undefined) {
             // Make default materials look better in env light
             child.material.roughness = Math.max(0.2, child.material.roughness);
             child.material.envMapIntensity = 1.2;
             child.material.needsUpdate = true;
           }
        }
      }
    });

    return cloned;
  }, [isObj, objData, gltfScene]);

  if (!scene) return null;

  return <primitive object={scene} />;
};
