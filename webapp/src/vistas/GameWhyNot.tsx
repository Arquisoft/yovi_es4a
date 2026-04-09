import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";
import { getUserSession } from "../utils/session";
import { recordUserGame } from "../api/users";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

export default function GameWhyNot() {
  const [searchParams] = useSearchParams();
  const size = parseBoardSize(searchParams.get("size"));

  const start = useCallback(async () => {
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: "player0" });
    return createHvhGame({ size, hvh_starter: "player0" });
  }, [size]);

  const move = useCallback(async (gameId: string, cellId: number) => {
    return hvhMove(gameId, cellId);
  }, []);

  return (
    <SessionGamePage<YEN>
      deps={[size]}
      start={start}
      move={move}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        const session = getUserSession();
        if (!session || !winner) return;
        
        // Invert winner for "WhY not" (misere)
        const realWinner = winner === "player0" ? "player1" : "player0";
        
        await recordUserGame(session.username, {
          gameId,
          mode: "whynot_hvh",
          result: realWinner === "player0" ? "won" : "lost",
          boardSize: size,
          totalMoves,
          opponent: "Jugador local (WhY not)",
          startedBy: "player0",
        });
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        const session = getUserSession();
        if (session) {
          await recordUserGame(session.username, {
            gameId,
            mode: "whynot_hvh",
            result: "abandoned",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (WhY not)",
            startedBy: "player0",
          });
        }
        await deleteHvhGame(gameId);
      }}
      resultConfig={{
        title: "Juego Y — WhY not",
        subtitle: `Tamaño: ${size} · El primero en conectar ¡PIERDE!`,
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => {
            const loser = winner === "player0" ? "Player 0" : "Player 1";
            const victor = winner === "player0" ? "Player 1" : "Player 0";
            return `${loser} conectó los 3 lados y ha PERDIDO. ¡Victoria para ${victor}!`;
        }
      }}
      winnerPalette={{
        highlightedWinner: "player1", // Use player 1 as highlighted winner inverting the standard
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: "🚯 Misere — Turno:",
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
