import { useEffect, useState } from "react";
import { Button, Card, Divider, Flex, InputNumber, Select, Space, Typography } from "antd";
import { BuildOutlined, LogoutOutlined, PlayCircleOutlined, RobotOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App } from "antd";
import { getGameConfig, type GameConfig } from "../api/gamey";

const { Title, Text } = Typography;

type StarterHvB = "human" | "bot";
type StarterHvH = "player0" | "player1";

type LastConfigHvB = { size: number; botId: string; hvbstarter: StarterHvB };
type LastConfigHvH = { size: number; hvhstarter: StarterHvH };

const LAST_CONFIG_KEY_HVB = "yovi:lastGameConfig";
const LAST_CONFIG_KEY_HVH = "yovi:lastGameConfigHvh";

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
    if (parsed.hvbstarter !== "human" && parsed.hvbstarter !== "bot")
      return null;

    return { size: parsed.size, botId: parsed.botId, hvbstarter: parsed.hvbstarter };
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

function loadLastConfigHvH(): LastConfigHvH | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY_HVH);
    if (!raw)
      return null;
    const parsed = JSON.parse(raw) as Partial<LastConfigHvH>;

    if (typeof parsed.size !== "number")
      return null;
    if (parsed.hvhstarter !== "player0" && parsed.hvhstarter !== "player1")
      return null;

    return { size: parsed.size, hvhstarter: parsed.hvhstarter };
  } catch {
    return null;
  }
}

function saveLastConfigHvH(cfg: LastConfigHvH) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY_HVH, JSON.stringify(cfg));
  } catch {
  }
}

function clampSize(n: number, cfg: GameConfig | null) {
  const min = cfg?.min_board_size ?? 2;
  const max = cfg?.max_board_size ?? 15;
  return Math.min(Math.max(n, min), max);
}

export default function Home() {
  const { modal } = App.useApp();
  const navigate = useNavigate();

  const [config, setConfig] = useState<GameConfig | null>(null);

  const [size, setSize] = useState(7);

  // HvB config
  const [botId, setBotId] = useState("random_bot");
  const [hvbstarter, setHvbStarter] = useState<StarterHvB>("human");

  // HvH config
  const [hvhStarter, setHvhStarter] = useState<StarterHvH>("player0");

  // Cargar config del server (min/max)
  useEffect(() => {
    getGameConfig()
      .then((c) => setConfig(c))
      .catch(() => setConfig({ min_board_size: 2, max_board_size: 15 }));
  }, []);

  // Cargar last configs (HVB + HVH)
  useEffect(() => {
    const lastHvb = loadLastConfigHvB();
    const lastHvh = loadLastConfigHvH();

    if (lastHvb) {
      setSize(lastHvb.size);
      setBotId(lastHvb.botId);
      setHvbStarter(lastHvb.hvbstarter);
    }

    if (lastHvh) {
      if (!lastHvb)
        setSize(lastHvh.size);
      setHvhStarter(lastHvh.hvhstarter);
    }
  }, []);

  useEffect(() => {
    if (!config) return;

    setSize((prev) => {
      const clamped = clampSize(prev, config);
      if (clamped !== prev) {
        saveLastConfigHvB({ size: clamped, botId, hvbstarter });
        saveLastConfigHvH({ size: clamped, hvhstarter: hvhStarter });
      }
      return clamped;
    });
  }, [config]);

  function handlePlayHvB() {
    const clamped = clampSize(size, config);
    saveLastConfigHvB({ size: clamped, botId, hvbstarter });

    const params = new URLSearchParams({
      size: String(clamped),
      bot: botId,
      hvbstarter,
    });
    navigate(`/game?${params.toString()}`);
  }

  function handlePlayHvH() {
    const clamped = clampSize(size, config);
    saveLastConfigHvH({ size: clamped, hvhstarter: hvhStarter });

    const params = new URLSearchParams({
      size: String(clamped),
      hvhstarter: hvhStarter,
    });
    navigate(`/game-hvh?${params.toString()}`);
  }

  function handleLogout() {
    modal.confirm({
      title: "Cerrar sesión",
      content: "¿Seguro que quieres cerrar sesión y salir?",
      okText: "Sí, salir",
      cancelText: "Cancelar",
      onOk: () => navigate("/", { replace: true }),
    });
  }

  const minSize = config?.min_board_size ?? 2;
  const maxSize = config?.max_board_size ?? 15;

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
                      min={minSize}
                      max={maxSize}
                      value={size}
                      onChange={(v) => {
                        const next = clampSize(
                          typeof v === "number" ? v : minSize,
                          config
                        );
                        setSize(next);
                        saveLastConfigHvB({ size: next, botId, hvbstarter });
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
                        saveLastConfigHvB({ size, botId: next, hvbstarter });
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
                      value={hvbstarter}
                      onChange={(next) => {
                        setHvbStarter(next);
                        saveLastConfigHvB({ size, botId, hvbstarter: next });
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
                      min={minSize}
                      max={maxSize}
                      value={size}
                      onChange={(v) => {
                        const next = clampSize(
                          typeof v === "number" ? v : minSize,
                          config
                        );
                        setSize(next);
                        saveLastConfigHvH({ size: next, hvhstarter: hvhStarter });
                      }}
                      style={{ width: 140 }}
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <Text type="secondary"><TeamOutlined /> Empieza:</Text>
                  <div>
                    <Select
                      value={hvhStarter}
                      onChange={(next) => {
                        setHvhStarter(next);
                        saveLastConfigHvH({ size, hvhstarter: next });
                      }}
                      style={{ width: 200 }}
                      options={[
                        { value: "player0", label: "Player 0" },
                        { value: "player1", label: "Player 1" },
                      ]}
                      disabled
                    />
                  </div>
                </div>

                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayHvH} disabled>
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