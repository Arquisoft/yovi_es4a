import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./App.css";
import "./estilos/Cell.css";

import Bienvenida from "./vistas/Bienvenida";
import Home from "./vistas/Home";
import Ranking from "./vistas/Ranking";
import RegisterForm from "./vistas/registroLogin/RegisterForm";
import ValidacionEmail from "./vistas/registroLogin/ValidacionEmail";
import UserHistory from "./vistas/UserHistory";
import VariantSelect from "./vistas/VariantSelect";
import MultiplayerLobby from "./vistas/MultiplayerLobby";
import GameMultiplayer from "./vistas/GameMultiplayer";
import GameFortuneCoin from "./vistas/GameFortuneCoin";
import GameFortuneDice from "./vistas/GameFortuneDice";
import GameHoley from "./vistas/GameHoley";
import GameMaster from "./vistas/GameMaster";
import GamePastel from "./vistas/GamePastel";
import GamePolyY from "./vistas/GamePolyY";
import GameTabu from "./vistas/GameTabu";
import GameWhyNot from "./vistas/GameWhyNot";
import Game3DY from "./vistas/Game3DY";
import GameHvB from "./vistas/game/GameHvB";
import GameHvH from "./vistas/game/GameHvH";
import {
  DEFAULT_VARIANT,
  type Variant,
} from "./game/variants";
import ProtectedRoute from "./utils/ProtectedRoute";

function HomeFlow() {
  const [step, setStep] = useState<"variant" | "config">("config");
  const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);

  function handleVariantSelect(selectedVariant: Variant) {
    setVariant(selectedVariant);
    setStep("config");
  }

  if (step === "variant") {
    return (
      <VariantSelect
        onSelect={handleVariantSelect}
        onBack={() => setStep("config")}
      />
    );
  }

  return (
    <Home
      variant={variant}
      onChangeVariant={() => setStep("variant")}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bienvenida />} />
        <Route path="/home" element={<HomeFlow />} />

        <Route path="/game-hvb" element={<GameHvB />} />
        <Route path="/game-hvh" element={<GameHvH />} />

        <Route path="/game-master" element={<GameMaster />} />
        <Route path="/game-pastel" element={<GamePastel />} />
        <Route path="/game-fortune-coin" element={<GameFortuneCoin />} />
        <Route path="/game-fortune-dice" element={<GameFortuneDice />} />
        <Route path="/game-tabu" element={<GameTabu />} />
        <Route path="/game-holey" element={<GameHoley />} />
        <Route path="/game-poly-y" element={<GamePolyY />} />
        <Route path="/game-why-not" element={<GameWhyNot />} />
        <Route path="/game-3dy" element={<Game3DY />} />

        <Route path="/multiplayer" element={<MultiplayerLobby />} />
        <Route path="/multiplayer/:code" element={<GameMultiplayer />} />

        <Route path="/registro" element={<RegisterForm />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route
          path="/historial"
          element={(
            <ProtectedRoute>
              <UserHistory />
            </ProtectedRoute>
          )}
        />
        <Route path="/verify" element={<ValidacionEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
