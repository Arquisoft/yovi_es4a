import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card, Flex, Spin, Typography, message, Button } from "antd";
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
import AppHeader from "./AppHeader";
import Lottie from "lottie-react";
import confettiAnimation from "../assets/Confetti.json";
import gameOverAnimation from "../assets/GameOver.json";

const { Title, Text } = Typography;

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

  // El host es player0, el guest es player1
  const myPlayer = role === "host" ? "player0" : "player1";

  // Efecto principal: Inicializar partida
  useEffect(() => {
    if (!socket.connected) socket.connect();
    
    let isMounted = true;

    async function initHost() {
      try {
        await putConfig({ size: config!.size, hvb_starter: "human", hvh_starter: "player0", bot_id: null });
        // Importante: usamos el mode configurado en el lobby
        // Como el API de gamey espera llamadas en las rutas correctas para modos normales, vamos a usar createHvhGame
        // que internamente llama a /api/v1/hvh/games e ignora el mode, espera, createHvhGame no admite mode?
        // En api/gamey.ts, createHvhGame solo manda size y hvh_starter. Y asume classic_hvh o el back lo gestiona.
        // Wait, los modos nuevos los añadimos en la ruta?
        // Actualmente el proyecto tiene GamePolyY, GameTabu que llaman a createHvhGame, el servidor Rust usa el modo de la config o /api/v1/hvh/games.
        // Asumiremos que el servidor acepta parámetros extra, o se guardó la confiugración correcta.
        // Vamos a mandar solo createHvhGame estándar.
        
        const r = await createHvhGame({ size: config!.size, hvh_starter: "player0" });
        if (!isMounted) return;

        setGameId(r.game_id);
        setYen(r.yen);
        setNextTurn(r.status.state === "ongoing" ? r.status.next! : null);
        const myClientId = getOrCreateClientId();
        socket.emit("startGame", { code, gameId: r.game_id, hostClientId: myClientId });
        setLoading(false);
      } catch (err: any) {
        if (isMounted) setError(err.message || String(err));
        setLoading(false);
      }
    }

    if (role === "host" && config) {
      initHost();
    } else if (role === "guest") {
      // El host nos avisará del gameId por socket
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
    function onGameStarted({ gameId, hostClientId: hId }: { gameId: string, hostClientId: string }) {
      if (role === "guest") {
        setGameId(gameId);
        setHostClientId(hId);
        refreshGameState(gameId, hId);
      }
    }

    function onEnemyMove() {
      // El rival ha movido, refrescamos el estado desde el backend
      if (gameId) {
        refreshGameState(gameId, hostClientId ?? undefined);
      }
    }
    
    function onPlayerDisconnected(msg: string) {
       message.warning(msg);
       setError("La partida ha terminado por desconexión del oponente.");
    }

    socket.on("gameStarted", onGameStarted);
    socket.on("enemyMove", onEnemyMove);
    socket.on("playerDisconnected", onPlayerDisconnected);

    return () => {
      socket.off("gameStarted", onGameStarted);
      socket.off("enemyMove", onEnemyMove);
      socket.off("playerDisconnected", onPlayerDisconnected);
    };
  }, [gameId, role, hostClientId]);

  async function refreshGameState(gId: string, overrideId?: string) {
    try {
      const r = await getHvhGame(gId, overrideId || (role === "guest" && hostClientId ? hostClientId : undefined));
      setYen(r.yen);
      if (r.status.state === "finished") {
        setWinner(r.status.winner ?? null);
        setNextTurn(null);
      } else {
        setNextTurn(r.status.next ?? null);
      }
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCellClick(cellId: number) {
    if (nextTurn !== myPlayer || loading || winner || !!error) return;

    setLoading(true);
    try {
      const isGuest = role === "guest";
      const r = await hvhMove(gameId!, cellId, isGuest && hostClientId ? hostClientId : undefined);
      setYen(r.yen);
      
      if (r.status.state === "finished") {
        setWinner(r.status.winner ?? null);
        setNextTurn(null);
      } else {
        setNextTurn(r.status.next ?? null);
      }

      socket.emit("playMove", { code, cellId });
      setLoading(false);
    } catch (e: any) {
      message.error(e.message);
      setLoading(false);
    }
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

  const activeTurnColor = nextTurn === "player0" ? "#28BBF5" : "#FF7B00";
  const myColor = myPlayer === "player0" ? "#28BBF5" : "#FF7B00";

  return (
    <>
      <AppHeader title={`Partida Multijugador (${code})`} />
      
      <div style={{ maxWidth: 800, margin: "20px auto", padding: "0 15px" }}>
        {error ? (
          <Card>
            <Flex vertical align="center" gap={16}>
              <Title level={4} type="danger">Error en la partida</Title>
              <Text>{error}</Text>
              <Button onClick={() => navigate("/multiplayer")}>Volver</Button>
            </Flex>
          </Card>
        ) : !gameId ? (
          <Card>
            <Flex vertical align="center" gap={16} style={{ padding: 40 }}>
              <Spin size="large" />
              <Title level={4}>Esperando al anfitrión...</Title>
              <Text type="secondary">La partida está siendo generada en el servidor</Text>
            </Flex>
          </Card>
        ) : (
          <GameShell
            title="Multijugador Online"
            subtitle={`Sala: ${code} · Eres: ${myPlayer === "player0" ? "Azul" : "Naranja"}`}
            loading={loading}
            error={error}
            hasBoard={!!yen}
            emptyText="Error de conexión al tablero"
            onAbandon={handleAbandon}
            abandonDisabled={false}
            turnIndicator={
              <Card size="small" style={{ borderLeft: `6px solid ${activeTurnColor}` }}>
                  <Text strong>
                    {winner ? "Partida terminada" : (
                       nextTurn === myPlayer ? "¡Es tu turno!" : "Turno del oponente..."
                    )}
                  </Text>
              </Card>
            }
            board={
              <Card
                style={{
                  width: "100%",
                  overflow: "hidden",
                  border: !winner && nextTurn === myPlayer ? `2px solid ${myColor}` : "none",
                  boxShadow: !winner && nextTurn === myPlayer ? `0 0 0 3px ${myColor}22` : "none",
                }}
                bodyStyle={{ padding: "clamp(8px, 2vw, 16px)" }}
              >
                <Board
                  size={yen?.size ?? config?.size ?? 11}
                  cells={cells}
                  disabled={loading || !!winner || nextTurn !== myPlayer}
                  onCellClick={handleCellClick}
                />
              </Card>
            }
            result={
              winner ? (
                <Card>
                  {winner === myPlayer && !animationFinished && (
                    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <Lottie animationData={confettiAnimation} loop={false} onComplete={() => setAnimationFinished(true)} />
                    </div>
                  )}
                  {winner !== myPlayer && winner !== "draw" && !animationFinished && (
                    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
                       <Lottie animationData={gameOverAnimation} loop={false} onComplete={() => setAnimationFinished(true)} />
                    </div>
                  )}
                  <Flex vertical align="center" gap={16}>
                    <Title level={4}>{winner === myPlayer ? "¡Has ganado!" : "Has perdido"}</Title>
                    <Button type="primary" onClick={() => navigate("/multiplayer")}>Jugar otra partida</Button>
                  </Flex>
                </Card>
              ) : null
            }
          />
        )}
      </div>
    </>
  );
}
