import "./App.css";
import "./estilos/Cell.css";
import { ConfigProvider } from "antd";
import { illustrationTheme } from "./theme/illustrationTheme";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./vistas/Bienvenida";
import Home from "./vistas/Home";
import GameHvB from "./vistas/GameHvB";

function App() {
  return (
    <ConfigProvider theme={illustrationTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Bienvenida />} />
          <Route path="/home" element={<Home />} />
          <Route path="/game" element={<GameHvB />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;