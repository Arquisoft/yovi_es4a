import "./App.css";
import "./estilos/Cell.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./vistas/Bienvenida";
import Home from "./vistas/Home";
import GameHvB from "./vistas/GameHvB";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bienvenida />} />
        <Route path="/home" element={<Home />} />
        <Route path="/game" element={<GameHvB />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;