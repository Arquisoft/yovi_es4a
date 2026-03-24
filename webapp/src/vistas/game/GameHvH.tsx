import { useRef, useState } from "react";
import { App } from "antd";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
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
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingPendingGame, setSavingPendingGame] = useState(false);
  const [pendingFinishedGame, setPendingFinishedGame] = useState<RecordUserGameRequest | null>(null);

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const playerLabels = {
    player0: "Player 0",
    player1: "Player 1",
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

    const result = winner === "player0" ? "won" : "lost";

    const payload: RecordUserGameRequest = {
      gameId,
      mode: "HvH",
      result,
      boardSize: size,
      totalMoves,
      opponent: "Jugador local",
      startedBy: hvh_starter,
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
        mode: "HvH",
        result: "abandoned",
        boardSize: size,
        totalMoves,
        opponent: "Jugador local",
        startedBy: hvh_starter,
      });

      savedGameIdsRef.current.add(gameId);
    }

    await deleteHvhGame(gameId);
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
          await registerFinishedGame(gameId, winner, totalMoves);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        canOfferGuestSave={!getUserSession() && !!pendingFinishedGame}
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
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}