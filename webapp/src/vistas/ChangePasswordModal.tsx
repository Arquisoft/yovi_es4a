import { useEffect, useState } from "react";
import { Alert, Button, Flex, Input, Modal, Typography } from "antd";
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  LockOutlined,
} from "@ant-design/icons";
import {
  evaluatePasswordStrength,
  validatePassword,
  validateConfirmPassword,
  type StrengthResult,
} from "../utils/Validation";

const { Text } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (oldPassword: string, newPassword: string) => Promise<void>;
};

export default function ChangePasswordModal({ open, onClose, onConfirm }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [strength, setStrength] = useState<StrengthResult>({
    label: "",
    color: "transparent",
    width: "0%",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Limpiar estado al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setLoading(false);
      setStrength({ label: "", color: "transparent", width: "0%" });
    }
  }, [open]);

  // Actualizar medidor de fuerza en tiempo real
  useEffect(() => {
    setStrength(
      newPassword
        ? evaluatePasswordStrength(newPassword)
        : { label: "", color: "transparent", width: "0%" }
    );
  }, [newPassword]);

  async function handleConfirm() {
    setError("");

    if (!oldPassword.trim()) {
      setError("Debes introducir tu contraseña actual.");
      return;
    }

    const passError = validatePassword(newPassword);
    if (passError) {
      setError(passError);
      return;
    }

    if (strength.label === "Baja") {
      setError("La seguridad de la nueva contraseña es demasiado baja.");
      return;
    }

    const confirmError = validateConfirmPassword(newPassword, confirmPassword);
    if (confirmError) {
      setError(confirmError);
      return;
    }

    if (oldPassword === newPassword) {
      setError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(oldPassword, newPassword);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar la contraseña.");
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
          <LockOutlined />
          <span>Cambiar contraseña</span>
        </Flex>
      }
      footer={null}
      destroyOnClose
      width={420}
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        {error && (
          <Alert message={error} type="error" showIcon />
        )}

        {/* Contraseña actual */}
        <Flex vertical gap={4}>
          <Text strong style={{ fontSize: 13 }}>
            Contraseña actual
          </Text>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Introduce tu contraseña actual"
            size="large"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        </Flex>

        {/* Nueva contraseña */}
        <Flex vertical gap={4}>
          <Text strong style={{ fontSize: 13 }}>
            Nueva contraseña
          </Text>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Introduce la nueva contraseña"
            size="large"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />

          {/* Medidor de fuerza */}
          {newPassword && (
            <Flex vertical gap={2} style={{ marginTop: 4 }}>
              <div
                style={{
                  background: "#edf2f7",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: strength.width,
                    backgroundColor: strength.color,
                    height: "100%",
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <Text style={{ color: strength.color, fontSize: "0.8rem", fontWeight: "bold" }}>
                Nivel de seguridad: {strength.label}
              </Text>
            </Flex>
          )}
        </Flex>

        {/* Repetir nueva contraseña */}
        <Flex vertical gap={4}>
          <Text strong style={{ fontSize: 13 }}>
            Repetir nueva contraseña
          </Text>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Repite la nueva contraseña"
            size="large"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        </Flex>

        {/* Botones */}
        <Flex justify="flex-end" gap={8} style={{ marginTop: 4 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={handleConfirm}
          >
            Cambiar contraseña
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}