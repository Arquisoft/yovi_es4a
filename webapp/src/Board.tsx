import React, { useEffect, useMemo, useState } from 'react';

type Coord = { x: number; y: number; z: number };

// Lo que idealmente debería devolver gamey para “dibujar tablero”
type GameyBoardResponse = {
  size: number;
  // lista de todas las coordenadas válidas
  cells: Coord[];
  // ocupación: clave "x,y,z" -> playerId (0/1)
  occupied?: Record<string, number>;
  nextPlayer?: number;
};

interface BoardProps {
  username: string;
  size: number;
  onExit: () => void;
}

function keyOf(c: Coord) {
  return `${c.x},${c.y},${c.z}`;
}

/**
 * Generación correcta de coordenadas baricéntricas del triángulo:
 * x + y + z = size - 1
 *
 * IMPORTANTE: esto es “fallback” si el endpoint de gamey no existe todavía.
 * La idea es que el source of truth sea gamey, no el front.
 */
function generateAllCells(size: number): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < size; row++) {
    const x = size - 1 - row; // arriba: x = size-1, abajo: x=0
    for (let y = 0; y <= row; y++) {
      const z = (size - 1) - x - y; // asegura suma=size-1
      cells.push({ x, y, z });
    }
  }
  return cells;
}

const Board: React.FC<BoardProps> = ({ username, size, onExit }) => {
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<Coord[]>([]);
  const [occupied, setOccupied] = useState<Record<string, number>>({});
  const [nextPlayer, setNextPlayer] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<Coord | null>(null);

  const GAMEY_URL = import.meta.env.VITE_GAMEY_URL ?? 'http://localhost:4000';

  useEffect(() => {
    let cancelled = false;

    async function loadBoardFromGamey() {
      setLoading(true);
      setError(null);

      try {
        // Endpoint propuesto (a implementar en gamey):
        // GET /v1/board?size=7
        const res = await fetch(`${GAMEY_URL}/v1/board?size=${size}`);
        if (!res.ok) {
          throw new Error(`Gamey responded ${res.status}`);
        }

        const data = (await res.json()) as GameyBoardResponse;

        if (cancelled) return;

        setCells(data.cells ?? []);
        setOccupied(data.occupied ?? {});
        setNextPlayer(typeof data.nextPlayer === 'number' ? data.nextPlayer : null);
      } catch (e: any) {
        if (cancelled) return;

        // Fallback temporal para poder avanzar en UI aunque gamey aún no tenga endpoint
        setCells(generateAllCells(size));
        setOccupied({});
        setNextPlayer(null);

        setError(
          `No se pudo cargar el tablero desde gamey (${GAMEY_URL}). ` +
            `Usando tablero local temporal. Motivo: ${e?.message ?? 'error'}`
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBoardFromGamey();

    return () => {
      cancelled = true;
    };
  }, [GAMEY_URL, size]);

  // Cálculo de posiciones (layout) en 2D para dibujar como botones circulares.
  // Ordena por “fila” (row = size-1-x), dentro por y.
  const positioned = useMemo(() => {
    const spacingX = 52;
    const spacingY = 48;

    const byRow = [...cells].sort((a, b) => {
      const ra = (size - 1) - a.x;
      const rb = (size - 1) - b.x;
      if (ra !== rb) return ra - rb;
      return a.y - b.y;
    });

    return byRow.map((c) => {
      const row = (size - 1) - c.x; // 0..size-1
      const col = c.y; // 0..row

      // centrado: cada fila se desplaza medio paso por col
      const left = 40 + (col - row / 2) * spacingX + 220;
      const top = 40 + row * spacingY;

      return { c, left, top, row, col };
    });
  }, [cells, size]);

  const handleCellClick = (c: Coord) => {
    setSelectedCell(c);
    console.log('Clicked cell:', c);
  };

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Board</h2>
          <div style={{ opacity: 0.8, fontSize: 14 }}>
            Jugador: {username} · size={size}
            {typeof nextPlayer === 'number' ? ` · turno: Player ${nextPlayer}` : ''}
          </div>
        </div>

        <button onClick={onExit} className="menu-button">
          Salir
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: 'red' }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          marginTop: 16,
        }}
      >
        {/* TABLERO */}
        <div
          style={{
            position: 'relative',
            height: 40 + size * 48 + 60,
            flex: '1 1 auto',
            borderRadius: 12,
            padding: 12,
          }}
        >
          {loading && (
            <div style={{ opacity: 0.85, marginBottom: 8 }}>
              Cargando tablero…
            </div>
          )}

          {positioned.map(({ c, left, top }) => {
            const k = keyOf(c);
            const owner = occupied[k]; // undefined si vacío
            const isSelected = selectedCell && keyOf(selectedCell) === k;

            return (
              <button
                key={k}
                type="button"
                onClick={() => handleCellClick(c)}
                aria-label={`cell ${k}`}
                title={`(${c.x},${c.y},${c.z})`}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.35)',
                  background:
                    owner === 0
                      ? 'rgba(0,0,0,0.35)'
                      : owner === 1
                      ? 'rgba(255,255,255,0.35)'
                      : 'rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </div>

        {/* PANEL LATERAL */}
        <div
          style={{
            width: 240,
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Celda seleccionada</h3>

          {selectedCell ? (
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <div>
                <strong>x</strong>: {selectedCell.x}
              </div>
              <div>
                <strong>y</strong>: {selectedCell.y}
              </div>
              <div>
                <strong>z</strong>: {selectedCell.z}
              </div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                ({selectedCell.x}, {selectedCell.y}, {selectedCell.z})
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              Pulsa una celda para ver sus coordenadas baricéntricas.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Board;
