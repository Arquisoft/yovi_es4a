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
import SessionGamePage from "../game/SessionGamePage";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

type StarterHvH = "player0" | "player1" | "random";

function parseBoardSize(raw: string | null): number {
  const n = Number(raw ?? "7");
  return Number.isFinite(n) && n >= 2 ? n : 7;
}

function rollDice(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 6) + 1;
}

export default function GameFortuneDice() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter: StarterHvH = "player0";

  // Número de piezas que quedan por colocar en el turno actual
  const piecesLeftRef = useRef(rollDice());
  const currentPlayerRef = useRef<"player0" | "player1">("player0");

  const [diceValue, setDiceValue] = useState(piecesLeftRef.current);
  const [piecesLeft, setPiecesLeft] = useState(piecesLeftRef.current);

  const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const { registerFinishedGame, registerAbandonedGame } =
    useLocalVariantGameSave({
      boardSize: size,
      mode: "fortune_dice_hvh",
      opponent: "Jugador local (Dado)",
      startedBy: hvh_starter,
      deleteGame: deleteHvhGame,
    });

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const curPlayer = currentPlayerRef.current;
    const curNextInt = curPlayer === "player0" ? 0 : 1;
    
    // Si quedan piezas, forzamos que el siguiente siga siendo el actual
    const nextPlayerOverride = piecesLeftRef.current > 1 ? curNextInt : undefined;

    const result = await hvhMove(gameId, cellId, undefined, nextPlayerOverride);

    if (result.status.state === "finished") return result;

    piecesLeftRef.current -= 1;

    if (piecesLeftRef.current > 0) {
      setPiecesLeft(piecesLeftRef.current);
      return {
        ...result,
        status: { state: "ongoing", next: curPlayer },
      };
    }

    // Turno terminado: alternar jugador y lanzar dado
    const nextPlayer: "player0" | "player1" =
      currentPlayerRef.current === "player0" ? "player1" : "player0";
    currentPlayerRef.current = nextPlayer;

    const roll = rollDice();
    piecesLeftRef.current = roll;
    setDiceValue(roll);
    setPiecesLeft(roll);

    return { ...result, status: { state: "ongoing", next: nextPlayer } };
  }, []);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    const roll = rollDice();
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
          winner === "player0"
            ? "Player 0 ha ganado."
            : winner === "player1"
              ? "Player 1 ha ganado."
              : "La partida terminó en empate.",
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
