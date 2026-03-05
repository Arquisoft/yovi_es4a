import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Space,
  Typography,
  App
} from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createHvhGame, hvhMove, putConfig, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";

const { Title, Text } = Typography;

type StarterHvH = "player0" | "player1";

export default function GameHvH() {
  const { modal } = App.useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size") ?? "7");
  const size = Number.isFinite(sizeParam) && sizeParam >= 2 ? sizeParam : 7;

  const [yen, setYen] = useState<YEN | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  const starterParam = (searchParams.get("hvhstarter") ?? "player0").toLowerCase();
  const starter: StarterHvH = starterParam === "player1" ? "player1" : "player0";


  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError("");
      setLoading(true);
      setYen(null);
      setGameId(null);
      setWinner(null);
      setGameOver(false);

      try {
        await putConfig({ size, starter: "human", bot_id: null });

        const r = await createHvhGame();
        if (!cancelled) {
          setGameId(r.game_id);
          setYen(r.yen);
          if (r.status.state === "finished") {
            setGameOver(true);
            setWinner(r.status.winner);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [size, starter]);

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

  async function handleCellClick(cellId: number) {
    if (!yen || !gameId || gameOver) return;

    setError("");
    setLoading(true);

    try {
      const r = await hvhMove(gameId, cellId);
      setYen(r.yen);

      if (r.status.state === "finished") {
        setGameOver(true);
        setWinner(r.status.winner);
      } else {
        setGameOver(false);
        setWinner(null);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
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
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space direction="vertical" size={0}>
                <Title level={3} style={{ margin: 0 }}>
                  Juego Y — Human vs Human
                </Title>
                <Text type="secondary">
                  Tamaño: {size} · Empieza: {starter}
                </Text>
              </Space>

              <Button danger onClick={handleAbandonGame} disabled={loading}>
                Abandonar
              </Button>
            </Flex>
          </Card>

          {error && <Alert type="error" showIcon message={error} />}

          {!yen ? (
            <Card>
              <Empty
                description={loading ? "Creando partida..." : "No se pudo crear la partida."}
                image={Empty.PRESENTED_IMAGE_DEFAULT}
                imageStyle={{ height: 120 }}
              />
            </Card>
          ) : (
            <>
              <Card style={boardCardStyle}> 
                <Board
                  size={yen.size}
                  cells={cells}
                  disabled={loading || gameOver}
                  onCellClick={handleCellClick}
                />
              </Card>

              {gameOver && (
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
              )}
            </>
          )}
        </Space>
      </div>
    </Flex>
  );
}