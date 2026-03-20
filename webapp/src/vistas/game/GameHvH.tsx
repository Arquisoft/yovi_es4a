import { useSearchParams } from "react-router-dom";

import { createHvhGame, hvhMove, putConfig, type YEN } from "../../api/gamey";
import SessionGamePage from "../../game/SessionGamePage";

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
