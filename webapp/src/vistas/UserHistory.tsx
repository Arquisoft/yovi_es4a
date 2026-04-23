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
  MinusCircleOutlined,
  StopOutlined,
  UserOutlined,
} from "@ant-design/icons";

import AppHeader from "./AppHeader";
import UserStatsSummary from "./UserStats";
import {
  getHistoryOpponentLabel,
  getHistoryStartedByLabel,
  getGameModeLongLabel,
  getGameModeShortLabel,
  getGameModeTagColor,
  getUserHistory,
  HISTORY_MODE_FILTER_OPTIONS,
  type GameMode,
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
      return (
        <Tag color="success" icon={<CheckCircleOutlined />} style={resultTagStyle}>
          Ganada
        </Tag>
      );
    case "lost":
      return (
        <Tag color="error" icon={<CloseCircleOutlined />} style={resultTagStyle}>
          Perdida
        </Tag>
      );
    case "abandoned":
      return (
        <Tag
          icon={<StopOutlined />}
          style={{
            ...resultTagStyle,
            background: "#f5f5f5",
            color: "#595959",
          }}
        >
          Abandonada
        </Tag>
      );
    case "draw":
      return (
        <Tag
          icon={<MinusCircleOutlined />}
          style={{
            ...resultTagStyle,
            background: "#fafafa",
            color: "#999999",
          }}
        >
          Empatada
        </Tag>
      );
    default:
      return <Tag style={resultTagStyle}>{result}</Tag>;
  }
}

function modeTag(mode: GameMode) {
  return <Tag color={getGameModeTagColor(mode)}>{getGameModeShortLabel(mode)}</Tag>;
}

function formatFinishedAt(finishedAt: string) {
  const parsedDate = new Date(finishedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return finishedAt;
  }

  return parsedDate.toLocaleString();
}

function gameDetails(game: HistoryGame) {
  const startedByLabel = getHistoryStartedByLabel(game);

  return (
    <Descriptions
      column={1}
      size="small"
      styles={{
        label: { width: 140, fontWeight: 600 },
      }}
    >
      <Descriptions.Item label="ID de partida">
        {game.gameId}
      </Descriptions.Item>

      <Descriptions.Item label="Modo">
        {getGameModeLongLabel(game.mode)}
      </Descriptions.Item>

      <Descriptions.Item label="Resultado">
        {resultTag(game.result)}
      </Descriptions.Item>

      <Descriptions.Item label="Fecha">
        {formatFinishedAt(game.finishedAt)}
      </Descriptions.Item>

      <Descriptions.Item label="Tamano">
        {game.boardSize}
      </Descriptions.Item>

      <Descriptions.Item label="Movimientos">
        {game.totalMoves}
      </Descriptions.Item>

      <Descriptions.Item label="Rival">
        {getHistoryOpponentLabel(game)}
      </Descriptions.Item>

      {startedByLabel ? (
        <Descriptions.Item label="Empieza">
          {startedByLabel}
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
  const [modeFilter, setModeFilter] = useState<"all" | GameMode>("all");
  const [resultFilter, setResultFilter] = useState<"all" | "won" | "lost" | "abandoned" | "draw">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "movesDesc" | "movesAsc">("newest");

  useEffect(() => {
    setPage(1);
  }, [modeFilter, resultFilter, sortBy]);

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setError(null);

    getUserHistory(username, page, PAGE_SIZE, {
      mode: modeFilter,
      result: resultFilter,
      sortBy,
    })
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [modeFilter, page, resultFilter, sortBy, username]);

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

              <UserStatsSummary stats={data.stats} title="Estadisticas" />

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
                        style={{ width: 240 }}
                        options={HISTORY_MODE_FILTER_OPTIONS}
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
                          { value: "newest", label: "Mas recientes" },
                          { value: "oldest", label: "Mas antiguas" },
                          { value: "movesDesc", label: "Mas movimientos" },
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
                                          {getGameModeLongLabel(game.mode)}
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
                          onChange={(nextPage) => setPage(nextPage)}
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
