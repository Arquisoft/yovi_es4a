import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MultiplayerLobby from "../vistas/MultiplayerLobby";
import { socket } from "../api/socket";
import { getUserSession } from "../utils/session";

const navigateMock = vi.fn();

const {
  messageSuccess,
  messageInfo,
  messageError,
} = vi.hoisted(() => ({
  messageSuccess: vi.fn(),
  messageInfo: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../api/socket", () => ({
  socket: {
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("../vistas/AppHeader", () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("../vistas/VariantSelect", () => ({
  VARIANTS: [
    { id: "classic", label: "Clásico", emoji: "🎮", implemented: true },
    { id: "tabu", label: "Tabú", emoji: "🚫", implemented: true },
    { id: "holey", label: "Holey", emoji: "🕳️", implemented: true },
    { id: "fortune_dice", label: "Fortune Dice", emoji: "🎲", implemented: false },
    { id: "why_not", label: "WhY Not", emoji: "🔄", implemented: true },
    { id: "poly_y", label: "Poly-Y", emoji: "🔺", implemented: false },
  ],
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");

  return {
    ...actual,
    message: {
      success: messageSuccess,
      info: messageInfo,
      error: messageError,
    },
    Select: ({
      value,
      onChange,
      options,
    }: {
      value: string;
      onChange: (value: string) => void;
      options: Array<{ value: string; label: string }>;
    }) => (
      <select
        aria-label="Modo de juego"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    InputNumber: ({
      value,
      onChange,
    }: {
      value: number | null;
      onChange: (value: number | null) => void;
    }) => (
      <input
        aria-label="Tamaño del tablero"
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    ),
  };
});

describe("MultiplayerLobby", () => {
  const socketMock = vi.mocked(socket);
  const mockedGetUserSession = vi.mocked(getUserSession);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetUserSession.mockReturnValue({
      username: "marcelo",
      profilePicture: "avatar.png",
    });

    socketMock.connect.mockImplementation(() => socketMock as any);
    socketMock.on.mockImplementation(() => socketMock as any);
    socketMock.off.mockImplementation(() => socketMock as any);
    socketMock.emit.mockImplementation(() => socketMock as any);
  });

  it("conecta el socket y registra playerJoined", () => {
    render(<MultiplayerLobby />);

    expect(socketMock.connect).toHaveBeenCalled();
    expect(socketMock.on).toHaveBeenCalledWith("playerJoined", expect.any(Function));
  });

  it("crea una sala enviando username y profilePicture", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "A1B2C" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Generar Código"));

    expect(socketMock.emit).toHaveBeenCalledWith(
      "createRoom",
      {
        size: 11,
        mode: "classic_hvh",
        username: "marcelo",
        profilePicture: "avatar.png",
      },
      expect.any(Function)
    );

    expect(messageInfo).toHaveBeenCalledWith("Sala creada: A1B2C. Esperando rival...");
    expect(screen.getByText("A1B2C")).toBeTruthy();
  });

  it("crea una sala why_not_hvh cuando se selecciona Why Not", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "WHY99" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.change(screen.getByLabelText("Modo de juego"), {
      target: { value: "why_not" },
    });

    fireEvent.click(screen.getByText("Generar Código"));

    expect(socketMock.emit).toHaveBeenCalledWith(
      "createRoom",
      {
        size: 11,
        mode: "why_not_hvh",
        username: "marcelo",
        profilePicture: "avatar.png",
      },
      expect.any(Function)
    );
  });

  it("permite crear sala sin sesión enviando null", () => {
    mockedGetUserSession.mockReturnValue(null);

    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "ZZ999" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Generar Código"));

    expect(socketMock.emit).toHaveBeenCalledWith(
      "createRoom",
      {
        size: 11,
        mode: "classic_hvh",
        username: null,
        profilePicture: null,
      },
      expect.any(Function)
    );
  });

  it("se une a una sala enviando username y profilePicture", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "joinRoom" && typeof callback === "function") {
        callback({
          success: true,
          roomConfig: { size: 11, mode: "classic_hvh" },
        });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.change(screen.getByPlaceholderText("Ej: A4F92"), {
      target: { value: "abc12" },
    });
    fireEvent.click(screen.getByText("Entrar a la partida"));

    expect(socketMock.emit).toHaveBeenCalledWith(
      "joinRoom",
      {
        code: "ABC12",
        username: "marcelo",
        profilePicture: "avatar.png",
      },
      expect.any(Function)
    );

    expect(messageSuccess).toHaveBeenCalledWith("Unido correctamente");
    expect(navigateMock).toHaveBeenCalledWith("/multiplayer/ABC12", {
      state: { role: "guest", config: { size: 11, mode: "classic_hvh" } },
    });
  });

  it("no intenta unirse si el código está vacío", () => {
    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Entrar a la partida"));

    expect(socketMock.emit).not.toHaveBeenCalledWith(
      "joinRoom",
      expect.anything(),
      expect.anything()
    );
  });

  it("navega a la partida cuando entra el rival", () => {
    const handlers: Record<string, () => void> = {};

    socketMock.on.mockImplementation((event: string, handler: () => void) => {
      handlers[event] = handler;
      return socketMock as any;
    });

    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "ROOM9" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Generar Código"));

    handlers.playerJoined?.();

    expect(messageSuccess).toHaveBeenCalledWith("¡El rival se ha unido!");
    expect(navigateMock).toHaveBeenCalledWith("/multiplayer/ROOM9", {
      state: { role: "host", config: { size: 11, mode: "classic_hvh" } },
    });
  });

  it("navega a la partida why_not_hvh cuando entra el rival", () => {
    const handlers: Record<string, () => void> = {};

    socketMock.on.mockImplementation((event: string, handler: () => void) => {
      handlers[event] = handler;
      return socketMock as any;
    });

    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "WHY01" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.change(screen.getByLabelText("Modo de juego"), {
      target: { value: "why_not" },
    });

    fireEvent.click(screen.getByText("Generar Código"));

    handlers.playerJoined?.();

    expect(navigateMock).toHaveBeenCalledWith("/multiplayer/WHY01", {
      state: { role: "host", config: { size: 11, mode: "why_not_hvh" } },
    });
  });

  it("cancela la sala creada", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: true, code: "ROOM9" });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Generar Código"));
    fireEvent.click(screen.getByText("Cancelar sala"));

    expect(socketMock.emit).toHaveBeenCalledWith("leaveRoom", { code: "ROOM9" });
  });

  it("muestra error si falla createRoom", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "createRoom" && typeof callback === "function") {
        callback({ success: false });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.click(screen.getByText("Generar Código"));

    expect(messageError).toHaveBeenCalledWith("Error al crear la sala");
  });

  it("muestra error si falla joinRoom", () => {
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      const callback = args[1];
      if (event === "joinRoom" && typeof callback === "function") {
        callback({ success: false, error: "Sala no encontrada." });
      }
      return socketMock as any;
    });

    render(<MultiplayerLobby />);

    fireEvent.change(screen.getByPlaceholderText("Ej: A4F92"), {
      target: { value: "abc12" },
    });
    fireEvent.click(screen.getByText("Entrar a la partida"));

    expect(messageError).toHaveBeenCalledWith("Sala no encontrada.");
  });

  it("limpia el listener al desmontar", () => {
    const { unmount } = render(<MultiplayerLobby />);

    unmount();

    expect(socketMock.off).toHaveBeenCalledWith("playerJoined", expect.any(Function));
  });
});