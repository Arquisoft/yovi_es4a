import type { YEN as GameYEN } from "../api/gamey";
import type { GameMode } from "../api/users";
import { deleteHvhGame } from "../api/gamey";
import type { StarterHvH } from "./variants";
import SessionGamePage, { type SessionGamePageProps } from "./SessionGamePage";
import useLocalVariantGameSave from "./useLocalVariantGameSave";
import AuthModal from "../vistas/registroLogin/AuthModal";

type LocalHvHSessionLayoutProps<TYen extends GameYEN> = SessionGamePageProps<TYen> & {
  boardSize: number;
  mode: GameMode;
  opponent: string;
  startedBy: StarterHvH;
};

export default function LocalHvHSessionLayout<TYen extends GameYEN>({
  boardSize,
  mode,
  opponent,
  startedBy,
  onGameFinished,
  onGameAbandoned,
  canOfferGuestSave,
  onGuestSaveRequested,
  guestSaveLoading,
  ...sessionProps
}: LocalHvHSessionLayoutProps<TYen>) {
  const {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave: canOfferLocalGuestSave,
    registerFinishedGame,
    registerAbandonedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
  } = useLocalVariantGameSave({
    boardSize,
    mode,
    opponent,
    startedBy,
    deleteGame: deleteHvhGame,
  });

  return (
    <>
      <SessionGamePage<TYen>
        {...sessionProps}
        onGameFinished={async (payload) => {
          await registerFinishedGame(payload.gameId, payload.winner, payload.totalMoves);
          await onGameFinished?.(payload);
        }}
        onGameAbandoned={async (payload) => {
          await registerAbandonedGame(payload.gameId, payload.totalMoves);
          await onGameAbandoned?.(payload);
        }}
        canOfferGuestSave={canOfferGuestSave ?? canOfferLocalGuestSave}
        onGuestSaveRequested={onGuestSaveRequested ?? handleGuestSaveRequested}
        guestSaveLoading={guestSaveLoading ?? savingPendingGame}
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
