import { Card, Col, Row, Statistic } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  FireOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import type { UserStats } from "../api/users";

type UserStatsSummaryProps = {
  stats: UserStats;
  title?: string;
};

export default function UserStatsSummary({
  stats,
  title = "Estadísticas",
}: UserStatsSummaryProps) {
  const total = stats.gamesWon + stats.gamesLost + stats.gamesDrawn + stats.gamesAbandoned;

  const wonPct = total > 0 ? (stats.gamesWon / total) * 100 : 0;
  const lostPct = total > 0 ? (stats.gamesLost / total) * 100 : 0;
  const drawPct = total > 0 ? (stats.gamesDrawn / total) * 100 : 0;
  const abandonedPct = total > 0 ? (stats.gamesAbandoned / total) * 100 : 0;

  const wonDeg = (wonPct / 100) * 360;
  const lostDeg = (lostPct / 100) * 360;
  const drawDeg = (drawPct / 100) * 360;
  const abandonedDeg = (abandonedPct / 100) * 360;

  return (
    <Card>
      <div style={{ width: "100%" }}>
        <h2 style={{ margin: "0 0 20px 0", textAlign: "center" }}>{title}</h2>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    prefix={<CheckCircleOutlined />}
                    title="Partidas Ganadas"
                    value={stats.gamesWon}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    prefix={<CloseCircleOutlined />}
                    title="Partidas Perdidas"
                    value={stats.gamesLost}
                    valueStyle={{ color: "#cf1322" }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    prefix={<StopOutlined />}
                    title="Partidas Abandonadas"
                    value={stats.gamesAbandoned}
                    valueStyle={{ color: "#595959" }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    prefix={<MinusCircleOutlined />}
                    title="Partidas Empatadas"
                    value={stats.gamesDrawn}
                    valueStyle={{ color: "#bfbfbf" }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          <Col xs={24} xl={10}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                height: "100%",
                justifyContent: "center",
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
                          #52c41a 0deg ${wonDeg}deg,
                          #cf1322 ${wonDeg}deg ${wonDeg + lostDeg}deg,
                          #595959 ${wonDeg + lostDeg}deg ${wonDeg + lostDeg + abandonedDeg}deg,
                          #d9d9d9 ${wonDeg + lostDeg + abandonedDeg}deg ${wonDeg + lostDeg + abandonedDeg + drawDeg}deg
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
                    color: "#595959",
                  }}
                >
                  {total}
                </div>
              </div>

              <Card style={{ width: "100%", maxWidth: 360 }}>
                <Statistic
                  prefix={<FireOutlined />}
                  title="Racha de Partidas Ganadas"
                  value={stats.currentWinStreak}
                  valueStyle={{ color: "#FF7B00" }}
                />
              </Card>
            </div>
          </Col>
        </Row>
      </div>
    </Card>
  );
}