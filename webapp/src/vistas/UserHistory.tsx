import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  List,
  Pagination,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  UserOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import AppHeader from "./AppHeader";
import UserStatsSummary from "./UserStats";
import {
  getUserHistory,
  type HistoryGame,
  type UserHistoryResponse,
} from "../api/users";
import { getUserSession } from "../utils/session";
import { resolveAvatarSrc } from "../utils/avatar";

const { Title, Text } = Typography;

const PAGE_SIZE = 5;

function resultTag(result: HistoryGame["result"]) {
  const resultTagStyle = {
    fontSize: 17,
    fontWeight: 700,
    padding: "6px 12px",
    lineHeight: 1.4,
    borderRadius: 8,
  };

  switch (result) {
    case "won":
      return <Tag color="success" icon={<CheckCircleOutlined />} style={resultTagStyle}>Ganada</Tag>;
    case "lost":
      return <Tag color="error" icon={<CloseCircleOutlined />} style={resultTagStyle}>Perdida</Tag>;
    case "abandoned":
      return <Tag color="default" icon={<StopOutlined />} style={resultTagStyle}>Abandonada</Tag>;
    case "draw":
      return <Tag color="processing" icon={<MinusCircleOutlined />} style={resultTagStyle}>Empatada</Tag>;
    default:
      return <Tag style={resultTagStyle}>{result}</Tag>;
  }
}

function modeTag(mode: HistoryGame["mode"]) {
  switch (mode) {
    case "classic_hvb":
      return <Tag color="#28BBF5">Clásico HvB</Tag>;
    case "classic_hvh":
      return <Tag color="#FF7B00">Clásico HvH</Tag>;
    case "tabu_hvh":
      return <Tag color="#FF4D6D">Tabú HvH</Tag>;
    case "holey_hvh":
      return <Tag color="#A855F7">HoleY HvH</Tag>;
    case "fortune_dice_hvh":
      return <Tag color="#FACC15">Fortune Dice HvH</Tag>;
    case "poly_hvh":
      return <Tag color="#22C55E">PolY HvH</Tag>;
    default:
      return <Tag>{mode}</Tag>;
  }
}

function modeLabel(mode: HistoryGame["mode"]) {
  switch (mode) {
    case "classic_hvb":
      return "Clásico — Humano vs Bot";
    case "classic_hvh":
      return "Clásico — Humano vs Humano";
    case "tabu_hvh":
      return "Tabú — Humano vs Humano";
    case "holey_hvh":
      return "HoleY — Humano vs Humano";
    case "fortune_dice_hvh":
      return "Fortune Dice — Humano vs Humano";
    case "poly_hvh":
      return "PolY — Humano vs Humano";
    default:
      return mode;
  }
}

function defaultOpponentLabel(mode: HistoryGame["mode"]) {
  return mode === "classic_hvb" ? "Bot" : "Jugador local";
}

function gameDetails(game: HistoryGame) {
  return (
    <Descriptions
      column={1}
      size="small"
      styles={{
        label: { width: 140, fontWeight: 600 },
      }}
    >
      <Descriptions.Item label="Modo">
        {modeLabel(game.mode)}
      </Descriptions.Item>

      <Descriptions.Item label="Fecha">
        {new Date(game.finishedAt).toLocaleString()}
      </Descriptions.Item>

      <Descriptions.Item label="Tamaño">
        {game.boardSize}
      </Descriptions.Item>

      <Descriptions.Item label="Movimientos">
        {game.totalMoves}
      </Descriptions.Item>

      <Descriptions.Item label="Rival">
        {game.opponent || defaultOpponentLabel(game.mode)}
      </Descriptions.Item>

      {game.startedBy ? (
        <Descriptions.Item label="Empieza">
          {game.startedBy}
        </Descriptions.Item>
      ) : null}
    </Descriptions>
  );
}

