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
import { getUserSession } from "../utils/session";
import { resolveAvatarSrc } from "../utils/avatar";
import { getUserProfile, getUserStats } from "../api/users";
import ChangePasswordModal from "./ChangePasswordModal";

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
  // TEMPORAL - quitar cuando haya BD
  const [session, setSession] = useState({
  username: "testuser",
  profilePicture: "seniora.png",
  password: "1234",
});
  // const session = getUserSession(); // ← restaurar después

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
  } | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!open || !session) return;

    setLoading(true);
    setProfile(null);
    setStats(null);

    // TEMPORAL - quitar cuando haya BD
    const profilePromise = Promise.resolve({
      username: "testuser",
      email: "test@example.com",
      profilePicture: "seniora.png",
    });
    const statsPromise = Promise.resolve({
      stats: { gamesPlayed: 10, gamesWon: 6, winRate: 60 },
    });
    // FIN TEMPORAL

    // ─── Restaurar cuando haya BD ────────────────────────────────────────────
    // const profilePromise = getUserProfile(session.username).catch(() => ({
    //   username: session.username,
    //   email: "—",
    //   profilePicture: session.profilePicture,
    // }));
    // const statsPromise = getUserStats(session.username).catch(() => null);
    // ─────────────────────────────────────────────────────────────────────────

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
            {/* Avatar y nombre */}
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

            {/* Datos de cuenta */}
            <Flex vertical gap={14}>
              {/* Usuario */}
              <Flex align="center" gap={12}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#f0f7ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <UserOutlined style={{ color: "#28BBF5", fontSize: 16 }} />
                </div>
                <Flex vertical gap={0} style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Nombre de usuario
                  </Text>
                  <Text strong>{profile?.username ?? session.username}</Text>
                </Flex>
              </Flex>

              {/* Correo */}
              <Flex align="center" gap={12}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#fff7e6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MailOutlined style={{ color: "#FF7B00", fontSize: 16 }} />
                </div>
                <Flex vertical gap={0} style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Correo electrónico
                  </Text>
                  <Text strong>{profile?.email ?? "—"}</Text>
                </Flex>
              </Flex>

              {/* Contraseña */}
              <Flex align="center" gap={12}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#f9f0ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <LockOutlined style={{ color: "#722ed1", fontSize: 16 }} />
                </div>
                <Flex vertical gap={0} style={{ flex: 1 }}>
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
                  <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>
                    Por seguridad, la contraseña no se muestra en texto plano.
                  </Text>
                </Flex>
              </Flex>
            </Flex>

            {/* Estadísticas */}
            {stats && (
              <>
                <Divider style={{ margin: "0" }} />
                <Flex justify="space-around" align="center">
                  <Flex vertical align="center" gap={2}>
                    <Text strong style={{ fontSize: 20, color: "#28BBF5" }}>
                      {stats.gamesPlayed}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Partidas
                    </Text>
                  </Flex>
                  <Flex vertical align="center" gap={2}>
                    <Text strong style={{ fontSize: 20, color: "#2FBF7C" }}>
                      {stats.gamesWon}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Victorias
                    </Text>
                  </Flex>
                  <Flex vertical align="center" gap={2}>
                    <Text strong style={{ fontSize: 20, color: "#FF7B00" }}>
                      {stats.winRate}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      % Victoria
                    </Text>
                  </Flex>
                </Flex>
              </>
            )}

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

      {/* Modal cambiar contraseña */}
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

          console.log("Contraseña actualizada a:", newPassword);
        }}
      />
    </>
  );
}