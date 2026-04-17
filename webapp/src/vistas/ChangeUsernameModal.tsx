import { useEffect, useState } from "react";
import { Alert, Button, Flex, Input, Modal, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { validateUsername } from "../utils/Validation";

const { Text } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (newUsername: string) => Promise<void>;
};

export default function ChangeUsernameModal({ open, onClose, onConfirm }: Props) {
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewUsername("");
      setError("");
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (error) setError("");
  }, [newUsername]);

  const validationError = validateUsername(newUsername);
  const isFormValid = newUsername.trim().length > 0 && !validationError;

  async function handleConfirm() {
    const err = validateUsername(newUsername);
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(newUsername.trim());
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar el nombre de usuario.");
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
          <span>Cambiar nombre de usuario</span>
        </Flex>
      }
      footer={null}
      destroyOnClose
      width={420}
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        {error && <Alert message={error} type="error" showIcon />}

        <Flex vertical gap={4}>
          <Text strong style={{ fontSize: 13 }}>
            Nuevo nombre de usuario
          </Text>
          <Input
            prefix={<UserOutlined />}
            placeholder="Introduce el nuevo nombre de usuario"
            size="large"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onPressEnter={isFormValid ? handleConfirm : undefined}
            maxLength={20}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Entre 3 y 20 caracteres. Solo letras, números, puntos y guiones.
          </Text>
        </Flex>

        <Flex justify="flex-end" gap={8} style={{ marginTop: 4 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={handleConfirm}
            disabled={!isFormValid}
          >
            Cambiar nombre
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}