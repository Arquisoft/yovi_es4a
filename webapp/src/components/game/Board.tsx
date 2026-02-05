import React from 'react';
import { HexGrid, Layout, Hexagon} from 'react-hexgrid';
import { generateTriangleGrid } from '../../utils/hexMath';
// CAMBIO AQUÍ: Añadimos 'type' porque CellData es una interfaz
import type { CellData } from '../../types/game';

interface BoardProps {
  occupiedCells: CellData[];
  onHexClick: (coords: { x: number, y: number, z: number }) => void;
}

const Board: React.FC<BoardProps> = ({ occupiedCells, onHexClick }) => {
  const hexas = generateTriangleGrid(5); 

  const getCellColor = (q: number, r: number, s: number) => {
    const found = occupiedCells.find(
      c => c.coords.x === q && c.coords.z === r && c.coords.y === s
    );
    
    if (found?.player === 'P1') return '#ff6b6b'; 
    if (found?.player === 'P2') return '#4ecdc4'; 
    return 'white'; 
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <HexGrid width={600} height={500} viewBox="-55 -10 110 100">
        <Layout size={{ x: 7, y: 7 }} flat={false} spacing={1.05} origin={{ x: 0, y: 0 }}>
          {hexas.map((hex, i) => (
            <Hexagon
              key={i}
              q={hex.q} r={hex.r} s={hex.s}
              onClick={() => onHexClick({ x: hex.q, y: hex.s, z: hex.r })}
              cellStyle={{
                fill: getCellColor(hex.q, hex.r, hex.s),
                stroke: 'gray', strokeWidth: '0.2', cursor: 'pointer'
              }}
            >
              {/* Texto opcional oculto por limpieza, descomentar si necesitas debug */}
              {/* <Text>{`${hex.q},${hex.r},${hex.s}`}</Text> */}
            </Hexagon>
          ))}
        </Layout>
      </HexGrid>
    </div>
  );
};

export default Board;