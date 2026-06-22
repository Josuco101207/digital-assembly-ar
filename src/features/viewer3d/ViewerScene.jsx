import React, { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import { ARButton, XR, useXR, useHitTest, Interactive } from '@react-three/xr';
import { ModelLoader } from './components/ModelLoader';
import { LoadingOverlay } from './components/LoadingOverlay';
import { CoordinateGrid } from './components/CoordinateGrid';
import { RotateCcw, RotateCw } from 'lucide-react';

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
            <group position={placement.position} rotation={placement.rotation}>
              <ModelLoader url={modelUrl} />
            </group>
          ) : (
            <mesh ref={reticleRef} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[0.1, 0.15, 32]} />
              <meshBasicMaterial color="#0ea5e9" opacity={0.8} transparent />
            </mesh>
          )}
        </Interactive>
        
        {/* Luz optimizada para AR */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
      </>
    );
  }

  // En Pantalla (Modo Normal):
  return (
    <>
      {/* Sistema de luces hiper-realista pero optimizado */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-bias={-0.001} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      <Center>
        <ModelLoader url={modelUrl} />
      </Center>
      
      {/* Grid Técnico como referencia visual de escala real */}
      <CoordinateGrid size={10} divisions={10} opacity={0.3} />
    </>
  );
};

export const ViewerScene = () => {
  const modelUrl = useViewerStore((state) => state.modelUrl);
  const controlsRef = useRef();

  const handleRotateLeft = () => {
    if (controlsRef.current) {
      const angle = controlsRef.current.getAzimuthalAngle() + Math.PI / 2;
      controlsRef.current.setAzimuthalAngle(angle);
    }
  };

  const handleRotateRight = () => {
    if (controlsRef.current) {
      const angle = controlsRef.current.getAzimuthalAngle() - Math.PI / 2;
      controlsRef.current.setAzimuthalAngle(angle);
    }
  };

  return (
    <div className="w-full h-full bg-industrial-base relative">
      {/* Botones de rotación de cámara (Estilo SolidWorks/Inventor) */}
      <div className="absolute top-6 right-[70px] z-50 flex gap-2">
        <button 
          onClick={handleRotateLeft}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors shadow-lg"
          title="Girar a la izquierda (90°)"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button 
          onClick={handleRotateRight}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors shadow-lg"
          title="Girar a la derecha (90°)"
        >
          <RotateCw className="w-5 h-5" />
        </button>
      </div>
      <ARButton 
        sessionInit={{ 
          requiredFeatures: [], 
          optionalFeatures: ['dom-overlay', 'hit-test', 'local-floor'] 
        }}
        style={{ 
          position: 'absolute', 
          bottom: 'auto', 
          top: '160px', // Movido aún más hacia abajo para no tapar el ViewCube (Gizmo)
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
      <Canvas 
        shadows={false} 
        dpr={1} 
        gl={{ antialias: false, powerPreference: "high-performance", precision: "lowp" }} 
        camera={{ position: [6, 5, 8], fov: 45 }}
      >
        <XR>
          <color attach="background" args={['#1e293b']} />
          <Suspense fallback={<LoadingOverlay />}>
            <SceneContent modelUrl={modelUrl} />
          </Suspense>

        <OrbitControls 
          ref={controlsRef}
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Evita ir por debajo del suelo
          enableDamping
          dampingFactor={0.05}
        />

        {/* ViewCube interactivo estilo CAD (arriba a la derecha) */}
        <GizmoHelper
          alignment="top-right"
          margin={[80, 80]}
        >
          <GizmoViewcube 
            color="#334155" // Color base del cubo
            strokeColor="#475569" // Bordes
            textColor="white" // Texto
            hoverColor="#0ea5e9" // Color al pasar el mouse (Cian)
            opacity={0.85} // Ligeramente transparente
            faces={['Derecha', 'Izquierda', 'Arriba', 'Abajo', 'Frente', 'Atrás']} // En español
          />
        </GizmoHelper>
        </XR>
      </Canvas>
    </div>
  );
};
