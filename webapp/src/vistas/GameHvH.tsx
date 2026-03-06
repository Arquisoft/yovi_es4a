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

import { createHvhGame, hvhMove, putConfig, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";
import GameShell from "../game/GameShell";
import { useSessionGame } from "../game/useSessionGame";

const { Title } = Typography;

type StarterHvH = "player0" | "player1";

export default function GameHvH() {
  const { modal } = App.useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size") ?? "7");
  const size = Number.isFinite(sizeParam) && sizeParam >= 2 ? sizeParam : 7;

  const starterParam = (searchParams.get("hvhstarter") ?? "player0").toLowerCase();
  const starter: StarterHvH = starterParam === "player1" ? "player1" : "player0";

  const { yen, winner, error, loading, gameOver, onCellClick } = useSessionGame<YEN>({
    deps: [size, starter],
    start: async () => {
      await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: starter });
      return createHvhGame();
    },
    move: (gameId, cellId) => hvhMove(gameId, cellId),
  });

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  function handleAbandonGame() {
    modal.confirm({
      title: "Abandonar",
      content: "¿Seguro que quieres abandonar la partida?",
      okText: "Abandonar",
      cancelText: "Cancelar",
      onOk: () => navigate("/home", { replace: true }),
    });
  }

  function goHome() {
    navigate("/home", { replace: true });
  }

  const boardCardStyle: React.CSSProperties = useMemo(() => {
    if (!gameOver) return {};
    if (winner === "player0") {
      return { background: "#28bbf532" };
    }
    if (winner) {
      return { background: "#ff7b0033" };
    }
    return {};
  }, [gameOver, winner]);

  const resultTitle = "Partida finalizada";
  const resultText =
    winner === "player0"
      ? "Player 0 ha ganado la partida."
      : "Player 1 ha ganado la partida.";

  return (
    <GameShell
      title="Juego Y — Human vs Human"
      subtitle={`Tamaño: ${size} · Empieza: ${starter}`}
      loading={loading}
      error={error}
      hasBoard={!!yen}
      emptyText="No se pudo crear la partida."
      onAbandon={handleAbandonGame}
      abandonDisabled={loading}
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