import React, { useMemo } from 'react';
import { Text, Line } from '@react-three/drei';
import { useViewerStore } from '../../../store/useViewerStore';

// Justificación Arquitectónica: Un sistema de coordenadas adaptativo.
// Lee las posiciones reales de los postes (guardadas en Zustand) y
// genera líneas exactamente en esas intersecciones, ignorando el espacio vacío.

export const CoordinateGrid = () => {
  const gridLines = useViewerStore((state) => state.gridLines);
  
  const { x: uniqueX, z: uniqueZ } = gridLines;

  if (!uniqueX || !uniqueZ || uniqueX.length === 0 || uniqueZ.length === 0) {
    return null; // Esperamos a que se detecten los postes
  }

  // Extendemos un poco las líneas más allá del último poste
  const extension = 1.5;
  const minX = uniqueX[0] - extension;
  const maxX = uniqueX[uniqueX.length - 1] + extension;
  const minZ = uniqueZ[0] - extension;
  const maxZ = uniqueZ[uniqueZ.length - 1] + extension;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return (
    <group position={[0, -0.02, 0]}>
      {/* 1. Dibujar Líneas Longitudinales (Paralelas al Eje Z, constantes en X) -> Letras */}
      {uniqueX.map((xPos, idx) => {
        let letter = '';
        if (idx < 26) {
          letter = alphabet[idx];
        } else {
          letter = alphabet[Math.floor(idx / 26) - 1] + alphabet[idx % 26];
        }

        return (
          <group key={`grid-x-${idx}`}>
            <Line 
              points={[[xPos, 0, minZ], [xPos, 0, maxZ]]} 
              color="#0ea5e9" // Azul para letras
              lineWidth={1.5}
              transparent
              opacity={0.6}
            />
            {/* Etiqueta Inicio */}
            <Text
              position={[xPos, 0, minZ - 0.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.5}
              color="#0ea5e9"
              anchorX="center"
              anchorY="middle"
            >
              {letter}
            </Text>
            {/* Etiqueta Fin */}
            <Text
              position={[xPos, 0, maxZ + 0.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.5}
              color="#0ea5e9"
              anchorX="center"
              anchorY="middle"
            >
              {letter}
            </Text>
          </group>
        );
      })}

      {/* 2. Dibujar Líneas Transversales (Paralelas al Eje X, constantes en Z) -> Números */}
      {uniqueZ.map((zPos, idx) => {
        // El usuario solicitó invertir el inicio de las coordenadas para que A1 esté donde A8
        const number = uniqueZ.length - idx;
        
        return (
          <group key={`grid-z-${idx}`}>
            <Line 
              points={[[minX, 0, zPos], [maxX, 0, zPos]]} 
              color="#94a3b8" // Gris para números
              lineWidth={1.5}
              transparent
              opacity={0.6}
            />
            {/* Etiqueta Inicio */}
            <Text
              position={[minX - 0.5, 0, zPos]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.5}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
            >
              {number}
            </Text>
            {/* Etiqueta Fin */}
            <Text
              position={[maxX + 0.5, 0, zPos]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.5}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
            >
              {number}
            </Text>
          </group>
        );
      })}
    </group>
  );
};
