import { useRef } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../../api/gamey";
import { recordUserGame } from "../../api/users";
import SessionGamePage from "../../game/SessionGamePage";
import { getUserSession } from "../../utils/session";

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
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const size = parseBoardSize(searchParams.get("size"));
  const hvh_starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const playerLabels = {
    player0: "Player 0",
    player1: "Player 1",
  } as const;

  async function registerFinishedGame(gameId: string, winner: string | null, totalMoves: number) {
    const session = getUserSession();
    if (!session) return;
    if (!winner) return;
    if (savedGameIdsRef.current.has(gameId)) return;

    const result = winner === "player0" ? "won" : "lost";

    await recordUserGame(session.username, {
      gameId,
      mode: "HvH",
      result,
      boardSize: size,
      totalMoves,
      opponent: "Jugador local",
      startedBy: hvh_starter,
    });

    savedGameIdsRef.current.add(gameId);
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

  return (
    <SessionGamePage<YEN>
      deps={[size, hvh_starter]}
      start={async () => {
        await putConfig({
          size,
          hvb_starter: "human",
          bot_id: null,
          hvh_starter: hvh_starter,
        });

        return createHvhGame({
          size,
          hvh_starter: hvh_starter,
        });
      }}
      move={(gameId, cellId) => hvhMove(gameId, cellId)}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        await registerFinishedGame(gameId, winner, totalMoves);
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        await registerAbandonedGame(gameId, totalMoves);
      }}
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
  );
}
