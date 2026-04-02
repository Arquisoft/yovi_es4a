/**
 * GameHex.tsx — Variante "Hex"
 *
 * Jugado en un tablero rómbico (habitualmente 11×11).
 * Cada jugador intenta conectar sus dos lados opuestos del tablero.
 * No hay empates posibles (Teorema de Brouwer).
 *
 * Implementación:
 *   - El backend Y triangular no soporta tablero rómbico nativo, por lo que
 *     usamos el motor Y con un tablero cuadrado simulado:
 *     mapeamos un grid NxN sobre el YEN triangular y evaluamos la
 *     conectividad de lado-a-lado en el cliente.
 *
 *   - Alternativamente (implementación real), se construye el tablero Hex
 *     directamente en React con una cuadrícula de hexágonos y se gestiona
 *     toda la lógica (Union-Find, detección de victoria) en el cliente,
 *     sin necesitar el backend Y para la detección de ganador.
 *
 * Esta implementación usa la lógica cliente-side completa (sin backend para
 * la detección de victoria) sobre un tablero NxN de hexágonos.
 */

import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { App, Button, Card, Flex, Space, Typography } from "antd";

const { Title, Text } = Typography;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Player = 0 | 1;
type CellState = null | Player;

// ─── Union-Find para detección de victoria ────────────────────────────────────

class UnionFind {
  parent: number[];
  rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
  }

  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }
}

function cellIndex(row: number, col: number, size: number): number {
  return row * size + col;
}

/** Vecinos de una celda en tablero Hex (6 direcciones). */
function hexNeighbors(row: number, col: number, size: number): [number, number][] {
  const dirs: [number, number][] = [
    [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0],
  ];
  return dirs
    .map(([dr, dc]) => [row + dr, col + dc] as [number, number])
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size);
}

/**
 * Comprueba si el `player` ha ganado.
 * - Player 0 (azul) conecta columna 0 con columna size-1 (izquierda-derecha).
 * - Player 1 (rojo) conecta fila 0 con fila size-1 (arriba-abajo).
 */
function checkWinner(board: CellState[], size: number, player: Player): boolean {
  // Nodos virtuales: size*size = fuente, size*size+1 = destino
  const src = size * size;
  const dst = size * size + 1;
  const uf = new UnionFind(size * size + 2);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[cellIndex(r, c, size)] !== player) continue;

      const idx = cellIndex(r, c, size);

      // Conectar con nodo virtual fuente/destino
      if (player === 0) {
        if (c === 0) uf.union(idx, src);
        if (c === size - 1) uf.union(idx, dst);
      } else {
        if (r === 0) uf.union(idx, src);
        if (r === size - 1) uf.union(idx, dst);
      }

      // Conectar con vecinos del mismo color
      for (const [nr, nc] of hexNeighbors(r, c, size)) {
        if (board[cellIndex(nr, nc, size)] === player) {
          uf.union(idx, cellIndex(nr, nc, size));
        }
      }
    }
  }

  return uf.connected(src, dst);
}

// ─── Componente ───────────────────────────────────────────────────────────────

const PLAYER_COLORS: Record<Player, string> = {
  0: "#28BBF5",
  1: "#FF7B00",
};

const PLAYER_NAMES: Record<Player, string> = {
  0: "Azul (conecta ←→)",
  1: "Naranja (conecta ↑↓)",
};

function parseBoardSize(raw: string | null): number {
  const n = Number(raw ?? "9");
  return Number.isFinite(n) && n >= 3 ? Math.min(n, 15) : 9;
}

