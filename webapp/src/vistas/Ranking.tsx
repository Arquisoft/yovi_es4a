import { useEffect, useState } from "react";
import {
  Select,
  Typography,
  Alert,
  Avatar,
  Tag,
  Tooltip,
  Card,
  Flex,
  Space,
  Table,
  Progress,
} from "antd";
import {
  TrophyOutlined,
  RiseOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import AppHeader from "./AppHeader";
import { getRanking } from "../api/users";

const { Title, Text } = Typography;
type SortBy = "winRate" | "gamesWon" | "gamesPlayed";

type RankingEntry = {
  username: string;
  profilePicture: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesAbandoned: number;
  totalMoves: number;
  winRate: number;
};

const SORT_OPTIONS = [
  { value: "winRate",     label: "% Partidas ganadas", icon: <TrophyOutlined /> },
  { value: "gamesWon",    label: "Partidas ganadas",    icon: <RiseOutlined /> },
  { value: "gamesPlayed", label: "Partidas jugadas",    icon: <PlayCircleOutlined /> },
];

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Ranking() {
  const [sortBy, setSortBy]   = useState<SortBy>("winRate");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getRanking(sortBy, 20)
      .then((data) => {
        setEntries(Array.isArray(data.ranking) ? data.ranking : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sortBy]);

  const columns = [
    {
      title: '#',
      key: 'rank',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <Text strong style={{ fontSize: index < 3 ? 18 : 14 }}>
          {index < 3 ? MEDAL[index] : index + 1}
        </Text>
      ),
    },
    {
      title: 'Jugador',
      key: 'username',
      render: (_: any, record: RankingEntry) => (
        <Space>
          <Avatar src={record.profilePicture}>{record.username[0].toUpperCase()}</Avatar>
          <Space direction="vertical" size={0}>
            <Text strong>{record.username}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.gamesWon}V · {record.gamesLost}D · {record.gamesAbandoned}A
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '% Victoria',
      dataIndex: 'winRate',
      key: 'winRate',
      align: 'center' as const,
      render: (val: number) => (
        <Tooltip title={`${val}% de victorias`}>
          <Progress percent={val} size="small" status="active" format={(percent) => `${percent}%`} />
        </Tooltip>
      ),
    },
    {
      title: 'Victorias',
      dataIndex: 'gamesWon',
      key: 'gamesWon',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={sortBy === "gamesWon" ? "geekblue" : "default"}>{val}</Tag>
      ),
    },
    {
      title: 'Partidas',
      dataIndex: 'gamesPlayed',
      key: 'gamesPlayed',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={sortBy === "gamesPlayed" ? "purple" : "default"}>{val}</Tag>
      ),
    },
    {
      title: 'Movimientos',
      dataIndex: 'totalMoves',
      key: 'totalMoves',
      align: 'center' as const,
      render: (val: number) => (
        <Tooltip title="Movimientos realizados en partidas registradas">
          <Text type="secondary">{val}</Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>

          {/* Barra Menú compartida */}
          <AppHeader title="🏆 Ranking" />

          {/* Tabla de Ranking */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              
              {/* Controles de la tabla: Título a la izquierda, Selector a la derecha */}
              <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                <Title level={3} style={{ margin: 0 }}>Clasificación</Title>
                
                <Select
                  value={sortBy}
                  onChange={v => setSortBy(v as SortBy)}
                  style={{ width: 220 }}
                  options={SORT_OPTIONS.map(o => ({
                    value: o.value,
                    label: (
                      <Space>
                        {o.icon} {o.label}
                      </Space>
                    )
                  }))}
                />
              </Flex>

              {error && <Alert type="error" title="No se pudo cargar el ranking" description={error} />}      
              
              <Table
                dataSource={entries}
                columns={columns}
                rowKey="username"
                pagination={false}
                loading={loading}
                locale={{ emptyText: "Todavía no hay jugadores con partidas registradas." }}
              />

              <Flex justify="center">
                <Text type="secondary" style={{ fontSize: 13, textAlign: "center" }}>
                  <strong>% Victoria</strong> — partidas ganadas / total jugadas.
                  <br />
                  <strong>Movimientos</strong> — total de movimientos realizados en todas las partidas registradas.
                  <br />
                  <strong>A</strong> — partidas abandonadas.
                </Text>
              </Flex>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}