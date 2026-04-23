import React, { useState, useEffect } from "react";
import { Form, Input, Button, Alert, Row, Col, message } from "antd"; // Importamos 'message' para los pop-ups flotantes
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from "@ant-design/icons";
import {
  evaluatePasswordStrength,
  validateUsername,
  validatePassword,
  validateConfirmPassword,
  AVATARS,
  type StrengthResult,
} from "../../utils/Validation";
import "../../estilos/RegisterForm.css";
import { registerUser } from "../../api/users";

type RegisterFormProps = {
  embedded?: boolean;
};

const RegisterForm: React.FC<RegisterFormProps> = ({
  embedded = false,
}) => {
  const [form] = Form.useForm();

  // --- Estados ---
  // Mantenemos solo el estado de 'password' porque lo necesitamos para calcular la barra de fuerza en tiempo real
  const [password, setPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState(AVATARS[0].id);

  // Estado de feedback visual
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [strength, setStrength] = useState<StrengthResult>({
    label: "",
    color: "transparent",
    width: "0%",
  });

  // --- Estado de visibilidad de contraseñas (Estilo solicitado) ---
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  /**
   * Hook de efecto que monitoriza cambios en la contraseña para actualizar
   * dinámicamente el medidor de fuerza.
   */
  useEffect(() => {
    setStrength(
      password
        ? evaluatePasswordStrength(password)
        : { label: "", color: "transparent", width: "0%" },
    );
  }, [password]);

  /**
   * Procesa el envío del formulario.
   * Aquí ejecutamos las validaciones fuertes para que surjan como pop-ups y alertas.
   */
  const onFinish = async (values: any) => {
    setError("");
    setSuccess("");

    // 1. Validaciones personalizadas (Lanzan pop-ups y alertas si fallan)
    const userError = validateUsername(values.username);
    if (userError) {
      message.error(userError); // Pop-up flotante
      setError(userError); // Alerta visual estática
      return;
    }

    const passError = validatePassword(values.password);
    if (passError) {
      message.error(passError);
      setError(passError);
      return;
    }

    const confirmError = validateConfirmPassword(
      values.password,
      values.confirmPassword,
    );
    if (confirmError) {
      message.error(confirmError);
      setError(confirmError);
      return;
    }

    if (strength.label === "Baja") {
      const strengthMsg =
        "La seguridad de la contraseña es demasiado baja para registrarse.";
      message.error(strengthMsg);
      setError(strengthMsg);
      return;
    }

    // 2. Si todo es correcto, llamamos al backend
    try {
      const data = await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
        profilePicture,
      });

      // En modo E2E o si no es embedded, usamos el mensaje del backend que ya gestiona el bypass de correo
      const successMessage = (data.message && (embedded ? data.message.includes('verificada automáticamente') : true))
        ? data.message
        : (embedded 
            ? "Cuenta creada correctamente. Cuando la verifiques por correo y luego inicies sesión, podrás guardar partidas en tu cuenta."
            : data.message);

      message.success(successMessage);
      setSuccess(successMessage);

      form.resetFields();
      setPassword("");
      setProfilePicture(AVATARS[0].id);
    } catch (err: any) {
      message.error(err.message);
      setError(err.message);
    }
  };

  return (
    <Form
      form={form}
      name="register_form"
      layout="vertical"
      onFinish={onFinish}
      style={{ width: "100%", margin: "0 auto" }}
    >
      {/* Alertas fijas en la parte superior */}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 15 }}
        />
      )}
      {success && (
        <Alert
          message={success}
          type="success"
          showIcon
          style={{ marginBottom: 15 }}
        />
      )}

      {/* Fila 1: Correo y Nombre de Usuario */}
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Form.Item
            name="email"
            label={
              <span style={{ fontWeight: "bold", color: "#1F2A30" }}>
                Correo Electrónico
              </span>
            }
            rules={[
              { required: true, message: "Por favor, ingresa tu correo." },
              { type: "email", message: "Ingresa un correo válido." },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="ejemplo@correo.com"
              size="large"
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="username"
            label={
              <span style={{ fontWeight: "bold", color: "#1F2A30" }}>
                Nombre de Usuario
              </span>
            }
            rules={[
              { required: true, message: "Por favor, ingresa tu usuario." },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Ej: user123"
              size="large"
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Fila 2: Contraseña y Selector de Avatar */}
      <Row gutter={24} style={{ marginTop: "10px" }}>
        <Col xs={24} md={12}>
          <Form.Item
            name="password"
            label={
              <span style={{ fontWeight: "bold", color: "#1F2A30" }}>
                Contraseña
              </span>
            }
            rules={[
              { required: true, message: "Por favor, ingresa tu contraseña." },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Contraseña"
              size="large"
              onChange={(e) => setPassword(e.target.value)}
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
              visibilityToggle={{
                visible: passwordVisible,
                onVisibleChange: setPasswordVisible,
              }}
            />
          </Form.Item>

          {/* Medidor de fuerza de la contraseña (se mantiene debajo del input de contraseña) */}
          {password && (
            <div style={{ marginTop: "-15px", marginBottom: "15px" }}>
              <div
                style={{
                  background: "#edf2f7",
                  height: "6px",
                  borderRadius: "3px",
                  overflow: "hidden",
                  marginBottom: "4px",
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
              <span
                style={{
                  color: strength.color,
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                }}
              >
                Nivel de seguridad: {strength.label}
              </span>
            </div>
          )}
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label={
              <span style={{ fontWeight: "bold", color: "#1F2A30" }}>
                Elige tu Avatar de perfil
              </span>
            }
          >
            <div
              style={{
                display: "flex",
                gap: "1px",
                justifyContent: "center",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setProfilePicture(av.id)}
                  aria-label={`Seleccionar avatar ${av.label}`}
                  aria-pressed={profilePicture === av.id}
                  style={{
                    background: "none",
                    border:
                      profilePicture === av.id
                        ? "3px solid #FF7B00"
                        : "3px solid transparent",
                    borderRadius: "50%",
                    padding: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow:
                      profilePicture === av.id
                        ? "0 4px 12px rgba(255,123,0,0.3)"
                        : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outlineColor: "#FF7B00",
                  }}
                >
                  <img
                    src={av.src}
                    alt={av.label}
                    title={av.label}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      backgroundColor: "#f0f0f0",
                    }}
                    onError={(e) => {
                      (e.target as any).src =
                        "https://via.placeholder.com/60?text=Avatar";
                    }}
                  />
                </button>
              ))}
            </div>
          </Form.Item>
        </Col>
      </Row>

      {/* Fila 3: Repetir Contraseña y Botón de Registro */}
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Form.Item
            name="confirmPassword"
            label={
              <span style={{ fontWeight: "bold", color: "#1F2A30" }}>
                Repetir Contraseña
              </span>
            }
            dependencies={["password"]}
            rules={[
              { required: true, message: "Por favor, confirma tu contraseña." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("Las contraseñas no coinciden."),
                  );
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repetir Contraseña"
              size="large"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
              visibilityToggle={{
                visible: confirmPasswordVisible,
                onVisibleChange: setConfirmPasswordVisible,
              }}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label={<span style={{ visibility: "hidden" }}>Acción</span>}
          >
            <Button type="primary" htmlType="submit" size="large">
              Registrarse
            </Button>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};

export default RegisterForm;
