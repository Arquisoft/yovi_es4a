import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  Flex,
  Modal,
  Skeleton,
  Space,
  Typography,
} from "antd";
import {
  LogoutOutlined,
  MailOutlined,
  UserOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { resolveAvatarSrc } from "../utils/avatar";
import ChangePasswordModal from "./ChangePasswordModal";
import ChangeEmailModal from "./ChangeEmailModal";

const { Text, Title } = Typography;

type UserProfile = {
  username: string;
  email: string;
  profilePicture?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export default function ProfileModal({ open, onClose, onLogout }: Props) {
  // TEMPORAL
  const [session, setSession] = useState({
    username: "testuser",
    profilePicture: "seniora.png",
    password: "1234",
  });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
  } | null>(null);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false); // ← añadido

  useEffect(() => {
    if (!open || !session) return;

    setLoading(true);
    setProfile(null);
    setStats(null);

    const profilePromise = Promise.resolve({
      username: "testuser",
      email: "test@example.com",
      profilePicture: "seniora.png",
    });

    const statsPromise = Promise.resolve({
      stats: { gamesPlayed: 10, gamesWon: 6, winRate: 60 },
    });

    Promise.all([profilePromise, statsPromise]).then(([prof, st]) => {
      setProfile(prof);
      if (st) {
        setStats({
          gamesPlayed: st.stats.gamesPlayed,
          gamesWon: st.stats.gamesWon,
          winRate: st.stats.winRate,
        });
      }
      setLoading(false);
    });
  }, [open, session?.username]);

  if (!session) return null;

  const avatarSrc = profile?.profilePicture
    ? resolveAvatarSrc(profile.profilePicture)
    : resolveAvatarSrc(session.profilePicture);

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={420}
        title={
          <Flex align="center" gap={8}>
            <UserOutlined />
            <span>Mi Perfil</span>
          </Flex>
        }
        destroyOnClose
      >
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : (
          <Flex vertical gap={20}>
            {/* Avatar */}
            <Flex vertical align="center" gap={12} style={{ paddingTop: 8 }}>
              <Avatar
                size={88}
                src={avatarSrc}
                icon={<UserOutlined />}
                style={{
                  border: "3px solid #28BBF5",
                  boxShadow: "0 4px 16px rgba(40,187,245,0.25)",
                }}
              />
              <Title level={4} style={{ margin: 0 }}>
                {profile?.username ?? session.username}
              </Title>
            </Flex>

            <Divider style={{ margin: "0" }} />

            {/* Datos */}
            <Flex vertical gap={14}>
              {/* Usuario */}
              <Flex align="center" gap={12}>
                <div style={box("#f0f7ff")}>
                  <UserOutlined style={{ color: "#28BBF5" }} />
                </div>
                <Flex vertical>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Nombre de usuario
                  </Text>
                  <Text strong>{profile?.username ?? session.username}</Text>
                </Flex>
              </Flex>

              {/* Email */}
              <Flex align="center" gap={12}>
                <div style={box("#fff7e6")}>
                  <MailOutlined style={{ color: "#FF7B00" }} />
                </div>
                <Flex vertical style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Correo electrónico
                  </Text>
                  <Flex align="center" gap={8}>
                    <Text strong>{profile?.email ?? "—"}</Text>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, fontSize: 12 }}
                      onClick={() => setChangeEmailOpen(true)}
                    >
                      Cambiar
                    </Button>
                  </Flex>
                </Flex>
              </Flex>

              {/* Password */}
              <Flex align="center" gap={12}>
                <div style={box("#f9f0ff")}>
                  <LockOutlined style={{ color: "#722ed1" }} />
                </div>
                <Flex vertical style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Contraseña
                  </Text>
                  <Flex align="center" gap={8}>
                    <Text strong style={{ letterSpacing: 3 }}>
                      ••••••••
                    </Text>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, fontSize: 12 }}
                      onClick={() => setChangePasswordOpen(true)}
                    >
                      Cambiar
                    </Button>
                  </Flex>
                </Flex>
              </Flex>
            </Flex>

            <Divider style={{ margin: "0" }} />

            {/* Botones */}
            <Space style={{ justifyContent: "flex-end" }}>
              <Button onClick={onClose}>Volver</Button>
              <Button danger icon={<LogoutOutlined />} onClick={onLogout}>
                Cerrar sesión
              </Button>
            </Space>
          </Flex>
        )}
      </Modal>

      {/* Password modal */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onConfirm={async (oldPassword, newPassword) => {
          if (oldPassword !== session.password) {
            throw new Error("La contraseña actual es incorrecta.");
          }

          setSession((prev) => ({
            ...prev,
            password: newPassword,
          }));
        }}
      />

      {/* Email modal */}
      <ChangeEmailModal
        open={changeEmailOpen}
        currentEmail={profile?.email ?? ""}
        onClose={() => setChangeEmailOpen(false)}
        onConfirm={async (newEmail) => {
          setProfile((prev) =>
            prev ? { ...prev, email: newEmail } : prev
          );
        }}
      />
    </>
  );
}

// helper para estilos repetidos
function box(bg: string) {
  return {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}