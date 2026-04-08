/**
 * GameHoley.tsx — Variante "Holey Y"
 *
 * Antes de empezar, algunas casillas del tablero se marcan como agujeros
 * permanentemente bloqueados. Los jugadores no pueden colocar piezas en ellas.
 *
 * Implementación:
 *   - Usamos el backend HvH.
 *   - Generamos los agujeros aleatoriamente en el cliente antes de iniciar.
 *   - Bloqueamos esas casillas en el Board pasándolas como celdas `disabled`.
 *   - Si el jugador intenta clickar un agujero, rechazamos el movimiento.
 *   - Los agujeros se muestran visualmente como celdas oscuras en el Board.
 *
 * Número de agujeros: ~10% del total de celdas (mínimo 1, máximo 15% del tablero).
 */

import { useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "antd";

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

function secureRandomInt(maxExclusive: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % maxExclusive;
}

function generateHoles(totalCells: number): Set<number> {
  const count = Math.max(1, Math.min(Math.floor(totalCells * 0.12), 15));
  const holes = new Set<number>();
  const allCells = Array.from({ length: totalCells }, (_, i) => i);

  // Shuffle y tomar los primeros `count`
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }
  allCells.slice(0, count).forEach((c) => holes.add(c));
  return holes;
}

export default function GameHoley() {
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const totalCells = (size * (size + 1)) / 2;

  // Los agujeros se generan una vez al montar el componente
  const holesRef = useRef<Set<number>>(generateHoles(totalCells));
  const [holes, setHoles] = useState<Set<number>>(holesRef.current);

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    const session = getUserSession();
    if (!session || !winner || savedGameIdsRef.current.has(gameId)) return;
    await recordUserGame(session.username, {
      gameId,
      mode: "holey_hvh",
      result: winner === "player0" ? "won" : "lost",
      boardSize: size,
      totalMoves,
      opponent: "Jugador local (Holey)",
      startedBy: hvh_starter,
    });
    savedGameIdsRef.current.add(gameId);
  }

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();
    if (session && !savedGameIdsRef.current.has(gameId)) {
      await recordUserGame(session.username, {
        gameId,
        mode: "holey_hvh",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: "Jugador local (Holey)",
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
    // Rechazar si es un agujero (no debería ocurrir porque el Board lo deshabilita)
    if (holes.has(cellId)) {
      throw new Error("Esa casilla es un agujero y no se puede usar.");
    }
    return hvhMove(gameId, cellId);
  }, [holes]);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    // Regenerar agujeros al iniciar nueva partida
    const newHoles = generateHoles(totalCells);
    holesRef.current = newHoles;
    setHoles(newHoles); // <-- ESTO FORZARÁ A RENDERIZAR LOS NUEVOS AGUJEROS

    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvh_starter });
    return createHvhGame({ size, hvh_starter: hvh_starter });
  }, [size, hvh_starter, totalCells]);

  return (
    <>
      <Alert
        message={`🕳️ ${holes.size} agujero(s) en el tablero — esas casillas están bloqueadas para siempre.`}
        type="info"
        showIcon
        style={{ marginBottom: 8, maxWidth: 600, margin: "0 auto 8px" }}
      />
      <SessionGamePage<YEN>
        disabledCells={holes}  
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
          title: "Juego Y — Holey Y",
          subtitle: `Tamaño: ${size} · ${holes.size} agujero(s) en el tablero`,
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
          textPrefix: "Turno actual:",
          turns: {
            player0: { label: "Player 0", color: "#28BBF5" },
            player1: { label: "Player 1", color: "#FF7B00" },
          },
        }}
      />
    </>
  );
}
