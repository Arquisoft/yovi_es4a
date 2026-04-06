import { useEffect, useState } from "react";
import { Alert, Button, Flex, Input, Modal, Typography } from "antd";
import {
  MailOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

type Props = {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
  onConfirm: (newEmail: string) => Promise<void>;
};

export default function ChangeEmailModal({
  open,
  currentEmail,
  onClose,
  onConfirm,
}: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Reset
  useEffect(() => {
    if (!open) {
      setNewEmail("");
      setConfirmEmail("");
      setError("");
      setLoading(false);
      setDone(false);
    }
  }, [open]);

  // Validación simple
  const isValid =
    newEmail &&
    confirmEmail &&
    newEmail === confirmEmail &&
    newEmail !== currentEmail &&
    // NOSONAR: esta regex es lineal y no vulnerable a backtracking
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);

  async function handleConfirm() {
    setError("");

    const email = newEmail.trim().toLowerCase();
    const confirm = confirmEmail.trim().toLowerCase();

    if (!email) {
      setError("Debes introducir un correo.");
      return;
    }
    // NOSONAR: esta regex es lineal y no vulnerable a backtracking
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Formato de correo inválido.");
      return;
    }

    if (email === currentEmail.trim().toLowerCase()) {
      setError("El nuevo correo debe ser distinto al actual.");
      return;
    }

    if (email !== confirm) {
      setError("Los correos no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(email);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar el correo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
      title={
        <Flex align="center" gap={8}>
          <MailOutlined />
          <span>Cambiar correo</span>
        </Flex>
      }
      destroyOnClose
    >
      {done ? (
        <Flex vertical align="center" gap={16} style={{ padding: "16px 0" }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: "#2FBF7C" }} />
          <Text strong>Correo actualizado correctamente</Text>
          <Button type="primary" onClick={onClose}>
            Cerrar
          </Button>
        </Flex>
      ) : (
        <Flex vertical gap={16} style={{ paddingTop: 8 }}>
          {error && <Alert message={error} type="error" showIcon />}

          {/* Email actual */}
          <Flex vertical gap={2}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Correo actual
            </Text>
            <Text strong>{currentEmail || "—"}</Text>
          </Flex>

          {/* Nuevo email */}
          <Flex vertical gap={4}>
            <Text strong style={{ fontSize: 13 }}>
              Nuevo correo
            </Text>
            <Input
              prefix={<MailOutlined />}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              size="large"
            />
          </Flex>

          {/* Confirmar */}
          <Flex vertical gap={4}>
            <Text strong style={{ fontSize: 13 }}>
              Confirmar correo
            </Text>
            <Input
              prefix={<MailOutlined />}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              size="large"
            />
          </Flex>

          <Flex justify="flex-end" gap={8}>
            <Button onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={handleConfirm}
              disabled={!isValid}
            >
              Cambiar correo
            </Button>
          </Flex>
        </Flex>
      )}
    </Modal>
  );
}