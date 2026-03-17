import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Alert, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { evaluatePasswordStrength, AVATARS, type StrengthResult } from '../../utils/Validation';
import '../../estilos/RegisterForm.css';

/**
 * Componente funcional que renderiza el formulario de registro de la aplicación.
 * Gestiona el estado de los campos, validaciones de cliente y la integración con el backend.
 * @component
 */
const RegisterForm: React.FC = () => {
    const [form] = Form.useForm();
  
  // --- Estado de validaciones y lógica visual ---
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(AVATARS[0].id);
  
  // --- Estado de Feedback Visual ---
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [strength, setStrength] = useState<StrengthResult>({ label: '', color: 'transparent', width: '0%' });

  // --- Estado de visibilidad de contraseñas (Estilo solicitado) ---
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const apiEndpoint = (window as any).REACT_APP_API_URI || 'http://localhost:3000';

  /**
   * Hook de efecto que monitoriza cambios en la contraseña para actualizar 
   * dinámicamente el medidor de fuerza.
   */
  useEffect(() => {
    setStrength(password ? evaluatePasswordStrength(password) : { label: '', color: 'transparent', width: '0%' });
  }, [password]);

  /**
   * Procesa el envío del formulario.
   * Realiza validaciones de seguridad y envía los datos al microservicio de usuarios.
   * @param {React.FormEvent} e - El evento de envío del formulario.
   */
  const onFinish = async (values: any) => {
    setError('');
    setSuccess('');

    // Validación: Repetir contraseña
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor, verifícalas.');
      return;
    }

    // Validación: Seguridad mínima requerida
    if (strength.label === 'Baja') {
      setError('La seguridad de la contraseña es demasiado baja para registrarse.');
      return;
    }

    try {
      const response = await fetch(`${apiEndpoint}/createuser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: values.username, 
          email: values.email, 
          password: values.password, 
          profilePicture 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar el registro.');
      }

      setSuccess(data.message);
      
      // Limpiar formulario
      form.resetFields();
      setPassword('');
      setConfirmPassword('');
      setProfilePicture(AVATARS[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Form
      form={form}
      name="register_form"
      layout="vertical"
      onFinish={onFinish}
      style={{ width: '100%', margin: '0 auto'}}
    >
      {/* Alertas de error/éxito usando componentes de Ant Design */}
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 15 }} />}
      {success && <Alert message={success} type="success" showIcon style={{ marginBottom: 15 }} />}

      {/* Fila 1: Correo y Nombre de Usuario */}
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Form.Item
            name="email"
            label={<span style={{ fontWeight: 'bold', color: '#1F2A30' }}>Correo Electrónico</span>}
            rules={[
              { required: true, message: 'Por favor, ingresa tu correo.' },
              { type: 'email', message: 'Ingresa un correo válido.' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="ejemplo@correo.com" size="large" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="username"
            label={<span style={{ fontWeight: 'bold', color: '#1F2A30' }}>Nombre de Usuario</span>}
            rules={[{ required: true, message: 'Por favor, ingresa tu usuario.' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Ej: user123" size="large" />
          </Form.Item>
        </Col>
      </Row>

      {/* Fila 2: Contraseña y Selector de Avatar */}
      <Row gutter={24} style={{ marginTop: '10px' }}>
        <Col xs={24} md={12}>
          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 'bold', color: '#1F2A30' }}>Contraseña</span>}
            rules={[{ required: true, message: 'Por favor, ingresa tu contraseña.' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Contraseña"
              size="large"
              onChange={(e) => setPassword(e.target.value)}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
            />
          </Form.Item>
          
          {/* Medidor de fuerza de la contraseña (se mantiene debajo del input de contraseña) */}
          {password && (
            <div style={{ marginTop: '-15px', marginBottom: '15px' }}>
              <div style={{ background: '#edf2f7', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ width: strength.width, backgroundColor: strength.color, height: '100%', transition: 'width 0.3s' }} />
              </div>
              <span style={{ color: strength.color, fontSize: '0.8rem', fontWeight: 'bold' }}>
                Nivel de seguridad: {strength.label}
              </span>
            </div>
          )}
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label={<span style={{ fontWeight: 'bold', color: '#1F2A30' }}>Elige tu Avatar de perfil</span>}>
            <div style={{ display: 'flex', gap: '1px', justifyContent: 'center', marginTop: '10px' }}>
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setProfilePicture(av.id)}
                  aria-label={`Seleccionar avatar ${av.label}`}
                  aria-pressed={profilePicture === av.id}
                  style={{
                    background: 'none',
                    border: profilePicture === av.id ? '3px solid #FF7B00' : '3px solid transparent',
                    borderRadius: '50%',
                    padding: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: profilePicture === av.id ? '0 4px 12px rgba(255,123,0,0.3)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outlineColor: '#FF7B00'
                  }}
                >
                  <img 
                    src={av.src} 
                    alt={av.label} 
                    title={av.label}
                    style={{ 
                      width: '40px',
                      height: '40px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      backgroundColor: '#f0f0f0'
                    }}
                    onError={(e) => { (e.target as any).src = "https://via.placeholder.com/60?text=Avatar" }}
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
            label={<span style={{ fontWeight: 'bold', color: '#1F2A30' }}>Repetir Contraseña</span>}
            dependencies={['password']}
            rules={[
              { required: true, message: 'Por favor, confirma tu contraseña.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Las contraseñas no coinciden.'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repetir Contraseña"
              size="large"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              visibilityToggle={{ visible: confirmPasswordVisible, onVisibleChange: setConfirmPasswordVisible }}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          {/* Etiqueta invisible para mantener la misma alineación que el input de la izquierda */}
          <Form.Item label={<span style={{ visibility: 'hidden' }}>Acción</span>}>
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