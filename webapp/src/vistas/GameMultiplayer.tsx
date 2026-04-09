import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card, Flex, Spin, Typography, message, Button, Input, List, Badge, Avatar, Drawer, Space } from "antd";
import { SendOutlined, MessageOutlined } from "@ant-design/icons";
import { socket } from "../api/socket";
import {
  createHvhGame,
  getHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  getOrCreateClientId,
  type YEN,
} from "../api/gamey";
import Board from "../game/Board";
import GameShell from "../game/GameShell";
import { parseYenToCells } from "../game/yen";
import { getAdjacentCells, generateHoles } from "../game/variants";
import AppHeader from "./AppHeader";
import Lottie from "lottie-react";
import confettiAnimation from "../assets/Confetti.json";
import gameOverAnimation from "../assets/GameOver.json";

const { Title, Text } = Typography;

interface ChatMessage {
  text: string;
  sender: "player0" | "player1";
  timestamp: number;
}

// ── Helper: resolve the game mode title ──────────────────────────────
function getModeTitle(mode: string | undefined): string {
  if (mode === "classic_hvh") return "Clásico Online";
  return mode?.split("_")[0].toUpperCase() ?? "YOVI";
}

// ── Sub-component: error card ────────────────────────────────────────
function ErrorPanel({ errorMsg, onBack }: Readonly<{ errorMsg: string; onBack: () => void }>) {
  return (
    <Card>
      <Flex vertical align="center" gap={16}>
        <Title level={4} type="danger">Error</Title>
        <Text>{errorMsg}</Text>
        <Button onClick={onBack}>Volver</Button>
      </Flex>
    </Card>
  );
}

// ── Sub-component: loading card ──────────────────────────────────────
function LoadingPanel() {
  return (
    <Card>
      <Flex vertical align="center" gap={16} style={{ padding: 40 }}>
        <Spin size="large" />
        <Title level={4}>Iniciando partida...</Title>
        <Text type="secondary">Conectando con el motor de juego</Text>
      </Flex>
    </Card>
  );
}

