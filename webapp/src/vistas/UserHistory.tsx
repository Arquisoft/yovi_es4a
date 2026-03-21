import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Card,
  Empty,
  Flex,
  List,
  Pagination,
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
} from "@ant-design/icons";
import AppHeader from "./AppHeader";
import UserStatsSummary from "./UserStats";
import {
  getUserHistory,
  type HistoryGame,
  type UserHistoryResponse,
} from "../api/users";
import { getUserSession } from "../utils/session";

const { Title, Text } = Typography;

const PAGE_SIZE = 5;

function resultTag(result: HistoryGame["result"]) {
  switch (result) {
    case "won":
      return <Tag color="success" icon={<CheckCircleOutlined />}>Ganada</Tag>;
    case "lost":
      return <Tag color="error" icon={<CloseCircleOutlined />}>Perdida</Tag>;
    case "abandoned":
      return <Tag color="default" icon={<StopOutlined />}>Abandonada</Tag>;
    default:
      return <Tag>{result}</Tag>;
  }
}

function modeLabel(mode: HistoryGame["mode"]) {
  return mode === "HvB" ? "Humano vs Bot" : "Humano vs Humano";
}

export default function UserHistory() {
  const session = getUserSession();
  const username = session?.username ?? "";

  const [data, setData] = useState<UserHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username)
      return;

    setLoading(true);
    setError(null);

    getUserHistory(username, page, PAGE_SIZE)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [username, page]);

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
                      src={data.profilePicture}
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
                  <Title level={2} style={{ margin: 0, textAlign: "center" }}>
                    Partidas jugadas
                  </Title>

                  {data.games.length === 0 ? (
                    <Empty description="Todavía no hay partidas registradas para este usuario." />
                  ) : (
                    <>
                      <List
                        dataSource={data.games}
                        renderItem={(game) => (
                          <List.Item>
                            <Card style={{ width: "100%" }}>
                              <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                                <Space direction="vertical" size={2}>
                                  <Text strong>
                                    {modeLabel(game.mode)} · {game.boardSize}x
                                  </Text>
                                  <Text type="secondary">
                                    Rival: {game.opponent || (game.mode === "HvB" ? "Bot" : "Jugador local")}
                                  </Text>
                                  <Text type="secondary">
                                    Movimientos: {game.totalMoves}
                                  </Text>
                                  <Text type="secondary">
                                    Fecha: {new Date(game.finishedAt).toLocaleString()}
                                  </Text>
                                </Space>

                                <Space direction="vertical" size={4} align="end">
                                  {resultTag(game.result)}
                                  {game.startedBy ? (
                                    <Text type="secondary">Empieza: {game.startedBy}</Text>
                                  ) : null}
                                </Space>
                              </Flex>
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