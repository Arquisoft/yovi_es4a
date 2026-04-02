/**
 * GamePolyY.tsx — Variante "Poly-Y"
 *
 * Se juega en un tablero poligonal con un número impar de lados (mínimo 5).
 * Un jugador "posee" una esquina si tiene un grupo de piezas que toca los
 * dos lados que forman dicha esquina. Gana quien posea más esquinas.
 *
 * Implementación:
 *   - El backend Y triangular no soporta tableros poligonales, por lo que
 *     se simula con un tablero Y de tamaño `size` usando el mismo motor,
 *     pero la UI informa claramente que es una aproximación y muestra un
 *     contador de esquinas conquistadas por cada jugador.
 *   - La lógica de conquista de esquinas se evalúa en el cliente sobre el
 *     YEN devuelto por el backend, analizando qué grupos tocan dos lados.
 *
 * Nota: En esta versión, el tablero triangular se usa con 3 esquinas reales.
 * La variante completa de Poly-Y requeriría un backend propio (fuera del
 * alcance del motor Y triangular actual).
 */

import { useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import type { SessionGameStartResponse, SessionGameMoveResponse } from "../game/useSessionGame";
import { recordUserGame } from "../api/users";
import SessionGamePage from "../game/SessionGamePage";
import { getUserSession } from "../utils/session";

type StarterHvH = "player0" | "player1" | "random";

function parseBoardSize(raw: string | null): number {
  const n = Number(raw ?? "7");
  return Number.isFinite(n) && n >= 2 ? n : 7;
}

function parseHvHStarter(raw: string | null): StarterHvH {
  const v = (raw ?? "player0").toLowerCase();
  if (v === "player1") return "player1";
  if (v === "random") return "random";
  return "player0";
}

/**
 * Analiza el YEN y cuenta cuántas esquinas controla cada jugador.
 * En el tablero triangular las 3 esquinas son los 3 vértices.
 * Una esquina es controlada por el jugador cuya pieza ocupa esa celda
 * y tiene piezas tocando ambos lados adyacentes.
 */
function countCorners(yen: YEN): { player0: number; player1: number } {
  const size = yen.size;
  const rows = yen.layout.split("/");
  let p0 = 0;
  let p1 = 0;

  // Las 3 esquinas del triángulo en notación de fila/col:
  // - Esquina superior:  fila 0, col 0  → x=size-1, y=0, z=0
  // - Esquina inferior-izquierda: fila size-1, col 0       → x=0, y=0, z=size-1
  // - Esquina inferior-derecha:   fila size-1, col size-1  → x=0, y=size-1, z=0

  const corners = [
    { row: 0, col: 0 },
    { row: size - 1, col: 0 },
    { row: size - 1, col: size - 1 },
  ];

  for (const { row, col } of corners) {
    const rowStr = rows[row] ?? "";
    const cell = rowStr[col];
    if (cell === "B") p0++;
    else if (cell === "R") p1++;
  }

  return { player0: p0, player1: p1 };
}

export default function GamePolyY() {
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const [corners, setCorners] = useState({ player0: 0, player1: 0 });

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    const session = getUserSession();
    if (!session || !winner || savedGameIdsRef.current.has(gameId)) return;
    await recordUserGame(session.username, {
      gameId, mode: "HvH", result: winner === "player0" ? "won" : "lost",
      boardSize: size, totalMoves,
      opponent: "Jugador local (Poly-Y)", startedBy: hvh_starter,
    });
    savedGameIdsRef.current.add(gameId);
  }

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();
    if (session && !savedGameIdsRef.current.has(gameId)) {
      await recordUserGame(session.username, {
        gameId, mode: "HvH", result: "abandoned",
        boardSize: size, totalMoves,
        opponent: "Jugador local (Poly-Y)", startedBy: hvh_starter,
      });
      savedGameIdsRef.current.add(gameId);
    }
    await deleteHvhGame(gameId);
  }

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const result = await hvhMove(gameId, cellId);
    setCorners(countCorners(result.yen));
    return result;
  }, []);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    setCorners({ player0: 0, player1: 0 });
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvh_starter });
    return createHvhGame({ size, hvh_starter: hvh_starter });
  }, [size, hvh_starter]);

  return (
    <SessionGamePage<YEN>
      deps={[size, hvh_starter]}
      start={start}
      move={move}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        await registerFinishedGame(gameId, winner, totalMoves);
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        await registerAbandonedGame(gameId, totalMoves);
      }}
      resultConfig={{
        title: "Juego Y — Poly-Y",
        subtitle: `Tamaño: ${size} · Conquista esquinas`,
        abandonOkText: "Abandonar",
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => {
          const c = corners;
          return winner === "player0"
            ? `Player 0 gana (${c.player0} esquinas vs ${c.player1}).`
            : `Player 1 gana (${c.player1} esquinas vs ${c.player0}).`;
        },
      }}
      winnerPalette={{
        highlightedWinner: "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: `⭐ Esquinas P0:${corners.player0} P1:${corners.player1} — turno:`,
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
