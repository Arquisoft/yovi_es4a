import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useMultiplayerGameSession } from "../game/useMultiplayerGameSession";
import { socket } from "../api/socket";
import {
  putConfig,
  createHvhGame,
  getOrCreateClientId,
  getHvhGame,
  hvhMove,
  deleteHvhGame,
} from "../api/gamey";
import { generateHoles, getAdjacentCells } from "../game/variants";
import { message } from "antd";

vi.mock("../api/socket", () => ({
  socket: {
    connected: false,
    connect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../api/gamey", () => ({
  putConfig: vi.fn(),
  createHvhGame: vi.fn(),
  getOrCreateClientId: vi.fn(),
  getHvhGame: vi.fn(),
  hvhMove: vi.fn(),
  deleteHvhGame: vi.fn(),
}));

vi.mock("../game/variants", () => ({
  generateHoles: vi.fn(),
  getAdjacentCells: vi.fn(),
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");
  return {
    ...actual,
    message: {
      warning: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe("useMultiplayerGameSession", () => {
  const mockedSocket = vi.mocked(socket);
  const mockedPutConfig = vi.mocked(putConfig);
  const mockedCreateHvhGame = vi.mocked(createHvhGame);
  const mockedGetOrCreateClientId = vi.mocked(getOrCreateClientId);
  const mockedGetHvhGame = vi.mocked(getHvhGame);
  const mockedHvhMove = vi.mocked(hvhMove);
  const mockedDeleteHvhGame = vi.mocked(deleteHvhGame);
  const mockedGenerateHoles = vi.mocked(generateHoles);
  const mockedGetAdjacentCells = vi.mocked(getAdjacentCells);
  const mockedMessage = vi.mocked(message);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedCreateHvhGame.mockResolvedValue({
      game_id: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      status: { state: "ongoing", next: "player0" },
    } as any);

    mockedPutConfig.mockResolvedValue({} as any);
    mockedGetOrCreateClientId.mockReturnValue("client-123");
    mockedGenerateHoles.mockReturnValue(new Set<number>([1, 3]));
    mockedGetAdjacentCells.mockReturnValue(new Set<number>([5, 6]));
    mockedGetHvhGame.mockResolvedValue({
      game_id: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      status: { state: "ongoing", next: "player1" },
    } as any);
    mockedHvhMove.mockResolvedValue({
      yen: { size: 11, layout: "BB/.R/..." },
      status: { state: "ongoing", next: "player1" },
    } as any);
    mockedDeleteHvhGame.mockResolvedValue({ deleted: true } as any);
  });

  it("inicializa la partida como host", async () => {
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "host",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await waitFor(() => {
      expect(mockedCreateHvhGame).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
    });

    expect(mockedPutConfig).toHaveBeenCalledWith({
      size: 11,
      hvb_starter: "human",
      hvh_starter: "player0",
      bot_id: null,
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith("startGame", {
      code: "ROOM1",
      gameId: "game-1",
      hostClientId: "client-123",
      extra: {},
    });

    expect(result.current.myPlayer).toBe("player0");
    expect(result.current.nextTurn).toBe("player0");
  });

  it("redirige si el estado inicial es inválido", () => {
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    renderHook(() =>
      useMultiplayerGameSession({
        code: undefined,
        role: undefined,
        config: undefined,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    expect(onInvalidState).toHaveBeenCalled();
  });

  it("registra listeners de socket", () => {
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    expect(mockedSocket.on).toHaveBeenCalledWith(
      "gameStarted",
      expect.any(Function),
    );
    expect(mockedSocket.on).toHaveBeenCalledWith(
      "enemyMove",
      expect.any(Function),
    );
    expect(mockedSocket.on).toHaveBeenCalledWith(
      "playerDisconnected",
      expect.any(Function),
    );
  });

  it("maneja un movimiento válido", async () => {
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "host",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
    });

    await act(async () => {
      await result.current.handleCellClick(7);
    });

    expect(mockedHvhMove).toHaveBeenCalledWith("game-1", 7, undefined);
    expect(mockedSocket.emit).toHaveBeenCalledWith("playMove", {
      code: "ROOM1",
      cellId: 7,
    });

    await waitFor(() => {
      expect(result.current.nextTurn).toBe("player1");
    });
  });

  it("emite finishGame cuando la jugada termina la partida", async () => {
    mockedHvhMove.mockResolvedValueOnce({
      yen: { size: 11, layout: "FINAL" },
      status: { state: "finished", winner: "player0" },
    } as any);

    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "host",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
    });

    await act(async () => {
      await result.current.handleCellClick(9);
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith("playMove", {
      code: "ROOM1",
      cellId: 9,
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith("finishGame", {
      code: "ROOM1",
      winner: "player0",
    });

    await waitFor(() => {
      expect(result.current.winner).toBe("player0");
      expect(result.current.nextTurn).toBeNull();
    });
  });

  it("abandona la sala y borra la partida si es host", async () => {
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "host",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
    });

    await act(async () => {
      await result.current.handleAbandon();
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith("leaveRoom", { code: "ROOM1" });
    expect(mockedDeleteHvhGame).toHaveBeenCalledWith("game-1");
    expect(onLeaveLobby).toHaveBeenCalled();
  });

  it("muestra warning cuando el rival se desconecta", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    mockedSocket.on.mockImplementation(
      (event: string, handler: (payload: any) => void) => {
        handlers[event] = handler;
        return mockedSocket as any;
      },
    );

    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();
    const config = { size: 11, mode: "classic_hvh" } as const;

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await waitFor(() => {
      expect(handlers.playerDisconnected).toBeTypeOf("function");
    });

    await act(async () => {
      handlers.playerDisconnected?.("El rival se ha desconectado de la partida.");
    });

    expect(mockedMessage.warning).toHaveBeenCalledWith(
      "El rival se ha desconectado de la partida.",
    );

    await waitFor(() => {
      expect(result.current.error).toBe(
        "La partida ha terminado por desconexión del oponente.",
      );
    });
  });
});