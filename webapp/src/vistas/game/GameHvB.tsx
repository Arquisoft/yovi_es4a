import { useSearchParams } from "react-router-dom";

import {
  createHvbGame,
  hvbBotMove,
  hvbHumanMove,
  hvbHint,
  putConfig,
  type YEN,
} from "../../api/gamey";
import SessionGamePage from "../../game/SessionGamePage";

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

  return (
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
      resultConfig={{
        title: "Juego Y — Human vs Bot",
        subtitle: `Tamaño: ${size} · Bot: ${participantLabels.bot} · Empieza: ${getStarterLabel(hvb_starter, participantLabels.bot)}`,
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
  );
}
