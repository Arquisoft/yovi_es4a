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

export default function Game3DY() {
  const size = 6; // Fixed size for 3D demonstration

  const start = useCallback(async () => {
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: "player0" });
    return createHvhGame({ size, hvh_starter: "player0" });
  }, []);

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
        await recordUserGame(session.username, {
          gameId,
          mode: "3dy_hvh",
          result: winner === "player0" ? "won" : "lost",
          boardSize: size,
          totalMoves,
          opponent: "Jugador local (3DY)",
          startedBy: "player0",
        });
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        const session = getUserSession();
        if (session) {
          await recordUserGame(session.username, {
            gameId,
            mode: "3dy_hvh",
            result: "abandoned",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (3DY)",
            startedBy: "player0",
          });
        }
        await deleteHvhGame(gameId);
      }}
      resultConfig={{
        title: "Juego Y — 3DY",
        subtitle: `Representación tetraédrica (Capas: 3, 2, 1)`,
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => `${winner === "player0" ? "Player 0" : "Player 1"} ha ganado.`
      }}
      winnerPalette={{
        highlightedWinner: "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: "🧊 3D — Turno:",
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
