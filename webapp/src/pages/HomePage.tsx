import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Menú Principal</h1>
      <p>Bienvenido usuario. ¿Qué quieres hacer?</p>
      
      <div style={{ marginTop: '30px' }}>
        <Link to="/game" className="button-link" style={{ 
          padding: '10px 20px', 
          backgroundColor: '#4ecdc4', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: '5px' 
        }}>
          Ir a Jugar
        </Link>
      </div>
    </div>
  );
};

export default HomePage;