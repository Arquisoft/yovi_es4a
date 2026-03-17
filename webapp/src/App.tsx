import "./App.css";
import "./estilos/Cell.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./vistas/Bienvenida";
import Home from "./vistas/Home";
import GameHvB from "./vistas/GameHvB";
import GameHvH from "./vistas/GameHvH";
import RegisterForm from "./vistas/RegisterForm";
import Ranking from "./vistas/Ranking";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Bienvenida />} />
        <Route path="/home"     element={<Home />} />
        <Route path="/game-hvb" element={<GameHvB />} />
        <Route path="/game-hvh" element={<GameHvH />} />
        <Route path="/registro" element={<RegisterForm />} />
        <Route path="/ranking"  element={<Ranking />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;