import { useEffect, useMemo, useRef } from "react";
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

const { Title, Text } = Typography;

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

type TurnPresentation = {
  label: string;
  color: string;
};

type TurnConfig = {
  textPrefix?: string;
  turns: Record<string, TurnPresentation>;
};

type Props<TYen extends GameYEN> = {
  deps: readonly unknown[];
  start: () => Promise<SessionGameStartResponse<TYen>>;
  move: (gameId: string, cellId: number) => Promise<SessionGameMoveResponse<TYen>>;
  botMove?: (gameId: string) => Promise<SessionGameMoveResponse<TYen>>;
  resultConfig: ResultConfig;
  winnerPalette: WinnerPalette;
  turnConfig: TurnConfig;
};

export default function SessionGamePage<TYen extends GameYEN>({
  deps,
  start,
  move,
  botMove,
  resultConfig,
  winnerPalette,
  turnConfig,
}: Props<TYen>) {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const botTurnInFlight = useRef(false);

  const {
    yen,
    gameId,
    winner,
    nextTurn,
    error,
    loading,
    gameOver,
    onCellClick,
    onBotTurn,
  } = useSessionGame<TYen>({
    deps,
    start,
    move,
    botMove,
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

  const activeTurn = nextTurn ? turnConfig.turns[nextTurn] : null;

  const boardCardStyle: React.CSSProperties = useMemo(() => {
    if (!gameOver && activeTurn) {
      return {
        border: `2px solid ${activeTurn.color}`,
        boxShadow: `0 0 0 3px ${activeTurn.color}22`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      };
    }

    if (gameOver && winner === winnerPalette.highlightedWinner) {
      return { background: winnerPalette.highlightedBackground };
    }

    if (gameOver && winner) {
      return { background: winnerPalette.otherWinnerBackground };
    }

    return {};
  }, [gameOver, activeTurn, winner, winnerPalette]);

  const turnIndicator = useMemo(() => {
    if (gameOver || !activeTurn) return null;

    return (
      <Card
        size="small"
        style={{
          borderLeft: `6px solid ${activeTurn.color}`,
        }}
      >
        <Text strong>
          {turnConfig.textPrefix ?? "Turno actual:"}{" "}
          <span style={{ color: activeTurn.color }}>{activeTurn.label}</span>
        </Text>
      </Card>
    );
  }, [gameOver, activeTurn, turnConfig]);

  useEffect(() => {
    if (!botMove) return;
    if (!gameId) return;
    if (gameOver) return;
    if (loading) return;
    if (nextTurn !== "bot") return;
    if (botTurnInFlight.current) return;

    botTurnInFlight.current = true;

    void onBotTurn().finally(() => {
      botTurnInFlight.current = false;
    });
  }, [botMove, gameId, gameOver, loading, nextTurn, onBotTurn]);

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
      turnIndicator={turnIndicator}
      board={
        <Card style={boardCardStyle}>
          <Board
            size={yen?.size ?? 7}
            cells={cells}
            disabled={loading || gameOver || nextTurn === "bot"}
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