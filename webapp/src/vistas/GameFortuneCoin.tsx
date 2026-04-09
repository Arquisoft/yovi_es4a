import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import { message } from "antd";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";
import { getUserSession } from "../utils/session";
import { recordUserGame } from "../api/users";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

function flipCoin(): "player0" | "player1" {
  return Math.random() < 0.5 ? "player0" : "player1";
}

export default function GameFortuneCoin() {
  const [searchParams] = useSearchParams();
  const size = parseBoardSize(searchParams.get("size"));

  const start = useCallback(async () => {
    const initialTurn = flipCoin();
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: initialTurn });
    const res = await createHvhGame({ size, hvh_starter: initialTurn });
    message.info(`🪙 Moneda lanzada: Empieza ${initialTurn === "player0" ? "Player 0 (Azul)" : "Player 1 (Naranja)"}`);
    return res;
  }, [size]);

  const move = useCallback(async (gameId: string, cellId: number) => {
    const next = flipCoin();
    const nextInt = next === "player0" ? 0 : 1;
    const res = await hvhMove(gameId, cellId, undefined, nextInt);
    if (res.status.state === "finished") return { ...res, status: res.status as any };

    message.info(`🪙 ¡Moneda! Siguiente turno: ${next === "player0" ? "Player 0 (Azul)" : "Player 1 (Naranja)"}`);
    return {
        ...res,
        status: { ...res.status, next } as any
    };
  }, []);

  return (
    <SessionGamePage<YEN>
      deps={[size]}
      start={start}
      move={move}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        const session = getUserSession();
        if (!session || !winner) return;
        
        await recordUserGame(session.username, {
          gameId,
          mode: "fortune_coin_hvh",
          result: winner === "player0" ? "won" : "lost",
          boardSize: size,
          totalMoves,
          opponent: "Jugador local (Fortune Moneda)",
          startedBy: "player0",
        });
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        const session = getUserSession();
        if (session) {
          await recordUserGame(session.username, {
            gameId,
            mode: "fortune_coin_hvh",
            result: "abandoned",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (Fortune Moneda)",
            startedBy: "player0",
          });
        }
        await deleteHvhGame(gameId);
      }}
      resultConfig={{
        title: "Juego Y — Fortune Moneda",
        subtitle: `Tamaño: ${size} · Se lanza una moneda cada turno`,
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => `${winner === "player0" ? "Player 0" : "Player 1"} ha ganado.`
      }}
      winnerPalette={{
        highlightedWinner: "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: "🪙 Lanza moneda... Turno:",
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
    />
  );
}
