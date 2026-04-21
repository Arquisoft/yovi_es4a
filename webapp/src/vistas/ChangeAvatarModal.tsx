import { useEffect, useState } from "react";
import { Alert, Button, Flex, Modal, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { AVATARS } from "../utils/Validation";

const { Text } = Typography;

type Props = {
  open: boolean;
  currentAvatar: string;
  onClose: () => void;
  onConfirm: (newAvatar: string) => Promise<void>;
};

export default function ChangeAvatarModal({
  open,
  currentAvatar,
  onClose,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState(currentAvatar);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(currentAvatar);
      setError("");
      setLoading(false);
    }
  }, [open, currentAvatar]);

  async function handleConfirm() {
    if (selected === currentAvatar) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await onConfirm(selected);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar el avatar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Flex align="center" gap={8}>
          <UserOutlined />
          <span>Cambiar avatar</span>
        </Flex>
      }
      footer={null}
      destroyOnClose
      width={420}
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        {error && <Alert message={error} type="error" showIcon />}

        <Text type="secondary" style={{ fontSize: 13 }}>
          Selecciona tu nuevo avatar:
        </Text>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {AVATARS.map((avatar) => {
            const isSelected = selected === avatar.id;
            return (
              <Flex
                key={avatar.id}
                align="center"
                justify="center"
                onClick={() => setSelected(avatar.id)}
                style={{
                  cursor: "pointer",
                  padding: 12,
                  borderRadius: 12,
                  border: isSelected
                    ? "2px solid #28BBF5"
                    : "2px solid transparent",
                  background: isSelected ? "#e6f7ff" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <img
                  src={avatar.src}
                  alt={avatar.label}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    objectFit: "cover",
                    boxShadow: isSelected
                      ? "0 0 0 3px #28BBF5"
                      : "0 2px 8px rgba(0,0,0,0.12)",
                    transition: "box-shadow 0.2s",
                  }}
                />
              </Flex>
            );
          })}
        </div>

        <Flex justify="flex-end" gap={8} style={{ marginTop: 4 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={handleConfirm}
          >
            Aceptar
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}