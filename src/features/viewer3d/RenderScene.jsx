import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Bounds, Sky, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { PureModelLoader } from './components/PureModelLoader';
import { LoadingOverlay } from './components/LoadingOverlay';

const SceneContent = ({ modelUrl, lightIntensity = 1.5, activeClusterIndex, onClustersFound }) => {
  return (
    <>
      <ambientLight intensity={0.5 * (lightIntensity / 1.5)} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={lightIntensity} 
        castShadow 
        shadow-mapSize-width={1024} // Optimizado de 2048 a 1024
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001} // Optimización de sombras
      />
      
      <Sky distance={450000} sunPosition={[10, 20, 10]} inclination={0} azimuth={0.25} />
      <Environment preset="city" environmentIntensity={lightIntensity / 1.5} />

      <Bounds key={activeClusterIndex ?? 'all'} fit margin={1.2}>
        <Center top>
          {modelUrl && (
            <PureModelLoader 
              url={modelUrl} 
              activeClusterIndex={activeClusterIndex} 
              onClustersFound={onClustersFound} 
            />
          )}
        </Center>
      </Bounds>

      <ContactShadows 
        position={[0, 0, 0]} 
        opacity={0.7} 
        scale={20} 
        blur={1.5} 
        far={10} 
        resolution={512} 
        color="#000000" 
      />
    </>
  );
};

export const RenderScene = ({ modelUrl, lightIntensity, activeClusterIndex, onClustersFound }) => {
  return (
    <div className="w-full h-full bg-slate-900 relative">
      <Canvas 
        shadows 
        dpr={[1, 1.5]} // Ligeramente bajado para más FPS en render mode
        frameloop="demand" // Optimización crucial: solo renderiza si cambia la cámara
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" }} 
      >
        <PerspectiveCamera makeDefault position={[8, 5, 8]} fov={45} near={0.1} far={10000} />

        <Suspense fallback={<LoadingOverlay />}>
          <SceneContent 
            modelUrl={modelUrl} 
            lightIntensity={lightIntensity} 
            activeClusterIndex={activeClusterIndex}
            onClustersFound={onClustersFound}
          />
        </Suspense>

        <OrbitControls 
          makeDefault 
          enableDamping={true}
          dampingFactor={0.05}
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 + 0.1} // No ir mucho más abajo del suelo
          rotateSpeed={0.6}
          panSpeed={0.6}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  );
};
