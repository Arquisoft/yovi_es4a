import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import GamePastel from "../vistas/GamePastel";
import { createHvhGame, deleteHvhGame, hvhMove, putConfig } from "../api/gamey";
import { getUserSession } from "../utils/session";
import useDeferredGameSave from "../game/useDeferredGameSave";

// ─── Mocks de navegación y params ────────────────────────────────────────────

const navigateMock = vi.fn();
let mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
    useNavigate: () => navigateMock,
  };
});

// ─── Mocks de API ─────────────────────────────────────────────────────────────

vi.mock("../api/gamey", () => ({
  createHvhGame: vi.fn(),
  deleteHvhGame: vi.fn(),
  hvhMove: vi.fn(),
  putConfig: vi.fn(),
}));

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("../game/useDeferredGameSave", () => ({
  default: vi.fn(),
}));

// ─── Mocks de librerías visuales ─────────────────────────────────────────────

vi.mock("lottie-react", () => ({ default: () => <div>Lottie</div> }));

vi.mock("antd", () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...props}>{children}</button>
  ),
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Flex: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Typography: {
    Title: ({ children }: any) => <h2>{children}</h2>,
    Text: ({ children }: any) => <span>{children}</span>,
  },
}));

vi.mock("@ant-design/icons", () => ({
  SwapOutlined: () => null,
  ArrowRightOutlined: () => null,
}));

// ─── Mocks de componentes propios ─────────────────────────────────────────────

vi.mock("../game/GameShell", () => ({
  default: ({ title, subtitle, error, hasBoard, turnIndicator, board, result, onAbandon }: any) => (
    <div>
      <div data-testid="shell-title">{title}</div>
      <div data-testid="shell-subtitle">{subtitle}</div>
      <div data-testid="shell-error">{error}</div>
      <div data-testid="shell-hasBoard">{String(hasBoard)}</div>
      <div data-testid="shell-turn">{turnIndicator}</div>
      <div data-testid="shell-board">{board}</div>
      <div data-testid="shell-result">{result}</div>
      <button data-testid="shell-abandon" onClick={onAbandon}>Abandonar</button>
    </div>
  ),
}));

vi.mock("../game/Board", () => ({
  default: ({ size, disabled, onCellClick }: any) => (
    <div data-testid="board" data-size={size} data-disabled={String(disabled)}>
      <button data-testid="cell-0" onClick={() => onCellClick(0)}>Celda 0</button>
      <button data-testid="cell-1" onClick={() => onCellClick(1)}>Celda 1</button>
    </div>
  ),
}));

vi.mock("../game/yen", () => ({
  parseYenToCells: vi.fn(() => [
    { cellId: 0, row: 0, col: 0, value: ".", coords: { x: 0, y: 0, z: 0 }, touches: { a: false, b: false, c: false } },
    { cellId: 1, row: 1, col: 0, value: ".", coords: { x: 1, y: 0, z: 0 }, touches: { a: false, b: false, c: false } },
  ]),
}));

vi.mock("../vistas/registroLogin/AuthModal", () => ({
  default: ({ open, onClose, onLoginSuccess }: any) => (
    <div data-testid="auth-modal" data-open={String(open)}>
      <button onClick={onClose}>Cerrar</button>
      <button onClick={onLoginSuccess}>Login</button>
    </div>
  ),
}));

// ─── Estado base del hook ─────────────────────────────────────────────────────

