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
  Tag,
  Typography,
} from "antd";
import {
  BuildOutlined,
  PlayCircleOutlined,
  TeamOutlined,
  DeploymentUnitOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getMeta, type MetaResponse } from "../api/gamey";
import { getUserStats, type UserStats } from "../api/users";
import { getUserSession } from "../utils/session";
import AppHeader from "./AppHeader.tsx";
import DifficultySelect from "./Dificultyselect.tsx";
import UserStatsSummary from "./UserStats";
import type { Variant, VariantId } from "./VariantSelect";

const { Title, Text } = Typography;

type StarterHvB = "human" | "bot" | "random";
type StarterHvH = "player0" | "player1" | "random";

type LastConfigHvB = { size: number; botId: string; hvbstarter: StarterHvB };
type LastConfigHvH = { size: number; hvhstarter: StarterHvH };

const LAST_CONFIG_KEY_HVB = "yovi:lastGameConfig";
const LAST_CONFIG_KEY_HVH = "yovi:lastGameConfigHvh";

// ─── Bots de fallback ─────────────────────────────────────────────────────────
// Lista completa de bots conocidos para cuando el backend no está disponible.
// Incluye los 4 niveles de dificultad que muestra DifficultySelect.
const FALLBACK_BOTS = ["random_bot", "mcts_medio", "mcts_dificil", "mcts_demencial"];

// ─── Helpers de localStorage ──────────────────────────────────────────────────

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
  } catch { }
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
  } catch { }
}

function clampSize(n: number, meta: MetaResponse | null) {
  const min = meta?.min_board_size ?? 2;
  const max = meta?.max_board_size ?? 15;
  return Math.min(Math.max(n, min), max);
}

// ─── Rutas de juego por variante ─────────────────────────────────────────────

function gameRouteForVariant(variantId: VariantId): string {
  const map: Record<VariantId, string> = {
    classic: "/game-hvb",
    pastel: "/game-pastel",
    master: "/game-master",
    fortune_coin: "/game-fortune-coin",
    fortune_dice: "/game-fortune-dice",
    tabu: "/game-tabu",
    holey: "/game-holey",
    why_not: "/game-why-not",
    poly_y: "/game-poly-y",
    hex: "/game-hex",
    "3dy": "/game-3dy",
  };
  return map[variantId] ?? "/game-hvb";
}

/** Ruta HvH: classic tiene su propia ruta /game-hvh; el resto usa la ruta de variante. */
function hvhRouteForVariant(variantId: VariantId): string {
  if (variantId === "classic") return "/game-hvh";
  return gameRouteForVariant(variantId);
}

