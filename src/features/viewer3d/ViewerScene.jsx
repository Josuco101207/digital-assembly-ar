import React, { Suspense, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Bounds, GizmoHelper, GizmoViewcube, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { ARButton, XR, useXR, useHitTest, Interactive } from '@react-three/xr';
import { ModelLoader } from './components/ModelLoader';
import { LoadingOverlay } from './components/LoadingOverlay';
import { CoordinateGrid } from './components/CoordinateGrid';

// Justificación Arquitectónica: Delegamos la complejidad de la carga y animación
// a los nuevos componentes. El Scene queda limpio y se enfoca solo en iluminación, 
// cámara y orquestación del Canvas.

import { useViewerStore } from '../../store/useViewerStore';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const SceneContent = ({ modelUrl }) => {
  const { isPresenting, session } = useXR();
  const arScale = useViewerStore((state) => state.arScale);
  const showGrid = useViewerStore((state) => state.showGrid);
  const activeSubModelId = useViewerStore((state) => state.activeSubModelId);
  
  const [placement, setPlacement] = useState(null); // Guardará la matriz (posición/rotación) cuando el usuario toque la pantalla
  const reticleRef = useRef();

  // Capturar el offset que <Center> aplica, para pasarlo a la cuadrícula
  const handleCentered = useCallback(({ container }) => {
    const p = container.position;
    useViewerStore.getState().setCenterOffset([p.x, p.y, p.z]);
  }, []);

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
              {showGrid && <CoordinateGrid />}
              <Bounds key={activeSubModelId} fit margin={1.2}>
                <Center top onCentered={handleCentered}>
                  {modelUrl && <ModelLoader url={modelUrl} />}
                </Center>
              </Bounds>
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

  // Vista 3D normal en pantalla: Iluminación estática ultraligera para máximo rendimiento
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1.2} castShadow={false} />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} castShadow={false} />
      {showGrid && <CoordinateGrid />}
      <Bounds key={activeSubModelId} fit margin={1.2}>
        <Center top onCentered={handleCentered}>
          {modelUrl && <ModelLoader url={modelUrl} />}
        </Center>
      </Bounds>
    </>
  );
};

export const ViewerScene = () => {
  const modelUrl = useViewerStore((state) => state.modelUrl);
  const isOrthographic = useViewerStore((state) => state.isOrthographic);

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
          top: '160px',
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
      <ErrorBoundary>
        <Canvas 
          shadows={false} 
          dpr={[0.5, 1]} // Dynamic resolution down to 0.5x on slow devices
          frameloop="demand" // Only render when things change, saves massive CPU/GPU
          gl={{ 
            antialias: false, 
            powerPreference: "low-power", // Avoid high-performance forcing which crashes some old phones
            precision: "lowp",
            alpha: false, // Disabling alpha channel saves memory
            depth: true,
            stencil: false, // Disabling stencil buffer saves memory
            preserveDrawingBuffer: false
          }} 
        >
          {isOrthographic ? (
            <OrthographicCamera makeDefault position={[6, 5, 8]} zoom={45} near={-1000} far={100000} />
          ) : (
            <PerspectiveCamera makeDefault position={[6, 5, 8]} fov={45} near={0.01} far={100000} />
          )}

          <XR>
            <color attach="background" args={['#1e293b']} />
            <Suspense fallback={<LoadingOverlay />}>
              <SceneContent modelUrl={modelUrl} />
            </Suspense>

          <OrbitControls 
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI} // Permite rotar completamente por debajo del modelo
            rotateSpeed={0.4} // Menos sensibilidad al rotar
            panSpeed={0.4} // Menos sensibilidad al panear
            zoomSpeed={0.5} // Menos sensibilidad al hacer zoom
            enableDamping={true} // Movimiento suave con inercia
            dampingFactor={0.1}
          />

          {/* ViewCube interactivo estilo CAD (arriba a la derecha) */}
          <GizmoHelper
            alignment="top-right"
            margin={[80, 80]}
          >
            <GizmoViewcube 
              color="#334155"
              strokeColor="#475569"
              textColor="white"
              hoverColor="#0ea5e9"
              opacity={0.85}
              faces={['Derecha', 'Izquierda', 'Arriba', 'Abajo', 'Frente', 'Atrás']}
            />
          </GizmoHelper>
          </XR>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
};
