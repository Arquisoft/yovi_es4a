import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../../api/gamey";
import type { RecordUserGameRequest } from "../../api/users";
import SessionGamePage from "../../game/SessionGamePage";
import useDeferredGameSave from "../../game/useDeferredGameSave";
import {
  createLocalHvHResultConfig,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../../game/variants";
import { getUserSession } from "../../utils/session";
import AuthModal from "../registroLogin/AuthModal";

export default function GameHvH() {
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
        mode: "classic_hvh",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: "Jugador local",
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
        onGameFinished={async ({ gameId, winner, totalMoves }) => {
          if (!winner) return;

          const payload: RecordUserGameRequest = {
            gameId,
            mode: "classic_hvh",
            result: winner === "player0" ? "won" : "lost",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local",
            startedBy: hvh_starter,
          };

          await registerFinishedGame(payload);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        celebrateWinner={(winner) => winner !== null} // se celebra solo cuando hay un ganador
        canOfferGuestSave={canOfferGuestSave}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={createLocalHvHResultConfig(
          "Juego Y — Human vs Human",
          size,
          hvh_starter,
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
