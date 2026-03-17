import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Flex,
  InputNumber,
  Select,
  Space,
  Typography
} from "antd";
import {
  BuildOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getMeta, type MetaResponse } from "../api/gamey";
import AppHeader from "./AppHeader.tsx";

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
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastConfigHvB>;
    if (typeof parsed.size !== "number") return null;
    if (typeof parsed.botId !== "string") return null;
    if (parsed.hvbstarter !== "human" && parsed.hvbstarter !== "bot") return null;
    return { size: parsed.size, botId: parsed.botId, hvbstarter: parsed.hvbstarter };
  } catch {
    return null;
  }
}

function saveLastConfigHvB(cfg: LastConfigHvB) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY_HVB, JSON.stringify(cfg));
  } catch {}
}

function loadLastConfigHvH(): LastConfigHvH | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY_HVH);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastConfigHvH>;
    if (typeof parsed.size !== "number") return null;
    if (parsed.hvhstarter !== "player0" && parsed.hvhstarter !== "player1") return null;
    return { size: parsed.size, hvhstarter: parsed.hvhstarter };
  } catch {
    return null;
  }
}

function saveLastConfigHvH(cfg: LastConfigHvH) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY_HVH, JSON.stringify(cfg));
  } catch {}
}

function clampSize(n: number, meta: MetaResponse | null) {
  const min = meta?.min_board_size ?? 2;
  const max = meta?.max_board_size ?? 15;
  return Math.min(Math.max(n, min), max);
}

export default function Home() {
  const navigate = useNavigate();

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [size, setSize] = useState(7);

  // HvB config
  const [botId, setBotId] = useState("random_bot");
  const [hvbstarter, setHvbStarter] = useState<StarterHvB>("human");

  // HvH config
  const [hvhStarter, setHvhStarter] = useState<StarterHvH>("player0");

  useEffect(() => {
    getMeta()
      .then((c) => setMeta(c))
      .catch(() => setMeta({
        api_version: "v1",
        min_board_size: 2,
        max_board_size: 15,
        bots: ["random_bot", "mcts_bot"],
      }));
  }, []);

  useEffect(() => {
    const lastHvb = loadLastConfigHvB();
    const lastHvh = loadLastConfigHvH();

    if (lastHvb) {
      setSize(lastHvb.size);
      setBotId(lastHvb.botId);
      setHvbStarter(lastHvb.hvbstarter);
    }

    if (lastHvh) {
      if (!lastHvb) setSize(lastHvh.size);
      setHvhStarter(lastHvh.hvhstarter);
    }
  }, []);

  useEffect(() => {
    if (!meta) return;
    setSize((prev) => clampSize(prev, meta));
  }, [meta]);

  const minSize = meta?.min_board_size ?? 2;
  const maxSize = meta?.max_board_size ?? 15;

  function handlePlayHvB() {
    const s = clampSize(size, meta);
    saveLastConfigHvB({ size: s, botId, hvbstarter });
    const params = new URLSearchParams();
    params.set("size", String(s));
    params.set("bot", botId);
    params.set("hvbstarter", hvbstarter);
    navigate(`/game-hvb?${params.toString()}`);
  }

  function handlePlayHvH() {
    const s = clampSize(size, meta);
    saveLastConfigHvH({ size: s, hvhstarter: hvhStarter });
    const params = new URLSearchParams();
    params.set("size", String(s));
    params.set("hvhstarter", hvhStarter);
    navigate(`/game-hvh?${params.toString()}`);
  }

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>

          {/* Barra Menú */}
          <AppHeader title="YOVI" />

          {/* Juego */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={3} style={{ margin: 0 }}>Juego Y</Title>
              </Flex>

              <Divider>Human vs. Bot</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <div>
                  <Text type="secondary"><BuildOutlined /> Tamaño [{minSize} - {maxSize}]:</Text>
                  <div>
                    <InputNumber
                      min={minSize}
                      max={maxSize}
                      value={size}
                      onChange={(next) => setSize(clampSize(Number(next ?? 7), meta))}
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
                      options={(meta?.bots ?? ["random_bot"]).map((b) => ({ value: b, label: b }))}
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
                  <Text type="secondary"><BuildOutlined /> Tamaño [{minSize} - {maxSize}]:</Text>
                  <div>
                    <InputNumber
                      min={minSize}
                      max={maxSize}
                      value={size}
                      onChange={(next) => setSize(clampSize(Number(next ?? 7), meta))}
                      style={{ width: 140 }}
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