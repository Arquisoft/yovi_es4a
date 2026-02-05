import React from 'react';
import RegisterForm from '../components/log/RegisterForm';

const LoginPage: React.FC = () => {
  return (
    <div className="login-container">
      <h2>Juego de la Y</h2>
      {/* Aquí cargamos el componente del formulario que ya tenías */}
      <RegisterForm />
    </div>
  );
};

export default LoginPage;