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
    winner,
    nextTurn,
    error,
    disabledCells,
    myPlayer,
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

  function handleSendChat(text: string) {
    socket.emit("sendMessage", { code, text });
  }

  const cells = useMemo(() => {
    return yen ? parseYenToCells(yen) : [];
  }, [yen]);

  return (
    <>
      <MultiplayerSessionGamePage
        title={getModeTitle(config?.mode)}
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
        boardDisabled={loading || !!winner || nextTurn !== myPlayer}
        onCellClick={handleCellClick}
        myPlayer={myPlayer}
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
        onClose={() => setIsChatOpen(false)}
        onSendMessage={handleSendChat}
      />
    </>
  );
}