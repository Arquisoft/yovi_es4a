import { useSearchParams } from "react-router-dom";

import {
  createHvbGame,
  deleteHvbGame,
  hvbBotMove,
  hvbHumanMove,
  hvbHint,
  putConfig,
  type YEN,
} from "../../api/gamey";
import type { RecordUserGameRequest } from "../../api/users";
import SessionGamePage from "../../game/SessionGamePage";
import useDeferredGameSave from "../../game/useDeferredGameSave";
import { getUserSession } from "../../utils/session";
import AuthModal from "../registroLogin/AuthModal";

type StarterHvB = "human" | "bot" | "random";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

function parseHvBStarter(raw: string | null): StarterHvB {
  const value = (raw ?? "human").toLowerCase();
  if (value === "bot") return "bot";
  if (value === "random") return "random";
  return "human";
}

function getStarterLabel(hvb_starter: StarterHvB, botId: string): string {
  switch (hvb_starter) {
    case "human":
      return "Humano";
    case "bot":
      return botId;
    case "random":
      return "Aleatorio";
  }
}

export default function GameHvB() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const botId = searchParams.get("bot") ?? "random_bot";
  const hvb_starter = parseHvBStarter(searchParams.get("hvbstarter"));

  const participantLabels = {
    human: "Humano",
    bot: botId,
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
        mode: "classic_hvb",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: botId,
        startedBy: hvb_starter,
      });
    }

    await deleteHvbGame(gameId);
  }

  return (
    <>
      <SessionGamePage<YEN>
        deps={[size, botId, hvb_starter]}
        start={async () => {
          await putConfig({
            size,
            hvb_starter,
            bot_id: botId,
            hvh_starter: "player0",
          });

          return createHvbGame({
            size,
            bot_id: botId,
            hvb_starter,
          });
        }}
        move={(gameId, cellId) => hvbHumanMove(gameId, cellId)}
        botMove={(gameId) => hvbBotMove(gameId)}
        onHint={(gameId) => hvbHint(gameId).then((r) => r.hint_cell_id)}
        shouldCountMove={(turn) => turn === "human"}
        onGameFinished={async ({ gameId, winner, totalMoves }) => {
          if (!winner) return;

          const payload: RecordUserGameRequest = {
            gameId,
            mode: "classic_hvb",
            result: winner === "human" ? "won" : "lost",
            boardSize: size,
            totalMoves,
            opponent: botId,
            startedBy: hvb_starter,
          };

          await registerFinishedGame(payload);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        celebrateWinner={(winner) => winner === "human"} // se celebra solo cuando gana el humano
        canOfferGuestSave={canOfferGuestSave}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={{
          title: "Juego Y — Human vs Bot",
          subtitle: `Tamaño: ${size} · Bot: ${participantLabels.bot} · Empieza: ${getStarterLabel(
            hvb_starter,
            participantLabels.bot,
          )}`,
          abandonOkText: "Sí, abandonar",
          getResultTitle: (winner) =>
            winner === "human" ? "¡Felicidades!" : "Game Over",
          getResultText: (winner) =>
            winner === "human"
              ? "Has ganado la partida."
              : `Ha ganado ${participantLabels.bot}. ¡Inténtalo de nuevo!`,
        }}
        winnerPalette={{
          highlightedWinner: "human",
          highlightedBackground: "#28bbf532",
          otherWinnerBackground: "#ff7b0033",
        }}
        turnConfig={{
          textPrefix: "Turno actual:",
          turns: {
            human: {
              label: participantLabels.human,
              color: "#28BBF5",
            },
            bot: {
              label: participantLabels.bot,
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
