import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Flex, Space, Typography } from "antd";
import { BulbOutlined } from "@ant-design/icons";
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
  onHint?: (gameId: string) => Promise<number>;
  resultConfig: ResultConfig;
  winnerPalette: WinnerPalette;
  turnConfig: TurnConfig;
};

export default function SessionGamePage<TYen extends GameYEN>({
  deps,
  start,
  move,
  botMove,
  onHint,
  resultConfig,
  winnerPalette,
  turnConfig,
}: Props<TYen>) {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const botTurnInFlight = useRef(false);

  const [hintCellId, setHintCellId] = useState<number | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);

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

  const cells = useMemo(() => {
    const base = yen ? parseYenToCells(yen) : [];
    if (hintCellId === null) return base;
    return base.map((c) =>
      c.cellId === hintCellId ? { ...c, hint: true } : c
    );
  }, [yen, hintCellId]);

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

  async function handleHint() {
    if (!onHint || !gameId || hintUsed) return;
    setHintLoading(true);
    try {
      const cellId = await onHint(gameId);
      setHintCellId(cellId);
      setHintUsed(true);
    } catch {
      // silencioso — si falla simplemente no se muestra pista
    } finally {
      setHintLoading(false);
    }
  }

  const prevYen = useRef(yen);
  useEffect(() => {
    if (prevYen.current !== yen) {
      prevYen.current = yen;
      setHintCellId(null);
    }
  }, [yen]);

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

    const canHint =
      !!onHint && !hintUsed && !loading && nextTurn !== "bot" && !!gameId;

    return (
      <Card
        size="small"
        style={{
          borderLeft: `6px solid ${activeTurn.color}`,
        }}
      >
        <Flex justify="space-between" align="center">
          <Text strong>
            {turnConfig.textPrefix ?? "Turno actual:"}{" "}
            <span style={{ color: activeTurn.color }}>{activeTurn.label}</span>
          </Text>
          {onHint && (
            <Button
              icon={<BulbOutlined />}
              size="small"
              loading={hintLoading}
              disabled={!canHint}
              onClick={handleHint}
              title={hintUsed ? "Ya usaste tu pista" : "Pedir pista (1 vez)"}
            >
              {hintUsed ? "Pista usada" : "Pista"}
            </Button>
          )}
        </Flex>
      </Card>
    );
  }, [gameOver, activeTurn, turnConfig, onHint, hintUsed, hintLoading, loading, nextTurn, gameId]);

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
        <Card
          style={{
            ...boardCardStyle,
            width: "100%",
            overflow: "hidden",
          }}
          bodyStyle={{
            padding: "clamp(8px, 2vw, 16px)",
          }}
        >
          <Board
            size={yen?.size ?? 7}
            cells={cells}
            disabled={loading || gameOver || nextTurn === "bot"}
            onCellClick={(cellId) => {
              setHintCellId(null);
              onCellClick(cellId);
            }}
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