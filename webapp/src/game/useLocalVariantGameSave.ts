import { useCallback, useRef } from "react";

import { recordUserGame, type GameMode } from "../api/users";
import { getUserSession } from "../utils/session";

type Starter = "player0" | "player1" | "random";

type UseLocalVariantGameSaveArgs = {
  boardSize: number;
  mode: GameMode;
  opponent: string;
  startedBy: Starter;
  deleteGame: (gameId: string) => Promise<unknown>;
};

export default function useLocalVariantGameSave({
  boardSize,
  mode,
  opponent,
  startedBy,
  deleteGame,
}: UseLocalVariantGameSaveArgs) {
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const registerFinishedGame = useCallback(
    async (gameId: string, winner: string | null, totalMoves: number) => {
      const session = getUserSession();

      if (!session || savedGameIdsRef.current.has(gameId))
        return;

      await recordUserGame(session.username, {
        gameId,
        mode,
        result:
          winner === "player0" ? "won" :
          winner === "player1" ? "lost" :
          "draw",
        boardSize,
        totalMoves,
        opponent,
        startedBy,
      });

      savedGameIdsRef.current.add(gameId);
    },
    [boardSize, mode, opponent, startedBy],
  );

  const registerAbandonedGame = useCallback(
    async (gameId: string, totalMoves: number) => {
      const session = getUserSession();

      if (session && !savedGameIdsRef.current.has(gameId)) {
        await recordUserGame(session.username, {
          gameId,
          mode,
          result: "abandoned",
          boardSize,
          totalMoves,
          opponent,
          startedBy,
        });

        savedGameIdsRef.current.add(gameId);
      }

      await deleteGame(gameId);
    },
    [boardSize, deleteGame, mode, opponent, startedBy],
  );

  return {
    registerFinishedGame,
    registerAbandonedGame,
  };
}
