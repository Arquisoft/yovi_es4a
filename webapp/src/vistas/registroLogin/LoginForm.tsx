import React, { useState } from "react";
import { Form, Input, Button, Checkbox, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api/users";
import { saveUserSession } from "../../utils/session";

const LoginForm: React.FC = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);

    try {
      const data = await loginUser(values.username, values.password);

      message.success(data.message);

      saveUserSession({
        username: data.username,
        profilePicture: data.profilePicture,
      });

      navigate("/home");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      name="login_form"
      initialValues={{ remember: false }}
      onFinish={onFinish}
      layout="vertical"
      style={{ width: "70%", height: "100%", margin: "0 auto" }}
    >
      <Form.Item
        name="username"
        label="Nombre de usuario"
        rules={[{ required: true, message: "Por favor, ingresa tu usuario." }]}
      >
        <Input prefix={<UserOutlined />} placeholder="Usuario" size="large" />
      </Form.Item>

      <Form.Item
        name="password"
        label="Contraseña"
        rules={[
          { required: true, message: "Por favor, ingresa tu contraseña." },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Contraseña"
          size="large"
          iconRender={(visible) =>
            visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
          }
          visibilityToggle={{
            visible: passwordVisible,
            onVisibleChange: setPasswordVisible,
          }}
        />
      </Form.Item>

      <Form.Item name="remember" valuePropName="checked">
        <Checkbox>Recordarme</Checkbox>
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          size="large"
          loading={loading}
          block
        >
          Iniciar Sesión
        </Button>
      </Form.Item>
    </Form>
  );
};

export default LoginForm;
