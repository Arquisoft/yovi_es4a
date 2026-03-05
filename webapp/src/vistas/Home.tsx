import { useEffect, useState } from "react";
import { Button, Card, Divider, Flex, InputNumber, Select, Space, Typography } from "antd";
import { BuildOutlined, LogoutOutlined, PlayCircleOutlined, RobotOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App } from "antd";
import { getGameConfig, type GameConfig } from "../api/gamey";

const { Title, Text } = Typography;

type StarterHvB = "human" | "bot";

type StarterHvH = "player0" | "player1";

type LastConfigHvB = { size: number; botId: string; starter: StarterHvB };

const LAST_CONFIG_KEY_HVB = "yovi:lastGameConfig";

function loadLastConfigHvB(): LastConfigHvB | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY_HVB);
    if (!raw)
      return null;
    const parsed = JSON.parse(raw) as Partial<LastConfigHvB>;

    if (typeof parsed.size !== "number")
      return null;
    if (typeof parsed.botId !== "string")
      return null;
    if (parsed.starter !== "human" && parsed.starter !== "bot")
      return null;

    return { size: parsed.size, botId: parsed.botId, starter: parsed.starter };
  } catch {
    return null;
  }
}

function saveLastConfigHvB(cfg: LastConfigHvB) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY_HVB, JSON.stringify(cfg));
  }
  catch {
  }
}

export default function Home() {
  const { modal } = App.useApp();

  const navigate = useNavigate();

  const [size, setSize] = useState(7);
  const [botId, setBotId] = useState("random_bot");
  const [starter, setStarter] = useState<"human" | "bot">("human");
  const [hvhStarter, setHvhStarter] = useState<StarterHvH>("player0");

  const [config, setConfig] = useState<GameConfig | null>(null);

  useEffect(() => {
    const last = loadLastConfigHvB();
    if (!last) return;

    setSize(last.size);
    setBotId(last.botId);
    setStarter(last.starter);
  }, []);

  function handlePlayHvB() {
    saveLastConfigHvB({ size, botId, starter });
    
    const params = new URLSearchParams({
      size: String(size),
      bot: botId,
      starter,
    });
    navigate(`/game?${params.toString()}`);
  }

  function handlePlayHvH() {
    const params = new URLSearchParams({
      size: String(size),
      starter: hvhStarter,
    });
    navigate(`/game-hvh?${params.toString()}`);
  }

  useEffect(() => {
    getGameConfig()
      .then((c) => {
        setConfig(c);
        setSize((prev) => {
          const clamped = Math.min(Math.max(prev, c.min_board_size), c.max_board_size);
          if (clamped !== prev)
            saveLastConfigHvB({ size: clamped, botId, starter });
          return clamped;
        });
      })
      .catch(() => {
        setConfig({ min_board_size: 2, max_board_size: 15 });
      });
  }, []);

  function handleLogout() {
    modal.confirm({
      title: "Cerrar sesión",
      content: "¿Seguro que quieres volver a la pantalla de bienvenida?",
      okText: "Sí, salir",
      cancelText: "Cancelar",
      onOk: () => navigate("/", { replace: true }),
    });
  }

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>

          {/* Barra Menú */}
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space>
                <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </Space>

              <Title level={2} style={{ margin: 0 }}>YOVI</Title>

              <Space>
                <Button icon={<UserOutlined />}>
                  Ver perfil
                </Button>
              </Space>
            </Flex>
          </Card>

          {/* Juego */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={3} style={{ margin: 0 }}>Juego Y</Title>
              </Flex>

              <Divider>Human vs. Bot</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <div>
                  <Text type="secondary"><BuildOutlined /> Tamaño:</Text>
                  <div>
                    <InputNumber
                      min={config?.min_board_size ?? 2}
                      max={config?.max_board_size ?? 15}
                      value={size}
                      onChange={(v) => {
                        const next = typeof v === "number" ? v : (config?.min_board_size ?? 2);
                        setSize(next);
                        saveLastConfigHvB({ size: next, botId, starter });
                      }}
                      style={{ width: 140 }}
                    />
                  </div>
                </div>

                <div>
                  <Text type="secondary"><RobotOutlined /> Bot:</Text>
                  <div>
                    <Select
                      value={botId}
                      onChange={(next) => {
                        setBotId(next);
                        saveLastConfigHvB({ size, botId: next, starter });
                      }}
                      style={{ width: 240 }}
                      options={[
                        { value: "random_bot", label: "Random bot" },
                        { value: "mcts_bot", label: "MCTS bot" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <Text type="secondary"><TeamOutlined /> Empieza:</Text>
                  <div>
                    <Select
                      value={starter}
                      onChange={(next) => {
                        setStarter(next);
                        saveLastConfigHvB({ size, botId, starter: next });
                      }}
                      style={{ width: 200 }}
                      options={[
                        { value: "human", label: "Human" },
                        { value: "bot", label: "Bot" },
                      ]}
                    />
                  </div>
                </div>

                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayHvB}>
                  Jugar
                </Button>
              </Flex>

              <Divider>Human vs. Human</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <div>
                  <Text type="secondary"><BuildOutlined /> Tamaño:</Text>
                  <div>
                    <InputNumber
                      min={config?.min_board_size ?? 2}
                      max={config?.max_board_size ?? 12}
                      value={size}
                      onChange={(v) => setSize(typeof v === "number" ? v : (config?.min_board_size ?? 2))}
                      style={{ width: 140 }}
                    />
                  </div>
                </div>

                <div>
                  <Text type="secondary"><TeamOutlined /> Empieza:</Text>
                  <div>
                    <Select
                      value={hvhStarter}
                      onChange={setHvhStarter}
                      style={{ width: 200 }}
                      options={[
                        { value: "player0", label: "Player 0" },
                        { value: "player1", label: "Player 1" },
                      ]}
                    />
                  </div>
                </div>

                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayHvH}>
                  Jugar
                </Button>
              </Flex>
            </Space>
          </Card>

          {/* Estadísticas */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={3} style={{ margin: 0 }}>Estadísticas</Title>
              </Flex>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Text type="secondary">Sin implementar todavía</Text>
              </Flex>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}