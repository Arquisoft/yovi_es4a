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

type MultiplayerPastelPhase = "place_neutral" | "pie_choice" | "playing";

type MultiplayerPastelState = {
  phase: MultiplayerPastelPhase;
  neutralCellId: number | null;
  swapped: boolean;
  firstPlayer: "player0" | "player1";
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
  displayMyPlayer: string;
  myColor: string;
  playerProfiles: MultiplayerPlayerProfiles;
  handleCellClick: (cellId: number) => Promise<void>;
  handleAbandon: () => Promise<void>;
  handlePastelSwap: () => void;
  handlePastelPass: () => void;
  neutralCells: Set<number>;
  pastelState: MultiplayerPastelState | null;

  // Chat
  messages: ChatMessage[];
  hasNewMessages: boolean;
  setHasNewMessages: (val: boolean) => void;
  handleSendChat: (text: string) => void;

  piecesLeft: number;
  diceValue: number;
};

function swapPlayer(player: string | null): string | null {
  if (player === "player0") return "player1";
  if (player === "player1") return "player0";
  return player;
}

function mapWinnerForMode(
  mode: string | undefined,
  winner: string | null,
  swapped = false,
): string | null {
  let resolved = winner;

  if (mode === "why_not_hvh" || mode === "whynot_hvh") {
    resolved = swapPlayer(resolved);
  }

  if (mode === "pastel_hvh" && swapped) {
    resolved = swapPlayer(resolved);
  }

  return resolved;
}

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
  const [pastelState, setPastelState] = useState<MultiplayerPastelState | null>(
    null,
  );

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Variants state
  const [piecesLeft, setPiecesLeft] = useState(1);
  const [diceValue, setDiceValue] = useState(1);

  const myPlayer = useMemo(() => {
    return role === "guest" ? "player1" : "player0";
  }, [role]);

  const displayMyPlayer = useMemo(() => {
    if (config?.mode !== "pastel_hvh" || !pastelState?.swapped) {
      return myPlayer;
    }

    return swapPlayer(myPlayer) ?? myPlayer;
  }, [config?.mode, myPlayer, pastelState?.swapped]);

  const myColor = displayMyPlayer === "player0" ? "#1677ff" : "#ff7b00";

  const neutralCells = useMemo(() => {
    if (
      config?.mode !== "pastel_hvh" ||
      pastelState?.phase !== "pie_choice" ||
      pastelState.neutralCellId == null
    ) {
      return new Set<number>();
    }

    return new Set<number>([pastelState.neutralCellId]);
  }, [config?.mode, pastelState]);

  const displayNextTurn = useMemo(() => {
    if (config?.mode !== "pastel_hvh" || !pastelState) {
      return nextTurn;
    }

    if (pastelState.phase === "place_neutral") {
      return pastelState.firstPlayer;
    }

    if (pastelState.phase === "pie_choice") {
      return swapPlayer(pastelState.firstPlayer);
    }

    if (!pastelState.swapped) {
      return nextTurn;
    }

    return swapPlayer(nextTurn);
  }, [config?.mode, nextTurn, pastelState]);

  const displayWinner = useMemo(() => {
    return mapWinnerForMode(config?.mode, winner, pastelState?.swapped);
  }, [config?.mode, pastelState?.swapped, winner]);

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
          setNextTurn(r.status.state === "ongoing" ? r.status.next : null);
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
        if (config?.mode === "pastel_hvh") {
          const firstPlayer =
            (r.status.state === "ongoing"
              ? r.status.next
              : initialTurn) === "player1"
              ? "player1"
              : "player0";
          const nextPastelState: MultiplayerPastelState = {
            phase: "place_neutral",
            neutralCellId: null,
            swapped: false,
            firstPlayer,
          };

          setPastelState(nextPastelState);
          extra.pastel = nextPastelState;
        } else {
          setPastelState(null);
        }

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
          setPiecesLeft(2);
          extra.piecesLeft = 2;
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
        setNextTurn(r.status.state === "ongoing" ? r.status.next ?? null : null);

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
    setPastelState(null);
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
      setPastelState(extra?.pastel ?? null);

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

    }

    function onVariantUpdate(update: any) {
      if (update.piecesLeft !== undefined) setPiecesLeft(update.piecesLeft);
      if (update.diceValue !== undefined) setDiceValue(update.diceValue);
      if (update.pastel !== undefined) setPastelState(update.pastel);
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

  const handlePastelDecision = useCallback((swapped: boolean) => {
    if (config?.mode !== "pastel_hvh" || !pastelState || pastelState.phase !== "pie_choice") {
      return;
    }

    const decisionPlayer = swapPlayer(pastelState.firstPlayer);
    if (decisionPlayer !== myPlayer) {
      return;
    }

    const nextPastelState: MultiplayerPastelState = {
      ...pastelState,
      phase: "playing",
      swapped,
    };

    setPastelState(nextPastelState);
    socket.emit("variantUpdate", { code, pastel: nextPastelState });
  }, [code, config?.mode, myPlayer, pastelState]);

  const handlePastelSwap = useCallback(() => {
    handlePastelDecision(true);
  }, [handlePastelDecision]);

  const handlePastelPass = useCallback(() => {
    handlePastelDecision(false);
  }, [handlePastelDecision]);

  const handleCellClick = useCallback(
    async (cellId: number) => {
      if (config?.mode === "pastel_hvh" && pastelState?.phase === "pie_choice") {
        return;
      }

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

        if (config?.mode === "pastel_hvh" && pastelState?.phase === "place_neutral") {
          const r = await hvhMove(gameId, cellId, overrideClientId);
          setYen(r.yen);
          setNextTurn(r.status.state === "ongoing" ? r.status.next ?? null : null);

          const nextPastelState: MultiplayerPastelState = {
            ...(pastelState ?? {
              phase: "place_neutral",
              neutralCellId: null,
              swapped: false,
              firstPlayer: myPlayer === "player1" ? "player1" : "player0",
            }),
            phase: "pie_choice",
            neutralCellId: cellId,
          };

          setPastelState(nextPastelState);
          socket.emit("playMove", { code, cellId });
          socket.emit("variantUpdate", { code, pastel: nextPastelState });
          return;
        }

        const nextPlayerInt = myPlayer === "player0" ? 0 : 1;
        let nextPlayerOverride: number | undefined = undefined;

        if (config?.mode === "master_hvh") {
          const remainingAfterMove = piecesLeft === 2 ? 1 : 2;
          if (remainingAfterMove === 1) nextPlayerOverride = nextPlayerInt;
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

          // Host is authoritative for multi-turn counters and syncs guests via variantUpdate.
          if (config?.mode === "master_hvh") {
            const nextPiecesLeft = r.status.next === myPlayer ? 1 : 2;
            setPiecesLeft(nextPiecesLeft);

            if (role === "host") {
              socket.emit("variantUpdate", { code, piecesLeft: nextPiecesLeft });
            }
          } else if (config?.mode === "fortune_dice_hvh") {
            if (r.status.next === myPlayer) {
              const remaining = piecesLeft - 1;
              setPiecesLeft(remaining);

              if (role === "host") {
                socket.emit("variantUpdate", { code, piecesLeft: remaining });
              }
            } else {
              let nextPiecesLeft = piecesLeft;
              let nextDiceValue = diceValue;

              if (role === "host") {
                nextDiceValue = Math.floor(Math.random() * 6) + 1;
                nextPiecesLeft = nextDiceValue;
              }

              setDiceValue(nextDiceValue);
              setPiecesLeft(nextPiecesLeft);

              if (role === "host") {
                socket.emit("variantUpdate", {
                  code,
                  diceValue: nextDiceValue,
                  piecesLeft: nextPiecesLeft,
                });
              }
            }
          }
        }

        socket.emit("playMove", { code, cellId });

        if (r.status.state === "finished") {
          socket.emit("finishGame", {
            code,
            winner: mapWinnerForMode(
              config?.mode,
              r.status.winner ?? null,
              pastelState?.swapped,
            ),
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
      pastelState,
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
    winner: displayWinner,
    nextTurn: displayNextTurn,
    error,
    disabledCells,
    myPlayer,
    displayMyPlayer,
    myColor,
    playerProfiles,
    handleCellClick,
    handleAbandon,
    handlePastelSwap,
    handlePastelPass,
    neutralCells,
    pastelState,
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

