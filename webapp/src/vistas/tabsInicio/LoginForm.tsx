import React, { useState } from 'react';
import { Form, Input, Button, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';

const LoginForm: React.FC = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const onFinish = (values: any) => {
    console.log('Valores de login:', values);
    // TODO: Conectar con tu API
  };

  return (
    <Form 
      name="login_form" 
      initialValues={{ remember: true }} 
      onFinish={onFinish} 
      layout="vertical"
      style={{ width: '100%' }}
    >
      <Form.Item 
        name="username" 
        label="Nombre de usuario"
        rules={[{ required: true, message: 'Por favor, ingresa tu usuario.' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="Usuario" size="large" />
      </Form.Item>

      <Form.Item 
        name="password" 
        label="Contraseña"
        rules={[{ required: true, message: 'Por favor, ingresa tu contraseña.' }]}
      >
        <Input.Password 
          prefix={<LockOutlined />} 
          placeholder="Contraseña" 
          size="large" 
          iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
        />
      </Form.Item>

      <Form.Item name="remember" valuePropName="checked">
        <Checkbox>Recordarme</Checkbox>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" size="large" block>
          Iniciar Sesión
        </Button>
      </Form.Item>
    </Form>
  );
};

export default LoginForm;