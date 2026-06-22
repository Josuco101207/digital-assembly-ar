import React from 'react';
import { Text, Line } from '@react-three/drei';
import { useViewerStore } from '../../../store/useViewerStore';

// Justificación Arquitectónica: Un sistema de coordenadas adaptativo y sutil.
// Usa líneas delgadas y semi-transparentes que no compiten visualmente con el modelo.
// Se alinea con el modelo usando el centerOffset de Zustand.

export const CoordinateGrid = () => {
  const gridLines = useViewerStore((state) => state.gridLines);
  const centerOffset = useViewerStore((state) => state.centerOffset);
  
  const { x: uniqueX, z: uniqueZ } = gridLines;

  if (!uniqueX || !uniqueZ || uniqueX.length === 0 || uniqueZ.length === 0) {
    return null;
  }

  // El offset que <Center> aplicó al modelo
  const ox = centerOffset[0];
  const oy = centerOffset[1];
  const oz = centerOffset[2];

  // Extensión mínima más allá de los extremos
  const extension = 0.8;
  const minX = uniqueX[0] - extension;
  const maxX = uniqueX[uniqueX.length - 1] + extension;
  const minZ = uniqueZ[0] - extension;
  const maxZ = uniqueZ[uniqueZ.length - 1] + extension;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // La cuadrícula se dibuja justo debajo del modelo
  const gridY = oy - 0.05;

  return (
    <group position={[ox, gridY, oz]}>
      {/* Líneas Longitudinales (eje X → Letras) */}
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
              color="#38bdf8"
              lineWidth={0.8}
              transparent
              opacity={0.25}
              depthWrite={false}
            />
            <Text
              position={[xPos, 0.01, minZ - 0.4]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.7}
              depthOffset={-1}
            >
              {letter}
            </Text>
            <Text
              position={[xPos, 0.01, maxZ + 0.4]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.7}
              depthOffset={-1}
            >
              {letter}
            </Text>
          </group>
        );
      })}

      {/* Líneas Transversales (eje Z → Números) */}
      {uniqueZ.map((zPos, idx) => {
        const number = uniqueZ.length - idx;
        
        return (
          <group key={`grid-z-${idx}`}>
            <Line 
              points={[[minX, 0, zPos], [maxX, 0, zPos]]} 
              color="#64748b"
              lineWidth={0.8}
              transparent
              opacity={0.2}
              depthWrite={false}
            />
            <Text
              position={[minX - 0.4, 0.01, zPos]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.6}
              depthOffset={-1}
            >
              {number}
            </Text>
            <Text
              position={[maxX + 0.4, 0.01, zPos]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.6}
              depthOffset={-1}
            >
              {number}
            </Text>
          </group>
        );
      })}
    </group>
  );
};
