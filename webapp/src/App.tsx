import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta raíz: Carga el Login */}
        <Route path="/" element={<LoginPage />} />
        
        {/* Ruta home: Menú principal */}
        <Route path="/home" element={<HomePage />} />
        
        {/* Ruta game: El tablero */}
        <Route path="/game" element={<GamePage />} />
      </Routes>
    </Router>
  );
}

export default App;