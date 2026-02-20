import { Button, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import yoviLogo from "../assets/yovi-logo.svg";

const { Title } = Typography;

export default function Bienvenida() {
  const navigate = useNavigate();

  return (
    <div className="App home">
      <Space direction="vertical" size="large" align="center">
        <a href="https://github.com/Arquisoft/yovi_es4a" target="_blank" rel="noreferrer">
          <img src={yoviLogo} className="logo yovi" alt="Yovi logo" />
        </a>

        <Title level={2} style={{ margin: 0 }}>
          Bienvenido a YOVI
        </Title>

        <Button type="primary" size="large" style={{ width: 180 }} disabled>
          Iniciar sesión
        </Button>

        <Button type="primary" size="large" style={{ width: 180 }} disabled>
          Registrarse
        </Button>

        <Button
          type="text"
          size="large"
          style={{ width: 200 }}
          onClick={() => navigate("/home")}
        >
          Continuar sin cuenta
        </Button>
      </Space>
    </div>
  );
}