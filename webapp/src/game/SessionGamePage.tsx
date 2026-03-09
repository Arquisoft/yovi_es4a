import { useMemo } from "react";
import { App, Button, Card, Flex, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import Board from "./Board";
import GameShell from "./GameShell";
import { parseYenToCells } from "./yen";
import {
  useSessionGame,
  type SessionGameMoveResponse,
  type SessionGameStartResponse,
} from "./useSessionGame";
import type { YEN as GameYEN } from "../api/gamey";

const { Title } = Typography;

type WinnerPalette = {
  highlightedWinner: string;
  highlightedBackground: string;
  otherWinnerBackground: string;
};

type ResultConfig = {
  title: string;
  subtitle: string;
  emptyText?: string;
  abandonOkText?: string;
  getResultTitle: (winner: string | null) => string;
  getResultText: (winner: string | null) => string;
};

type Props<TYen extends GameYEN> = {
  deps: readonly unknown[];
  start: () => Promise<SessionGameStartResponse<TYen>>;
  move: (gameId: string, cellId: number) => Promise<SessionGameMoveResponse<TYen>>;
  resultConfig: ResultConfig;
  winnerPalette: WinnerPalette;
};

export default function SessionGamePage<TYen extends GameYEN>({
  deps,
  start,
  move,
  resultConfig,
  winnerPalette,
}: Props<TYen>) {
  const { modal } = App.useApp();
  const navigate = useNavigate();

  const { yen, winner, error, loading, gameOver, onCellClick } = useSessionGame<TYen>({
    deps,
    start,
    move,
  });

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  function goHome() {
    navigate("/home", { replace: true });
  }

  function handleAbandonGame() {
    modal.confirm({
      title: "Abandonar",
      content: "¿Seguro que quieres abandonar la partida?",
      okText: resultConfig.abandonOkText ?? "Abandonar",
      cancelText: "Cancelar",
      onOk: goHome,
    });
  }

  const boardCardStyle: React.CSSProperties = useMemo(() => {
    if (!gameOver) return {};
    if (winner === winnerPalette.highlightedWinner) {
      return { background: winnerPalette.highlightedBackground };
    }
    if (winner) {
      return { background: winnerPalette.otherWinnerBackground };
    }
    return {};
  }, [gameOver, winner, winnerPalette]);

  return (
    <GameShell
      title={resultConfig.title}
      subtitle={resultConfig.subtitle}
      loading={loading}
      error={error}
      hasBoard={!!yen}
      emptyText={resultConfig.emptyText ?? "No se pudo crear la partida."}
      onAbandon={handleAbandonGame}
      abandonDisabled={loading || gameOver}
      board={
        <Card style={boardCardStyle}>
          <Board
            size={yen?.size ?? 7}
            cells={cells}
            disabled={loading || gameOver}
            onCellClick={onCellClick}
          />
        </Card>
      }
      result={
        gameOver ? (
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={4} style={{ margin: 0 }}>
                  {resultConfig.getResultTitle(winner)}
                </Title>
              </Flex>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={5} style={{ margin: 0 }}>
                  {resultConfig.getResultText(winner)}
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