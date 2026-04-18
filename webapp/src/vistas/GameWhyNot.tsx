import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import type { RecordUserGameRequest } from "../api/users";
import SessionGamePage from "../game/SessionGamePage";
import useDeferredGameSave from "../game/useDeferredGameSave";
import {
  createLocalHvHResultConfig,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../game/variants";
import { getUserSession } from "../utils/session";
import AuthModal from "./registroLogin/AuthModal";

function invertWinner(winner: string | null): string | null {
  if (winner === "player0")
    return "player1";
  if (winner === "player1")
    return "player0";
  return winner;
}

export default function GameWhyNot() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave,
    saveGameForCurrentSession,
    registerFinishedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
  } = useDeferredGameSave();

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();

    if (session) {
      await saveGameForCurrentSession({
        gameId,
        mode: "why_not_hvh",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: "Jugador local (WhY Not)",
        startedBy: hvh_starter,
      });
    }

    await deleteHvhGame(gameId);
  }

  return (
    <>
      <SessionGamePage<YEN>
        deps={[size, hvh_starter]}
        start={async () => {
          await putConfig({
            size,
            hvb_starter: "human",
            bot_id: null,
            hvh_starter,
          });

          return createHvhGame({
            size,
            hvh_starter,
          });
        }}
        move={(gameId, cellId) => hvhMove(gameId, cellId)}
        shouldCountMove={(turn) => turn === "player0"}
        mapWinner={invertWinner}
        onGameFinished={async ({ gameId, winner, totalMoves }) => {
          if (!winner)
            return;

          const payload: RecordUserGameRequest = {
            gameId,
            mode: "why_not_hvh",
            result: winner === "player0" ? "won" : "lost",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (WhY Not)",
            startedBy: hvh_starter,
          };

          await registerFinishedGame(payload);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        celebrateWinner={(winner) => winner !== null}
        canOfferGuestSave={canOfferGuestSave}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={createLocalHvHResultConfig(
          "Juego Y — WhY Not",
          size,
          hvh_starter,
          "Conectar los tres lados te hace perder",
        )}
        winnerPalette={LOCAL_HVH_WINNER_PALETTE}
        turnConfig={LOCAL_HVH_TURN_CONFIG}
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}