import { useEffect } from "react";
import { Button, Space, Typography, Tabs, Card, Grid, Flex } from "antd";
import { useNavigate } from "react-router-dom";
import yoviLogo from "../assets/yovi-logo.svg";
import LoginForm from "./registroLogin/LoginForm";
import RegisterForm from "./registroLogin/RegisterForm";
import { clearUserSession } from "../utils/session";

const { Title } = Typography;
const { useBreakpoint } = Grid;

export default function Bienvenida() {
  const navigate = useNavigate();
  const screens = useBreakpoint();

  useEffect(() => {
    clearUserSession();
  }, []);

  function handleContinueAsGuest() {
    clearUserSession();
    navigate("/home", { replace: true });
  }

  return (
    <div className="App home">
      {/* Aplicamos la estructura flex y anchos calcados de la vista Home */}
      <Flex
        justify="center"
        align="center"
        style={{ padding: 20, minHeight: "100vh", minWidth: "200vw" }}
      >
        <div style={{ width: "min(1000px, 100%)" }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card styles={{ body: { padding: 0 } }} bordered={true}>
              <Flex
                vertical={!screens.md} // Si es menor a 'md' (móvil), se apila verticalmente
                align="stretch"
              >
                {/* LADO IZQUIERDO: Contenido original de Bienvenida */}
                <Flex
                  vertical
                  justify="center"
                  align="center"
                  style={{
                    flex: 1,
                    padding: "60px 40px",
                    // Línea separadora adaptativa
                    borderRight: screens.md ? "1px solid #f0f0f0" : "none",
                    borderBottom: !screens.md ? "1px solid #f0f0f0" : "none",
                  }}
                >
                  <Space direction="vertical" size="large" align="center">
                    <a
                      href="https://github.com/Arquisoft/yovi_es4a"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={yoviLogo}
                        className="logo yovi"
                        alt="Yovi logo"
                        style={{ width: "100%", maxWidth: "280px" }}
                      />
                    </a>

                    <Title level={2} style={{ margin: 0, textAlign: "center" }}>
                      Bienvenido a YOVI
                    </Title>
                  </Space>
                </Flex>

                {/* LADO DERECHO: Pestañas de Login y Registro */}
                <Flex
                  vertical
                  style={{
                    flex: 2,
                    padding: "50px 40px",
                  }}
                >
                  <Tabs
                    defaultActiveKey="1"
                    centered
                    size="large"
                    items={[
                      {
                        key: "1",
                        label: "Iniciar Sesión",
                        children: (
                          <div style={{ marginTop: "20px" }}>
                            <LoginForm />
                          </div>
                        ),
                      },
                      {
                        key: "2",
                        label: "Registrarse",
                        children: (
                          <div style={{ marginTop: "20px" }}>
                            <RegisterForm />
                          </div>
                        ),
                      },
                    ]}
                  />
                </Flex>
              </Flex>
            </Card>

            {/* LINK DE CONTINUAR: Fuera del recuadro central y centrado */}
            <Flex justify="center">
              <Button
                color="default"
                variant="link"
                onClick={handleContinueAsGuest}
              >
                <u>Continuar sin cuenta</u>
              </Button>
            </Flex>
          </Space>
        </div>
      </Flex>
    </div>
  );
}
