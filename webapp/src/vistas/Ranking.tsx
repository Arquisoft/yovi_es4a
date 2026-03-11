import { useEffect, useState } from "react";
import { Select, Typography, Spin, Alert, Avatar, Tag, Tooltip } from "antd";
import { TrophyOutlined, RiseOutlined, PlayCircleOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const USERS_URL = (typeof process !== "undefined" && process.env?.REACT_APP_USERS_URL) || "http://localhost:3000";

type SortBy = "winRate" | "gamesWon" | "gamesPlayed";

type RankingEntry = {
  username: string;
  profilePicture: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalMoves: number;
  winRate: number;
};

const SORT_OPTIONS = [
  { value: "winRate",     label: "% Partidas ganadas", icon: <TrophyOutlined /> },
  { value: "gamesWon",    label: "Partidas ganadas",    icon: <RiseOutlined /> },
  { value: "gamesPlayed", label: "Partidas jugadas",    icon: <PlayCircleOutlined /> },
];

const MEDAL = ["🥇", "🥈", "🥉"];

function MetricBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ position: "relative", height: 6, background: "#2a2a3a", borderRadius: 3, overflow: "hidden", minWidth: 80 }}>
      <div style={{ position: "absolute", inset: 0, width: `${value}%`, background: color, borderRadius: 3, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

export default function Ranking() {
  const navigate = useNavigate();
  const [sortBy, setSortBy]   = useState<SortBy>("winRate");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${USERS_URL}/ranking?sortBy=${sortBy}&limit=20`)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then(data => setEntries(data.ranking ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [sortBy]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d0d1a 0%, #111128 50%, #0a0a18 100%)", padding: "0 0 48px", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #1a1a2e 0%, transparent 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 32px 20px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => navigate("/home")}
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#aaa", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, transition: "all .2s" }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "#5c6bc0")}
          onMouseOut={e  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
        >
          <ArrowLeftOutlined /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 700 }}>🏆 Ranking de Jugadores</Title>
          <Text style={{ color: "#888", fontSize: 13 }}>Top jugadores ordenados por métricas de rendimiento</Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text style={{ color: "#888", fontSize: 13, whiteSpace: "nowrap" }}>Ordenar por:</Text>
          <Select
            value={sortBy}
            onChange={v => setSortBy(v as SortBy)}
            style={{ width: 210 }}
            options={SORT_OPTIONS.map(o => ({ value: o.value, label: <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{o.icon} {o.label}</span> }))}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "32px auto 0", padding: "0 24px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 80 }}>
            <Spin size="large" />
            <div style={{ color: "#888", marginTop: 16 }}>Cargando ranking…</div>
          </div>
        )}

        {error && <Alert type="error" message="No se pudo cargar el ranking" description={error} style={{ marginBottom: 24 }} />}

        {!loading && !error && entries.length === 0 && (
          <div style={{ textAlign: "center", color: "#888", padding: 80 }}>
            <TrophyOutlined style={{ fontSize: 48, marginBottom: 16, display: "block" }} />
            Todavía no hay jugadores con partidas registradas.
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 110px 90px 90px 90px", gap: 12, padding: "4px 16px", color: "#666", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <span>#</span>
              <span>Jugador</span>
              <span style={{ textAlign: "center" }}>% Victoria</span>
              <span style={{ textAlign: "center" }}>Victorias</span>
              <span style={{ textAlign: "center" }}>Partidas</span>
              <span style={{ textAlign: "center" }}>Movimientos</span>
            </div>

            {entries.map((entry, i) => (
              <div
                key={entry.username}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 110px 90px 90px 90px",
                  gap: 12,
                  alignItems: "center",
                  background: i < 3 ? "linear-gradient(90deg, rgba(92,107,192,0.12) 0%, rgba(0,0,0,0) 100%)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${i === 0 ? "rgba(255,215,0,0.25)" : i === 1 ? "rgba(192,192,192,0.18)" : i === 2 ? "rgba(205,127,50,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; }}
                onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
              >
                {/* Rank */}
                <div style={{ textAlign: "center", fontSize: i < 3 ? 22 : 14, color: "#888", fontWeight: 700 }}>{i < 3 ? MEDAL[i] : `${i + 1}`}</div>

                {/* Player */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Avatar src={entry.profilePicture} size={38} style={{ border: "2px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>{entry.username[0].toUpperCase()}</Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.username}</div>
                    <div style={{ color: "#666", fontSize: 12 }}>{entry.gamesWon}V · {entry.gamesLost}D</div>
                  </div>
                </div>

                {/* Win rate */}
                <Tooltip title={`${entry.winRate}% de victorias`}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: sortBy === "winRate" ? "#7986cb" : "#ccc", fontWeight: sortBy === "winRate" ? 700 : 400, fontSize: 15 }}>{entry.winRate}%</div>
                    <MetricBar value={entry.winRate} color="#5c6bc0" />
                  </div>
                </Tooltip>

                {/* Games won */}
                <div style={{ textAlign: "center" }}>
                  <Tag
                    color={sortBy === "gamesWon" ? "geekblue" : undefined}
                    style={{ background: sortBy === "gamesWon" ? undefined : "rgba(255,255,255,0.06)", border: "none", color: sortBy === "gamesWon" ? undefined : "#aaa", fontWeight: sortBy === "gamesWon" ? 700 : 400 }}
                  >
                    {entry.gamesWon}
                  </Tag>
                </div>

                {/* Games played */}
                <div style={{ textAlign: "center" }}>
                  <Tag
                    color={sortBy === "gamesPlayed" ? "purple" : undefined}
                    style={{ background: sortBy === "gamesPlayed" ? undefined : "rgba(255,255,255,0.06)", border: "none", color: sortBy === "gamesPlayed" ? undefined : "#aaa", fontWeight: sortBy === "gamesPlayed" ? 700 : 400 }}
                  >
                    {entry.gamesPlayed}
                  </Tag>
                </div>

                {/* Total moves (from wins only) */}
                <Tooltip title="Movimientos realizados en partidas ganadas">
                  <div style={{ textAlign: "center", color: "#888", fontSize: 14 }}>{entry.totalMoves}</div>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div style={{ marginTop: 32, padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#666", fontSize: 12 }}>
              <strong style={{ color: "#888" }}>% Victoria</strong> — partidas ganadas / total jugadas.{" "}
              <strong style={{ color: "#888" }}>Movimientos</strong> — total de movimientos realizados únicamente en partidas ganadas.
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}