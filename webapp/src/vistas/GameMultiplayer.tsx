import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Flex, Typography } from "antd";

const { Text } = Typography;

import MultiplayerSessionGamePage from "../game/MultiplayerSessionGamePage";
import { parseYenToCells } from "../game/yen";
import {
  useMultiplayerGameSession,
  type MultiplayerConfig,
  type MultiplayerRole,
} from "../game/useMultiplayerGameSession";
import MultiplayerChatDrawer from "./MultiplayerChatDrawer";
import "../estilos/VariantVisuals.css";
import { useEffect } from "react";

function getModeTitle(mode: string | undefined): string {
  if (mode === "classic_hvh") return "Clásico Online";
  if (mode === "holey_hvh") return "Holey (Agujeros)";
  if (mode === "tabu_hvh") return "Tabú (Bloqueos)";
  if (mode === "master_hvh") return "Master (Doble Mov)";
  if (mode === "fortune_dice_hvh") return "Fortune (Dados)";
  if (mode === "fortune_coin_hvh") return "Fortune (Moneda)";
  if (mode === "why_not_hvh" || mode === "whynot_hvh") return "WhY Not";
  return mode?.split("_")[0].toUpperCase() ?? "YOVI";
}

export default function GameMultiplayer() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const role = location.state?.role as MultiplayerRole | undefined;
  const config = location.state?.config as MultiplayerConfig | undefined;

  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleInvalidState = () => {
    navigate("/multiplayer");
  };

  const handleLeaveLobby = () => {
    navigate("/multiplayer");
  };

  const {
    yen,
    loading,
    gameOver,
    winner,
    nextTurn,
    error,
    disabledCells,
    myPlayer,
    playerProfiles,
    handleCellClick,
    handleAbandon,
    // Chat
    messages,
    hasNewMessages,
    setHasNewMessages,
    handleSendChat,
    // Variants
    piecesLeft,
    diceValue,
  } = useMultiplayerGameSession({
    code,
    role,
    config,
    onInvalidState: handleInvalidState,
    onLeaveLobby: handleLeaveLobby,
  });

  const cells = useMemo(() => {
    return yen ? parseYenToCells(yen) : [];
  }, [yen]);

  const [isRolling, setIsRolling] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (diceValue) {
      setIsRolling(true);
      const timer = setTimeout(() => setIsRolling(false), 600);
      return () => clearTimeout(timer);
    }
  }, [diceValue]);

  useEffect(() => {
    if (nextTurn) {
      setIsFlipping(true);
      const timer = setTimeout(() => setIsFlipping(false), 600);
      return () => clearTimeout(timer);
    }
  }, [nextTurn]);

  const opponentName = useMemo(() => {
    const opponent =
      myPlayer === "player0"
        ? playerProfiles.player1
        : playerProfiles.player0;

    return opponent.username?.trim() || "Jugador online";
  }, [myPlayer, playerProfiles]);

  const turnIndicatorExtra = (
    <Flex gap={12} align="center">
      {config?.mode === "master_hvh" && (
        <div className={`moves-indicator ${nextTurn === myPlayer ? "move-active" : ""}`}>
          <span>⚡</span> {piecesLeft} mov.
        </div>
      )}
      {config?.mode === "fortune_dice_hvh" && (
        <>
          <div className={`dice-container ${isRolling ? "dice-rolling" : ""}`}>
            {diceValue}
          </div>
          <div className={`moves-indicator ${nextTurn === myPlayer && piecesLeft > 0 ? "move-active" : ""}`}>
            {piecesLeft} piezas
          </div>
        </>
      )}
      {config?.mode === "fortune_coin_hvh" && (
        <>
          <div className={`coin-container ${isFlipping ? "coin-flipping" : ""}`}>
            {nextTurn === "player0" ? "A" : "N"}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Lanzando moneda...
          </Text>
        </>
      )}
    </Flex>
  );

  return (
    <>
      <MultiplayerSessionGamePage
        title={`${getModeTitle(config?.mode)} vs. ${opponentName}`}
        subtitle={`Sala: ${code ?? ""} · Eres: ${myPlayer === "player0" ? "Azul" : "Naranja"
          }`}
        mode={config?.mode}
        loading={loading}
        error={error}
        hasBoard={!!yen}
        emptyText="No se pudo cargar la partida."
        boardSize={yen?.size ?? config?.size ?? 11}
        cells={cells}
        disabledCells={disabledCells}
        boardDisabled={loading || gameOver || nextTurn !== myPlayer}
        onCellClick={handleCellClick}
        myPlayer={myPlayer}
        gameOver={gameOver}
        nextTurn={nextTurn}
        winner={winner}
        hasNewMessages={hasNewMessages}
        onOpenChat={() => {
          setIsChatOpen(true);
          setHasNewMessages(false);
        }}
        onAbandon={handleAbandon}
        onBack={() => navigate("/multiplayer")}
        turnIndicatorExtra={turnIndicatorExtra}
      />

      <MultiplayerChatDrawer
        open={isChatOpen}
        myPlayer={myPlayer}
        messages={messages}
        playerProfiles={playerProfiles}
        onClose={() => setIsChatOpen(false)}
        onSendMessage={handleSendChat}
      />
    </>
  );
}
