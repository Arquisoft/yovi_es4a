import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRightOutlined, SwapOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Space, Typography } from "antd";
import Lottie from "lottie-react";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type GameStateResponse,
  type YEN,
} from "../api/gamey";
import type { RecordUserGameRequest } from "../api/users";
import Board from "../game/Board";
import GameShell from "../game/GameShell";
import useDeferredGameSave from "../game/useDeferredGameSave";
import {
  getHvHStarterLabel,
  parseBoardSize,
  parseHvHStarter,
} from "../game/variants";
import { parseYenToCells, type Cell } from "../game/yen";
import { getUserSession } from "../utils/session";
import AuthModal from "./registroLogin/AuthModal";
import confettiAnimation from "../assets/Confetti.json";
import gameOverAnimation from "../assets/GameOver.json";

const { Text, Title } = Typography;

type Phase = "loading" | "place_neutral" | "pie_choice" | "playing" | "finished";
type LocalPlayer = "player0" | "player1";

const PLAYER_COLORS: Record<LocalPlayer, string> = {
  player0: "#28BBF5",
  player1: "#FF7B00",
};

const PLAYER_LABELS: Record<LocalPlayer, string> = {
  player0: "Player 0",
  player1: "Player 1",
};

function getOtherPlayer(player: LocalPlayer): LocalPlayer {
  return player === "player0" ? "player1" : "player0";
}

function swapPlayer(player: string | null): LocalPlayer | null {
  if (player === "player0")
    return "player1";
  if (player === "player1")
    return "player0";
  return null;
}

function buildFinishedPayload({
  gameId,
  winner,
  size,
  totalMoves,
  hvhStarter,
}: {
  gameId: string;
  winner: LocalPlayer | null;
  size: number;
  totalMoves: number;
  hvhStarter: "player0" | "player1" | "random";
}): RecordUserGameRequest {
  return {
    gameId,
    mode: "pastel_hvh",
    result:
      winner === null
        ? "draw"
        : winner === "player0"
          ? "won"
          : "lost",
    boardSize: size,
    totalMoves,
    opponent: "Jugador local",
    startedBy: hvhStarter,
  };
}

