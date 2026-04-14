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
  const socketMock = socket as any;
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
    vi.resetAllMocks();

    socketMock.connected = false;
    socketMock.connect = vi.fn();
    socketMock.emit = vi.fn();
    socketMock.on = vi.fn();
    socketMock.off = vi.fn();

    mockedPutConfig.mockResolvedValue({} as any);

    mockedCreateHvhGame.mockResolvedValue({
      game_id: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      status: { state: "ongoing", next: "player0" },
    } as any);

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

  it("conecta el socket si no estaba conectado", () => {
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    expect(socketMock.connect).toHaveBeenCalled();
  });

  it("inicializa la partida como host", async () => {
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(socketMock.emit).toHaveBeenCalledWith("startGame", {
      code: "ROOM1",
      gameId: "game-1",
      hostClientId: "client-123",
      extra: {},
    });

    expect(result.current.myPlayer).toBe("player0");
    expect(result.current.nextTurn).toBe("player0");
    expect(result.current.playerProfiles).toEqual({
      player0: { username: null, profilePicture: null },
      player1: { username: null, profilePicture: null },
    });
  });

  it("inicializa la partida host en modo holey_hvh con holes", async () => {
    const config = { size: 11, mode: "holey_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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
      expect(mockedGenerateHoles).toHaveBeenCalledWith(66);
    });

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
    });

    expect(socketMock.emit).toHaveBeenCalledWith("startGame", {
      code: "ROOM1",
      gameId: "game-1",
      hostClientId: "client-123",
      extra: { holes: [1, 3] },
    });

    expect(result.current.disabledCells).toEqual(new Set([1, 3]));
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
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    expect(socketMock.on).toHaveBeenCalledWith(
      "gameStarted",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "enemyMove",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "playerDisconnected",
      expect.any(Function),
    );
  });

  it("maneja gameStarted con holes para guest", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const config = { size: 11, mode: "holey_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socketMock;
    });

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await act(async () => {
      handlers.gameStarted?.({
        gameId: "game-1",
        hostClientId: "host-999",
        extra: { holes: [2, 4] },
        players: {
          player0: { username: "hostUser", profilePicture: "host.png" },
          player1: { username: "guestUser", profilePicture: "guest.png" },
        },
      });
    });

    await waitFor(() => {
      expect(mockedGetHvhGame).toHaveBeenCalledWith("game-1", "host-999");
    });

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
      expect(result.current.nextTurn).toBe("player1");
    });

    expect(result.current.disabledCells).toEqual(new Set([2, 4]));
    expect(result.current.playerProfiles).toEqual({
      player0: { username: "hostUser", profilePicture: "host.png" },
      player1: { username: "guestUser", profilePicture: "guest.png" },
    });
  });

  it("actualiza playerProfiles aunque el evento gameStarted llegue siendo host", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socketMock;
    });

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
      handlers.gameStarted?.({
        gameId: "game-1",
        hostClientId: "host-999",
        extra: {},
        players: {
          player0: { username: "hostUser", profilePicture: "host.png" },
          player1: { username: "guestUser", profilePicture: "guest.png" },
        },
      });
    });

    expect(result.current.playerProfiles).toEqual({
      player0: { username: "hostUser", profilePicture: "host.png" },
      player1: { username: "guestUser", profilePicture: "guest.png" },
    });
  });

  it("actualiza disabledCells con adyacentes al recibir enemyMove en modo tabu_hvh", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const config = { size: 11, mode: "tabu_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socketMock;
    });

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await act(async () => {
      handlers.gameStarted?.({
        gameId: "game-1",
        hostClientId: "host-123",
        players: {
          player0: { username: "hostUser", profilePicture: "host.png" },
          player1: { username: "guestUser", profilePicture: "guest.png" },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
      expect(result.current.nextTurn).toBe("player1");
    });

    await act(async () => {
      handlers.enemyMove?.({ cellId: 8 });
    });

    await waitFor(() => {
      expect(mockedGetAdjacentCells).toHaveBeenCalledWith(8, 11);
    });

    expect(result.current.disabledCells).toEqual(new Set([5, 6]));
  });

  it("maneja un movimiento válido", async () => {
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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
    expect(socketMock.emit).toHaveBeenCalledWith("playMove", {
      code: "ROOM1",
      cellId: 7,
    });

    await waitFor(() => {
      expect(result.current.nextTurn).toBe("player1");
    });
  });

  it("no juega si no es su turno", async () => {
    mockedCreateHvhGame.mockResolvedValue({
      game_id: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      status: { state: "ongoing", next: "player1" },
    } as any);

    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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
      expect(result.current.nextTurn).toBe("player1");
    });

    await act(async () => {
      await result.current.handleCellClick(7);
    });

    expect(mockedHvhMove).not.toHaveBeenCalled();
  });

  it("no juega si la celda está bloqueada", async () => {
    const config = { size: 11, mode: "holey_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(result.current.disabledCells.has(1)).toBe(true);

    await act(async () => {
      await result.current.handleCellClick(1);
    });

    expect(mockedHvhMove).not.toHaveBeenCalled();
  });

  it("usa hostClientId como override al mover siendo guest", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socketMock;
    });

    mockedGetHvhGame.mockResolvedValue({
      game_id: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      status: { state: "ongoing", next: "player1" },
    } as any);

    const { result } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    await act(async () => {
      handlers.gameStarted?.({
        gameId: "game-1",
        hostClientId: "host-123",
        players: {
          player0: { username: "hostUser", profilePicture: "host.png" },
          player1: { username: "guestUser", profilePicture: "guest.png" },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.gameId).toBe("game-1");
      expect(result.current.nextTurn).toBe("player1");
    });

    mockedHvhMove.mockResolvedValue({
      yen: { size: 11, layout: "NEXT" },
      status: { state: "ongoing", next: "player0" },
    } as any);

    await act(async () => {
      await result.current.handleCellClick(4);
    });

    expect(mockedHvhMove).toHaveBeenCalledWith("game-1", 4, "host-123");
  });

  it("muestra message.error si hvhMove falla", async () => {
    mockedHvhMove.mockRejectedValue(new Error("movimiento inválido"));

    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(mockedMessage.error).toHaveBeenCalledWith("movimiento inválido");
  });

  it("emite finishGame cuando la jugada termina la partida", async () => {
    mockedHvhMove.mockResolvedValue({
      yen: { size: 11, layout: "FINAL" },
      status: { state: "finished", winner: "player0" },
    } as any);

    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(mockedHvhMove).toHaveBeenCalledWith("game-1", 9, undefined);
    expect(socketMock.emit).toHaveBeenCalledWith("playMove", {
      code: "ROOM1",
      cellId: 9,
    });
    expect(socketMock.emit).toHaveBeenCalledWith("finishGame", {
      code: "ROOM1",
      winner: "player0",
    });

    await waitFor(() => {
      expect(result.current.winner).toBe("player0");
      expect(result.current.nextTurn).toBeNull();
      expect(result.current.disabledCells).toEqual(new Set());
    });
  });

  it("abandona la sala y borra la partida si es host", async () => {
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(socketMock.emit).toHaveBeenCalledWith("leaveRoom", { code: "ROOM1" });
    expect(mockedDeleteHvhGame).toHaveBeenCalledWith("game-1");
    expect(onLeaveLobby).toHaveBeenCalled();
  });

  it("si deleteHvhGame falla al abandonar, igualmente sale al lobby", async () => {
    mockedDeleteHvhGame.mockRejectedValue(new Error("fail"));

    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

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

    expect(mockedDeleteHvhGame).toHaveBeenCalledWith("game-1");
    expect(onLeaveLobby).toHaveBeenCalled();
  });

  it("muestra warning cuando el rival se desconecta", async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socketMock;
    });

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

  it("limpia los listeners al desmontar", () => {
    const config = { size: 11, mode: "classic_hvh" } as const;
    const onInvalidState = vi.fn();
    const onLeaveLobby = vi.fn();

    const { unmount } = renderHook(() =>
      useMultiplayerGameSession({
        code: "ROOM1",
        role: "guest",
        config,
        onInvalidState,
        onLeaveLobby,
      }),
    );

    unmount();

    expect(socketMock.off).toHaveBeenCalledWith("gameStarted", expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith("enemyMove", expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith("playerDisconnected", expect.any(Function));
  });
});