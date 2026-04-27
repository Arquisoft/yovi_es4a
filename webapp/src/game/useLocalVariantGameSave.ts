import { useCallback } from "react";

import type { GameMode } from "../api/users";
import { getUserSession } from "../utils/session";
import type { FinishedGamePayload } from "./SessionGamePage";
import useDeferredGameSave from "./useDeferredGameSave";

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
  const {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave,
    registerFinishedGame: registerDeferredFinishedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
    saveGameForCurrentSession,
  } = useDeferredGameSave();

  const registerFinishedGame = useCallback(
    async (gameId: string, winner: string | null, totalMoves: number) => {
      await registerDeferredFinishedGame({
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
    },
    [boardSize, mode, opponent, registerDeferredFinishedGame, startedBy],
  );

  const registerAbandonedGame = useCallback(
    async (gameId: string, totalMoves: number) => {
      const session = getUserSession();

      if (session) {
        await saveGameForCurrentSession({
          gameId,
          mode,
          result: "abandoned",
          boardSize,
          totalMoves,
          opponent,
          startedBy,
        });
      }

      await deleteGame(gameId);
    },
    [boardSize, deleteGame, mode, opponent, saveGameForCurrentSession, startedBy],
  );

  return {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave,
    registerFinishedGame,
    registerAbandonedGame,
    handleGuestSaveRequested: (payload: FinishedGamePayload) => handleGuestSaveRequested(payload),
    handleLoginSuccess,
    closeAuthModal,
  };
}