// Variantes que solo tienen modo HvH (el bot no puede respetar sus reglas extra)
const HVH_ONLY_VARIANTS: VariantId[] = ["fortune_coin", "fortune_dice", "poly_y", "holey", "tabu", "why_not", "pastel", "3dy"];
const STANDALONE_VARIANTS: VariantId[] = ["hex"];

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  variant: Variant;
  onChangeVariant: () => void;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function Home({ variant, onChangeVariant }: Props) {
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
      .catch(() =>
        // FIX: el fallback incluye los 4 bots reales con sus IDs correctos
        // para que DifficultySelect pueda mostrar Fácil/Medio/Difícil/Demencial
        // incluso cuando el backend gamey no está disponible.
        setMeta({
          api_version: "v1",
          min_board_size: 2,
          max_board_size: 15,
          bots: FALLBACK_BOTS,
        })
      );
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

  // ─── Bots disponibles (con fallback garantizado) ───────────────────────────
  // Si meta ya está cargado usamos sus bots; si no, usamos el fallback directamente.
  // Esto evita que DifficultySelect se renderice con una lista vacía.
  const availableBots = meta?.bots?.length ? meta.bots : FALLBACK_BOTS;

  // ─── Handlers ─────────────────────────────────────────────────────────────

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
    params.set("variant", variant.id);
    navigate(`${gameRouteForVariant(variant.id)}?${params.toString()}`);
  }

  function handlePlayHvH() {
    const s = clampSize(size, meta);
    saveLastConfigHvH({ size: s, hvhstarter: hvhStarter });
    const params = new URLSearchParams();
    params.set("size", String(s));
    params.set("hvhstarter", hvhStarter);
    params.set("variant", variant.id);
    navigate(`${hvhRouteForVariant(variant.id)}?${params.toString()}`);
  }

  function handlePlayStandalone() {
    const s = clampSize(size, meta);
    const params = new URLSearchParams();
    params.set("size", String(s));
    params.set("variant", variant.id);
    navigate(`${gameRouteForVariant(variant.id)}?${params.toString()}`);
  }

  // ─── Pantalla de dificultad HvB ───────────────────────────────────────────

  if (showDifficulty) {
    return (
      <DifficultySelect
        bots={availableBots}
        selectedBot={botId}
        onSelect={(next) => {
          setBotId(next);
          saveLastConfigHvB({ size, botId: next, hvbstarter });
        }}
        onConfirm={handleConfirmDifficulty}
      />
    );
  }

  // ─── Variante standalone (Hex) ────────────────────────────────────────────

  if (STANDALONE_VARIANTS.includes(variant.id)) {
    return (
      <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
        <div style={{ width: "min(1000px, 100%)" }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <AppHeader title="YOVI" />
            <MultiplayerCard onClick={() => navigate("/multiplayer")} />
            <Card>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <VariantHeader variant={variant} onChangeVariant={onChangeVariant} />
                <Divider>Configuración</Divider>
                <Flex justify="center" gap={16} wrap="wrap" align="end">
                  <SizeInput size={size} setSize={setSize} meta={meta} minSize={minSize} maxSize={maxSize} />
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayStandalone}>
                    Jugar
                  </Button>
                </Flex>
              </Space>
            </Card>
            <StatsSection session={session} stats={stats} statsLoading={statsLoading} statsError={statsError} />
          </Space>
        </div>
      </Flex>
    );
  }

  // ─── Variantes solo HvH ───────────────────────────────────────────────────

  if (HVH_ONLY_VARIANTS.includes(variant.id)) {
    return (
      <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
        <div style={{ width: "min(1000px, 100%)" }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <AppHeader title="YOVI" />
            <MultiplayerCard onClick={() => navigate("/multiplayer")} />
            <Card>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <VariantHeader variant={variant} onChangeVariant={onChangeVariant} />
                <Divider>Human vs. Human</Divider>
                <Flex justify="center" gap={16} wrap="wrap" align="end">
                  <SizeInput size={size} setSize={setSize} meta={meta} minSize={minSize} maxSize={maxSize} />
                  <StarterHvHInput hvhStarter={hvhStarter} setHvhStarter={setHvhStarter} saveLastConfigHvH={saveLastConfigHvH} size={size} />
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayHvH}>
                    Jugar
                  </Button>
                </Flex>
              </Space>
            </Card>
            <StatsSection session={session} stats={stats} statsLoading={statsLoading} statsError={statsError} />
          </Space>
        </div>
      </Flex>
    );
  }

  // ─── Variantes completas (HvB + HvH) ─────────────────────────────────────

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <AppHeader title="YOVI" />
          <MultiplayerCard onClick={() => navigate("/multiplayer")} />

          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <VariantHeader variant={variant} onChangeVariant={onChangeVariant} />

              <Divider>Human vs. Bot</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <SizeInput size={size} setSize={setSize} meta={meta} minSize={minSize} maxSize={maxSize} />

                <div>
                  <Text type="secondary">
                    <TeamOutlined /> Empieza:
                  </Text>
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

                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleGoToDifficulty}
                >
                  Jugar
                </Button>
              </Flex>

              <Divider>Human vs. Human</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <SizeInput size={size} setSize={setSize} meta={meta} minSize={minSize} maxSize={maxSize} />
                <StarterHvHInput hvhStarter={hvhStarter} setHvhStarter={setHvhStarter} saveLastConfigHvH={saveLastConfigHvH} size={size} />
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handlePlayHvH}
                >
                  Jugar
                </Button>
              </Flex>
            </Space>
          </Card>

          <StatsSection session={session} stats={stats} statsLoading={statsLoading} statsError={statsError} />
        </Space>
      </div>
    </Flex>
  );
}

function MultiplayerCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      hoverable
      style={{
        background: "linear-gradient(135deg, #1677ff 0%, #164cff 100%)",
        border: "none",
        color: "white",
        textAlign: "center",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <Title level={3} style={{ color: "white", margin: 0 }}>
        🌍 Multijugador Online (BETA)
      </Title>
      <Text style={{ color: "rgba(255,255,255,0.8)" }}>
        Crea o únete a salas privadas mediante códigos y juega en tiempo real.
      </Text>
    </Card>
  );
}

// ─── Subcomponentes reutilizables ─────────────────────────────────────────────

function VariantHeader({
  variant,
  onChangeVariant,
}: {
  variant: Variant;
  onChangeVariant: () => void;
}) {
  return (
    <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
      <Flex align="center" gap={12}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{variant.emoji}</span>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {variant.label}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {variant.description}
          </Text>
        </div>
        <Tag color={variant.tagColor}>{variant.tagLabel}</Tag>
      </Flex>
      <Button
        size="medium"
        icon={<DeploymentUnitOutlined />}
        onClick={onChangeVariant}
        data-testid="change-variant-btn"
      >
        Cambiar variante
      </Button>
    </Flex>
  );
}

function SizeInput({
  size,
  setSize,
  meta,
  minSize,
  maxSize,
}: {
  size: number;
  setSize: (n: number) => void;
  meta: MetaResponse | null;
  minSize: number;
  maxSize: number;
}) {
  return (
    <div>
      <Text type="secondary">
        <BuildOutlined /> Tamaño [{minSize} - {maxSize}]:
      </Text>
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
  );
}

function StarterHvHInput({
  hvhStarter,
  setHvhStarter,
  saveLastConfigHvH,
  size,
}: {
  hvhStarter: StarterHvH;
  setHvhStarter: (v: StarterHvH) => void;
  saveLastConfigHvH: (cfg: LastConfigHvH) => void;
  size: number;
}) {
  return (
    <div>
      <Text type="secondary">
        <TeamOutlined /> Empieza:
      </Text>
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
  );
}

function StatsSection({
  session,
  stats,
  statsLoading,
  statsError,
}: {
  session: ReturnType<typeof getUserSession>;
  stats: UserStats | null;
  statsLoading: boolean;
  statsError: string | null;
}) {
  if (!session) return null;
  return (
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
  );
}