export default function UserHistory() {
  const session = getUserSession();
  const username = session?.username ?? "";

  const [data, setData] = useState<UserHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [modeFilter, setModeFilter] = useState<
    "all" | "classic_hvb" | "classic_hvh" | "tabu_hvh" | "holey_hvh" | "fortune_dice_hvh" | "poly_hvh"
  >("all");
  const [resultFilter, setResultFilter] = useState<"all" | "won" | "lost" | "abandoned" | "draw">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "movesDesc" | "movesAsc">("newest");

  useEffect(() => {
    setPage(1);
  }, [modeFilter, resultFilter, sortBy]);

  useEffect(() => {
    if (!username)
      return;

    setLoading(true);
    setError(null);

    getUserHistory(username, page, PAGE_SIZE, {
      mode: modeFilter,
      result: resultFilter,
      sortBy,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [username, page, modeFilter, resultFilter, sortBy]);

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1100px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <AppHeader title="Historial" />

          {error && (
            <Alert
              type="error"
              message="No se pudo cargar el historial"
              description={error}
              showIcon
            />
          )}

          {loading ? (
            <Card>
              <Flex justify="center" align="center" style={{ minHeight: 280 }}>
                <Spin size="large" />
              </Flex>
            </Card>
          ) : data ? (
            <>
              <Card>
                <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                  <Space size={12}>
                    <Avatar
                      size={56}
                      src={resolveAvatarSrc(data.profilePicture)}
                      icon={<UserOutlined />}
                    />
                    <Space direction="vertical" size={0}>
                      <Title level={3} style={{ margin: 0 }}>
                        {data.username}
                      </Title>
                      <Text type="secondary">
                        {data.pagination.totalGames} partidas registradas
                      </Text>
                    </Space>
                  </Space>
                </Flex>
              </Card>

              <UserStatsSummary stats={data.stats} title="Estadísticas" />

              <Card>
                <Space direction="vertical" size={20} style={{ width: "100%" }}>
                  <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                    <Title level={2} style={{ margin: 0 }}>
                      Partidas jugadas
                    </Title>

                    <Space wrap>
                      <Select
                        value={modeFilter}
                        onChange={setModeFilter}
                        style={{ width: 220 }}
                        options={[
                          { value: "all", label: "Todos los modos" },
                          { value: "classic_hvb", label: "Clásico HvB" },
                          { value: "classic_hvh", label: "Clásico HvH" },
                          { value: "tabu_hvh", label: "Tabú HvH" },
                          { value: "holey_hvh", label: "HoleY HvH" },
                          { value: "fortune_dice_hvh", label: "Fortune Dice HvH" },
                          { value: "poly_hvh", label: "PolY HvH" },
                        ]}
                      />

                      <Select
                        value={resultFilter}
                        onChange={setResultFilter}
                        style={{ width: 180 }}
                        options={[
                          { value: "all", label: "Todos los resultados" },
                          { value: "won", label: "Ganadas" },
                          { value: "lost", label: "Perdidas" },
                          { value: "abandoned", label: "Abandonadas" },
                          { value: "draw", label: "Empatadas" },
                        ]}
                      />

                      <Select
                        value={sortBy}
                        onChange={setSortBy}
                        style={{ width: 180 }}
                        options={[
                          { value: "newest", label: "Más recientes" },
                          { value: "oldest", label: "Más antiguas" },
                          { value: "movesDesc", label: "Más movimientos" },
                          { value: "movesAsc", label: "Menos movimientos" },
                        ]}
                      />
                    </Space>
                  </Flex>

                  {data.games.length === 0 ? (
                    <Empty description="No hay partidas que coincidan con los filtros seleccionados." />
                  ) : (
                    <>
                      <List
                        dataSource={data.games}
                        split={false}
                        renderItem={(game) => (
                          <List.Item style={{ paddingInline: 0 }}>
                            <Card
                              hoverable
                              style={{
                                width: "100%",
                                borderRadius: 12,
                              }}
                              bodyStyle={{ padding: 0 }}
                            >
                              <Collapse
                                ghost
                                expandIconPosition="end"
                                items={[
                                  {
                                    key: game.gameId,
                                    label: (
                                      <Flex
                                        justify="space-between"
                                        align="center"
                                        wrap="wrap"
                                        gap={12}
                                        style={{ width: "100%", paddingRight: 8 }}
                                      >
                                        <Space size={8} wrap>
                                          {resultTag(game.result)}
                                          {modeTag(game.mode)}
                                        </Space>

                                        <Text type="secondary">
                                          {modeLabel(game.mode)}
                                        </Text>
                                      </Flex>
                                    ),
                                    children: gameDetails(game),
                                  },
                                ]}
                              />
                            </Card>
                          </List.Item>
                        )}
                      />

                      <Flex justify="center">
                        <Pagination
                          current={data.pagination.page}
                          total={data.pagination.totalGames}
                          pageSize={data.pagination.pageSize}
                          onChange={(newPage) => setPage(newPage)}
                          showSizeChanger={false}
                        />
                      </Flex>
                    </>
                  )}
                </Space>
              </Card>
            </>
          ) : null}
        </Space>
      </div>
    </Flex>
  );
}