import "./App.css";
import "./estilos/Cell.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./vistas/Bienvenida";
import Home from "./vistas/Home";
import GameHvB from "./vistas/game/GameHvB";
import RegisterForm from "./vistas/registroLogin/RegisterForm";
import GameHvH from "./vistas/game/GameHvH";
import Ranking from "./vistas/Ranking";
import ValidacionEmail from "./vistas/registroLogin/ValidacionEmail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bienvenida />} />
        <Route path="/home" element={<Home />} />
        <Route path="/game-hvb" element={<GameHvB />} />
        <Route path="/game-hvh" element={<GameHvH />} />
        <Route path="/registro" element={<RegisterForm />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/verify" element={<ValidacionEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
