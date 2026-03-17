import { Button, Card, Dropdown, Flex, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  BarChartOutlined,
  HomeOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  TrophyOutlined // 1. Importamos el icono del trofeo
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App } from "antd";

const { Title } = Typography;

type AppHeaderProps = {
  title: string;
};

export default function AppHeader({ title }: AppHeaderProps) {
  const { modal } = App.useApp();
  const navigate = useNavigate();

  function handleLogout() {
    modal.confirm({
      title: "Cerrar sesión",
      content: "¿Seguro que quieres cerrar sesión y salir?",
      okText: "Sí, salir",
      cancelText: "Cancelar",
      onOk: () => navigate("/", { replace: true }),
    });
  }

  function handleProfileMenuClick(key: string) {
    switch (key) {
      case "profile":
        //navigate("/profile");
        break;
      case "stats":
        //navigate("/stats");
        break;
      case "ranking":       // 2. Añadimos el caso para navegar al ranking
        navigate("/ranking");
        break;
      case "home":
        navigate("/home");
        break;
      case "help":
        //navigate("/help");
        break;
      case "logout":
        handleLogout();
        break;
      default:
        break;
    }
  }

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Ver Perfil",
    },
    {
      key: "stats",
      icon: <BarChartOutlined />,
      label: "Ver Estadísticas",
    },
    {
      key: "ranking",       // 3. Añadimos el botón visual al menú
      icon: <TrophyOutlined />,
      label: "Ranking Global",
    },
    {
      type: "divider",      // (Opcional) Una pequeña línea para separar el menú principal
    },
    {
      key: "home",
      icon: <HomeOutlined />,
      label: "Volver a Home",
    },
    {
      key: "help",
      icon: <QuestionCircleOutlined />,
      label: "Ayuda",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Cerrar Sesión",
      danger: true,
    },
  ];

  return (
    <Card>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>

        <Space>
          <Dropdown
            menu={{
              items: profileMenuItems,
              onClick: ({ key }) => handleProfileMenuClick(key),
            }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button shape="circle" icon={<UserOutlined />} />
          </Dropdown>
        </Space>
      </Flex>
    </Card>
  );
}