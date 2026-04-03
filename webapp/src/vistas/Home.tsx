import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Flex,
  InputNumber,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  BuildOutlined,
  PlayCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getMeta, type MetaResponse } from "../api/gamey";
import { getUserStats, type UserStats } from "../api/users";
import { getUserSession } from "../utils/session";
import AppHeader from "./AppHeader.tsx";
import DifficultySelect from "./Dificultyselect.tsx";
import UserStatsSummary from "./UserStats";

const { Title, Text } = Typography;

type StarterHvB = "human" | "bot" | "random";
type StarterHvH = "player0" | "player1" | "random";

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
    if (parsed.hvbstarter !== "human" && parsed.hvbstarter !== "bot" && parsed.hvbstarter !== "random") return null;
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
    if (parsed.hvhstarter !== "player0" && parsed.hvhstarter !== "player1" && parsed.hvhstarter !== "random") return null;
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
  const session = getUserSession();

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [size, setSize] = useState(7);

  // HvB config
  const [botId, setBotId] = useState("random_bot");
  const [hvbstarter, setHvbStarter] = useState<StarterHvB>("human");

  // HvH config
  const [hvhStarter, setHvhStarter] = useState<StarterHvH>("player0");

  // Pantalla de dificultad HvB
  const [showDifficulty, setShowDifficulty] = useState(false);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session?.username) {
      setStats(null);
      setStatsError(null);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    setStatsError(null);

    getUserStats(session.username)
      .then((data) => setStats(data.stats))
      .catch((e) => setStatsError(e.message))
      .finally(() => setStatsLoading(false));
  }, [session?.username]);

  const minSize = meta?.min_board_size ?? 2;
  const maxSize = meta?.max_board_size ?? 15;

  function handleGoToDifficulty() {
    setShowDifficulty(true);
  }

  function handleConfirmDifficulty() {
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

  if (showDifficulty) {
    return (
      <DifficultySelect
        bots={meta?.bots ?? ["random_bot", "mcts_bot"]}
        selectedBot={botId}
        onSelect={(next) => {
          setBotId(next);
          saveLastConfigHvB({ size, botId: next, hvbstarter });
        }}
        onConfirm={handleConfirmDifficulty}
      />
    );
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
                        { value: "human", label: "Humano" },
                        { value: "bot", label: "Bot" },
                        { value: "random", label: "Aleatorio" },
                      ]}
                    />
                  </div>
                </div>

                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleGoToDifficulty}>
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
                        { value: "random", label: "Aleatorio" },
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

          {session && (
            <>
              {statsError && (
                <Alert
                  type="error"
                  message="No se pudieron cargar las estadísticas"
                  description={statsError}
                  showIcon
                />
              )}

              {statsLoading ? (
                <Card>
                  <Flex justify="center" align="center" style={{ minHeight: 180 }}>
                    <Spin size="large" />
                  </Flex>
                </Card>
              ) : stats ? (
                <UserStatsSummary stats={stats} title="Tus estadísticas" />
              ) : null}
            </>
          )}
        </Space>
      </div>
    </Flex>
  );
}