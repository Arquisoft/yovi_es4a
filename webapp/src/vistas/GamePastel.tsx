import { useSearchParams } from "react-router-dom";
import { useState, useCallback } from "react";
import { Button, Space, Typography } from "antd";
import { SwapOutlined } from "@ant-design/icons";

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

const { Text } = Typography;

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

export default function GamePastel() {
  const [searchParams] = useSearchParams();
  const size = parseBoardSize(searchParams.get("size"));
  const [swapped, setSwapped] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  // Labels depend on whether we swapped or not
  const playerLabels = swapped 
    ? { player0: "Player 1 (ex-P0)", player1: "Player 0 (ex-P1)" }
    : { player0: "Player 0", player1: "Player 1" };

  const handleSwap = () => {
    setSwapped(true);
    // After swapping, it's the "new" P1's turn (the one who was P0)
    // Actually, in Pie Rule: P1 moves, P2 swaps. P2 is now P1 and HAS moved.
    // So it's P1's turn (the original P0).
  };

  const start = useCallback(async () => {
    setSwapped(false);
    setMoveCount(0);
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: "player0" });
    const res = await createHvhGame({ size, hvh_starter: "player0" });
    return {
      ...res,
      status: res.status as any
    };
  }, [size]);

  const move = useCallback(async (gameId: string, cellId: number) => {
    const res = await hvhMove(gameId, cellId);
    setMoveCount(prev => prev + 1);
    return {
      ...res,
      status: res.status as any
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
        
        let result: "won" | "lost" = "won";
        if (swapped) {
            result = winner === "player1" ? "won" : "lost";
        } else {
            result = winner === "player0" ? "won" : "lost";
        }

        await recordUserGame(session.username, {
          gameId,
          mode: "pastel_hvh",
          result,
          boardSize: size,
          totalMoves,
          opponent: "Jugador local (Pastel)",
          startedBy: "player0",
        });
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        const session = getUserSession();
        if (session) {
          await recordUserGame(session.username, {
            gameId,
            mode: "pastel_hvh",
            result: "abandoned",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (Pastel)",
            startedBy: "player0",
          });
        }
        await deleteHvhGame(gameId);
      }}
      resultConfig={{
        title: "Juego Y — Regla del Pastel",
        subtitle: `Tamaño: ${size} · Un jugador coloca, el otro elige`,
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => {
            const w = swapped 
                ? (winner === "player0" ? "Player 1" : "Player 0")
                : (winner === "player0" ? "Player 0" : "Player 1");
            return `${w} ha ganado la partida.`;
        }
      }}
      winnerPalette={{
        highlightedWinner: swapped ? "player1" : "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: swapped ? "🔄 Swap activo — Turno:" : "Turno actual:",
        turns: {
          player0: { label: playerLabels.player0, color: "#28BBF5" },
          player1: { label: playerLabels.player1, color: "#FF7B00" },
        },
      }}
      // Custom indicator to show the Swap button
      turnIndicator={
        moveCount === 1 && !swapped ? (
            <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ background: '#fffbe6', padding: 8, border: '1px solid #ffe58f', borderRadius: 4 }}>
                    <Text>P0 ha movido. P1: ¿Quieres <b>Intercambiar</b> bandos o <b>Ceder</b> el turno?</Text>
                    <Button 
                        type="primary" 
                        size="small" 
                        icon={<SwapOutlined />} 
                        onClick={handleSwap}
                        style={{ marginLeft: 8 }}
                    >
                        Intercambiar (Ser P0)
                    </Button>
                </div>
            </Space>
        ) : undefined
      }
    />
  );
}
