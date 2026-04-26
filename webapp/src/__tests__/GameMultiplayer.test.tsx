import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import GameMultiplayer from "../vistas/GameMultiplayer";
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
    playerProfiles,
    onClose,
    onSendMessage,
  }: {
    open: boolean;
    messages: Array<{ text: string }>;
    playerProfiles: {
      player0: { username: string | null; profilePicture: string | null };
      player1: { username: string | null; profilePicture: string | null };
    };
    onClose: () => void;
    onSendMessage: (text: string) => void;
  }) => (
    <div>
      <div>{`chat-open:${String(open)}`}</div>
      <div>{`chat-messages:${messages.length}`}</div>
      <div>{`player0-avatar:${playerProfiles.player0.profilePicture ?? "none"}`}</div>
      <div>{`player1-avatar:${playerProfiles.player1.profilePicture ?? "none"}`}</div>
      <button onClick={onClose}>cerrar-chat</button>
      <button onClick={() => onSendMessage("hola chat")}>send-chat</button>
    </div>
  ),
}));

describe("GameMultiplayer", () => {
  // const mockedSocket = vi.mocked(socket);
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      // New properties:
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
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

    expect(screen.getByText("Clásico Online vs. guestUser")).toBeTruthy();
    expect(screen.getByText("Sala: ROOM1 · Eres: Azul")).toBeTruthy();
  });

  it("muestra el título TABU para el modo tabu_hvh", () => {
    locationState.config = { size: 11, mode: "tabu_hvh" };
    render(<GameMultiplayer />);

    expect(screen.getByText("Tabú (Bloqueos) vs. guestUser")).toBeTruthy();
  });

  it("usa YOVI como fallback si no hay modo", () => {
    locationState = {
      role: "host",
      config: { size: 11 },
    };

    render(<GameMultiplayer />);

    expect(screen.getByText("YOVI vs. guestUser")).toBeTruthy();
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
    });

    render(<GameMultiplayer />);

    expect(screen.getByText("Clásico Online vs. hostUser")).toBeTruthy();
    expect(screen.getByText("Sala: ROOM1 · Eres: Naranja")).toBeTruthy();
  });

  it("usa 'Jugador online' si el rival no tiene username", () => {
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: null, profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
    });

    render(<GameMultiplayer />);

    expect(screen.getByText("Clásico Online vs. Jugador online")).toBeTruthy();
  });

  it("pasa playerProfiles al chat", () => {
    render(<GameMultiplayer />);

    expect(screen.getByText("player0-avatar:host.png")).toBeTruthy();
    expect(screen.getByText("player1-avatar:guest.png")).toBeTruthy();
  });

  it("abre el chat y limpia la marca de mensajes nuevos", () => {
    const setHasNewMessagesMock = vi.fn();
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      messages: [],
      hasNewMessages: true,
      setHasNewMessages: setHasNewMessagesMock,
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
    });

    render(<GameMultiplayer />);

    expect(screen.getByText("badge:true")).toBeTruthy();

    fireEvent.click(screen.getByText("abrir-chat"));

    expect(screen.getByText("chat-open:true")).toBeTruthy();
    expect(setHasNewMessagesMock).toHaveBeenCalledWith(false);
  });

  it("cierra el chat", () => {
    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("abrir-chat"));
    expect(screen.getByText("chat-open:true")).toBeTruthy();

    fireEvent.click(screen.getByText("cerrar-chat"));
    expect(screen.getByText("chat-open:false")).toBeTruthy();
  });

  it("envía mensajes llamando a handleSendChat del hook", () => {
    const handleSendChatMock = vi.fn();
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: handleSendChatMock,
      piecesLeft: 1,
      diceValue: 1,
    });

    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("send-chat"));

    expect(handleSendChatMock).toHaveBeenCalledWith("hola chat");
  });

  it("navega al lobby al pulsar volver", () => {
    render(<GameMultiplayer />);

    fireEvent.click(screen.getByText("volver"));

    expect(navigateMock).toHaveBeenCalledWith("/multiplayer");
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
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
    });

    render(<GameMultiplayer />);

    expect(mockedParseYenToCells).not.toHaveBeenCalled();
    expect(screen.getByText("has-board:false")).toBeTruthy();
    expect(screen.getByText("cells:0")).toBeTruthy();
    expect(screen.getByText("board-size:11")).toBeTruthy();
  });
});