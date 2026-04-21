import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge } from "antd";

import MultiplayerSessionGamePage from "../game/MultiplayerSessionGamePage";
import { parseYenToCells } from "../game/yen";
import {
  useMultiplayerGameSession,
  type MultiplayerConfig,
  type MultiplayerRole,
} from "../game/useMultiplayerGameSession";
import MultiplayerChatDrawer from "./MultiplayerChatDrawer";

function getModeTitle(mode: string | undefined): string {
  if (mode === "classic_hvh") return "Clásico Online";
  if (mode === "holey_hvh") return "Holey (Agujeros)";
  if (mode === "tabu_hvh") return "Tabú (Bloqueos)";
  if (mode === "master_hvh") return "Master (Doble Mov)";
  if (mode === "fortune_dice_hvh") return "Fortune (Dados)";
  if (mode === "fortune_coin_hvh") return "Fortune (Moneda)";
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

  const opponentName = useMemo(() => {
    const opponent =
      myPlayer === "player0"
        ? playerProfiles.player1
        : playerProfiles.player0;

    return opponent.username?.trim() || "Jugador online";
  }, [myPlayer, playerProfiles]);

  const turnIndicatorExtra = (
    <>
      {config?.mode === "master_hvh" && (
        <Badge count={piecesLeft} overflowCount={9} style={{ backgroundColor: "#52c41a" }} title="Movimientos restantes" />
      )}
      {config?.mode === "fortune_dice_hvh" && (
        <>
          <Badge count={diceValue} overflowCount={9} style={{ backgroundColor: "#faad14" }} title="Valor del dado" />
          <Badge count={piecesLeft} overflowCount={9} style={{ backgroundColor: "#52c41a" }} title="Movimientos restantes" />
        </>
      )}
    </>
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
