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
import { generateHoles, getAdjacentCells } from "./variants";

export type MultiplayerRole = "host" | "guest";
export type MultiplayerConfig = {
  size: number;
  mode: string;
};

type UseMultiplayerGameSessionArgs = {
  code?: string;
  role?: MultiplayerRole;
  config?: MultiplayerConfig;
  onInvalidState: () => void;
  onLeaveLobby: () => void;
};

export function useMultiplayerGameSession({
  code,
  role,
  config,
  onInvalidState,
  onLeaveLobby,
}: UseMultiplayerGameSessionArgs) {
  const [gameId, setGameId] = useState<string | null>(null);
  const [yen, setYen] = useState<YEN | null>(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [nextTurn, setNextTurn] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hostClientId, setHostClientId] = useState<string | null>(null);
  const [disabledCells, setDisabledCells] = useState<Set<number>>(new Set());
  const [holes, setHoles] = useState<Set<number>>(new Set());

  const myPlayer = useMemo(
    () => (role === "guest" ? "player1" : "player0"),
    [role],
  );

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

        if (config?.mode === "tabu_hvh" && lastMoveCellId !== undefined)
          setDisabledCells(getAdjacentCells(lastMoveCellId, r.yen.size));
        else if (config?.mode === "holey_hvh")
          setDisabledCells(forcedHoles || holes);
        else
          setDisabledCells(new Set());      

        if (r.status.state === "finished") {
          setWinner(r.status.winner ?? null);
          setNextTurn(null);
          setDisabledCells(new Set());
        }
        else {
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
        await putConfig({
          size: config!.size,
          hvb_starter: "human",
          hvh_starter: "player0",
          bot_id: null,
        });

        const r = await createHvhGame({
          size: config!.size,
          hvh_starter: "player0",
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

        setGameId(r.game_id);
        setYen(r.yen);
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
    setWinner(null);
    setNextTurn(null);
    setHostClientId(null);

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
    }: any) {
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
    }

    function onEnemyMove({ cellId }: { cellId: number }) {
      if (!gameId)
        return;
      void refreshGameState(gameId, hostClientId ?? undefined, cellId);
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
  }, [gameId, hostClientId, refreshGameState, role]);

  const handleCellClick = useCallback(
    async (cellId: number) => {
      if (
        !gameId ||
        nextTurn !== myPlayer ||
        loading ||
        winner ||
        !!error ||
        disabledCells.has(cellId)
      ) {
        return;
      }

      setLoading(true);

      try {
        const overrideClientId =
          role === "guest" && hostClientId ? hostClientId : undefined;

        const r = await hvhMove(gameId, cellId, overrideClientId);
        setYen(r.yen);

        if (config?.mode === "tabu_hvh")
          setDisabledCells(new Set());

        if (r.status.state === "finished") {
          setWinner(r.status.winner ?? null);
          setNextTurn(null);
          setDisabledCells(new Set());
        }
        else {
          setWinner(null);
          setNextTurn(r.status.next ?? null);
        }

        socket.emit("playMove", { code, cellId });
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
      config?.mode,
      disabledCells,
      error,
      gameId,
      hostClientId,
      loading,
      myPlayer,
      nextTurn,
      role,
      winner,
    ],
  );

  const handleAbandon = useCallback(async () => {
    socket.emit("leaveRoom", code);

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

  return {
    gameId,
    yen,
    loading,
    winner,
    nextTurn,
    error,
    disabledCells,
    myPlayer,
    myColor,
    handleCellClick,
    handleAbandon,
  };
}