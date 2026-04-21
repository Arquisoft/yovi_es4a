/**
 * GamePastel.tsx — Variante "Regla del Pastel" (Pie Rule)
 *
 * Flujo:
 *   1. FASE "place_neutral": Player que empieza coloca la primera ficha (gris).
 *   2. FASE "pie_choice": El otro jugador decide:
 *        • "Quedarme" → swap: los colores B↔R se invierten visualmente.
 *        • "Ceder"    → sin cambio, la ficha queda del jugador original.
 *   3. FASE "playing": partida HvH estándar.
 */

import { useState, useCallback, useRef } from "react";
import type React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Card, Flex, Space, Typography } from "antd";
import { SwapOutlined, ArrowRightOutlined } from "@ant-design/icons";
import confettiAnimation from "../assets/Confetti.json";

import GameShell from "../game/GameShell";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";
import type { Cell } from "../game/yen";
import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
  type GameStateResponse,
} from "../api/gamey";
import type { RecordUserGameRequest } from "../api/users";
import { getUserSession } from "../utils/session";
import useDeferredGameSave from "../game/useDeferredGameSave";
import AuthModal from "./registroLogin/AuthModal";

const { Title, Text } = Typography;

type StarterHvH = "player0" | "player1" | "random";
type Phase = "loading" | "place_neutral" | "pie_choice" | "playing" | "finished";

function parseBoardSize(raw: string | null): number {
  const n = Number(raw ?? "7");
  return Number.isFinite(n) && n >= 2 ? n : 7;
}

function parseHvHStarter(raw: string | null): StarterHvH {
  const v = (raw ?? "player0").toLowerCase();
  if (v === "player1") return "player1";
  if (v === "random") return "random";
  return "player0";
}

function getStarterLabel(s: StarterHvH): string {
  if (s === "player1") return "Player 1";
  if (s === "random") return "Aleatorio";
  return "Player 0";
}

const PLAYER_COLORS: Record<string, string> = {
  player0: "#28BBF5",
  player1: "#FF7B00",
};
const PLAYER_LABELS: Record<string, string> = {
  player0: "Player 0",
  player1: "Player 1",
};

