import React from "react";
import { Modal, Tabs, Typography } from "antd";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

const { Paragraph } = Typography;

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: () => void | Promise<void>;
};

const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  onLoginSuccess,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={820}
      title="Guardar partida en tu cuenta"
    >
      <Paragraph style={{ marginBottom: 16 }}>
        Si inicias sesión ahora, la partida terminada se guardará en tu cuenta.
        Si te registras, primero tendrás que verificar el correo antes de poder iniciar sesión y guardar partidas.
      </Paragraph>

      <Tabs
        defaultActiveKey="login"
        items={[
          {
            key: "login",
            label: "Iniciar sesión",
            children: (
              <LoginForm
                redirectOnSuccess={false}
                onLoginSuccess={onLoginSuccess}
              />
            ),
          },
          {
            key: "register",
            label: "Registrarse",
            children: <RegisterForm embedded />,
          },
        ]}
      />
    </Modal>
  );
};

export default AuthModal;