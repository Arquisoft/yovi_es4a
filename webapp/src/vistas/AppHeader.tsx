import { Avatar, Button, Card, Dropdown, Flex, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  HomeOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  TrophyOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App } from "antd";
import { clearUserSession, getUserSession } from "../utils/session";
import { resolveAvatarSrc } from "../utils/avatar";
import { useState } from "react";
import HelpModal from "./HelpModal";
import ProfileModal from "./ProfileModal";


const { Title, Text } = Typography;

type AppHeaderProps = {
  title: string;
};

export default function AppHeader({ title }: AppHeaderProps) {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const session = getUserSession();
  const [profileOpen, setProfileOpen] = useState(false);

  function handleLogout() {
    modal.confirm({
      title: "Cerrar sesión",
      content: "¿Seguro que quieres cerrar sesión y salir?",
      okText: "Sí, salir",
      cancelText: "Cancelar",
      onOk: () => {
        clearUserSession();
        navigate("/", { replace: true });
      },
    });
  }

  function handleHelp() {
    modal.info({
      title: "Ayuda — Juego Y",
      content: <HelpModal />,
      okText: "Cerrar",
      width: 640,
      icon: <QuestionCircleOutlined />,
    });
  }
/*
  function handleProfile() {
    if (!session) {
      navigate("/", { replace: true });
      return;
    }
    setProfileOpen(true);
  }
*/

  function handleProfileMenuClick(key: string) {
    switch (key) {
      case "profile":
        setProfileOpen(true);
        break;
      case "history":
        navigate("/historial");
        break;
      case "ranking":
        navigate("/ranking");
        break;
      case "home":
        navigate("/home");
        break;
      case "help":
        handleHelp();
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
      // disabled: !session,  // ← comentar temporalmente
    },
    {
      key: "history",
      icon: <HistoryOutlined />,
      label: "Mi Historial",
      disabled: !session,
    },
    {
      key: "ranking",
      icon: <TrophyOutlined />,
      label: "Ranking Global",
    },
    {
      type: "divider",
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
    <>
      <Card>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Title level={2} style={{ margin: 0 }}>
            {title}
          </Title>
 
          <Space size={12}>
            {session ? (
              <Space size={8}>
                <Text strong>{session.username}</Text>
              </Space>
            ) : (
              <Text type="secondary">Invitado</Text>
            )}
 
            <Dropdown
              menu={{
                items: profileMenuItems,
                onClick: ({ key }) => handleProfileMenuClick(key),
              }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                shape="circle"
                style={{ padding: 0, width: 40, height: 40 }}
                icon={
                  session ? (
                    <Avatar
                      size={32}
                      src={resolveAvatarSrc(session?.profilePicture)}
                      icon={<UserOutlined />}
                    />
                  ) : (
                    <Avatar
                      size={32}
                      icon={<UserOutlined />}
                    />
                  )
                }
              />
            </Dropdown>
          </Space>
        </Flex>
      </Card>
 
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={() => {
          setProfileOpen(false);
          handleLogout();
        }}
      />
    </>
  );
}