export default function GamePastel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  // ─── Estado ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("loading");
  const [gameId, setGameId] = useState<string | null>(null);
  const [yen, setYen] = useState<YEN | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [winner, setWinner] = useState<string | null>(null);
  const [nextTurn, setNextTurn] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [animationFinished, setAnimationFinished] = useState(false);

  // swapped=true: los colores B↔R se invierten visualmente (pie rule aplicada)
  const [swapped, setSwapped] = useState(false);
  // cellId de la primera ficha (para mostrarla en gris durante pie_choice)
  const [neutralCellId, setNeutralCellId] = useState<number | null>(null);
  // jugador real que pone la ficha neutral (resuelto por el backend)
  const [firstPlayer, setFirstPlayer] = useState<string>("player0");

  const initDone = useRef(false);

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

  // ─── Inicialización (una sola vez) ────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvhStarter });
        const resp: GameStateResponse = await createHvhGame({ size, hvh_starter: hvhStarter });
        const resolvedFirst = resp.status.state === "ongoing" ? (resp.status.next ?? "player0") : "player0";
        setGameId(resp.game_id);
        setYen(resp.yen);
        setNextTurn(resolvedFirst);
        setFirstPlayer(resolvedFirst);
        setPhase("place_neutral");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al crear la partida");
      } finally {
        setLoading(false);
      }
    })();
  });

  const secondPlayer = firstPlayer === "player0" ? "player1" : "player0";

  // ─── Click en celda ───────────────────────────────────────────────────────
  const handleCellClick = useCallback(async (cellId: number) => {
    if (!gameId) return;

    if (phase === "place_neutral") {
      try {
        const resp = await hvhMove(gameId, cellId);
        setYen(resp.yen);
        setNeutralCellId(cellId);
        setMoveCount((c) => c + 1);
        if (resp.status.state === "finished") {
          setWinner(resp.status.winner ?? null);
          setPhase("finished");
        } else {
          setNextTurn(resp.status.next ?? null);
          setPhase("pie_choice");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al colocar la ficha");
      }
      return;
    }

    if (phase === "playing") {
      try {
        const resp = await hvhMove(gameId, cellId);
        setYen(resp.yen);
        setMoveCount((c) => c + 1);
        if (resp.status.state === "finished") {
          const backendWinner = resp.status.winner ?? null;
          const visualWinner = swapped
            ? backendWinner === "player0" ? "player1" : backendWinner === "player1" ? "player0" : null
            : backendWinner;
          setWinner(visualWinner);
          setPhase("finished");

          const payload: RecordUserGameRequest = {
            gameId,
            mode: "pastel_hvh",
            result: visualWinner === "player0" ? "won" : "lost",
            boardSize: size,
            totalMoves: moveCount + 1,
            opponent: "Jugador local",
            startedBy: hvhStarter,
          };
          const session = getUserSession();
          if (session) await registerFinishedGame(payload);
          else handleGuestSaveRequested({ gameId, winner: visualWinner, totalMoves: moveCount + 1 });
        } else {
          setNextTurn(resp.status.next ?? null);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al realizar el movimiento");
      }
    }
  }, [gameId, phase, swapped, size, hvhStarter, moveCount, registerFinishedGame, handleGuestSaveRequested]);

  // ─── Pie choice ───────────────────────────────────────────────────────────
  function handleSwap() {
    setSwapped(true);
    setPhase("playing");
  }

  function handlePass() {
    setSwapped(false);
    setPhase("playing");
  }

  // ─── Abandono ─────────────────────────────────────────────────────────────
  async function handleAbandon() {
    if (!gameId) { navigate("/home"); return; }
    try {
      const session = getUserSession();
      if (session) {
        await saveGameForCurrentSession({
          gameId, mode: "pastel_hvh", result: "abandoned",
          boardSize: size, totalMoves: moveCount,
          opponent: "Jugador local", startedBy: hvhStarter,
        });
      }
      await deleteHvhGame(gameId);
    } finally {
      navigate("/home");
    }
  }

  // ─── Celdas para el tablero ───────────────────────────────────────────────
  const cells: Cell[] = yen ? parseYenToCells(yen).map((cell) => {
    if (phase === "pie_choice" && cell.cellId === neutralCellId) {
      return { ...cell, value: "N" };
    }
    if (swapped) {
      if (cell.value === "B") return { ...cell, value: "R" };
      if (cell.value === "R") return { ...cell, value: "B" };
    }
    return cell;
  }) : [];

  // ─── Turno visual ─────────────────────────────────────────────────────────
  const secondPlayer2 = firstPlayer === "player0" ? "player1" : "player0";

  const visualNext: string | null = (() => {
    if (phase === "place_neutral") return firstPlayer;
    if (phase === "pie_choice")    return secondPlayer2;
    if (phase === "playing") {
      if (!nextTurn) return null;
      return swapped
        ? nextTurn === "player0" ? "player1" : "player0"
        : nextTurn;
    }
    return null;
  })();

  const activeColor = visualNext ? PLAYER_COLORS[visualNext] : null;

  const isFinished = phase === "finished";
  const hasBoard   = !!yen && !loading && !error;
  const boardDisabled = loading || phase === "pie_choice" || isFinished;

  const boardCardStyle: React.CSSProperties = (() => {
    if (isFinished && winner === "player0") return { background: "#28bbf532" };
    if (isFinished && winner === "player1") return { background: "#ff7b0033" };
    if (activeColor && !isFinished) return {
      border: `2px solid ${activeColor}`,
      boxShadow: `0 0 0 3px ${activeColor}22`,
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    };
    return {};
  })();

  const turnIndicator = phase !== "finished" && !!yen && !loading && activeColor ? (
    <Card size="small" style={{ borderLeft: `6px solid ${activeColor}` }}>
      <Text strong>
        Turno actual:{" "}
        <span style={{ color: activeColor }}>
          {phase === "pie_choice"
            ? `${PLAYER_LABELS[secondPlayer2]} — Elige tu bando`
            : PLAYER_LABELS[visualNext!]}
        </span>
      </Text>
    </Card>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <GameShell
        title="Juego Y — Regla del Pastel 🍰"
        subtitle={`Tamaño: ${size} · Empieza: ${getStarterLabel(hvhStarter)}`}
        loading={loading}
        error={error}
        hasBoard={hasBoard}
        emptyText="No se pudo crear la partida."
        onAbandon={handleAbandon}
        abandonDisabled={isFinished || loading}
        turnIndicator={turnIndicator}
        board={
          hasBoard ? (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>

              {/* ── Banner pie_choice ─────────────────────────────────── */}
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
                          {PLAYER_LABELS[firstPlayer]} ha colocado la primera ficha (gris).{" "}
                          {PLAYER_LABELS[secondPlayer]}, ¿quieres esa posición o prefieres cederla?
                        </Text>
                      </div>
                    </Flex>
                    <Flex gap={12} wrap="wrap" justify="center">
                      <Button
                        type="primary"
                        size="large"
                        icon={<SwapOutlined />}
                        onClick={handleSwap}
                        style={{ background: PLAYER_COLORS[secondPlayer], borderColor: PLAYER_COLORS[secondPlayer] }}
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

              {/* ── Tablero con marco de color ────────────────────────── */}
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
                  neutralCells={neutralCellId !== null && phase === "pie_choice"
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
              {/* Animación fullscreen */}
              {winner !== null && !animationFinished && (
                <div
                  style={{
                    position: "fixed",
                    top: 0, left: 0,
                    width: "100vw", height: "100vh",
                    zIndex: 9999,
                    pointerEvents: "none",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
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
                      onClick={() => handleGuestSaveRequested({ gameId: gameId!, winner, totalMoves: moveCount })}
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