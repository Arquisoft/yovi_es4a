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
      </div>
    </Card>
  );
}