// ── Sub-component: turn indicator ────────────────────────────────────
function TurnIndicator({
  winner,
  nextTurn,
  myPlayer,
  activeTurnColor,
  mode,
  disabledCells,
  hasNewMessages,
  onOpenChat,
}: Readonly<{
  winner: string | null;
  nextTurn: string | null;
  myPlayer: string;
  activeTurnColor: string;
  mode: string | undefined;
  disabledCells: Set<number>;
  hasNewMessages: boolean;
  onOpenChat: () => void;
}>) {
  let turnText: string;
  if (winner) {
    turnText = "Partida terminada";
  } else if (nextTurn === myPlayer) {
    turnText = "🟢 ¡TU TURNO!";
  } else {
    turnText = "⌛ Esperando rival...";
  }

  return (
    <Card size="small" style={{ borderLeft: `6px solid ${activeTurnColor}`, marginBottom: 12 }}>
      <Flex justify="space-between" align="center">
        <Text strong>{turnText}</Text>
        <Space>
          {mode === "tabu_hvh" && nextTurn === myPlayer && disabledCells.size > 0 && (
            <Badge status="error" text={`${disabledCells.size} bloqueadas`} />
          )}
          <Button
            type="text"
            icon={<Badge dot={hasNewMessages}><MessageOutlined /></Badge>}
            onClick={onOpenChat}
          >
            Chat
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}

// ── Sub-component: game result overlay ───────────────────────────────
function GameResult({
  winner,
  myPlayer,
  animationFinished,
  onAnimationComplete,
  onBack,
  mode,
}: Readonly<{
  winner: string;
  myPlayer: string;
  animationFinished: boolean;
  onAnimationComplete: () => void;
  onBack: () => void;
  mode?: string;
}>) {
  const isWhYnot = mode === "whynot_hvh";
  const effectivelyWhoWon = isWhYnot ? (winner === "player0" ? "player1" : "player0") : winner;
  const isWin = effectivelyWhoWon === myPlayer;
  
  return (
    <Card style={{ marginTop: 20, textAlign: "center" }}>
      {!animationFinished && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Lottie
            animationData={isWin ? confettiAnimation : gameOverAnimation}
            loop={false}
            onComplete={onAnimationComplete}
          />
        </div>
      )}
      <Title level={3}>{isWin ? "👑 ¡HAS GANADO!" : "💀 HAS PERDIDO"}</Title>
      {isWhYnot && (
        <Text type="secondary">En WhY not, el primero que conecta pierde.</Text>
      )}
      <Button type="primary" size="large" onClick={onBack} style={{ marginTop: 10 }}>
        Volver al Lobby
      </Button>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function GameMultiplayer() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const role = location.state?.role as "host" | "guest" | undefined;
  const config = location.state?.config as { size: number; mode: string } | undefined;

  const [gameId, setGameId] = useState<string | null>(null);
  const [yen, setYen] = useState<YEN | null>(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [nextTurn, setNextTurn] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [animationFinished, setAnimationFinished] = useState(false);
  const [hostClientId, setHostClientId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Variants state
  const [disabledCells, setDisabledCells] = useState<Set<number>>(new Set());
  const [holes, setHoles] = useState<Set<number>>(new Set());
  const [piecesLeft, setPiecesLeft] = useState(1);
  const [diceValue, setDiceValue] = useState(1);
  const [swapped, setSwapped] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  const effectiveMyPlayer = useMemo(() => {
    const base = role === "host" ? "player0" : "player1";
    if (swapped) return base === "player0" ? "player1" : "player0";
    return base;
  }, [role, swapped]);

  const myPlayer = effectiveMyPlayer;
  const myColor = myPlayer === "player0" ? "#1677ff" : "#ff7b00";

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Efecto principal: Inicializar partida
  useEffect(() => {
    if (!socket.connected) socket.connect();
    
    let isMounted = true;

    async function initHost() {
      try {
        const initialTurn: "player0" | "player1" = config?.mode === "fortune_coin_hvh" 
            ? (Math.random() < 0.5 ? "player0" : "player1") 
            : "player0";

        await putConfig({ 
          size: config!.size, 
          hvb_starter: "human", 
          hvh_starter: initialTurn, 
          bot_id: null 
        });
        
        const r = await createHvhGame({ size: config!.size, hvh_starter: initialTurn });
        if (!isMounted) return;

        let extra: any = {};

        if (config?.mode === "holey_hvh") {
          const totalCells = (config.size * (config.size + 1)) / 2;
          const generatedHoles = generateHoles(totalCells);
          const holesArray = Array.from(generatedHoles);
          setHoles(generatedHoles);
          setDisabledCells(generatedHoles);
          extra.holes = holesArray;
        }

        if (config?.mode === "master_hvh") {
            setPiecesLeft(1); // First move is 1 piece
            extra.piecesLeft = 1;
        } else if (config?.mode === "fortune_dice_hvh") {
            const firstDice = Math.floor(Math.random() * 6) + 1;
            setDiceValue(firstDice);
            setPiecesLeft(firstDice);
            extra.diceValue = firstDice;
            extra.piecesLeft = firstDice;
        } else if (config?.mode === "fortune_coin_hvh") {
            extra.nextTurnOverride = initialTurn;
            message.info(`🪙 Moneda lanzada: Empieza ${initialTurn === "player0" ? "Azul" : "Naranja"}`);
        }

        setGameId(r.game_id);
        setYen(r.yen);
        setNextTurn(initialTurn);
        
        const myClientId = getOrCreateClientId();
        socket.emit("startGame", { 
          code, 
          gameId: r.game_id, 
          hostClientId: myClientId,
          extra: {
            ...extra,
            mode: config?.mode
          }
        });
        setLoading(false);
      } catch (err: any) {
        if (isMounted) setError(err.message || String(err));
        setLoading(false);
      }
    }

    if (role === "host" && config) {
      initHost();
    } else if (role === "guest") {
      setLoading(true);
    } else {
      navigate("/multiplayer");
    }

    return () => {
      isMounted = false;
    };
  }, [role, config, code, navigate]);

  // Suscribirse a eventos de socket
  useEffect(() => {
    function onGameStarted({ gameId: gId, hostClientId: hId, extra }: any) {
      if (role === "guest") {
        setGameId(gId);
        setHostClientId(hId);
        if (extra?.holes) {
          const holesSet = new Set<number>(extra.holes);
          setHoles(holesSet);
          refreshGameState(gId, hId, undefined, holesSet);
        } else {
          refreshGameState(gId, hId);
        }
        if (extra?.piecesLeft !== undefined) setPiecesLeft(extra.piecesLeft);
        if (extra?.diceValue !== undefined) setDiceValue(extra.diceValue);
      }
    }

    function onEnemyMove({ cellId }: { cellId: number }) {
      if (gameId) {
        refreshGameState(gameId, hostClientId ?? undefined, cellId);
      }
    }

    function onChatMessage(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setHasNewMessages(true);
      }
    }

    function onVariantUpdate(update: any) {
        if (update.swapped !== undefined) setSwapped(update.swapped);
        if (update.piecesLeft !== undefined) setPiecesLeft(update.piecesLeft);
        if (update.diceValue !== undefined) setDiceValue(update.diceValue);
        if (update.nextTurnOverride !== undefined) {
            setNextTurn(update.nextTurnOverride);
            message.info(`🪙 ¡Moneda! Turno para ${update.nextTurnOverride === "player0" ? "Azul" : "Naranja"}`);
        }
    }
    
    function onPlayerDisconnected(msg: string) {
       message.warning(msg);
       setError("La partida ha terminado por desconexión del oponente.");
    }

    socket.on("gameStarted", onGameStarted);
    socket.on("enemyMove", onEnemyMove);
    socket.on("chatMessage", onChatMessage);
    socket.on("playerDisconnected", onPlayerDisconnected);
    socket.on("variantUpdate", onVariantUpdate);

    return () => {
      socket.off("gameStarted", onGameStarted);
      socket.off("enemyMove", onEnemyMove);
      socket.off("chatMessage", onChatMessage);
      socket.off("playerDisconnected", onPlayerDisconnected);
      socket.off("variantUpdate", onVariantUpdate);
    };
  }, [gameId, role, hostClientId, config]);

  async function refreshGameState(gId: string, overrideId?: string, lastMoveCellId?: number, forcedHoles?: Set<number>) {
    try {
      const r = await getHvhGame(gId, overrideId || (role === "guest" && hostClientId ? hostClientId : undefined));
      setYen(r.yen);
      
      // Lógica de variantes
      if (config?.mode === "tabu_hvh" && lastMoveCellId !== undefined) {
         setDisabledCells(getAdjacentCells(lastMoveCellId, r.yen.size));
      } else if (config?.mode === "holey_hvh") {
         setDisabledCells(forcedHoles || holes);
      } else if (config?.mode === "classic_hvh") {
         setDisabledCells(new Set());
      }

      if (r.status.state === "finished") {
        setWinner(r.status.winner ?? null);
        setNextTurn(null);
        setDisabledCells(new Set());
      } else {
        setNextTurn(r.status.next ?? null);
      }
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCellClick(cellId: number) {
    if (nextTurn !== myPlayer || loading || winner || !!error || disabledCells.has(cellId)) return;

    setLoading(true);
    try {
      const isGuest = role === "guest";
      const nextPlayerInt = myPlayer === "player0" ? 0 : 1;
      let nextPlayerOverride: number | undefined = undefined;

      if (config?.mode === "master_hvh") {
          const newPiecesLeft = piecesLeft === 2 ? 1 : 2;
          if (newPiecesLeft === 1) nextPlayerOverride = nextPlayerInt;
      } else if (config?.mode === "fortune_dice_hvh") {
          if (piecesLeft > 1) nextPlayerOverride = nextPlayerInt;
      } else if (role === "host" && config?.mode === "fortune_coin_hvh") {
          // El host decide el siguiente jugador tras el lanzamiento de moneda
          const next = Math.random() < 0.5 ? 0 : 1;
          nextPlayerOverride = next;
          const nextStr = next === 0 ? "player0" : "player1";
          socket.emit("variantUpdate", { code, nextTurnOverride: nextStr });
          message.info(`🪙 ¡Moneda! Turno para ${next === 0 ? "Azul" : "Naranja"}`);
      }

      const r = await hvhMove(
          gameId!, 
          cellId, 
          isGuest && hostClientId ? hostClientId : undefined,
          nextPlayerOverride
      );
      setYen(r.yen);
      
      // Al mover nosotros, en Tabu se limpian nuestras celdas bloqueadas (hasta el próximo turno rival)
      if (config?.mode === "tabu_hvh") {
          setDisabledCells(new Set());
      }

      if (r.status.state === "finished") {
        setWinner(r.status.winner ?? null);
        setNextTurn(null);
        setDisabledCells(new Set());
      } else {
        setNextTurn(r.status.next ?? null);
        setMoveCount(prev => prev + 1);
        
        // Host pushes state for pieces/dice that are not in the standard engine
        if (role === "host") {
            if (config?.mode === "master_hvh") {
                const newPiecesLeft = piecesLeft === 2 ? 1 : 2;
                setPiecesLeft(newPiecesLeft);
                socket.emit("variantUpdate", { code, piecesLeft: newPiecesLeft });
            } else if (config?.mode === "fortune_dice_hvh") {
                const newPiecesLeft = piecesLeft - 1;
                if (newPiecesLeft > 0) {
                    setPiecesLeft(newPiecesLeft);
                    socket.emit("variantUpdate", { code, piecesLeft: newPiecesLeft });
                } else {
                    const newDice = Math.floor(Math.random() * 6) + 1;
                    setDiceValue(newDice);
                    setPiecesLeft(newDice);
                    socket.emit("variantUpdate", { code, diceValue: newDice, piecesLeft: newDice });
                }
            }
        }
      }

      socket.emit("playMove", { code, cellId });
      setLoading(false);
    } catch (e: any) {
      message.error(e.message);
      setLoading(false);
    }
  }

  function handleSendChat() {
    if (!chatInput.trim()) return;
    socket.emit("sendMessage", { code, text: chatInput.trim() });
    setChatInput("");
  }

  function handleAbandon() {
    socket.emit("leaveRoom", code);
    if (role === "host" && gameId) {
      deleteHvhGame(gameId).catch(() => {});
    }
    navigate("/multiplayer");
  }

  const cells = useMemo(() => {
    return yen ? parseYenToCells(yen) : [];
  }, [yen]);

  function handleSwapRoles() {
    if (role === "guest" && moveCount === 1 && !swapped) {
        setSwapped(true);
        socket.emit("variantUpdate", { code, swapped: true });
        message.success("Has intercambiado roles.");
    }
  }

  const activeTurnColor = nextTurn === "player0" ? "#1677ff" : "#ff7b00";
  const goToLobby = () => navigate("/multiplayer");

  // ── Render board section ───────────────────────────────────────────
  function renderBoardSection() {
    if (error) {
      return <ErrorPanel errorMsg={error} onBack={goToLobby} />;
    }

    if (!gameId) {
      return <LoadingPanel />;
    }

    const borderStyle = !winner && nextTurn === myPlayer
      ? `3px solid ${myColor}`
      : "1px solid #f0f0f0";

    return (
      <GameShell
        title={getModeTitle(config?.mode)}
        subtitle={`Sala: ${code ?? ""} · Eres: ${myPlayer === "player0" ? "Azul" : "Naranja"}`}
        loading={loading}
        error={error}
        hasBoard={!!yen}
        emptyText="Error de conexión"
        onAbandon={handleAbandon}
        abandonDisabled={false}
        turnIndicator={
          <TurnIndicator
            winner={winner}
            nextTurn={nextTurn}
            myPlayer={myPlayer}
            activeTurnColor={activeTurnColor}
            mode={config?.mode}
            disabledCells={disabledCells}
            hasNewMessages={hasNewMessages}
            onOpenChat={() => { setIsChatOpen(true); setHasNewMessages(false); }}
          />
        }
        turnIndicatorExtra={
            <>
                {config?.mode === "master_hvh" && (
                     <Badge count={piecesLeft} overflowCount={9} style={{ backgroundColor: '#52c41a' }} />
                )}
                {config?.mode === "fortune_dice_hvh" && (
                     <Badge count={diceValue} overflowCount={9} style={{ backgroundColor: '#faad14' }} title="Valor del dado" />
                )}
                {config?.mode === "fortune_dice_hvh" && (
                     <Badge count={piecesLeft} overflowCount={9} style={{ backgroundColor: '#52c41a' }} title="Movimientos restantes" />
                )}
                {role === "guest" && config?.mode === "pastel_hvh" && moveCount === 1 && !swapped && (
                    <Button size="small" onClick={handleSwapRoles}>Intercambiar Roles (Regla Pastel)</Button>
                )}
            </>
        }
        board={
          <Card
            style={{
              width: "100%",
              overflow: "hidden",
              border: borderStyle,
              transition: "all 0.3s ease"
            }}
            styles={{ body: { padding: 12 } }}
          >
            <Board
              size={yen?.size ?? config?.size ?? 11}
              cells={cells}
              disabled={loading || !!winner || nextTurn !== myPlayer}
              onCellClick={handleCellClick}
              disabledCells={disabledCells}
            />
          </Card>
        }
        result={
          winner ? (
            <GameResult
              winner={winner}
              myPlayer={myPlayer}
              animationFinished={animationFinished}
              onAnimationComplete={() => setAnimationFinished(true)}
              onBack={goToLobby}
              mode={config?.mode}
            />
          ) : null
        }
      />
    );
  }

  return (
    <>
      <AppHeader title={`Multipayer: ${getModeTitle(config?.mode)}`} />
      
      <div style={{ maxWidth: 800, margin: "20px auto", padding: "0 15px" }}>
        <Flex gap={20} vertical align="center">
          <div style={{ width: "100%" }}>
            {renderBoardSection()}
          </div>
        </Flex>
      </div>

      {/* CHAT DESPLEGABLE (DRAWER) */}
      <Drawer
        title={<span><MessageOutlined /> Chat de Sala</span>}
        placement="right"
        onClose={() => setIsChatOpen(false)}
        open={isChatOpen}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' },
          wrapper: { width: 350 },
        }}
        mask={false}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: "15px 20px", background: "#fafafa" }}>
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item style={{ border: "none", padding: "4px 0", justifyContent: item.sender === myPlayer ? "flex-end" : "flex-start" }}>
                <Flex vertical align={item.sender === myPlayer ? "end" : "start"}>
                   <Flex align="center" gap={8} style={{ flexDirection: item.sender === myPlayer ? "row-reverse" : "row" }}>
                      <Avatar 
                        size="small" 
                        style={{ backgroundColor: item.sender === "player0" ? "#1677ff" : "#ff7b00" }}
                      >
                        {item.sender === "player0" ? "P0" : "P1"}
                      </Avatar>
                      <div style={{ 
                        background: item.sender === myPlayer ? "#1677ff" : "white", 
                        color: item.sender === myPlayer ? "white" : "inherit",
                        padding: "6px 12px", 
                        borderRadius: 12,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        maxWidth: 240,
                        wordWrap: 'break-word'
                      }}>
                        {item.text}
                      </div>
                   </Flex>
                   <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>
                     {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </Text>
                </Flex>
              </List.Item>
            )}
          />
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: 15, borderTop: "1px solid #f0f0f0" }}>
          <Flex gap={10}>
            <Input 
              placeholder="Escribe un mensaje..." 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              onPressEnter={handleSendChat}
              autoFocus
            />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSendChat} />
          </Flex>
        </div>
      </Drawer>
    </>
  );
}
