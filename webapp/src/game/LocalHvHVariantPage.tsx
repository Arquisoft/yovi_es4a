import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import type { GameMode, RecordUserGameRequest } from "../api/users";
import { getUserSession } from "../utils/session";
import AuthModal from "../vistas/registroLogin/AuthModal";
import SessionGamePage from "./SessionGamePage";
import useDeferredGameSave from "./useDeferredGameSave";
import {
  createLocalHvHResultConfig,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "./variants";

type Props = {
  title: string;
  mode: GameMode;
  opponent: string;
  subtitleSuffix?: string;
  mapWinner?: (winner: string | null) => string | null;
};

export default function LocalHvHVariantPage({
  title,
  mode,
  opponent,
  subtitleSuffix,
  mapWinner,
}: Props) {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

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
        mode,
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent,
        startedBy: hvhStarter,
      });
    }

    await deleteHvhGame(gameId);
  }

  async function handleGameFinished({
    gameId,
    winner,
    totalMoves,
  }: {
    gameId: string;
    winner: string | null;
    totalMoves: number;
  }) {
    const payload: RecordUserGameRequest = {
      gameId,
      mode,
      result:
        winner === null
          ? "draw"
          : winner === "player0"
            ? "won"
            : "lost",
      boardSize: size,
      totalMoves,
      opponent,
      startedBy: hvhStarter,
    };

    await registerFinishedGame(payload);
  }

  return (
    <>
      <SessionGamePage<YEN>
        deps={[size, hvhStarter]}
        start={async () => {
          await putConfig({
            size,
            hvb_starter: "human",
            bot_id: null,
            hvh_starter: hvhStarter,
          });

          return createHvhGame({
            size,
            hvh_starter: hvhStarter,
          });
        }}
        move={(gameId, cellId) => hvhMove(gameId, cellId)}
        shouldCountMove={(turn) => turn === "player0"}
        mapWinner={mapWinner}
        onGameFinished={handleGameFinished}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        canOfferGuestSave={canOfferGuestSave}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={createLocalHvHResultConfig(
          title,
          size,
          hvhStarter,
          subtitleSuffix,
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
