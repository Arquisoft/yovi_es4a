import { useSearchParams } from "react-router-dom";

import { createHvbGame, hvbHumanMove, putConfig, type YEN } from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";

type StarterHvB = "human" | "bot";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

function parseHvBStarter(raw: string | null): StarterHvB {
  return (raw ?? "human").toLowerCase() === "bot" ? "bot" : "human";
}

export default function GameHvB() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const botId = searchParams.get("bot") ?? "random_bot";
  const starter = parseHvBStarter(searchParams.get("hvbstarter"));

  return (
    <SessionGamePage<YEN>
      deps={[size, botId, starter]}
      start={async () => {
        await putConfig({
          size,
          hvb_starter: starter,
          bot_id: botId,
          hvh_starter: "player0",
        });

        return createHvbGame({
          size,
          bot_id: botId,
          hvb_starter: starter,
        });
      }}
      move={(gameId, cellId) => hvbHumanMove(gameId, cellId)}
      resultConfig={{
        title: "Juego Y — Human vs Bot",
        subtitle: `Tamaño: ${size} · Bot: ${botId} · Empieza: ${starter}`,
        abandonOkText: "Sí, abandonar",
        getResultTitle: (winner) =>
          winner === "human" ? "¡Felicidades!" : "Game Over",
        getResultText: (winner) =>
          winner === "human"
            ? "Has ganado la partida."
            : "Ha ganado el bot. ¡Inténtalo de nuevo!",
      }}
      winnerPalette={{
        highlightedWinner: "human",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
    />
  );
}