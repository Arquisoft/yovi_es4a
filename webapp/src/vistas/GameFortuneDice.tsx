/**
 * GameFortuneDice.tsx — Variante "Fortune Y — Dado"
 *
 * Al inicio de cada turno se lanza un dado de 6 caras.
 * El resultado indica cuántas piezas puede colocar el jugador activo ese turno.
 * Después pasa al oponente.
 *
 * Implementación:
 *   - Usamos el backend HvH.
 *   - Lanzamos el dado al inicio de cada turno.
 *   - Acumulamos clicks hasta llegar al número del dado, luego alternamos.
 *   - Sobreescribimos el `next` de la respuesta mientras no se hayan
 *     colocado todas las piezas del turno.
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

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export default function GameFortuneDice() {
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter: StarterHvH = "player0";

  // Número de piezas que quedan por colocar en el turno actual
  const piecesLeftRef = useRef(rollDie());
  const currentPlayerRef = useRef<"player0" | "player1">("player0");

  const [diceValue, setDiceValue] = useState(piecesLeftRef.current);
  const [piecesLeft, setPiecesLeft] = useState(piecesLeftRef.current);

  const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    const session = getUserSession();
    if (!session || !winner || savedGameIdsRef.current.has(gameId)) return;
    await recordUserGame(session.username, {
      gameId, mode: "HvH", result: winner === "player0" ? "won" : "lost",
      boardSize: size, totalMoves,
      opponent: "Jugador local (Dado)", startedBy: hvh_starter,
    });
    savedGameIdsRef.current.add(gameId);
  }

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();
    if (session && !savedGameIdsRef.current.has(gameId)) {
      await recordUserGame(session.username, {
        gameId, mode: "HvH", result: "abandoned",
        boardSize: size, totalMoves,
        opponent: "Jugador local (Dado)", startedBy: hvh_starter,
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

    if (result.status.state === "finished") return result;

    piecesLeftRef.current -= 1;

    if (piecesLeftRef.current > 0) {
      // Aún quedan piezas en este turno: mantener el mismo jugador
      setPiecesLeft(piecesLeftRef.current);
      return {
        ...result,
        status: { state: "ongoing", next: currentPlayerRef.current },
      };
    }

    // Turno terminado: alternar jugador y lanzar dado
    const nextPlayer: "player0" | "player1" =
      currentPlayerRef.current === "player0" ? "player1" : "player0";
    currentPlayerRef.current = nextPlayer;

    const roll = rollDie();
    piecesLeftRef.current = roll;
    setDiceValue(roll);
    setPiecesLeft(roll);

    return { ...result, status: { state: "ongoing", next: nextPlayer } };
  }, []);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    const roll = rollDie();
    piecesLeftRef.current = roll;
    currentPlayerRef.current = "player0";
    setDiceValue(roll);
    setPiecesLeft(roll);

    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvh_starter });
    const game = await createHvhGame({ size, hvh_starter: hvh_starter });
    return {
      ...game,
      status: game.status.state === "ongoing"
        ? { state: "ongoing", next: "player0" as const }
        : game.status,
    };
  }, [size]);

  const diceEmoji = DICE_FACES[diceValue - 1];

  return (
    <SessionGamePage<YEN>
      deps={[size]}
      start={start}
      move={move}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        await registerFinishedGame(gameId, winner, totalMoves);
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        await registerAbandonedGame(gameId, totalMoves);
      }}
      resultConfig={{
        title: "Juego Y — Fortune Dado",
        subtitle: `Tamaño: ${size} · Piezas por turno según dado`,
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
        textPrefix: `${diceEmoji} Dado: ${diceValue} piezas (quedan ${piecesLeft}) — turno:`,
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
