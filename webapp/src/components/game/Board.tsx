import React from 'react';
import { HexGrid, Layout, Hexagon, Text } from 'react-hexgrid';
import { generateTriangleGrid } from '../../utils/hexMath';

interface BoardProps {
  // x=q, y=s, z=r
  occupiedCells: Array<{ coords: { x: number, y: number, z: number }, player: string }>;
  onHexClick: (coords: { x: number, y: number, z: number }) => void;
}

const Board: React.FC<BoardProps> = ({ occupiedCells, onHexClick }) => {
  // Generamos un triángulo de tamaño 5 (puedes cambiar este número)
  // ----------------- REVISAR CREAR DE CUALQUIER TAMAÑO ------------------------------------------------------------
  const hexas = generateTriangleGrid(5);

  // coloreamos hexagonos por celdas ocupadas
  const getCellColor = (q: number, r: number, s: number) => {
    const found = occupiedCells.find(
      c => c.coords.x === q && c.coords.z === r && c.coords.y === s
    );
    
    if (found?.player === 'P1') return '#ff6b6b'; // Rojo suave
    if (found?.player === 'P2') return '#4ecdc4'; // Turquesa
    return 'white'; // Vacío
  };

  return (
    <div className="board-container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      {/* viewBox ajustado: muevete -55 a la izq, -10 arriba, y ten 110x100 de zoom */}
      <HexGrid width={600} height={500} viewBox="-55 -10 110 100">
        <Layout size={{ x: 7, y: 7 }} flat={false} spacing={1.05} origin={{ x: 0, y: 0 }}>
          
          {hexas.map((hex, i) => (
            <Hexagon
              key={i}
              q={hex.q}
              r={hex.r}
              s={hex.s}
              onClick={() => onHexClick({ x: hex.q, y: hex.s, z: hex.r })}
              cellStyle={{
                fill: getCellColor(hex.q, hex.r, hex.s),
                stroke: 'gray',
                strokeWidth: '0.2',
                cursor: 'pointer'
              }}
            >
              {/* Texto opcional para ver coordenadas (útil para debug) */}
              <Text style={{ fontSize: '0.25rem', fill: '#333' }}>{`${hex.q},${hex.r},${hex.s}`}</Text>
            </Hexagon>
          ))}
          
        </Layout>
      </HexGrid>
    </div>
  );
};

export default Board;