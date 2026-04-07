import { Card, Col, Row, Statistic } from "antd";
import type { UserStats } from "../api/users";

type UserStatsSummaryProps = {
  stats: UserStats;
  title?: string;
};

export default function UserStatsSummary({
  stats,
  title = "Estadísticas",
}: UserStatsSummaryProps) {
  const total = stats.gamesWon + stats.gamesLost + stats.gamesAbandoned;

  const wonPct = total > 0 ? (stats.gamesWon / total) * 100 : 0;
  const lostPct = total > 0 ? (stats.gamesLost / total) * 100 : 0;
  const abandonedPct = total > 0 ? (stats.gamesAbandoned / total) * 100 : 0;

  const wonDeg = (wonPct / 100) * 360;
  const lostDeg = (lostPct / 100) * 360;
  const abandonedDeg = (abandonedPct / 100) * 360;

  return (
    <Card>
      <div style={{ width: "100%" }}>
        <h2 style={{ margin: "0 0 20px 0", textAlign: "center" }}>{title}</h2>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Partidas Ganadas"
                value={stats.gamesWon}
                valueStyle={{ color: "#389e0d" }}
              />
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Partidas Perdidas"
                value={stats.gamesLost}
                valueStyle={{ color: "#cf1322" }}
              />
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Partidas Abandonadas"
                value={stats.gamesAbandoned}
                valueStyle={{ color: "#595959" }}
              />
            </Card>
          </Col>
        </Row>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 32,
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              background:
                total > 0
                  ? `conic-gradient(
                      #389e0d 0deg ${wonDeg}deg,
                      #cf1322 ${wonDeg}deg ${wonDeg + lostDeg}deg,
                      #595959 ${wonDeg + lostDeg}deg ${wonDeg + lostDeg + abandonedDeg}deg
                    )`
                  : "#f0f0f0",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 18,
              }}
            >
            </div>
          </div>

        </div>
      </div>
    </Card>
  );
}