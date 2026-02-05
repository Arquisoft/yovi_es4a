import React from 'react';

interface GameBoardProps {
  username: string;
  size: number;
  onExit: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ username, size, onExit }) => {
  
  const generateBoard = () => {
    const cells = [];
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size - i; j++) {
        const k = size - 1 - i - j;
        cells.push({ i, j, k });
      }
    }
    return cells;
  };

  const cells = generateBoard();

  return (
    <div className="game-container">
      <header className="game-header">
        <h2>Jugador: {username}</h2>
        <button onClick={onExit} className="exit-button">Volver al Menú</button>
      </header>

      <div className="board-wrapper">
        <svg viewBox="0 0 500 450" className="game-svg">
          {cells.map((cell) => {
            const x = 250 + (cell.j - cell.k) * 30;
            const y = 50 + cell.i * 50;
            
            return (
              <g key={`${cell.i}-${cell.j}-${cell.k}`} className="hex-group">
                <polygon
                  points="0,-25 22,-12.5 22,12.5 0,25 -22,12.5 -22,-12.5"
                  transform={`translate(${x}, ${y})`}
                  className="hex-cell"
                  onClick={() => console.log(`Coordenadas: i=${cell.i}, j=${cell.j}, k=${cell.k}`)}
                />
                <text x={x} y={y + 5} textAnchor="middle" className="hex-label">
                  {cell.i},{cell.j},{cell.k}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default GameBoard;