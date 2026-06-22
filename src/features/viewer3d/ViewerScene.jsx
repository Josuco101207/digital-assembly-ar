import React, { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Center, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { ARButton, XR, useXR, useHitTest, Interactive } from '@react-three/xr';
import { ModelLoader } from './components/ModelLoader';
import { LoadingOverlay } from './components/LoadingOverlay';
import { CoordinateGrid } from './components/CoordinateGrid';

// Justificación Arquitectónica: Delegamos la complejidad de la carga y animación
// a los nuevos componentes. El Scene queda limpio y se enfoca solo en iluminación, 
// cámara y orquestación del Canvas.

import { useViewerStore } from '../../store/useViewerStore';

const SceneContent = ({ modelUrl }) => {
  const { isPresenting, session } = useXR();
  const arScale = useViewerStore((state) => state.arScale);
  
  const [placement, setPlacement] = useState(null); // Guardará la matriz (posición/rotación) cuando el usuario toque la pantalla
  const reticleRef = useRef();

  // Hit-Test: Escanea el piso constantemente para actualizar el círculo blanco
  useHitTest((hitMatrix) => {
    if (reticleRef.current) {
      hitMatrix.decompose(
        reticleRef.current.position,
        reticleRef.current.quaternion,
        reticleRef.current.scale
      );
    }
  });

  // Cuando el usuario toca la pantalla, capturamos la posición del reticle
  const handleSelect = () => {
    if (reticleRef.current && isPresenting) {
      setPlacement({
        position: [reticleRef.current.position.x, reticleRef.current.position.y, reticleRef.current.position.z],
        rotation: [reticleRef.current.rotation.x, reticleRef.current.rotation.y, reticleRef.current.rotation.z]
      });
    }
  };

  // En AR (Realidad Aumentada): 
  if (isPresenting) {
    return (
      <>
        {/* Capturamos el tap en cualquier lado del entorno usando Interactive de WebXR */}
        <Interactive onSelect={handleSelect}>
          {/* Si ya tenemos el placement, mostramos el modelo en esa ubicación exacta.
              Si no lo tenemos, mostramos el reticle para que el usuario escoja el piso. */}
          {placement ? (
            <group position={placement.position} rotation={placement.rotation} scale={arScale}>
              <ambientLight intensity={1} />
              <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
              <CoordinateGrid />
              <Center top>
                {modelUrl && <ModelLoader url={modelUrl} />}
              </Center>
            </group>
          ) : (
            <mesh ref={reticleRef} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[0.1, 0.15, 32]} />
              <meshBasicMaterial color="white" transparent opacity={0.8} />
            </mesh>
          )}
        </Interactive>
      </>
    );
  }

  // Vista 3D normal en pantalla: Usamos Stage para mejor iluminación y auto-encuadre
  return (
    <Stage environment="city" intensity={0.5} adjustCamera={false}>
      <CoordinateGrid />
      <Center top>
        {modelUrl && <ModelLoader url={modelUrl} />}
      </Center>
    </Stage>
  );
};

export const ViewerScene = () => {
  const modelUrl = useViewerStore((state) => state.modelUrl);

  return (
    <div className="w-full h-full bg-industrial-base relative">
      <ARButton 
        sessionInit={{ 
          requiredFeatures: [], 
          optionalFeatures: ['dom-overlay', 'hit-test', 'local-floor'] 
        }}
        style={{ 
          position: 'absolute', 
          bottom: 'auto', 
          top: '24px', 
          right: '24px', 
          zIndex: 50,
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(14, 165, 233, 0.5)',
          borderRadius: '12px',
          color: 'white',
          padding: '12px 20px',
          fontWeight: 'bold',
          backdropFilter: 'blur(8px)'
        }} 
      />
      
      {/* Canvas 3D (Desarrollador B) */}
      <Canvas shadows dpr={[1, 2]} camera={{ position: [6, 5, 8], fov: 45 }}>
        <XR>
          <color attach="background" args={['#1e293b']} />
          <Suspense fallback={<LoadingOverlay />}>
            <SceneContent modelUrl={modelUrl} />
          </Suspense>

        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Evita ir por debajo del suelo
          enableDamping
          dampingFactor={0.05}
        />

        {/* ViewCube interactivo (arriba a la derecha) */}
        <GizmoHelper
          alignment="top-right"
          margin={[80, 80]}
        >
          <GizmoViewport 
            axisColors={['#ef4444', '#22c55e', '#3b82f6']} // Colores técnicos (X rojo, Y verde, Z azul)
            labelColor="white"
          />
        </GizmoHelper>
        </XR>
      </Canvas>
    </div>
  );
};
