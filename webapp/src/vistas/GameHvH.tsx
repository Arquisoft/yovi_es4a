import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Flex, Space, Typography, App } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { humanVsHumanMove, newHvhGame, type StarterHvH, type YEN } from "../api/gamey";
import Board from "../game/Board";
import { parseYenToCells } from "../game/yen";

const { Title, Text } = Typography;

export default function GameHvH() {
  const { modal } = App.useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size") ?? "7");
  const size = Number.isFinite(sizeParam) && sizeParam >= 2 ? sizeParam : 7;

  const starterParam = (searchParams.get("starter") ?? "player0").toLowerCase();
  const starter: StarterHvH = starterParam === "player1" ? "player1" : "player0";

  const [yen, setYen] = useState<YEN | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
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
      setNext(null);
      setGameOver(false);

      try {
        const r = await newHvhGame(size, starter);
        if (!cancelled) {
          setYen(r.yen);
          if (r.status.state === "finished") {
            setGameOver(true);
            setWinner(r.status.winner);
          } else {
            setNext(r.status.next);
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

  async function handleCellClick(cellId: number) {
    if (!yen || loading || gameOver) return;

    setError("");
    setLoading(true);

    try {
      const r = await humanVsHumanMove(yen, cellId);
      setYen(r.yen);

      if (r.status.state === "finished") {
        setGameOver(true);
        setWinner(r.status.winner);
        setNext(null);
      } else {
        setNext(r.status.next);
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
                  Juego Y — Human vs Human
                </Title>
                <Text type="secondary">
                  Tamaño: {size} · Empieza: {starter}
                  {next ? ` · Turno: ${next}` : ""}
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
              <Card>
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
                    <Flex justify="center">
                      <Title level={4} style={{ margin: 0 }}>
                        Partida terminada
                      </Title>
                    </Flex>
                    <Flex justify="center">
                      <Text>{winner ? `Ganador: ${winner}` : "—"}</Text>
                    </Flex>
                    <Flex justify="center" gap={12} wrap="wrap">
                      <Button type="primary" onClick={() => navigate("/home", { replace: true })}>
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