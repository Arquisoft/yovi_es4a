import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { socket } from "../api/socket";
import MultiplayerSessionGamePage from "../game/MultiplayerSessionGamePage";
import { parseYenToCells } from "../game/yen";
import {
  useMultiplayerGameSession,
  type MultiplayerConfig,
  type MultiplayerRole,
} from "../game/useMultiplayerGameSession";
import MultiplayerChatDrawer, {
  type ChatMessage,
} from "./MultiplayerChatDrawer";

function getModeTitle(mode: string | undefined): string {
  if (mode === "classic_hvh") return "Clásico Online";
  if (mode === "tabu_hvh") return "Tabú Online";
  if (mode === "holey_hvh") return "Holey Online";
  if (mode === "fortune_dice_hvh") return "Fortune Dice Online";
  if (mode === "why_not_hvh") return "WhY Not Online";
  if (mode === "poly_hvh") return "PolY Online";
  return mode?.split("_")[0].toUpperCase() ?? "YOVI";
}

export default function GameMultiplayer() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const role = location.state?.role as MultiplayerRole | undefined;
  const config = location.state?.config as MultiplayerConfig | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const handleInvalidState = useCallback(() => {
    navigate("/multiplayer");
  }, [navigate]);

  const handleLeaveLobby = useCallback(() => {
    navigate("/multiplayer");
  }, [navigate]);

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
  } = useMultiplayerGameSession({
    code,
    role,
    config,
    onInvalidState: handleInvalidState,
    onLeaveLobby: handleLeaveLobby,
  });

  useEffect(() => {
    function onChatMessage(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen)
        setHasNewMessages(true);
    }

    socket.on("chatMessage", onChatMessage);
    return () => {
      socket.off("chatMessage", onChatMessage);
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (error) {
      setIsChatOpen(false);
      setHasNewMessages(false);
    }
  }, [error]);

  function handleSendChat(text: string) {
    socket.emit("sendMessage", { code, text });
  }

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

  return (
    <>
      <MultiplayerSessionGamePage
        title={`${getModeTitle(config?.mode)} vs. ${opponentName}`}
        subtitle={`Sala: ${code ?? ""} · Eres: ${
          myPlayer === "player0" ? "Azul" : "Naranja"
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
