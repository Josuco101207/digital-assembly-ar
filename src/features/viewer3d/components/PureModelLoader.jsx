import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';

const processScene = (baseScene) => {
  if (!baseScene) return null;
  const cloned = baseScene.clone(true);
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
    }
  });
  return cloned;
};

const ObjModel = ({ url }) => {
  const objData = useLoader(OBJLoader, url);
  const scene = useMemo(() => processScene(objData), [objData]);
  return <primitive object={scene} />;
};

const GltfModel = ({ url }) => {
  const { scene: gltfScene } = useGLTF(url);
  const scene = useMemo(() => processScene(gltfScene), [gltfScene]);
  return <primitive object={scene} />;
};

export const PureModelLoader = ({ url }) => {
  if (!url) return null;
  const isObj = url.toLowerCase().includes('.obj');
  return isObj ? <ObjModel url={url} /> : <GltfModel url={url} />;
};
