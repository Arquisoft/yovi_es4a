import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";

import { socket } from "../api/socket";
import {
  createHvhGame,
  deleteHvhGame,
  getHvhGame,
  getOrCreateClientId,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import { generateHoles, getAdjacentCells, hasPlayableCells } from "./variants";
import type { ChatMessage } from "../vistas/MultiplayerChatDrawer";

export type MultiplayerRole = "host" | "guest";
export type MultiplayerConfig = {
  size: number;
  mode: string;
};

export type MultiplayerPlayerProfile = {
  username: string | null;
  profilePicture: string | null;
};

export type MultiplayerPlayerProfiles = {
  player0: MultiplayerPlayerProfile;
  player1: MultiplayerPlayerProfile;
};

type UseMultiplayerGameSessionArgs = {
  code?: string;
  role?: MultiplayerRole;
  config?: MultiplayerConfig;
  onInvalidState: () => void;
  onLeaveLobby: () => void;
};

export type UseMultiplayerGameSessionResult = {
  gameId: string | null;
  yen: YEN | null;
  loading: boolean;
  gameOver?: boolean;
  winner: string | null;
  nextTurn: string | null;
  error: string;
  disabledCells: Set<number>;
  myPlayer: string;
  myColor: string;
  playerProfiles: MultiplayerPlayerProfiles;
  handleCellClick: (cellId: number) => Promise<void>;
  handleAbandon: () => Promise<void>;

  // Chat
  messages: ChatMessage[];
  hasNewMessages: boolean;
  setHasNewMessages: (val: boolean) => void;
  handleSendChat: (text: string) => void;

  piecesLeft: number;
  diceValue: number;
};

export function useMultiplayerGameSession({
  code,
  role,
  config,
  onInvalidState,
  onLeaveLobby,
}: UseMultiplayerGameSessionArgs): UseMultiplayerGameSessionResult {
  const [gameId, setGameId] = useState<string | null>(null);
  const [yen, setYen] = useState<YEN | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [nextTurn, setNextTurn] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hostClientId, setHostClientId] = useState<string | null>(null);
  const [disabledCells, setDisabledCells] = useState<Set<number>>(new Set());
  const [holes, setHoles] = useState<Set<number>>(new Set());
  const [playerProfiles, setPlayerProfiles] =
    useState<MultiplayerPlayerProfiles>({
      player0: { username: null, profilePicture: null },
      player1: { username: null, profilePicture: null },
    });

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Variants state
  const [piecesLeft, setPiecesLeft] = useState(1);
  const [diceValue, setDiceValue] = useState(1);

  const myPlayer = useMemo(() => {
    return role === "guest" ? "player1" : "player0";
  }, [role]);

  const myColor = myPlayer === "player0" ? "#1677ff" : "#ff7b00";

  const refreshGameState = useCallback(
    async (
      gId: string,
      overrideId?: string,
      lastMoveCellId?: number,
      forcedHoles?: Set<number>,
    ) => {
      try {
        const effectiveOverrideId =
          overrideId ||
          (role === "guest" && hostClientId ? hostClientId : undefined);

        const r = await getHvhGame(gId, effectiveOverrideId);
        setYen(r.yen);

        const nextBlockedCells =
          config?.mode === "tabu_hvh" && lastMoveCellId !== undefined
            ? getAdjacentCells(lastMoveCellId, r.yen.size)
            : config?.mode === "holey_hvh"
              ? forcedHoles || holes
              : new Set<number>();

        setDisabledCells(nextBlockedCells);

        if (r.status.state === "finished") {
          setGameOver(true);
          setWinner(r.status.winner ?? null);
          setNextTurn(null);
          setDisabledCells(new Set());
        }
        else {
          if (!hasPlayableCells(r.yen, nextBlockedCells)) {
            setGameOver(true);
            setWinner(null);
            setNextTurn(null);
            return;
          }

          setGameOver(false);
          setWinner(null);
          setNextTurn(r.status.next ?? null);
        }
      }
      catch (e: any) {
        setError(e?.message ?? String(e));
      }
      finally {
        setLoading(false);
      }
    },
    [config?.mode, hostClientId, holes, role],
  );

  useEffect(() => {
    if (!socket.connected)
      socket.connect();

    let cancelled = false;

    async function initHost() {
      try {
        const initialTurn: "player0" | "player1" = config?.mode === "fortune_coin_hvh"
          ? (Math.random() < 0.5 ? "player0" : "player1")
          : "player0";

        await putConfig({
          size: config!.size,
          hvb_starter: "human",
          hvh_starter: initialTurn,
          bot_id: null,
        });

        const r = await createHvhGame({
          size: config!.size,
          hvh_starter: initialTurn,
        });

        if (cancelled)
          return;

        const extra: Record<string, unknown> = {};
        if (config?.mode === "holey_hvh") {
          const totalCells = (config.size * (config.size + 1)) / 2;
          const generatedHoles = generateHoles(totalCells);
          setHoles(generatedHoles);
          setDisabledCells(generatedHoles);
          extra.holes = Array.from(generatedHoles);
        }
        else {
          setHoles(new Set());
          setDisabledCells(new Set());
        }

        if (config?.mode === "master_hvh") {
          setPiecesLeft(1);
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
        setGameOver(r.status.state === "finished");
        setWinner(r.status.state === "finished" ? r.status.winner ?? null : null);
        setNextTurn(r.status.next ?? null);

        const myClientId = getOrCreateClientId();
        socket.emit("startGame", {
          code,
          gameId: r.game_id,
          hostClientId: myClientId,
          extra,
        });
      }
      catch (e: any) {
        if (!cancelled)
          setError(e?.message ?? String(e));
      }
      finally {
        if (!cancelled)
          setLoading(false);
      }
    }

    setError("");
    setLoading(true);
    setGameId(null);
    setYen(null);
    setGameOver(false);
    setWinner(null);
    setNextTurn(null);
    setHostClientId(null);
    setPlayerProfiles({
      player0: { username: null, profilePicture: null },
      player1: { username: null, profilePicture: null },
    });

    if (role === "host" && config && code)
      void initHost();
    else if (role === "guest" && code)
      setLoading(true);
    else
      onInvalidState();

    return () => {
      cancelled = true;
    };
  }, [code, role, config, onInvalidState]);

  useEffect(() => {
    function onGameStarted({
      gameId: startedGameId,
      hostClientId: startedHostClientId,
      extra,
      players,
    }: any) {
      setPlayerProfiles({
        player0: {
          username: players?.player0?.username ?? null,
          profilePicture: players?.player0?.profilePicture ?? null,
        },
        player1: {
          username: players?.player1?.username ?? null,
          profilePicture: players?.player1?.profilePicture ?? null,
        },
      });

      if (role !== "guest")
        return;

      setGameId(startedGameId);
      setHostClientId(startedHostClientId);

      if (extra?.holes) {
        const holesSet = new Set<number>(extra.holes);
        setHoles(holesSet);
        void refreshGameState(
          startedGameId,
          startedHostClientId,
          undefined,
          holesSet,
        );
      }
      else {
        setHoles(new Set());
        void refreshGameState(startedGameId, startedHostClientId);
      }

      if (extra?.piecesLeft !== undefined) setPiecesLeft(extra.piecesLeft);
      if (extra?.diceValue !== undefined) setDiceValue(extra.diceValue);
      if (extra?.nextTurnOverride !== undefined) {
        setNextTurn(extra.nextTurnOverride);
        message.info(`🪙 ¡Moneda! Empieza ${extra.nextTurnOverride === "player0" ? "Azul" : "Naranja"}`);
      }
    }

    function onEnemyMove({ cellId }: { cellId: number }) {
      if (!gameId)
        return;
      void refreshGameState(gameId, hostClientId ?? undefined, cellId);

      // Multi-turn variants
      if (config?.mode === "master_hvh" || config?.mode === "fortune_dice_hvh") {
        setPiecesLeft(prev => (prev > 1 ? prev - 1 : (config.mode === "master_hvh" ? 2 : prev)));
      }
    }

    function onVariantUpdate(update: any) {
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

    function onChatMessage(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
      // We don't know if chat is open here, so we'll just set hasNewMessages to true
      // The component can reset it when opening
      setHasNewMessages(true);
    }

    socket.on("gameStarted", onGameStarted);
    socket.on("enemyMove", onEnemyMove);
    socket.on("variantUpdate", onVariantUpdate);
    socket.on("chatMessage", onChatMessage);
    socket.on("playerDisconnected", onPlayerDisconnected);

    return () => {
      socket.off("gameStarted", onGameStarted);
      socket.off("enemyMove", onEnemyMove);
      socket.off("variantUpdate", onVariantUpdate);
      socket.off("chatMessage", onChatMessage);
      socket.off("playerDisconnected", onPlayerDisconnected);
    };
  }, [gameId, hostClientId, refreshGameState, role, config]);

  const handleCellClick = useCallback(
    async (cellId: number) => {
      if (
        !gameId ||
        nextTurn !== myPlayer ||
        loading ||
        gameOver ||
        !!error ||
        disabledCells.has(cellId)
      ) {
        return;
      }

      setLoading(true);

      try {
        const overrideClientId =
          role === "guest" && hostClientId ? hostClientId : undefined;

        const nextPlayerInt = myPlayer === "player0" ? 0 : 1;
        let nextPlayerOverride: number | undefined = undefined;

        if (config?.mode === "master_hvh") {
          const newPiecesLeft = piecesLeft === 2 ? 1 : 2;
          if (newPiecesLeft === 1) nextPlayerOverride = nextPlayerInt;
        } else if (config?.mode === "fortune_dice_hvh") {
          if (piecesLeft > 1) nextPlayerOverride = nextPlayerInt;
        } else if (role === "host" && config?.mode === "fortune_coin_hvh") {
          const next = Math.random() < 0.5 ? 0 : 1;
          nextPlayerOverride = next;
          const nextStr = next === 0 ? "player0" : "player1";
          socket.emit("variantUpdate", { code, nextTurnOverride: nextStr });
          message.info(`🪙 ¡Moneda! Turno para ${next === 0 ? "Azul" : "Naranja"}`);
        }

        const r = await hvhMove(gameId, cellId, overrideClientId, nextPlayerOverride);
        setYen(r.yen);

        const nextBlockedCells =
          config?.mode === "tabu_hvh"
            ? getAdjacentCells(cellId, r.yen.size)
            : config?.mode === "holey_hvh"
              ? holes
              : new Set<number>();

        if (config?.mode === "tabu_hvh")
          setDisabledCells(nextBlockedCells);

        if (r.status.state === "finished") {
          setGameOver(true);
          setWinner(r.status.winner ?? null);
          setNextTurn(null);
          setDisabledCells(new Set());
        }
        else {
          if (!hasPlayableCells(r.yen, nextBlockedCells)) {
            setGameOver(true);
            setWinner(null);
            setNextTurn(null);
            socket.emit("finishGame", { code, winner: null });
            return;
          }

          setGameOver(false);
          setWinner(null);
          setNextTurn(r.status.next ?? null);

          // Update local pieces/dice
          if (config?.mode === "master_hvh" || config?.mode === "fortune_dice_hvh") {
            if (r.status.next !== myPlayer) {
              if (config.mode === "master_hvh") setPiecesLeft(2);
            } else {
              setPiecesLeft(prev => prev - 1);
            }
          }

          // Host pushes state for pieces/dice
          if (role === "host") {
            if (config?.mode === "master_hvh") {
              const newPiecesLeft = piecesLeft === 2 ? 1 : 2;
              socket.emit("variantUpdate", { code, piecesLeft: newPiecesLeft });
            } else if (config?.mode === "fortune_dice_hvh") {
              const remaining = piecesLeft - 1;
              if (remaining > 0) {
                socket.emit("variantUpdate", { code, piecesLeft: remaining });
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

        if (r.status.state === "finished") {
          socket.emit("finishGame", {
            code,
            winner: r.status.winner ?? null,
          });
        }
      }
      catch (e: any) {
        message.error(e?.message ?? String(e));
      }
      finally {
        setLoading(false);
      }
    },
    [
      code,
      config,
      disabledCells,
      error,
      gameId,
      hostClientId,
      loading,
      myPlayer,
      nextTurn,
      role,
      gameOver,
      piecesLeft,
      holes,
    ],
  );

  const handleAbandon = useCallback(async () => {
    socket.emit("leaveRoom", { code });

    if (role === "host" && gameId) {
      try {
        await deleteHvhGame(gameId);
      }
      catch {
        // silencioso
      }
    }

    onLeaveLobby();
  }, [code, gameId, onLeaveLobby, role]);

  const handleSendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    socket.emit("sendMessage", { code, text: text.trim() });
  }, [code]);

  return {
    gameId,
    yen,
    loading,
    gameOver,
    winner,
    nextTurn,
    error,
    disabledCells,
    myPlayer,
    myColor,
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
  };
}

