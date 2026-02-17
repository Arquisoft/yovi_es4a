import { useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Flex, InputNumber, Select, Space, Typography } from "antd";
import { PlayCircleOutlined, RobotOutlined } from "@ant-design/icons";

import { humanVsBotMove, newGame, type YEN } from "./api/gamey";
import Board from "./game/Board";
import { parseYenToCells } from "./game/yen";

const { Title, Text } = Typography;

export default function GameHvB() {
  const [size, setSize] = useState(7);
  const [botId, setBotId] = useState("random_bot");

  const [yen, setYen] = useState<YEN | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cells = useMemo(() => {
    if (!yen) return [];
    return parseYenToCells(yen);
  }, [yen]);

  const inGame = !!yen && !gameOver;
  const controlsDisabled = loading || inGame;

  async function handleNewGame() {
    setError("");
    setLoading(true);
    try {
      const r = await newGame(size);
      setYen(r.yen);
      setGameOver(false);
      setWinner(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleAbandonGame() {
    setError("");
    setLoading(false);
    setGameOver(false);
    setWinner(null);
    setYen(null);
  }

  async function handleCellClick(cellId: number) {
    if (!yen || gameOver) return;

    setError("");
    setLoading(true);
    try {
      const r = await humanVsBotMove(botId, yen, cellId);
      setYen(r.yen);

      const finished = r.status.state === "finished";
      setGameOver(finished);

      if (r.status.state === "finished") {
        setWinner(r.status.winner);
      } else {
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
          <Title level={2} style={{ margin: 0, textAlign: "center" }}>
            Juego Y — Human vs Bot
          </Title>

          {/* Controls */}
          <Card>
            <Flex gap={16} wrap="wrap" align="end">
              <div>
                <Text type="secondary">Tamaño:</Text>
                <div>
                  <InputNumber
                    min={2}
                    value={size}
                    onChange={(v) => setSize(typeof v === "number" ? v : 7)}
                    disabled={controlsDisabled}
                    style={{ width: 140 }}
                  />
                </div>
              </div>

              <div>
                <Text type="secondary"><RobotOutlined /> Bot:</Text>
                <div>
                  <Select
                    value={botId}
                    onChange={(value) => setBotId(value)}
                    disabled={controlsDisabled}
                    style={{ width: 240 }}
                    options={[
                      { value: "random_bot", label: "Random bot" },
                      { value: "mcts_bot", label: "MCTS bot" },
                    ]}
                  />
                </div>
              </div>

              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={loading}
                onClick={handleNewGame}
                disabled={controlsDisabled}
              >
                Jugar
              </Button>
            </Flex>
          </Card>

          {/* Feedback */}
          {error && <Alert type="error" showIcon message={error} />}

          {gameOver && winner && (
            <Alert
              showIcon
              type={winner === "human" ? "success" : "error"}
              message={winner === "human" ? "Felicidades, has ganado!" : "Game Over, ha ganado el bot!"}
            />
          )}

          {/* Empty / Board */}
          {!yen ? (
            <Card>
              <Empty
                description="Crear un nuevo juego para empezar."
                image={Empty.PRESENTED_IMAGE_DEFAULT}
                imageStyle={{ height: 120 }}
              />
            </Card>
          ) : (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <Card>
                <Board
                  size={yen.size}
                  cells={cells}
                  disabled={loading || gameOver}
                  onCellClick={handleCellClick}
                />
              </Card>

              {!gameOver && (
                <Flex justify="center">
                  <Button
                    danger
                    onClick={handleAbandonGame}
                    disabled={loading}
                  >
                    Abandonar partida
                  </Button>
                </Flex>
              )}
            </Space>
          )}

        </Space>
      </div>
    </Flex>
  );
}
