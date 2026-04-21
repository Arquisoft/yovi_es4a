import { useMemo, useState } from "react";
import { App, Badge, Button, Card, Flex, Space, Typography } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import Lottie from "lottie-react";

import Board from "./Board";
import GameShell from "./GameShell";
import type { Cell } from "./yen";
import confettiAnimation from "../assets/Confetti.json";
import gameOverAnimation from "../assets/GameOver.json";

const { Title, Text } = Typography;

type Props = {
  title: string;
  subtitle: string;
  mode?: string;

  loading: boolean;
  error: string;
  hasBoard: boolean;
  emptyText: string;

  boardSize: number;
  cells: Cell[];
  disabledCells: Set<number>;
  boardDisabled: boolean;
  onCellClick: (cellId: number) => void;

  myPlayer: string;
  gameOver?: boolean;
  nextTurn: string | null;
  winner: string | null;

  hasNewMessages: boolean;
  onOpenChat: () => void;

  onAbandon: () => Promise<void> | void;
  onBack: () => void;

  turnIndicatorExtra?: React.ReactNode;
};

export default function MultiplayerSessionGamePage({
  title,
  subtitle,
  mode,
  loading,
  error,
  hasBoard,
  emptyText,
  boardSize,
  cells,
  disabledCells,
  boardDisabled,
  onCellClick,
  myPlayer,
  gameOver = false,
  nextTurn,
  winner,
  hasNewMessages,
  onOpenChat,
  onAbandon,
  onBack,
  turnIndicatorExtra,
}: Props) {
  const { modal } = App.useApp();
  const [abandoning, setAbandoning] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  const myColor = myPlayer === "player0" ? "#28BBF5" : "#ff7b00";
  const activeTurnColor = nextTurn === "player0" ? "#28BBF5" : "#ff7b00";

  const turnIndicator = useMemo(() => {
    if (gameOver || !nextTurn)
      return null;

    const turnText =
      nextTurn === myPlayer ? "🟢 ¡TU TURNO!" : "⌛ Esperando rival...";

    return (
      <Card
        size="small"
        style={{
          borderLeft: `6px solid ${activeTurnColor}`,
        }}
      >
        <Flex justify="space-between" align="center">
          <Space>
            <Text strong>{turnText}</Text>
            {turnIndicatorExtra}
          </Space>

          <Space>
            {mode === "tabu_hvh" &&
              nextTurn === myPlayer &&
              disabledCells.size > 0 && (
                <Badge
                  status="error"
                  text={`${disabledCells.size} bloqueadas`}
                />
              )}

            <Button
              type="text"
              icon={
                <Badge dot={hasNewMessages}>
                  <MessageOutlined />
                </Badge>
              }
              onClick={onOpenChat}
            >
              Chat
            </Button>
          </Space>
        </Flex>
      </Card>
    );
  }, [
    activeTurnColor,
    disabledCells,
    hasNewMessages,
    mode,
    myPlayer,
    nextTurn,
    onOpenChat,
    gameOver,
    turnIndicatorExtra,
  ]);

  const boardCardStyle = useMemo(() => {
    if (!gameOver && nextTurn === myPlayer) {
      return {
        border: `2px solid ${myColor}`,
        boxShadow: `0 0 0 3px ${myColor}22`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      };
    }

    return {};
  }, [gameOver, myColor, myPlayer, nextTurn]);

  const effectivelyWhoWon = mode === "whynot_hvh"
    ? (winner === "player0" ? "player1" : "player0")
    : winner;
  const isWin = effectivelyWhoWon === myPlayer;
  const shouldAnimate = gameOver && !!winner && !animationFinished;

  async function handleConfirmedAbandon() {
    try {
      setAbandoning(true);
      await onAbandon();
    }
    finally {
      setAbandoning(false);
    }
  }

  function handleAbandonGame() {
    modal.confirm({
      title: "Abandonar",
      content: "¿Seguro que quieres abandonar la partida?",
      okText: "Abandonar",
      cancelText: "Cancelar",
      onOk: handleConfirmedAbandon,
    });
  }

  if (error) {
    return (
      <Flex
        justify="center"
        align="start"
        style={{
          padding: "clamp(10px, 3vw, 20px)",
          minHeight: "100vh",
        }}
      >
        <div style={{ width: "min(1000px, 100%)" }}>
          <Card>
            <Flex vertical align="center" gap={16}>
              <Title level={4} type="danger" style={{ margin: 0 }}>
                El oponente se ha desconectado de la partida
              </Title>
              <Text>{"Esta partida no se guardará en tu historial."}</Text>
              <Button onClick={onBack}>Volver</Button>
            </Flex>
          </Card>
        </div>
      </Flex>
    );
  }

  return (
    <GameShell
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={""}
      hasBoard={hasBoard}
      emptyText={emptyText}
      onAbandon={handleAbandonGame}
      abandonDisabled={loading || abandoning || gameOver}
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
            size={boardSize}
            cells={cells}
            disabled={boardDisabled}
            disabledCells={disabledCells}
            onCellClick={onCellClick}
          />
        </Card>
      }
      result={
        gameOver ? (
          <Card>
            {shouldAnimate && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  zIndex: 9999,
                  pointerEvents: "none",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Lottie
                  animationData={
                    isWin ? confettiAnimation : gameOverAnimation
                  }
                  loop={false}
                  onComplete={() => setAnimationFinished(true)}
                  style={!isWin ? { width: "80%", height: "80%" } : undefined}
                />
              </div>
            )}

            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={4} style={{ margin: 0 }}>
                  {winner === null
                    ? "🤝 EMPATE"
                    : isWin
                      ? "👑 ¡HAS GANADO!"
                      : "💀 HAS PERDIDO"}
                </Title>
              </Flex>

              {mode === "whynot_hvh" && (
                <Flex justify="center">
                  <Text type="secondary">En WhY not, el primero que conecta pierde.</Text>
                </Flex>
              )}

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Button type="primary" onClick={onBack}>
                  Volver al Lobby
                </Button>
              </Flex>
            </Space>
          </Card>
        ) : null
      }
    />
  );
}

