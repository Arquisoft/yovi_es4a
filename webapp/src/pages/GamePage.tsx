import React, { useState } from 'react';
import Board from '../components/game/Board';
import type { CellData, Player } from '../types/game'; 

const GamePage: React.FC = () => {
  const [turn, setTurn] = useState<Player>('P1');
  const [occupied, setOccupied] = useState<CellData[]>([]);

  const handleHexClick = (coords: { x: number, y: number, z: number }) => {
    const exists = occupied.find(c => c.coords.x === coords.x && c.coords.z === coords.z);
    if (exists) return;

    setOccupied([...occupied, { coords, player: turn }]);
    setTurn(turn === 'P1' ? 'P2' : 'P1');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h1>Juego de la Y</h1>
      <h3>Turno: <span style={{ color: turn === 'P1' ? 'red' : 'blue' }}>{turn}</span></h3>
      <Board occupiedCells={occupied} onHexClick={handleHexClick} />
    </div>
  );
};

export default GamePage;