import { useState } from "react";
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
import UserHistory from "./vistas/UserHistory";
import ProtectedRoute from "./utils/ProtectedRoute";
import VariantSelect from "./vistas/VariantSelect";
import type { Variant } from "./vistas/VariantSelect";
import MultiplayerLobby from "./vistas/MultiplayerLobby";
import GameMultiplayer from "./vistas/GameMultiplayer";

// ─── Variantes de juego ──────────────────────────────────────────────────────
import GameFortuneDice from "./vistas/GameFortuneDice";
import GameTabu from "./vistas/GameTabu";
import GameHoley from "./vistas/GameHoley";
import GamePolyY from "./vistas/GamePolyY";
import GameHex from "./vistas/GameHex";

// ─── Flujo /home: configuración → selección de variante ─────────────────────

const CLASSIC_VARIANT: Variant = {
  id: "classic",
  label: "Clásico",
  emoji: "⬡",
  tagLabel: "Estándar",
  tagColor: "blue",
  description: "El juego Y original. Conecta los tres lados del tablero.",
  detail:
    "Dos jugadores se alternan colocando fichas. Gana quien conecte los tres lados del tablero triangular con una cadena continua de piezas propias.",
  implemented: true,
};

function HomeFlow() {
  const [step, setStep] = useState<"variant" | "config">("config");
  const [variant, setVariant] = useState<Variant>(CLASSIC_VARIANT);

  function handleVariantSelect(v: Variant) {
    setVariant(v);
    setStep("config");
  }

  if (step === "variant") {
    return <VariantSelect onSelect={handleVariantSelect} onBack={() => setStep("config")} />;
  }

  return (
    <Home
      variant={variant}
      onChangeVariant={() => setStep("variant")}
    />
  );
}

// ─── App principal ───────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bienvenida />} />
        <Route path="/home" element={<HomeFlow />} />

        {/* Clásico */}
        <Route path="/game-hvb" element={<GameHvB />} />
        <Route path="/game-hvh" element={<GameHvH />} />

        {/* Variantes */}
        <Route path="/game-fortune-dice" element={<GameFortuneDice />} />
        <Route path="/game-tabu" element={<GameTabu />} />
        <Route path="/game-holey" element={<GameHoley />} />
        <Route path="/game-poly-y" element={<GamePolyY />} />
        <Route path="/game-hex" element={<GameHex />} />
        <Route path="/game-why-not" element={<GameHex />} />
        <Route path="/game-pastel" element={<GameHex />} />

        {/* Multijugador por Sockets */}
        <Route path="/multiplayer" element={<MultiplayerLobby />} />
        <Route path="/multiplayer/:code" element={<GameMultiplayer />} />

        {/* Usuarios */}
        <Route path="/registro" element={<RegisterForm />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route
          path="/historial"
          element={
            <ProtectedRoute>
              <UserHistory />
            </ProtectedRoute>
          }
        />
        <Route path="/verify" element={<ValidacionEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