const deferredGameSaveState = {
  authModalOpen: false,
  savingPendingGame: false,
  canOfferGuestSave: false,
  saveGameForCurrentSession: vi.fn(),
  registerFinishedGame: vi.fn(),
  handleGuestSaveRequested: vi.fn(),
  handleLoginSuccess: vi.fn(),
  closeAuthModal: vi.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_YEN = { size: 7, layout: "." };

const ongoingResp = (next = "player0") => ({
  game_id: "g1",
  yen: BASE_YEN,
  status: { state: "ongoing", next },
});

const moveResp = (next = "player1") => ({
  game_id: "g1",
  yen: { ...BASE_YEN, layout: ".B." },
  applied_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
  status: { state: "ongoing", next },
});

const finishedResp = (winner = "player0") => ({
  game_id: "g1",
  yen: BASE_YEN,
  applied_move: { cell_id: 1, coords: {} },
  status: { state: "finished", winner },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GamePastel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvhGame).mockResolvedValue(ongoingResp() as any);
    vi.mocked(hvhMove).mockResolvedValue(moveResp() as any);
    vi.mocked(deleteHvhGame).mockResolvedValue({ deleted: true } as any);

    vi.mocked(getUserSession).mockReturnValue({
      username: "marcelo",
      profilePicture: "avatar.png",
    } as any);

    vi.mocked(useDeferredGameSave).mockReturnValue({ ...deferredGameSaveState } as any);
  });

  // ── Inicialización ───────────────────────────────────────────────────────────

  it("llama a putConfig y createHvhGame al montar", async () => {
    render(<GamePastel />);

    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith({
        size: 7,
        hvb_starter: "human",
        bot_id: null,
        hvh_starter: "player0",
      });
      expect(createHvhGame).toHaveBeenCalledWith({ size: 7, hvh_starter: "player0" });
    });
  });

  it("muestra el título y subtítulo correctos", async () => {
    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("shell-title")).toHaveTextContent("Juego Y — Regla del Pastel 🍰");
      expect(screen.getByTestId("shell-subtitle")).toHaveTextContent("Tamaño: 7 · Empieza: Player 0");
    });
  });

  it("usa valores por defecto si faltan params", async () => {
    mockSearchParams = new URLSearchParams("");
    render(<GamePastel />);

    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith(
        expect.objectContaining({ size: 7, hvh_starter: "player0" })
      );
    });
  });

  it("respeta los params de tamaño y starter", async () => {
    mockSearchParams = new URLSearchParams("size=9&hvhstarter=player1");
    render(<GamePastel />);

    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith(
        expect.objectContaining({ size: 9, hvh_starter: "player1" })
      );
      expect(screen.getByTestId("shell-subtitle")).toHaveTextContent("Tamaño: 9 · Empieza: Player 1");
    });
  });

  it("muestra el tablero tras inicializar", async () => {
    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("shell-hasBoard")).toHaveTextContent("true");
      expect(screen.getByTestId("board")).toBeInTheDocument();
    });
  });

  it("muestra error si createHvhGame falla", async () => {
    vi.mocked(createHvhGame).mockRejectedValue(new Error("Error de red"));
    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("shell-error")).toHaveTextContent("Error de red");
    });
  });

  // ── Fase place_neutral ───────────────────────────────────────────────────────

  it("en place_neutral el tablero está habilitado", async () => {
    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("board")).toHaveAttribute("data-disabled", "false");
    });
  });

  it("el indicador de turno muestra al firstPlayer durante place_neutral", async () => {
    vi.mocked(createHvhGame).mockResolvedValue(ongoingResp("player0") as any);
    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("shell-turn")).toHaveTextContent("Player 0");
    });
  });

  it("al hacer clic en celda durante place_neutral, llama a hvhMove y pasa a pie_choice", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));

    expect(hvhMove).toHaveBeenCalledWith("g1", 0);

    await waitFor(() => {
      expect(screen.getByTestId("shell-board")).toHaveTextContent("¡Regla del Pastel!");
    });
  });

  // ── Fase pie_choice ──────────────────────────────────────────────────────────

  it("en pie_choice el tablero está deshabilitado", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));

    await waitFor(() => {
      expect(screen.getByTestId("board")).toHaveAttribute("data-disabled", "true");
    });
  });

  it("en pie_choice se muestran los botones de elección", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));

    await waitFor(() => {
      expect(screen.getByTestId("pastel-swap-btn")).toBeInTheDocument();
      expect(screen.getByTestId("pastel-pass-btn")).toBeInTheDocument();
    });
  });

  it("al ceder (pass) desaparece el banner y el tablero se habilita", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-pass-btn"));
    await user.click(screen.getByTestId("pastel-pass-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("board")).toHaveAttribute("data-disabled", "false");
      expect(screen.queryByTestId("pastel-swap-btn")).not.toBeInTheDocument();
    });
  });

  it("al quedarse (swap) desaparece el banner y el tablero se habilita", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-swap-btn"));
    await user.click(screen.getByTestId("pastel-swap-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("board")).toHaveAttribute("data-disabled", "false");
      expect(screen.queryByTestId("pastel-swap-btn")).not.toBeInTheDocument();
    });
  });

  // ── Fase playing ─────────────────────────────────────────────────────────────

  it("en playing, hvhMove se llama al hacer clic en celda", async () => {
    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-pass-btn"));
    await user.click(screen.getByTestId("pastel-pass-btn"));

    vi.mocked(hvhMove).mockClear();
    await waitFor(() => screen.getByTestId("cell-1"));
    await user.click(screen.getByTestId("cell-1"));

    expect(hvhMove).toHaveBeenCalledWith("g1", 1);
  });

  it("cuando el backend devuelve finished, se muestra el resultado", async () => {
    const user = userEvent.setup();

    vi.mocked(hvhMove)
      .mockResolvedValueOnce(moveResp("player1") as any)
      .mockResolvedValueOnce(finishedResp("player0") as any);

    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-pass-btn"));
    await user.click(screen.getByTestId("pastel-pass-btn"));
    await waitFor(() => screen.getByTestId("cell-1"));
    await user.click(screen.getByTestId("cell-1"));

    await waitFor(() => {
      expect(screen.getByTestId("shell-result")).toHaveTextContent("Player 0 ha ganado.");
    });
  });

  it("con swap activo, invierte el ganador visualmente", async () => {
    const user = userEvent.setup();

    vi.mocked(hvhMove)
      .mockResolvedValueOnce(moveResp("player1") as any)
      .mockResolvedValueOnce(finishedResp("player0") as any);

    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-swap-btn"));
    await user.click(screen.getByTestId("pastel-swap-btn"));
    await waitFor(() => screen.getByTestId("cell-1"));
    await user.click(screen.getByTestId("cell-1"));

    await waitFor(() => {
      expect(screen.getByTestId("shell-result")).toHaveTextContent("Player 1 ha ganado.");
    });
  });

  it("registra la partida al terminar si hay sesión", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    const user = userEvent.setup();

    vi.mocked(hvhMove)
      .mockResolvedValueOnce(moveResp("player1") as any)
      .mockResolvedValueOnce(finishedResp("player0") as any);

    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("cell-0"));
    await user.click(screen.getByTestId("cell-0"));
    await waitFor(() => screen.getByTestId("pastel-pass-btn"));
    await user.click(screen.getByTestId("pastel-pass-btn"));
    await waitFor(() => screen.getByTestId("cell-1"));
    await user.click(screen.getByTestId("cell-1"));

    await waitFor(() => {
      expect(registerFinishedGame).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: "g1",
          mode: "pastel_hvh",
          result: "won",
          boardSize: 7,
          startedBy: "player0",
        })
      );
    });
  });

  // ── Abandono ─────────────────────────────────────────────────────────────────

  it("al abandonar con sesión, llama a saveGameForCurrentSession y deleteHvhGame", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("shell-abandon"));
    await user.click(screen.getByTestId("shell-abandon"));

    await waitFor(() => {
      expect(saveGameForCurrentSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "pastel_hvh", result: "abandoned" })
      );
      expect(deleteHvhGame).toHaveBeenCalledWith("g1");
      expect(navigateMock).toHaveBeenCalledWith("/home");
    });
  });

  it("al abandonar sin sesión, igualmente borra la partida y navega", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    const user = userEvent.setup();
    render(<GamePastel />);

    await waitFor(() => screen.getByTestId("shell-abandon"));
    await user.click(screen.getByTestId("shell-abandon"));

    await waitFor(() => {
      expect(saveGameForCurrentSession).not.toHaveBeenCalled();
      expect(deleteHvhGame).toHaveBeenCalledWith("g1");
      expect(navigateMock).toHaveBeenCalledWith("/home");
    });
  });

  // ── AuthModal ────────────────────────────────────────────────────────────────

  it("renderiza AuthModal con las props del hook", async () => {
    const handleLoginSuccess = vi.fn();
    const closeAuthModal = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      authModalOpen: true,
      handleLoginSuccess,
      closeAuthModal,
    } as any);

    render(<GamePastel />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-modal")).toHaveAttribute("data-open", "true");
    });
  });
});