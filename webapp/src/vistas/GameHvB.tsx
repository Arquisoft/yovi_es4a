import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Flex, Modal, Space, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { humanVsBotMove, newGame, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";

const { Title, Text } = Typography;

export default function GameHvB() {
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

  const [resultOpen, setResultOpen] = useState(false);

  const cells = useMemo(() => (yen ? parseYenToCells(yen) : []), [yen]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError("");
      setLoading(true);
      setYen(null);
      setWinner(null);
      setGameOver(false);
      setResultOpen(false);

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
    Modal.confirm({
      title: "Abandonar",
      content: "¿Seguro que quieres abandonar la partida?",
      okText: "Sí, abandonar",
      cancelText: "Cancelar",
      onOk: () => navigate("/home", { replace: true }),
    });
  }

  function handleCloseResult() {
    setResultOpen(false);
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
        setResultOpen(true);
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

              <Button danger onClick={handleAbandonGame} disabled={loading}>
                Abandonar
              </Button>
            </Flex>
          </Card>

          <Modal
            open={resultOpen}
            title={winner === "human" ? "¡Felicidades!" : "Game Over"}
            onOk={handleCloseResult}
            onCancel={handleCloseResult}
            okText="Volver a Home"
            cancelButtonProps={{ style: { display: "none" } }}
            centered
            maskClosable={false}
            keyboard={false}
          >
            {winner === "human"
              ? "Has ganado la partida."
              : "Ha ganado el bot. ¡Inténtalo de nuevo!"}
          </Modal>

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
            <Card>
              <Board
                size={yen.size}
                cells={cells}
                disabled={loading || gameOver}
                onCellClick={handleCellClick}
              />
            </Card>
          )}
        </Space>
      </div>
    </Flex>
  );
}