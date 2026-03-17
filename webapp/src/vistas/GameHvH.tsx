import { useSearchParams } from "react-router-dom";

import { createHvhGame, hvhMove, putConfig, type YEN } from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";

type StarterHvH = "player0" | "player1";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

function parseHvHStarter(raw: string | null): StarterHvH {
  return (raw ?? "player0").toLowerCase() === "player1" ? "player1" : "player0";
}

export default function GameHvH() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const starter = parseHvHStarter(searchParams.get("hvhstarter"));

  const playerLabels = {
    player0: "Player 0",
    player1: "Player 1",
  } as const;

  return (
    <SessionGamePage<YEN>
      deps={[size, starter]}
      start={async () => {
        await putConfig({
          size,
          hvb_starter: "human",
          bot_id: null,
          hvh_starter: starter,
        });

        return createHvhGame({
          size,
          hvh_starter: starter,
        });
      }}
      move={(gameId, cellId) => hvhMove(gameId, cellId)}
      resultConfig={{
        title: "Juego Y — Human vs Human",
        subtitle: `Tamaño: ${size} · Empieza: ${playerLabels[starter]}`,
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