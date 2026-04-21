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

function resolveWinnerByMode(
  winner: string | null,
  mode?: string,
): string | null {
  if (mode === "why_not_hvh") {
    if (winner === "player0")
      return "player1";
    if (winner === "player1")
      return "player0";
  }

  return winner;
}

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

        const nextBlockedCells =
          config?.mode === "tabu_hvh" && lastMoveCellId !== undefined
            ? getAdjacentCells(lastMoveCellId, r.yen.size)
            : config?.mode === "holey_hvh"
              ? (forcedHoles || holes)
              : new Set<number>();

        setDisabledCells(nextBlockedCells);

        if (r.status.state === "finished") {
          setGameOver(true);
          setWinner(resolveWinnerByMode(r.status.winner ?? null, config?.mode));
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
        setGameOver(r.status.state === "finished");
        setWinner(
          r.status.state === "finished"
            ? resolveWinnerByMode(r.status.winner ?? null, config?.mode)
            : null,
        );
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

        const r = await hvhMove(gameId, cellId, overrideClientId);
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
          const resolvedWinner = resolveWinnerByMode(
            r.status.winner ?? null,
            config?.mode,
          );

          setGameOver(true);
          setWinner(resolvedWinner);
          setNextTurn(null);
          setDisabledCells(new Set());

          socket.emit("playMove", { code, cellId });

          if (resolvedWinner) {
            socket.emit("finishGame", {
              code,
              winner: resolvedWinner,
            });
          }

          return;
        }

        if (!hasPlayableCells(r.yen, nextBlockedCells)) {
          setGameOver(true);
          setWinner(null);
          setNextTurn(null);
          socket.emit("playMove", { code, cellId });
          socket.emit("finishGame", { code, winner: null });
          return;
        }

        setGameOver(false);
        setWinner(null);
        setNextTurn(r.status.next ?? null);

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
      gameOver,
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
  };
}
