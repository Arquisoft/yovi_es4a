import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Flex, Space, Typography } from "antd";
import { ArrowRightOutlined, SwapOutlined } from "@ant-design/icons";

const { Text } = Typography;

import MultiplayerSessionGamePage from "../../game/MultiplayerSessionGamePage";
import { parseYenToCells } from "../../game/yen";
import {
  useMultiplayerGameSession,
  type MultiplayerConfig,
  type MultiplayerRole,
} from "../../game/useMultiplayerGameSession";
import MultiplayerChatDrawer from "../MultiplayerChatDrawer";
import "../../estilos/VariantVisuals.css";
import { useEffect } from "react";

function getModeTitle(mode: string | undefined): string {
  if (mode === "classic_hvh") return "Clásico Online";
  if (mode === "pastel_hvh") return "Regla del Pastel";
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
    displayMyPlayer = myPlayer,
    playerProfiles,
    handleCellClick,
    handleAbandon,
    handlePastelSwap,
    handlePastelPass,
    neutralCells,
    pastelState,
    messages,
    hasNewMessages,
    setHasNewMessages,
    handleSendChat,
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
    if (!yen) {
      return [];
    }

    return parseYenToCells(yen).map((cell) => {
      if (config?.mode === "pastel_hvh" && neutralCells.has(cell.cellId)) {
        return { ...cell, value: "N" };
      }

      if (config?.mode === "pastel_hvh" && pastelState?.swapped) {
        if (cell.value === "B") return { ...cell, value: "R" };
        if (cell.value === "R") return { ...cell, value: "B" };
      }

      return cell;
    });
  }, [config?.mode, neutralCells, pastelState?.swapped, yen]);

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
        <div className={`moves-indicator ${nextTurn === displayMyPlayer ? "move-active" : ""}`}>
          <span>⚡</span> {piecesLeft} mov.
        </div>
      )}
      {config?.mode === "fortune_dice_hvh" && (
        <>
          <div className={`dice-container ${isRolling ? "dice-rolling" : ""}`}>
            {diceValue}
          </div>
          <div className={`moves-indicator ${nextTurn === displayMyPlayer && piecesLeft > 0 ? "move-active" : ""}`}>
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

  const pastelDecisionBanner = config?.mode === "pastel_hvh" && pastelState?.phase === "pie_choice" ? (
    <Card
      style={{
        background: "linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)",
        border: "2px solid #faad14",
        borderRadius: 12,
      }}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Flex align="center" gap={10}>
          <span style={{ fontSize: 26 }}>🍰</span>
          <div>
            <Text strong style={{ color: "#d46b08", display: "block" }}>
              Regla del Pastel
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              El segundo jugador decide si se queda con la primera posición o cede el turno.
            </Text>
          </div>
        </Flex>

        <Flex gap={12} wrap="wrap" justify="center">
          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={handlePastelSwap}
            data-testid="multiplayer-pastel-swap-btn"
          >
            Quedarme con esa posición
          </Button>
          <Button
            icon={<ArrowRightOutlined />}
            onClick={handlePastelPass}
            data-testid="multiplayer-pastel-pass-btn"
          >
            Ceder y jugar después
          </Button>
        </Flex>
      </Space>
    </Card>
  ) : null;

  return (
    <>
      <MultiplayerSessionGamePage
        title={`${getModeTitle(config?.mode)} vs. ${opponentName}`}
        subtitle={`Sala: ${code ?? ""} · Eres: ${displayMyPlayer === "player0" ? "Azul" : "Naranja"}`}
        mode={config?.mode}
        loading={loading}
        error={error}
        hasBoard={!!yen}
        emptyText="No se pudo cargar la partida."
        boardSize={yen?.size ?? config?.size ?? 11}
        cells={cells}
        disabledCells={disabledCells}
        neutralCells={neutralCells}
        boardBanner={pastelDecisionBanner}
        boardDisabled={loading || gameOver || nextTurn !== displayMyPlayer}
        onCellClick={handleCellClick}
        myPlayer={displayMyPlayer}
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
