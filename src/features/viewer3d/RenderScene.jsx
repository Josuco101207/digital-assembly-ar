import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Bounds, Environment, ContactShadows, Sky, PerspectiveCamera } from '@react-three/drei';
import { PureModelLoader } from './components/PureModelLoader';
import { LoadingOverlay } from './components/LoadingOverlay';

const SceneContent = ({ modelUrl, lightIntensity = 1.5 }) => {
  return (
    <>
      <ambientLight intensity={0.5 * (lightIntensity / 1.5)} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={2.5 * (lightIntensity / 1.5)}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      <Sky distance={450000} sunPosition={[10, 20, 10]} inclination={0} azimuth={0.25} />
      <Environment preset="city" environmentIntensity={lightIntensity / 1.5} />

      <Bounds fit margin={1.2}>
        <Center top>
          {modelUrl && <PureModelLoader url={modelUrl} />}
        </Center>
      </Bounds>

      <ContactShadows 
        resolution={1024} 
        scale={50} 
        blur={2} 
        opacity={0.5} 
        far={10} 
        color="#000000"
      />
    </>
  );
};

export const RenderScene = ({ modelUrl, lightIntensity }) => {
  return (
    <div className="w-full h-full bg-slate-900 relative">
      <Canvas 
        shadows
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[8, 5, 8]} fov={45} near={0.1} far={10000} />

        <Suspense fallback={<LoadingOverlay />}>
          <SceneContent modelUrl={modelUrl} lightIntensity={lightIntensity} />
        </Suspense>

        <OrbitControls 
          makeDefault 
          enableDamping 
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2} 
        />
      </Canvas>
    </div>
  );
};
