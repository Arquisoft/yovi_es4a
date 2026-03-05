import React, { useState, useEffect } from 'react';
import { evaluatePasswordStrength, AVATARS, type StrengthResult } from '../utils/Validation';
import { Link } from 'react-router-dom';
import '../estilos/RegisterForm.css';

/**
 * Componente funcional que renderiza el formulario de registro de la aplicación.
 * Gestiona el estado de los campos, validaciones de cliente y la integración con el backend.
 * @component
 */
const RegisterForm: React.FC = () => {
  // --- Estado del Formulario ---
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(AVATARS[0].id);
  
  // --- Estado de Feedback Visual ---
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [strength, setStrength] = useState<StrengthResult>({ label: '', color: 'transparent', width: '0%' });

  /**
   * Endpoint de la API obtenido de las variables de entorno o valor por defecto.
   */
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        body: JSON.stringify({ username, email, password, profilePicture }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar el registro.');
      }

      setSuccess(data.message);
      
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setProfilePicture(AVATARS[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="home">
      <div className="game-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 'bold' }}>Crear nueva cuenta</h2>

        {error && (
          <div style={{ padding: '10px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px', background: '#f0fdf4', color: '#16a34a', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label htmlFor="reg-username" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1F2A30' }}>Nombre de Usuario</label>
            <input 
              id="reg-username" type="text" className="ant-input" required
              value={username} onChange={(e) => setUsername(e.target.value)} 
              placeholder="Ej: user123"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#dad9d9fe'}}
            />
          </div>

          <div>
            <label htmlFor="reg-email" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1F2A30' }}>Correo Electrónico</label>
            <input 
              id="reg-email" type="email" className="ant-input" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#dad9d9fe' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1F2A30' }}>Elige tu Avatar de perfil</label>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
              {AVATARS.map((av) => (
                <img 
                  key={av.id} src={av.src} alt={av.label} title={av.label}
                  style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover',
                    border: profilePicture === av.id ? '3px solid #FF7B00' : '3px solid transparent',
                    boxShadow: profilePicture === av.id ? '0 4px 12px rgba(255,123,0,0.3)' : 'none',
                    transition: 'all 0.2s',
                    backgroundColor: '#f0f0f0'
                  }}
                  onClick={() => setProfilePicture(av.id)}
                  onError={(e) => { (e.target as any).src = "https://via.placeholder.com/60?text=Avatar" }}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1F2A30' }}>Contraseña</label>
            <input 
              id="reg-password" type="password" className="ant-input" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#dad9d9fe' }}
            />
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ background: '#edf2f7', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                  <div style={{ width: strength.width, backgroundColor: strength.color, height: '100%', transition: 'width 0.3s' }} />
                </div>
                <span style={{ color: strength.color, fontSize: '0.8rem', fontWeight: 'bold' }}>
                  Nivel de seguridad: {strength.label}
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1F2A30' }}>Repetir Contraseña</label>
            <input 
              id="reg-confirm" type="password" className="ant-input" required
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#dad9d9fe' }}
            />
          </div>

          {/* USAMOS .btn-accent DE App.css PARA EL BOTÓN PRINCIPAL */}
          <button type="submit" className="ant-btn btn-accent" style={{ 
            width: '100%', padding: '12px', borderRadius: '8px', border: 'none', 
            fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' 
          }}>
            Registrarse
          </button>
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <Link 
                to="/" 
                style={{ 
                  textDecoration: 'underline', 
                  color: '#4a5568', 
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Volver a la página de bienvenida
              </Link>
            </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;