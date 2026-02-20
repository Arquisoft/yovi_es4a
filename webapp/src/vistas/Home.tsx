import { useState } from "react";
import { Button, Card, Divider, Flex, InputNumber, Select, Space, Typography } from "antd";
import { LogoutOutlined, PlayCircleOutlined, RobotOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App } from "antd";

const { Title, Text } = Typography;

export default function Home() {
  const { modal } = App.useApp();

  const navigate = useNavigate();

  const [size, setSize] = useState(7);
  const [botId, setBotId] = useState("random_bot");

  function handlePlay() {
    const params = new URLSearchParams({
      size: String(size),
      bot: botId,
    });
    navigate(`/game?${params.toString()}`);
  }

  function handleLogout() {
    modal.confirm({
      title: "Cerrar sesión",
      content: "¿Seguro que quieres volver a la pantalla de bienvenida?",
      okText: "Sí, salir",
      cancelText: "Cancelar",
      onOk: () => navigate("/", { replace: true }),
    });
  }

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(1000px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>

          {/* Barra Menú */}
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space>
                <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </Space>

              <Title level={2} style={{ margin: 0 }}>YOVI</Title>

              <Space>
                <Button icon={<UserOutlined />}>
                  Ver perfil
                </Button>
              </Space>
            </Flex>
          </Card>

          {/* Juego */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={3} style={{ margin: 0 }}>Juego Y</Title>
              </Flex>

              <Divider>Human vs Bot</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <div>
                  <Text type="secondary">Tamaño:</Text>
                  <div>
                    <InputNumber
                      min={2}
                      value={size}
                      onChange={(v) => setSize(typeof v === "number" ? v : 7)}
                      style={{ width: 140 }}
                    />
                  </div>
                </div>

                <div>
                  <Text type="secondary"><RobotOutlined /> Bot:</Text>
                  <div>
                    <Select
                      value={botId}
                      onChange={setBotId}
                      style={{ width: 240 }}
                      options={[
                        { value: "random_bot", label: "Random bot" },
                        { value: "mcts_bot", label: "MCTS bot" },
                      ]}
                    />
                  </div>
                </div>

                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlay}>
                  Jugar
                </Button>
              </Flex>

              <Divider>Human vs Human</Divider>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Text type="secondary">Sin implementar todavía</Text>
              </Flex>
            </Space>
          </Card>

          {/* Estadísticas */}
          <Card>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Title level={3} style={{ margin: 0 }}>Estadísticas</Title>
              </Flex>

              <Flex justify="center" gap={16} wrap="wrap" align="end">
                <Text type="secondary">Sin implementar todavía</Text>
              </Flex>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}