/**
 * GameTabu.tsx — Variante "Tabu Y"
 *
 * Prohibido colocar ficha en una casilla adyacente a la última ficha
 * colocada por el oponente.
 *
 * Implementación:
 *   - Usamos el backend HvH.
 *   - Rastreamos el `lastOpponentCellId` localmente.
 *   - Calculamos las celdas adyacentes a esa celda y las marcamos como
 *     deshabilitadas pasando una lista de `blockedCells` a la UI.
 *   - Si el jugador intenta clickar una celda prohibida, la ignoramos
 *     (Board ya la marca disabled, así que no llega el evento).
 *
 * Las adyacencias se calculan con la misma lógica baricéntrica del backend.
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

/** Calcula el índice lineal a partir de coordenadas baricéntricas. */
function toIndex(x: number, y: number, boardSize: number): number {
  const r = (boardSize - 1) - x;
  const rowStart = (r * (r + 1)) / 2;
  return rowStart + y;
}

/** Dado un cellId, devuelve el conjunto de cellIds adyacentes (válidos). */
function adjacentCells(cellId: number, boardSize: number): Set<number> {
  // Recuperar coordenadas baricéntricas del índice
  const iF = cellId;
  const r = Math.floor((Math.sqrt(8 * iF + 1) - 1) / 2);
  const rowStart = (r * (r + 1)) / 2;
  const c = cellId - rowStart;

  const x = boardSize - 1 - r;
  const y = c;
  const z = (boardSize - 1) - x - y;

  const candidates: [number, number, number][] = [];

  if (x > 0) {
    candidates.push([x - 1, y + 1, z]);
    candidates.push([x - 1, y, z + 1]);
  }
  if (y > 0) {
    candidates.push([x + 1, y - 1, z]);
    candidates.push([x, y - 1, z + 1]);
  }
  if (z > 0) {
    candidates.push([x + 1, y, z - 1]);
    candidates.push([x, y + 1, z - 1]);
  }

  const result = new Set<number>();
  for (const [nx, ny] of candidates) {
    if (nx >= 0 && ny >= 0 && nx + ny <= boardSize - 1) {
      result.add(toIndex(nx, ny, boardSize));
    }
  }
  return result;
}

export default function GameTabu() {
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  // Última celda jugada por cada jugador
  const lastMoveByPlayerRef = useRef<{ player0: number | null; player1: number | null }>({
    player0: null,
    player1: null,
  });
  const currentPlayerRef = useRef<"player0" | "player1">("player0");

  const [tabuCells, setTabuCells] = useState<Set<number>>(new Set());

  function computeTabu(lastOpponentCell: number | null): Set<number> {
    if (lastOpponentCell === null) return new Set();
    return adjacentCells(lastOpponentCell, size);
  }

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    const session = getUserSession();
    if (!session || !winner || savedGameIdsRef.current.has(gameId)) return;
    await recordUserGame(session.username, {
      gameId,
      mode: "tabu_hvh",
      result: winner === "player0" ? "won" : "lost",
      boardSize: size,
      totalMoves,
      opponent: "Jugador local (Tabú)",
      startedBy: hvh_starter,
    });
    savedGameIdsRef.current.add(gameId);
  }

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();
    if (session && !savedGameIdsRef.current.has(gameId)) {
      await recordUserGame(session.username, {
        gameId,
        mode: "tabu_hvh",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: "Jugador local (Tabú)",
        startedBy: hvh_starter,
      });
      savedGameIdsRef.current.add(gameId);
    }
    await deleteHvhGame(gameId);
  }

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const player = currentPlayerRef.current;
    const opponent: "player0" | "player1" = player === "player0" ? "player1" : "player0";

    const result = await hvhMove(gameId, cellId);

    // Registrar la jugada del jugador actual
    lastMoveByPlayerRef.current[player] = cellId;

    if (result.status.state === "ongoing") {
      currentPlayerRef.current = opponent;
      // Las celdas tabú para el próximo turno son las adyacentes a la jugada del jugador actual
      const newTabu = computeTabu(cellId);
      setTabuCells(newTabu);
    } else {
      setTabuCells(new Set());
    }

    return result;
  }, [size]);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    lastMoveByPlayerRef.current = { player0: null, player1: null };
    currentPlayerRef.current = "player0";
    setTabuCells(new Set());

    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvh_starter });
    return createHvhGame({ size, hvh_starter: hvh_starter });
  }, [size, hvh_starter]);

  return (
    <SessionGamePage<YEN>
      disabledCells={tabuCells}
      deps={[size, hvh_starter]}
      start={start}
      move={move}
      shouldCountMove={(turn) => turn === "player0"}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        await registerFinishedGame(gameId, winner, totalMoves);
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        await registerAbandonedGame(gameId, totalMoves);
      }}
      resultConfig={{
        title: "Juego Y — Tabu Y",
        subtitle: `Tamaño: ${size} · No puedes jugar adyacente al rival`,
        abandonOkText: "Abandonar",
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) =>
          winner === "player0" ? "Player 0 ha ganado." : "Player 1 ha ganado.",
      }}
      winnerPalette={{
        highlightedWinner: "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: `🚫 ${tabuCells.size} casilla(s) prohibida(s) — turno:`,
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
