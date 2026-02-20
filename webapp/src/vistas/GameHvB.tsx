import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Flex, Space, Typography, App } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { humanVsBotMove, newGame, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";

const { Title, Text } = Typography;

export default function GameHvB() {
  const { modal } = App.useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size") ?? "7");
  const botId = searchParams.get("bot") ?? "random_bot";
  const size = Number.isFinite(sizeParam) && sizeParam >= 2 ? sizeParam : 7;

  const [yen, setYen] = useState<YEN | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError("");
      setLoading(true);
      setYen(null);
      setWinner(null);
      setGameOver(false);

      try {
        const r = await newGame(size);
        if (!cancelled) setYen(r.yen);
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
  }, [size]);

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

  async function handleCellClick(cellId: number) {
    if (!yen || gameOver) return;

    setError("");
    setLoading(true);
    try {
      const r = await humanVsBotMove(botId, yen, cellId);
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
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space direction="vertical" size={0}>
                <Title level={3} style={{ margin: 0 }}>
                  Juego Y — Human vs Bot
                </Title>
                <Text type="secondary">
                  Tamaño: {size} · Bot: {botId}
                </Text>
              </Space>

              <Button danger onClick={handleAbandonGame} disabled={loading || gameOver}>
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
                      {/*<Text>{resultText}</Text>*/}
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