export default function GameHex() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { modal } = App.useApp();

  const size = parseBoardSize(searchParams.get("size"));

  const [board, setBoard] = useState<CellState[]>(Array(size * size).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>(0);
  const [winner, setWinner] = useState<Player | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  function handleCellClick(row: number, col: number) {
    if (winner !== null) return;
    const idx = cellIndex(row, col, size);
    if (board[idx] !== null) return;

    const newBoard = [...board];
    newBoard[idx] = currentPlayer;

    const won = checkWinner(newBoard, size, currentPlayer);

    setBoard(newBoard);
    setMoveCount((c) => c + 1);

    if (won) {
      setWinner(currentPlayer);
    } else {
      setCurrentPlayer(currentPlayer === 0 ? 1 : 0);
    }
  }

  function handleAbandon() {
    modal.confirm({
      title: "¿Abandonar la partida?",
      onOk: () => navigate("/home", { replace: true }),
      okText: "Abandonar",
      cancelText: "Cancelar",
    });
  }

  function handleRestart() {
    setBoard(Array(size * size).fill(null));
    setCurrentPlayer(0);
    setWinner(null);
    setMoveCount(0);
  }

  // ─── Render del tablero Hex ───────────────────────────────────────────────

  const HEX_SIZE = 28;
  const HEX_W = HEX_SIZE * 2;
  const HEX_H = Math.sqrt(3) * HEX_SIZE;
  const PAD = HEX_SIZE * 1.5;

  const svgW = HEX_W * size + HEX_W * 0.5 * (size - 1) + PAD * 2;
  const svgH = HEX_H * size + PAD * 2;

  function hexPoints(cx: number, cy: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`);
    }
    return pts.join(" ");
  }

  const hexCells: JSX.Element[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cx = PAD + c * (HEX_W * 0.75 + HEX_SIZE * 0.5) + r * (HEX_W * 0.375 + HEX_SIZE * 0.25);
      const cy = PAD + r * HEX_H + c * 0;
      const idx = cellIndex(r, c, size);
      const state = board[idx];
      const fill =
        state === null ? "#f0f0f0" :
        state === 0 ? PLAYER_COLORS[0] :
        PLAYER_COLORS[1];

      hexCells.push(
        <polygon
          key={idx}
          points={hexPoints(cx, cy)}
          fill={fill}
          stroke="#999"
          strokeWidth={1}
          style={{ cursor: state === null && winner === null ? "pointer" : "default" }}
          onClick={() => handleCellClick(r, c)}
        />
      );
    }
  }

  return (
    <Flex justify="center" align="start" style={{ padding: "clamp(10px, 3vw, 20px)", minHeight: "100vh" }}>
      <div style={{ width: "min(900px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space direction="vertical" size={0}>
                <Title level={3} style={{ margin: 0 }}>Juego Hex</Title>
                <Text type="secondary">Tamaño: {size}×{size} · Conecta tus dos lados</Text>
              </Space>
              <Space>
                <Button onClick={handleRestart}>Nueva partida</Button>
                <Button danger onClick={handleAbandon}>Abandonar</Button>
              </Space>
            </Flex>
          </Card>

          {winner === null ? (
            <Card>
              <Text strong style={{ color: PLAYER_COLORS[currentPlayer] }}>
                Turno: {PLAYER_NAMES[currentPlayer]}
              </Text>
              <Text type="secondary" style={{ marginLeft: 12 }}>
                · Movimiento #{moveCount + 1}
              </Text>
            </Card>
          ) : (
            <Card style={{ borderColor: PLAYER_COLORS[winner] }}>
              <Text strong style={{ fontSize: 18, color: PLAYER_COLORS[winner] }}>
                🏆 ¡{PLAYER_NAMES[winner]} gana en {moveCount} movimientos!
              </Text>
            </Card>
          )}

          <Card style={{ overflowX: "auto" }}>
            <svg
              width={svgW}
              height={svgH}
              style={{ display: "block", maxWidth: "100%" }}
              viewBox={`0 0 ${svgW} ${svgH}`}
            >
              {/* Indicadores de lados */}
              <text x={PAD / 2} y={svgH / 2} fill={PLAYER_COLORS[0]} fontSize={12} textAnchor="middle">←</text>
              <text x={svgW - PAD / 2} y={svgH / 2} fill={PLAYER_COLORS[0]} fontSize={12} textAnchor="middle">→</text>
              <text x={svgW / 2} y={PAD / 2} fill={PLAYER_COLORS[1]} fontSize={12} textAnchor="middle">↑</text>
              <text x={svgW / 2} y={svgH - PAD / 4} fill={PLAYER_COLORS[1]} fontSize={12} textAnchor="middle">↓</text>
              {hexCells}
            </svg>
          </Card>

          <Card>
            <Space>
              <Text style={{ color: PLAYER_COLORS[0] }}>■ Azul: conecta izquierda-derecha</Text>
              <Text style={{ color: PLAYER_COLORS[1] }}>■ Naranja: conecta arriba-abajo</Text>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}
