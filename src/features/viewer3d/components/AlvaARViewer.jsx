import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ModelLoader } from './ModelLoader';
import { useViewerStore } from '../../../store/useViewerStore';
import { Center } from '@react-three/drei';

// Helper de AlvaAR para Three.js
const applyPose = (pose, rotationQuaternion, translationVector) => {
  const m = new THREE.Matrix4().fromArray(pose);
  const r = new THREE.Quaternion().setFromRotationMatrix(m);
  const t = new THREE.Vector3(pose[12], pose[13], pose[14]);

  if (rotationQuaternion !== null) rotationQuaternion.set(-r.x, r.y, r.z, r.w);
  if (translationVector !== null) translationVector.set(t.x, -t.y, -t.z);
};

const resize2cover = (vw, vh, cw, ch) => {
  const videoRatio = vw / vh;
  const canvasRatio = cw / ch;
  if (canvasRatio < videoRatio) {
    return {
      width: ch * videoRatio,
      height: ch,
      x: -(ch * videoRatio - cw) / 2,
      y: 0,
    };
  }
  return {
    width: cw,
    height: cw / videoRatio,
    x: 0,
    y: -(cw / videoRatio - ch) / 2,
  };
};

// Componente que maneja el loop de Alva y la Cámara
const AlvaEngine = ({ videoRef, canvas2dRef, onTrackingStatus }) => {
  const { gl, camera } = useThree();
  const alvaRef = useRef(null);
  const ctxRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initAlva = async () => {
      try {
        const module = await import(/* @vite-ignore */ '/alva/alva_ar.js');
        const AlvaAR = module.AlvaAR;
        const width = gl.domElement.clientWidth;
        const height = gl.domElement.clientHeight;

        canvas2dRef.current.width = width;
        canvas2dRef.current.height = height;
        ctxRef.current = canvas2dRef.current.getContext('2d', { alpha: false, desynchronized: true });

        const alva = await AlvaAR.Initialize(width, height);
        if (isMounted) {
          alvaRef.current = alva;
          setReady(true);
        }
      } catch (err) {
        console.error("Error loading AlvaAR:", err);
      }
    };
    initAlva();
    return () => { isMounted = false; };
  }, [gl, canvas2dRef]);

  useFrame(() => {
    if (!ready || !alvaRef.current || !videoRef.current || !ctxRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const width = canvas2dRef.current.width;
    const height = canvas2dRef.current.height;
    const size = resize2cover(video.videoWidth, video.videoHeight, width, height);

    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, size.x, size.y, size.width, size.height);
    const frameData = ctx.getImageData(0, 0, width, height);

    const pose = alvaRef.current.findCameraPose(frameData);

    if (pose) {
      applyPose(pose, camera.quaternion, camera.position);
      onTrackingStatus(true);
    } else {
      onTrackingStatus(false);
      // Opcional: Dibujar puntos de rastreo si se pierde
      const dots = alvaRef.current.getFramePoints();
      ctx.fillStyle = 'red';
      for (const p of dots) {
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    }
  });

  return null;
};

export const AlvaARViewer = () => {
  const modelUrl = useViewerStore((state) => state.modelUrl);
  const arScale = useViewerStore((state) => state.arScale);
  const [hasPermission, setHasPermission] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const videoRef = useRef(null);
  const canvas2dRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', aspectRatio: 16 / 9, width: { ideal: 1280 } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setHasPermission(true);
      } catch (err) {
        console.error("Camera access denied", err);
        setHasPermission(false);
      }
    };
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  if (hasPermission === false) {
    return <div className="flex items-center justify-center h-full text-white bg-black">Permiso de cámara denegado.</div>;
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* 1. Video oculto para source */}
      <video ref={videoRef} playsInline autoPlay muted className="hidden" />

      {/* 2. Canvas 2D donde se procesa la visión (Background) */}
      <canvas ref={canvas2dRef} className="absolute top-0 left-0 w-full h-full object-cover" />

      {/* 3. Status Badge */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
        <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${isTracking ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>
          {isTracking ? 'Rastreando Piso' : 'Buscando Superficie...'}
        </span>
      </div>

      {/* 4. Canvas R3F transparente encima */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <Canvas camera={{ position: [0, 0, 0], fov: 75 }} gl={{ alpha: true }}>
          <ambientLight intensity={1} />
          <directionalLight position={[10, 10, 10]} intensity={1.5} />
          
          <AlvaEngine videoRef={videoRef} canvas2dRef={canvas2dRef} onTrackingStatus={setIsTracking} />
          
          {modelUrl && isTracking && (
            <group scale={arScale}>
              <Center>
                <ModelLoader url={modelUrl} />
              </Center>
            </group>
          )}
        </Canvas>
      </div>
    </div>
  );
};
