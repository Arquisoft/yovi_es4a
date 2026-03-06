import { useMemo } from "react";
import {
  App,
  Button,
  Card,
  Flex,
  Space,
  Typography,
} from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createHvbGame, hvbHumanMove, putConfig, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";
import GameShell from "../game/GameShell";
import { useSessionGame } from "../game/useSessionGame";

const { Title } = Typography;

export default function GameHvB() {
  const { modal } = App.useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size") ?? "7");
  const botId = searchParams.get("bot") ?? "random_bot";
  const size = Number.isFinite(sizeParam) && sizeParam >= 2 ? sizeParam : 7;

  const starterParam = (searchParams.get("hvbstarter") ?? "human").toLowerCase();
  const starter = starterParam === "bot" ? "bot" : "human";

  const { yen, winner, error, loading, gameOver, onCellClick } = useSessionGame<YEN>({
    deps: [size, botId, starter],
    start: async () => {
        await putConfig({ size, hvb_starter: starter, bot_id: botId, hvh_starter: "player0" });
        return createHvbGame({ size, bot_id: botId, hvb_starter: starter });
      },
    move: (gameId, cellId) => hvbHumanMove(gameId, cellId),
  });

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  function handleAbandonGame() {
    modal.confirm({
      title: "Abandonar",
      content: "¿Seguro que quieres abandonar la partida?",
      okText: "Sí, abandonar",
      cancelText: "Cancelar",
      onOk: () => navigate("/home", { replace: true }),
    });
  }

  function goHome() {
    navigate("/home", { replace: true });
  }

  const boardCardStyle: React.CSSProperties = useMemo(() => {
    if (!gameOver) return {};
    if (winner === "human") {
      return { background: "#28bbf532" };
    }
    if (winner) {
      return { background: "#ff7b0033" };
    }
    return {};
  }, [gameOver, winner]);

  const resultTitle = winner === "human" ? "¡Felicidades!" : "Game Over";
  const resultText =
    winner === "human"
      ? "Has ganado la partida."
      : "Ha ganado el bot. ¡Inténtalo de nuevo!";

  return (
    <GameShell
      title="Juego Y — Human vs Bot"
      subtitle={`Tamaño: ${size} · Bot: ${botId} · Empieza: ${starter}`}
      loading={loading}
      error={error}
      hasBoard={!!yen}
      emptyText="No se pudo crear la partida."
      onAbandon={handleAbandonGame}
      abandonDisabled={loading || gameOver}
      board={
        <Card style={boardCardStyle}>
          <Board size={yen?.size ?? size} cells={cells} disabled={loading || gameOver} onCellClick={onCellClick} />
        </Card>
      }
      result={
        gameOver ? (
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={4} style={{ margin: 0 }}>
                  {resultTitle}
                </Title>
              </Flex>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={5} style={{ margin: 0 }}>
                  {resultText}
                </Title>
              </Flex>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Button type="primary" onClick={goHome}>
                  Volver a Home
                </Button>
              </Flex>
            </Space>
          </Card>
        ) : null
      }
    />
  );
}