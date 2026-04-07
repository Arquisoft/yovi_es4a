import { useEffect, useState } from "react";
import {
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
  Segmented,
  Select,
} from "antd";
import {
  TrophyOutlined,
  RiseOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  FireOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import AppHeader from "./AppHeader";
import { getRanking } from "../api/users";
import type { SortByOption, RankingPodiumEntry } from "../api/users";
import { resolveAvatarSrc } from "../utils/avatar";
import "../estilos/Ranking.css";

const { Title, Text } = Typography;

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
  { value: "winRate",     label: "% Victorias",      icon: <TrophyOutlined />       },
  { value: "gamesWon",   label: "Victorias",         icon: <RiseOutlined />         },
  { value: "gamesPlayed",label: "Partidas jugadas",  icon: <PlayCircleOutlined />   },
  { value: "totalMoves", label: "Movimientos",       icon: <ThunderboltOutlined />  },
  { value: "gamesLost",  label: "Derrotas",          icon: <FireOutlined />         },
  { value: "gamesAbandoned", label: "Abandonos",     icon: <FireOutlined />         },
];

// Podium categories — usando las llaves del backend
const PODIUM_CATEGORIES = {
  mostGames: {
    label: "Más partidas",
    icon: <FireOutlined />,
    color: "#722ed1",
    bgColor: "#f9f0ff",
    borderColor: "#d3adf7",
    format: (v: number) => `${v} partidas`,
    valueKey: "gamesPlayed" as const,
  },
  mostWins: {
    label: "Más victorias",
    icon: <RiseOutlined />,
    color: "#1677ff",
    bgColor: "#e6f4ff",
    borderColor: "#91caff",
    format: (v: number) => `${v} victorias`,
    valueKey: "gamesWon" as const,
  },
  bestRate: {
    label: "Mejor % victoria",
    icon: <TrophyOutlined />,
    color: "#d4380d",
    bgColor: "#fff2e8",
    borderColor: "#ffbb96",
    format: (v: number) => `${v}%`,
    valueKey: "winRate" as const,
  },
} as const;

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["#faad14", "#bfbfbf", "#ad6800"];
const PODIUM_HEIGHTS = [80, 55, 40]; // px — gold highest

// ── Podium column ─────────────────────────────────────────────────────────────

function PodiumColumn({
  entry,
  rank,
  valueLabel,
  color,
}: {
  entry: NonNullable<RankingPodiumEntry>;
  rank: number;
  valueLabel: string;
  color: string;
}) {
  const isFirst = rank === 0;

  return (
    <Flex vertical align="center" gap={6} style={{ minWidth: 72, maxWidth: 96 }}>
      {/* Avatar + medal */}
      <div style={{ position: "relative", display: "inline-flex" }}>
        <Avatar
          size={isFirst ? 56 : 44}
          src={resolveAvatarSrc(entry.profilePicture)}
          style={{
            border: `2px solid ${MEDAL_COLORS[rank]}`,
            boxShadow: isFirst ? `0 0 0 3px ${MEDAL_COLORS[rank]}44` : undefined,
          }}
        >
          {entry.username[0].toUpperCase()}
        </Avatar>
        <span
          style={{
            position: "absolute",
            bottom: -6,
            right: -6,
            fontSize: isFirst ? 18 : 14,
            lineHeight: 1,
          }}
        >
          {MEDAL_EMOJI[rank]}
        </span>
      </div>

      {/* Name */}
      <Text
        strong
        style={{
          fontSize: isFirst ? 13 : 12,
          textAlign: "center",
          lineHeight: 1.2,
          wordBreak: "break-word",
          maxWidth: 88,
          color: isFirst ? color : undefined,
        }}
      >
        {entry.username}
      </Text>

      {/* Value */}
      <Tag color={rank === 0 ? "gold" : "default"} style={{ margin: 0 }}>
        {valueLabel}
      </Tag>

      {/* Podium bar */}
      <div
        style={{
          width: "100%",
          height: PODIUM_HEIGHTS[rank],
          background: rank === 0 ? color : rank === 1 ? "#d9d9d9" : "#bfbfbf",
          borderRadius: "6px 6px 0 0",
          opacity: 0.7,
        }}
      />
    </Flex>
  );
}

