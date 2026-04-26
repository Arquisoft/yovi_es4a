import { Button, Card, Flex, Space, Typography } from "antd";
import {
  ArrowLeftOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FireOutlined,
} from "@ant-design/icons";
import AppHeader from "./AppHeader";

const { Title, Text } = Typography;

type Props = {
  bots: string[];
  selectedBot: string;
  onSelect: (botId: string) => void;
  onConfirm: () => void;
  onBackHome: () => void;
};

const DIFFICULTY_ORDER = ["random_bot", "mcts_medio", "mcts_completo_medio", "mcts_completo_dificil"];

const BOT_META: Record<string, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  random_bot: {
    label: "Fácil",
    description: "Elige casillas al azar. Perfecto para aprender las reglas.",
    icon: <RobotOutlined />,
    color: "#52c41a",
  },
  mcts_medio: {
    label: "Medio",
    description: "Analiza un buen número de jugadas. Un reto razonable.",
    icon: <ThunderboltOutlined />,
    color: "#faad14",
  },
  mcts_completo_medio: {
    label: "Difícil",
    description: "Calcula miles de partidas. Cuesta vencerle.",
    icon: <ThunderboltOutlined />,
    color: "#f5222d",
  },
  mcts_completo_dificil: {
    label: "Demencial",
    description: "Simulaciones masivas. Solo para los más valientes.",
    icon: <FireOutlined />,
    color: "#722ed1",
  },
};

function botMeta(botId: string) {
  return BOT_META[botId] ?? {
    label: botId,
    description: "Bot personalizado.",
    icon: <RobotOutlined />,
    color: "#1677ff",
  };
}

function sortedBots(bots: string[]): string[] {
  const available = new Set(bots);
  return DIFFICULTY_ORDER.filter((botId) => available.has(botId));
}

export default function DifficultySelect({ bots, selectedBot, onSelect, onConfirm, onBackHome }: Props) {
  const ordered = sortedBots(bots);

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(600px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <AppHeader title="YOVI" />

          <Card>
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              <Flex justify="center">
                <Title level={3} style={{ margin: 0 }}>
                  Selecciona la dificultad
                </Title>
              </Flex>

              <Flex vertical gap={12}>
                {ordered.map((botId) => {
                  const meta = botMeta(botId);
                  const isSelected = selectedBot === botId;
                  return (
                    <Card
                      key={botId}
                      hoverable
                      onClick={() => onSelect(botId)}
                      style={{
                        cursor: "pointer",
                        border: isSelected
                          ? `2px solid ${meta.color}`
                          : "2px solid transparent",
                        boxShadow: isSelected
                          ? `0 0 0 3px ${meta.color}22`
                          : undefined,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Flex align="center" gap={16}>
                        <div
                          style={{
                            fontSize: 28,
                            color: meta.color,
                            lineHeight: 1,
                          }}
                        >
                          {meta.icon}
                        </div>
                        <div>
                          <Text strong style={{ fontSize: 16 }}>
                            {meta.label}
                          </Text>
                          <br />
                          <Text type="secondary">{meta.description}</Text>
                        </div>
                      </Flex>
                    </Card>
                  );
                })}
              </Flex>

              <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBackHome}>
                  Volver
                </Button>

                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={onConfirm}
                  disabled={!selectedBot}
                >
                  Empezar partida
                </Button>
              </Flex>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}