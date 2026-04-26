import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import GameMultiplayer from "../vistas/GameMultiplayer";
import { useMultiplayerGameSession } from "../game/useMultiplayerGameSession";
import { parseYenToCells } from "../game/yen";
import type { UseMultiplayerGameSessionResult } from "../game/useMultiplayerGameSession";

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
    boardBanner,
  }: {
    title: string;
    subtitle: string;
    hasNewMessages: boolean;
    hasBoard: boolean;
    boardSize: number;
    cells: Array<{ cellId?: number; value?: string }>;
    onOpenChat: () => void;
    onBack: () => void;
    onCellClick: (cellId: number) => void;
    boardBanner?: ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{`badge:${String(hasNewMessages)}`}</div>
      <div>{`has-board:${String(hasBoard)}`}</div>
      <div>{`board-size:${boardSize}`}</div>
      <div>{`cells:${cells.length}`}</div>
      <div data-testid="cells-json">{JSON.stringify(cells)}</div>
      <div>{`has-banner:${String(Boolean(boardBanner))}`}</div>
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

  function buildSessionResult(
    overrides: Partial<UseMultiplayerGameSessionResult> = {},
  ): UseMultiplayerGameSessionResult {
    return {
      gameId: "game-1",
      yen: { size: 11, layout: "B/.R/..." },
      loading: false,
      gameOver: false,
      winner: null,
      nextTurn: "player0",
      error: "",
      disabledCells: new Set<number>(),
      myPlayer: "player0",
      displayMyPlayer: "player0",
      myColor: "#1677ff",
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: "guestUser", profilePicture: "guest.png" },
      },
      handleCellClick: vi.fn(),
      handleAbandon: vi.fn(),
      handlePastelSwap: vi.fn(),
      handlePastelPass: vi.fn(),
      neutralCells: new Set<number>(),
      pastelState: null,
      messages: [],
      hasNewMessages: false,
      setHasNewMessages: vi.fn(),
      handleSendChat: vi.fn(),
      piecesLeft: 1,
      diceValue: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    locationState = {
      role: "host",
      config: { size: 11, mode: "classic_hvh" },
    };

    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult());

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
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      nextTurn: "player1",
      myPlayer: "player1",
      displayMyPlayer: "player1",
      myColor: "#ff7b00",
    }));

    render(<GameMultiplayer />);

    expect(screen.getByText("Clásico Online vs. hostUser")).toBeTruthy();
    expect(screen.getByText("Sala: ROOM1 · Eres: Naranja")).toBeTruthy();
  });

  it("usa 'Jugador online' si el rival no tiene username", () => {
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      playerProfiles: {
        player0: { username: "hostUser", profilePicture: "host.png" },
        player1: { username: null, profilePicture: "guest.png" },
      },
    }));

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
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      hasNewMessages: true,
      setHasNewMessages: setHasNewMessagesMock,
    }));

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
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      handleSendChat: handleSendChatMock,
    }));

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
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      yen: null,
    }));

    render(<GameMultiplayer />);

    expect(mockedParseYenToCells).not.toHaveBeenCalled();
    expect(screen.getByText("has-board:false")).toBeTruthy();
    expect(screen.getByText("cells:0")).toBeTruthy();
    expect(screen.getByText("board-size:11")).toBeTruthy();
  });
  it("redirige al lobby si el hook invoca onInvalidState u onLeaveLobby", () => {
    mockedUseMultiplayerGameSession.mockImplementation((args) => {
      args.onInvalidState();
      args.onLeaveLobby();
      return buildSessionResult();
    });

    render(<GameMultiplayer />);

    expect(navigateMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(navigateMock.mock.calls.every(([path]) => path === "/multiplayer")).toBe(true);
  });

  it("transforma la celda neutral y los colores intercambiados en pastel", () => {
    locationState.config = { size: 11, mode: "pastel_hvh" };
    mockedUseMultiplayerGameSession.mockReturnValue(buildSessionResult({
      pastelState: {
        phase: "pie_choice",
        neutralCellId: 0,
        swapped: true,
        firstPlayer: "player0",
      },
      neutralCells: new Set<number>([0]),
    }));

    mockedParseYenToCells.mockReturnValue([
      {
        cellId: 0,
        row: 0,
        col: 0,
        value: "B",
        coords: { x: 0, y: 0, z: 0 },
        touches: { a: false, b: false, c: false },
      },
      {
        cellId: 1,
        row: 1,
        col: 0,
        value: "B",
        coords: { x: 0, y: 0, z: 0 },
        touches: { a: false, b: false, c: false },
      },
      {
        cellId: 2,
        row: 1,
        col: 1,
        value: "R",
        coords: { x: 0, y: 0, z: 0 },
        touches: { a: false, b: false, c: false },
      },
    ]);

    render(<GameMultiplayer />);

    expect(screen.getByText("has-banner:true")).toBeTruthy();
    expect(screen.getByTestId("cells-json").textContent).toContain("\"cellId\":0");
    expect(screen.getByTestId("cells-json").textContent).toContain("\"value\":\"N\"");
    expect(screen.getByTestId("cells-json").textContent).toContain("\"cellId\":1");
    expect(screen.getByTestId("cells-json").textContent).toContain("\"value\":\"R\"");
    expect(screen.getByTestId("cells-json").textContent).toContain("\"cellId\":2");
    expect(screen.getByTestId("cells-json").textContent).toContain("\"value\":\"B\"");
  });
});