export default function GamePastel() {
  const { modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  const [phase, setPhase] = useState<Phase>("loading");
  const [gameId, setGameId] = useState<string | null>(null);
  const [yen, setYen] = useState<YEN | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [winner, setWinner] = useState<LocalPlayer | null>(null);
  const [nextTurn, setNextTurn] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [neutralCellId, setNeutralCellId] = useState<number | null>(null);
  const [firstPlayer, setFirstPlayer] = useState<LocalPlayer>("player0");
  const [abandoning, setAbandoning] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  const initializedRef = useRef(false);

  const {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave,
    saveGameForCurrentSession,
    registerFinishedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
  } = useDeferredGameSave();

  useEffect(() => {
    if (initializedRef.current)
      return;

    initializedRef.current = true;

    void (async () => {
      try {
        await putConfig({
          size,
          hvb_starter: "human",
          bot_id: null,
          hvh_starter: hvhStarter,
        });

        const response: GameStateResponse = await createHvhGame({
          size,
          hvh_starter: hvhStarter,
        });

        const resolvedFirstPlayer =
          response.status.state === "ongoing"
            ? ((response.status.next ?? "player0") as LocalPlayer)
            : "player0";

        setGameId(response.game_id);
        setYen(response.yen);
        setNextTurn(resolvedFirstPlayer);
        setFirstPlayer(resolvedFirstPlayer);
        setPhase("place_neutral");
      } catch (cause: unknown) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Error al crear la partida",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [hvhStarter, size]);

  const secondPlayer = useMemo(
    () => getOtherPlayer(firstPlayer),
    [firstPlayer],
  );

  const resolveVisualPlayer = useCallback(
    (player: string | null): LocalPlayer | null => (
      swapped ? swapPlayer(player) : (player as LocalPlayer | null)
    ),
    [swapped],
  );

  const handleCellClick = useCallback(async (cellId: number) => {
    if (!gameId)
      return;

    if (phase === "place_neutral") {
      try {
        const response = await hvhMove(gameId, cellId);
        setYen(response.yen);
        setNeutralCellId(cellId);
        setMoveCount((current) => current + 1);

        if (response.status.state === "finished") {
          const visualWinner = resolveVisualPlayer(response.status.winner ?? null);
          setWinner(visualWinner);
          setPhase("finished");

          await registerFinishedGame(
            buildFinishedPayload({
              gameId,
              winner: visualWinner,
              size,
              totalMoves: moveCount + 1,
              hvhStarter,
            }),
          );
        } else {
          setNextTurn(response.status.next ?? null);
          setPhase("pie_choice");
        }
      } catch (cause: unknown) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Error al colocar la ficha",
        );
      }

      return;
    }

    if (phase !== "playing")
      return;

    try {
      const response = await hvhMove(gameId, cellId);
      setYen(response.yen);
      setMoveCount((current) => current + 1);

      if (response.status.state === "finished") {
        const visualWinner = resolveVisualPlayer(response.status.winner ?? null);
        const totalMoves = moveCount + 1;

        setWinner(visualWinner);
        setPhase("finished");

        await registerFinishedGame(
          buildFinishedPayload({
            gameId,
            winner: visualWinner,
            size,
            totalMoves,
            hvhStarter,
          }),
        );
      } else {
        setNextTurn(response.status.next ?? null);
      }
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Error al realizar el movimiento",
      );
    }
  }, [
    gameId,
    hvhStarter,
    moveCount,
    phase,
    registerFinishedGame,
    resolveVisualPlayer,
    size,
  ]);

  function handleSwap() {
    setSwapped(true);
    setPhase("playing");
  }

  function handlePass() {
    setSwapped(false);
    setPhase("playing");
  }

  async function handleAbandon() {
    if (!gameId) {
      navigate("/home");
      return;
    }

    try {
      setAbandoning(true);
      if (getUserSession()) {
        await saveGameForCurrentSession({
          gameId,
          mode: "pastel_hvh",
          result: "abandoned",
          boardSize: size,
          totalMoves: moveCount,
          opponent: "Jugador local",
          startedBy: hvhStarter,
        });
      }

      await deleteHvhGame(gameId);
    } finally {
      setAbandoning(false);
      navigate("/home");
    }
  }

  function handleAbandonGame() {
    modal.confirm({
      title: "Abandonar",
      content: "Â¿Seguro que quieres abandonar la partida?",
      okText: "Abandonar",
      cancelText: "Cancelar",
      onOk: handleAbandon,
    });
  }

  const cells: Cell[] = useMemo(() => {
    if (!yen)
      return [];

    return parseYenToCells(yen).map((cell) => {
      if (phase === "pie_choice" && cell.cellId === neutralCellId) {
        return { ...cell, value: "N" };
      }

      if (!swapped)
        return cell;

      if (cell.value === "B")
        return { ...cell, value: "R" };
      if (cell.value === "R")
        return { ...cell, value: "B" };
      return cell;
    });
  }, [neutralCellId, phase, swapped, yen]);

  const visualNextTurn = useMemo(() => {
    if (phase === "place_neutral")
      return firstPlayer;
    if (phase === "pie_choice")
      return secondPlayer;
    if (phase === "playing")
      return resolveVisualPlayer(nextTurn);
    return null;
  }, [firstPlayer, nextTurn, phase, resolveVisualPlayer, secondPlayer]);

  const activeColor = visualNextTurn ? PLAYER_COLORS[visualNextTurn] : null;
  const isFinished = phase === "finished";
  const hasBoard = Boolean(yen) && !loading && !error;
  const boardDisabled = loading || phase === "pie_choice" || isFinished;
  const isWin = winner === "player0";
  const shouldAnimate = isFinished && !!winner && !animationFinished;

  useEffect(() => {
    setAnimationFinished(false);
  }, [gameId]);

  const boardCardStyle: React.CSSProperties = useMemo(() => {
    if (isFinished && winner === "player0")
      return { background: "#28bbf532" };
    if (isFinished && winner === "player1")
      return { background: "#ff7b0033" };
    if (!isFinished && activeColor) {
      return {
        border: `2px solid ${activeColor}`,
        boxShadow: `0 0 0 3px ${activeColor}22`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      };
    }
    return {};
  }, [activeColor, isFinished, winner]);

  const turnIndicator = !isFinished && hasBoard && activeColor ? (
    <Card size="small" style={{ borderLeft: `6px solid ${activeColor}` }}>
      <Text strong>
        Turno actual:{" "}
        <span style={{ color: activeColor }}>
          {phase === "pie_choice"
            ? `${PLAYER_LABELS[secondPlayer]} — Elige tu bando`
            : PLAYER_LABELS[visualNextTurn!]}
        </span>
      </Text>
    </Card>
  ) : null;

  return (
    <>
      <GameShell
        title="Juego Y — Regla del Pastel 🍰"
        subtitle={`Tamaño: ${size} · Empieza: ${getHvHStarterLabel(hvhStarter)}`}
        loading={loading}
        error={error}
        hasBoard={hasBoard}
        emptyText="No se pudo crear la partida."
        onAbandon={handleAbandonGame}
        abandonDisabled={isFinished || loading || abandoning}
        turnIndicator={turnIndicator}
        board={
          hasBoard ? (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {phase === "pie_choice" && (
                <Card
                  style={{
                    background: "linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)",
                    border: "2px solid #faad14",
                    borderRadius: 12,
                  }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Flex align="center" gap={10}>
                      <span style={{ fontSize: 26 }}>🍰</span>
                      <div>
                        <Title level={4} style={{ margin: 0, color: "#d46b08" }}>
                          ¡Regla del Pastel!
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {PLAYER_LABELS[firstPlayer]} ha colocado la primera ficha
                          {" "}
                          (gris). {PLAYER_LABELS[secondPlayer]}, ¿quieres esa
                          {" "}
                          posición o prefieres cederla?
                        </Text>
                      </div>
                    </Flex>

                    <Flex gap={12} wrap="wrap" justify="center">
                      <Button
                        type="primary"
                        size="large"
                        icon={<SwapOutlined />}
                        onClick={handleSwap}
                        style={{
                          background: PLAYER_COLORS[secondPlayer],
                          borderColor: PLAYER_COLORS[secondPlayer],
                        }}
                        data-testid="pastel-swap-btn"
                      >
                        Quedarme con esa posición
                      </Button>

                      <Button
                        size="large"
                        icon={<ArrowRightOutlined />}
                        onClick={handlePass}
                        data-testid="pastel-pass-btn"
                      >
                        Ceder y jugar después
                      </Button>
                    </Flex>
                  </Space>
                </Card>
              )}

              <Card
                style={{
                  ...boardCardStyle,
                  width: "100%",
                  overflow: "hidden",
                }}
                bodyStyle={{ padding: "clamp(8px, 2vw, 16px)" }}
              >
                <Board
                  size={size}
                  cells={cells}
                  disabled={boardDisabled}
                  onCellClick={handleCellClick}
                  neutralCells={
                    neutralCellId !== null && phase === "pie_choice"
                      ? new Set([neutralCellId])
                      : undefined
                  }
                />
              </Card>
            </Space>
          ) : null
        }
        result={
          isFinished ? (
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
                    animationData={isWin ? confettiAnimation : gameOverAnimation}
                    loop={false}
                    onComplete={() => setAnimationFinished(true)}
                    style={!isWin ? { width: "80%", height: "80%" } : undefined}
                  />
                </div>
              )}

              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Flex justify="center">
                  <Title level={4} style={{ margin: 0 }}>
                    Partida finalizada
                  </Title>
                </Flex>

                <Flex justify="center">
                  <Title level={5} style={{ margin: 0 }}>
                    {winner === "player0"
                      ? "Player 0 ha ganado."
                      : winner === "player1"
                        ? "Player 1 ha ganado."
                        : "La partida ha terminado."}
                  </Title>
                </Flex>

                <Flex justify="center" gap={16} wrap="wrap">
                  {canOfferGuestSave && (
                    <Button
                      type="primary"
                      loading={savingPendingGame}
                      onClick={() => handleGuestSaveRequested({
                        gameId: gameId!,
                        winner,
                        totalMoves: moveCount,
                      })}
                    >
                      Guardar esta partida
                    </Button>
                  )}

                  <Button onClick={() => navigate("/home")}>Volver a Home</Button>
                </Flex>
              </Space>
            </Card>
          ) : null
        }
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
