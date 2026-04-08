import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

import GameMultiplayer from "../vistas/GameMultiplayer";
import { socket } from "../api/socket";
import { useMultiplayerGameSession } from "../game/useMultiplayerGameSession";
import { parseYenToCells } from "../game/yen";

const navigateMock = vi.fn();

let locationState: {
  role?: "host" | "guest";
  config?: { size: number; mode?: string };
} = {
  role: "host",
  config: { size: 11, mode: "classic_hvh" },
};

vi.mock("react-router-dom", () => ({
  useParams: () => ({ code: "ROOM1" }),
  useLocation: () => ({
    state: locationState,
  }),
  useNavigate: () => navigateMock,
}));

vi.mock("../api/socket", () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("../game/useMultiplayerGameSession", () => ({
  useMultiplayerGameSession: vi.fn(),
}));

vi.mock("../game/yen", () => ({
  parseYenToCells: vi.fn(),
}));

vi.mock("../game/MultiplayerSessionGamePage", () => ({
  default: ({
    title,
    subtitle,
    hasNewMessages,
    hasBoard,
    boardSize,
    cells,
    onOpenChat,
    onBack,
    onCellClick,
  }: {
    title: string;
    subtitle: string;
    hasNewMessages: boolean;
    hasBoard: boolean;
    boardSize: number;
    cells: unknown[];
    onOpenChat: () => void;
    onBack: () => void;
    onCellClick: (cellId: number) => void;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{`badge:${String(hasNewMessages)}`}</div>
      <div>{`has-board:${String(hasBoard)}`}</div>
      <div>{`board-size:${boardSize}`}</div>
      <div>{`cells:${cells.length}`}</div>
      <button onClick={onOpenChat}>abrir-chat</button>
      <button onClick={onBack}>volver</button>
      <button onClick={() => onCellClick(7)}>click-cell</button>
    </div>
  ),
}));

vi.mock("../vistas/MultiplayerChatDrawer", () => ({
  default: ({
    open,
    messages,
    onClose,
    onSendMessage,
  }: {
    open: boolean;
    messages: Array<{ text: string }>;
    onClose: () => void;
    onSendMessage: (text: string) => void;
  }) => (
    <div>
      <div>{`chat-open:${String(open)}`}</div>
      <div>{`chat-messages:${messages.length}`}</div>
      <button onClick={onClose}>cerrar-chat</button>
      <button onClick={() => onSendMessage("hola chat")}>send-chat</button>
    </div>
  ),
}));

describe("GameMultiplayer", () => {
  const mockedSocket = vi.mocked(socket);
  const mockedUseMultiplayerGameSession = vi.mocked(useMultiplayerGameSession);
  const mockedParseYenToCells = vi.mocked(parseYenToCells);

  beforeEach(() => {
    vi.clearAllMocks();

    locationState = {
      role: "host",
      config: { size: 11, mode: "classic_hvh" },
    };

    mockedUseMultiplayerGameSession.mockReturnValue({
      gameId: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      loading: false,
      winner: null,
      nextTurn: "player0",
      error: "",
      disabledCells: new Set<number>(),
      myPlayer: "player0",
      myColor: "#1677ff",
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
    });

    mockedParseYenToCells.mockReturnValue([
      {
        cellId: 0,
        row: 0,
        col: 0,
        value: "B",
        coords: { x: 0, y: 0, z: 0 },
        touches: { a: false, b: false, c: false },
      },
    ]);
  });

  it("renderiza el título y subtítulo de la partida", () => {
    render(<GameMultiplayer />);

    expect(screen.getByText("Clásico Online")).toBeTruthy();
    expect(screen.getByText("Sala: ROOM1 · Eres: Azul")).toBeTruthy();
  });

  it("muestra el título TABU para el modo tabu_hvh", () => {
    locationState = {
      role: "host",
      config: { size: 11, mode: "tabu_hvh" },
    };

    render(<GameMultiplayer />);

    expect(screen.getByText("TABU")).toBeTruthy();
  });

  it("usa YOVI como fallback si no hay modo", () => {
    locationState = {
      role: "host",
      config: { size: 11 },
    };

    render(<GameMultiplayer />);

    expect(screen.getByText("YOVI")).toBeTruthy();
  });

  it("muestra Naranja para player1", () => {
    mockedUseMultiplayerGameSession.mockReturnValue({
      gameId: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      loading: false,
      winner: null,
      nextTurn: "player1",
      error: "",
      disabledCells: new Set<number>(),
      myPlayer: "player1",
      myColor: "#ff7b00",
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
    });

    render(<GameMultiplayer />);

    expect(screen.getByText("Sala: ROOM1 · Eres: Naranja")).toBeTruthy();
  });

  it("abre el chat y limpia la marca de mensajes nuevos", async () => {
    const handlers: Record<string, (payload: any) => void> = {};

    mockedSocket.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return mockedSocket as any;
    });

    render(<GameMultiplayer />);

    await waitFor(() => {
      expect(handlers.chatMessage).toBeTypeOf("function");
    });

    await act(async () => {
      handlers.chatMessage?.({
        text: "hola",
        sender: "player1",
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("badge:true")).toBeTruthy();
      expect(screen.getByText("chat-messages:1")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("abrir-chat"));

    await waitFor(() => {
      expect(screen.getByText("chat-open:true")).toBeTruthy();
      expect(screen.getByText("badge:false")).toBeTruthy();
    });
  });

  it("si llega un mensaje con el chat abierto no activa la marca de nuevos", async () => {
    const handlers: Record<string, (payload: any) => void> = {};

    mockedSocket.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return mockedSocket as any;
    });

    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("abrir-chat"));

    await act(async () => {
      handlers.chatMessage?.({
        text: "ya abierto",
        sender: "player1",
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("chat-open:true")).toBeTruthy();
      expect(screen.getByText("chat-messages:1")).toBeTruthy();
      expect(screen.getByText("badge:false")).toBeTruthy();
    });
  });

  it("cierra el chat", () => {
    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("abrir-chat"));
    expect(screen.getByText("chat-open:true")).toBeTruthy();

    fireEvent.click(screen.getByText("cerrar-chat"));
    expect(screen.getByText("chat-open:false")).toBeTruthy();
  });

  it("envía mensajes por socket", () => {
    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("send-chat"));

    expect(mockedSocket.emit).toHaveBeenCalledWith("sendMessage", {
      code: "ROOM1",
      text: "hola chat",
    });
  });

  it("navega al lobby al pulsar volver", () => {
    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("volver"));

    expect(navigateMock).toHaveBeenCalledWith("/multiplayer");
  });

  it("registra el listener del chat", () => {
    render(<GameMultiplayer />);

    expect(mockedSocket.on).toHaveBeenCalledWith(
      "chatMessage",
      expect.any(Function),
    );
  });

  it("limpia el listener del chat al desmontar", () => {
    const { unmount } = render(<GameMultiplayer />);

    unmount();

    expect(mockedSocket.off).toHaveBeenCalledWith(
      "chatMessage",
      expect.any(Function),
    );
  });

  it("usa cells vacías cuando yen es null", () => {
    mockedUseMultiplayerGameSession.mockReturnValue({
      gameId: "game-1",
      yen: null,
      loading: false,
      winner: null,
      nextTurn: "player0",
      error: "",
      disabledCells: new Set<number>(),
      myPlayer: "player0",
      myColor: "#1677ff",
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
    });

    render(<GameMultiplayer />);

    expect(mockedParseYenToCells).not.toHaveBeenCalled();
    expect(screen.getByText("has-board:false")).toBeTruthy();
    expect(screen.getByText("cells:0")).toBeTruthy();
    expect(screen.getByText("board-size:11")).toBeTruthy();
  });
});