// ── Podium section ────────────────────────────────────────────────────────────

function PodiumSection({
  podium,
}: {
  podium: {
    mostGames: RankingPodiumEntry;
    mostWins: RankingPodiumEntry;
    bestRate: RankingPodiumEntry;
  };
}) {
  if (!podium || (!podium.mostGames && !podium.mostWins && !podium.bestRate)) return null;

  return (
    <Card
      style={{ borderRadius: 12 }}
      styles={{ body: { paddingBottom: 20 } }}
    >
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <Flex align="center" gap={8}>
          <BarChartOutlined style={{ fontSize: 18, color: "#1677ff" }} />
          <Title level={4} style={{ margin: 0 }}>
            Podio de la semana
          </Title>
          <Tag color="blue" style={{ marginLeft: 4 }}>
            Últimos 7 días
          </Tag>
        </Flex>

        <Flex gap={16} wrap="wrap" justify="flex-start" className="ranking-podium-cards">
          {(["mostGames", "mostWins", "bestRate"] as const).map((key) => {
            const cat = PODIUM_CATEGORIES[key];
            const entry = podium[key];

            return (
              <Card
                key={key}
                size="small"
                style={{
                  flex: "1 1 260px",
                  minWidth: 220,
                  background: cat.bgColor,
                  border: `1px solid ${cat.borderColor}`,
                  borderRadius: 10,
                }}
              >
                {/* Category header */}
                <Flex align="center" gap={6} style={{ marginBottom: 16 }}>
                  <span style={{ color: cat.color, fontSize: 16 }}>{cat.icon}</span>
                  <Text strong style={{ color: cat.color }}>
                    {cat.label}
                  </Text>
                </Flex>

                <Flex align="flex-end" justify="center" gap={8}>
                  {entry ? (
                    <PodiumColumn
                      entry={entry}
                      rank={0}
                      valueLabel={cat.format(entry.stats[cat.valueKey])}
                      color={cat.color}
                    />
                  ) : (
                    <Text type="secondary" style={{ marginBottom: 16 }}>
                      Nadie jugó esta semana
                    </Text>
                  )}
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </Space>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Ranking() {
  const [sortBy, setSortBy]   = useState<SortByOption>("winRate");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems]   = useState(0);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [podium, setPodium]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const PAGE_SIZE_REQ = 15;
    getRanking(sortBy, currentPage, PAGE_SIZE_REQ)
      .then((data) => {
        const raw = Array.isArray(data.ranking) ? data.ranking : [];
        setEntries(raw);
        if (data.podium) {
          setPodium(data.podium);
        }
        if (data.pagination) {
          setTotalItems(data.pagination.totalItems);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sortBy, currentPage]);

  const handleSortChange = (v: SortByOption) => {
    setSortBy(v);
    setCurrentPage(1); // Reset page on sort change
  };

  const PAGE_SIZE = 15;

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 56,
      align: "center" as const,
      render: (_: any, __: any, index: number) => {
        const globalIndex = (currentPage - 1) * PAGE_SIZE + index;
        return (
          <Text strong style={{ fontSize: globalIndex < 3 ? 18 : 14 }}>
            {globalIndex < 3 ? MEDAL_EMOJI[globalIndex] : globalIndex + 1}
          </Text>
        );
      },
    },
    {
      title: "Jugador",
      key: "username",
      render: (_: any, record: RankingEntry) => (
        <Space>
          <Avatar src={resolveAvatarSrc(record.profilePicture)}>
            {record.username[0].toUpperCase()}
          </Avatar>
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
      title: "% Victoria",
      dataIndex: "winRate",
      key: "winRate",
      align: "center" as const,
      render: (val: number) => (
        <Tooltip title={`${val}% de victorias`}>
          <Progress
            percent={val}
            size="small"
            status="active"
            format={(p) => `${p}%`}
            strokeColor={sortBy === "winRate" ? "#f5222d" : undefined}
          />
        </Tooltip>
      ),
    },
    {
      title: "Victorias",
      dataIndex: "gamesWon",
      key: "gamesWon",
      align: "center" as const,
      render: (val: number) => (
        <Tag color={sortBy === "gamesWon" ? "geekblue" : "default"}>{val}</Tag>
      ),
    },
    {
      title: "Partidas",
      dataIndex: "gamesPlayed",
      key: "gamesPlayed",
      align: "center" as const,
      render: (val: number) => (
        <Tag color={sortBy === "gamesPlayed" ? "purple" : "default"}>{val}</Tag>
      ),
    },
    {
      title: "Movimientos",
      dataIndex: "totalMoves",
      key: "totalMoves",
      align: "center" as const,
      responsive: ["md"] as any,
      render: (val: number) => (
        <Tooltip title="Total de movimientos realizados">
          <Tag color={sortBy === "totalMoves" ? "cyan" : "default"}>{val}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "Derrotas",
      dataIndex: "gamesLost",
      key: "gamesLost",
      align: "center" as const,
      responsive: ["md"] as any,
      render: (val: number) => (
        <Tag color={sortBy === "gamesLost" ? "volcano" : "default"}>{val}</Tag>
      ),
    },
    {
      title: "Abandonos",
      dataIndex: "gamesAbandoned",
      key: "gamesAbandoned",
      align: "center" as const,
      responsive: ["lg"] as any,
      render: (val: number) => (
        <Tag color={sortBy === "gamesAbandoned" ? "magenta" : "default"}>{val}</Tag>
      ),
    },
  ];

  return (
    <Flex justify="center" align="start" className="ranking-page" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1100px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>

          <AppHeader title="🏆 Ranking" />

          {/* Podium — always visible when we have data */}
          {podium && (
            <PodiumSection podium={podium} />
          )}

          {/* Ranking table */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>

              {/* Header: title + sort control */}
              <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                <Title level={3} style={{ margin: 0 }}>
                  Clasificación global
                </Title>

                {/* Segmented on desktop */}
                <div className="ranking-segmented-desktop">
                  <Segmented
                    aria-label="sort-ranking"
                    value={sortBy}
                    onChange={(v) => handleSortChange(v as SortByOption)}
                    options={SORT_OPTIONS.map((o) => ({
                      value: o.value,
                      icon: o.icon,
                      label: o.label,
                    }))}
                  />
                </div>

                {/* Select on mobile */}
                <div className="ranking-select-mobile">
                  <Select
                    value={sortBy}
                    onChange={(v) => handleSortChange(v as SortByOption)}
                    style={{ width: 200 }}
                    options={SORT_OPTIONS.map((o) => ({
                      value: o.value,
                      label: (
                        <Space>{o.icon} {o.label}</Space>
                      ),
                    }))}
                  />
                </div>
              </Flex>

              {/* Active sort label */}
              <Flex align="center" gap={6}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Ordenando por:
                </Text>
                {SORT_OPTIONS.filter((o) => o.value === sortBy).map((o) => (
                  <Tag key={o.value} icon={o.icon} color="blue">
                    {o.label}
                  </Tag>
                ))}
              </Flex>

              {error && (
                <Alert
                  type="error"
                  message="No se pudo cargar el ranking"
                  description={error}
                />
              )}

              <div className="ranking-table-wrapper">
                <Table
                  dataSource={entries}
                  columns={columns}
                  rowKey="username"
                  scroll={{ x: 700 }}
                  pagination={{
                    current: currentPage,
                    pageSize: PAGE_SIZE,
                    total: totalItems,
                    showSizeChanger: false,
                    onChange: (p) => setCurrentPage(p),
                    responsive: true,
                  }}
                  loading={loading}
                  locale={{
                    emptyText: "Todavía no hay jugadores con partidas registradas.",
                  }}
                  rowClassName={(_, index) => {
                    const globalIndex = (currentPage - 1) * PAGE_SIZE + index;
                    return globalIndex < 3 ? "ranking-top3-row" : "";
                  }}
                />
              </div>

              <Flex justify="center">
                <Text type="secondary" style={{ fontSize: 13, textAlign: "center" }}>
                  <strong>% Victoria</strong> — partidas ganadas / total jugadas. ·{" "}
                  <strong>Movimientos</strong> — total de movimientos en todas las partidas. ·{" "}
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