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
import { getUserSession } from "../../utils/session";
import AuthModal from "../registroLogin/AuthModal";

type StarterHvH = "player0" | "player1" | "random";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

function parseHvHStarter(raw: string | null): StarterHvH {
  const value = (raw ?? "player0").toLowerCase();
  if (value === "player1") return "player1";
  if (value === "random") return "random";
  return "player0";
}

function getStarterLabel(hvh_starter: StarterHvH): string {
  switch (hvh_starter) {
    case "player0":
      return "Player 0";
    case "player1":
      return "Player 1";
    case "random":
      return "Aleatorio";
  }
}

export default function GameHvH() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const playerLabels = {
    player0: "Player 0",
    player1: "Player 1",
  } as const;

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
        resultConfig={{
          title: "Juego Y — Human vs Human",
          subtitle: `Tamaño: ${size} · Empieza: ${getStarterLabel(hvh_starter)}`,
          abandonOkText: "Abandonar",
          getResultTitle: () => "Partida finalizada",
          getResultText: (winner) =>
            winner === "player0"
              ? `${playerLabels.player0} ha ganado la partida.`
              : `${playerLabels.player1} ha ganado la partida.`,
        }}
        winnerPalette={{
          highlightedWinner: "player0",
          highlightedBackground: "#28bbf532",
          otherWinnerBackground: "#ff7b0033",
        }}
        turnConfig={{
          textPrefix: "Turno actual:",
          turns: {
            player0: {
              label: playerLabels.player0,
              color: "#28BBF5",
            },
            player1: {
              label: playerLabels.player1,
              color: "#FF7B00",
            },
          },
        }}
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
