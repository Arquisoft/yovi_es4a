import { useRef, useState } from "react";
import { App } from "antd";
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
import {
  recordUserGame,
  type RecordUserGameRequest,
} from "../../api/users";
import SessionGamePage, {
  type FinishedGamePayload,
} from "../../game/SessionGamePage";
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
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingPendingGame, setSavingPendingGame] = useState(false);
  const [pendingFinishedGame, setPendingFinishedGame] = useState<RecordUserGameRequest | null>(null);

  const size = parseBoardSize(searchParams.get("size"));
  const botId = searchParams.get("bot") ?? "random_bot";
  const hvb_starter = parseHvBStarter(searchParams.get("hvbstarter"));

  const participantLabels = {
    human: "Humano",
    bot: botId,
  } as const;

  async function saveGameForCurrentSession(payload: RecordUserGameRequest) {
    const session = getUserSession();
    if (!session)
      throw new Error("No hay ninguna sesión iniciada.");

    if (savedGameIdsRef.current.has(payload.gameId))
      return;

    await recordUserGame(session.username, payload);
    savedGameIdsRef.current.add(payload.gameId);
  }

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    if (!winner) return;
    if (savedGameIdsRef.current.has(gameId)) return;

    const result = winner === "human" ? "won" : "lost";

    const payload: RecordUserGameRequest = {
      gameId,
      mode: "HvB",
      result,
      boardSize: size,
      totalMoves,
      opponent: botId,
      startedBy: hvb_starter,
    };

    const session = getUserSession();

    if (session) {
      await saveGameForCurrentSession(payload);
      return;
    }

    setPendingFinishedGame(payload);
  }

  async function registerAbandonedGame(gameId: string, totalMoves: number) {
    const session = getUserSession();

    if (session && !savedGameIdsRef.current.has(gameId)) {
      await recordUserGame(session.username, {
        gameId,
        mode: "HvB",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: botId,
        startedBy: hvb_starter,
      });

      savedGameIdsRef.current.add(gameId);
    }

    await deleteHvbGame(gameId);
  }

  function handleGuestSaveRequested(_payload: FinishedGamePayload) {
    if (!pendingFinishedGame) return;
    setAuthModalOpen(true);
  }

  async function handleLoginSuccess() {
    if (!pendingFinishedGame) return;

    try {
      setSavingPendingGame(true);
      await saveGameForCurrentSession(pendingFinishedGame);
      message.success("La partida se ha guardado correctamente en tu cuenta.");
      setPendingFinishedGame(null);
      setAuthModalOpen(false);
    } catch (err: any) {
      message.error(
        err?.message ?? "No se pudo guardar la partida en tu cuenta."
      );
    } finally {
      setSavingPendingGame(false);
    }
  }

  return (
    <>
      <SessionGamePage<YEN>
        deps={[size, botId, hvb_starter]}
        start={async () => {
          await putConfig({
            size,
            hvb_starter: hvb_starter,
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
        onGameFinished={async ({ gameId, winner, totalMoves }) => {
          await registerFinishedGame(gameId, winner, totalMoves);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        canOfferGuestSave={!getUserSession() && !!pendingFinishedGame}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={{
          title: "Juego Y — Human vs Bot",
          subtitle: `Tamaño: ${size} · Bot: ${participantLabels.bot} · Empieza: ${getStarterLabel(
            hvb_starter,
            participantLabels.bot
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
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
