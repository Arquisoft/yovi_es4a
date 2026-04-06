import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionGamePage from "../game/SessionGamePage";

const navigateMock = vi.fn();
const confirmMock = vi.fn();
const useSessionGameMock = vi.fn();
const parseYenToCellsMock = vi.fn();

vi.mock("lottie-react", () => ({
  default: () => (
    <div data-testid="lottie-animation-mock">Animación Lottie</div>
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../game/useSessionGame", () => ({
  useSessionGame: (...args: any[]) => useSessionGameMock(...args),
}));

vi.mock("../game/yen", () => ({
  parseYenToCells: (...args: any[]) => parseYenToCellsMock(...args),
}));

vi.mock("antd", () => ({
  App: {
    useApp: () => ({
      modal: { confirm: confirmMock },
    }),
  },
  Button: ({ children, onClick, disabled, title }: any) => (
    <button onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Flex: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Typography: {
    Title: ({ children }: any) => <div>{children}</div>,
    Text: ({ children }: any) => <div>{children}</div>,
  },
}));

vi.mock("@ant-design/icons", () => ({
  BulbOutlined: () => null,
}));

vi.mock("../game/Board", () => ({
  default: ({ size, cells, disabled, onCellClick }: any) => (
    <div>
      <div>BOARD size={size}</div>
      <div>BOARD disabled={String(disabled)}</div>
      <div>BOARD cells={JSON.stringify(cells)}</div>
      <button
        aria-label="board-cell-0"
        disabled={disabled}
        onClick={() => onCellClick(0)}
      >
        cell0
      </button>
    </div>
  ),
}));

vi.mock("../game/GameShell", () => ({
  default: ({
    title,
    subtitle,
    loading,
    error,
    hasBoard,
    emptyText,
    onAbandon,
    abandonDisabled,
    turnIndicator,
    board,
    result,
  }: any) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>loading={String(loading)}</div>
      <div>error={error}</div>
      <div>hasBoard={String(hasBoard)}</div>
      <div>emptyText={emptyText}</div>
      <button onClick={onAbandon} disabled={!!abandonDisabled}>
        Abandonar
      </button>
      <div data-testid="shell-turn">{turnIndicator}</div>
      <div data-testid="shell-board">{board}</div>
      <div data-testid="shell-result">{result}</div>
    </div>
  ),
}));

describe("SessionGamePage", () => {
  const startMock = vi.fn();
  const moveMock = vi.fn();
  const botMoveMock = vi.fn();
  const onHintMock = vi.fn();
  const onGameFinishedMock = vi.fn();
  const onGameAbandonedMock = vi.fn();
  const onGuestSaveRequestedMock = vi.fn();
  const onCellClickMock = vi.fn();
  const onBotTurnMock = vi.fn().mockResolvedValue(undefined);

  const baseProps = {
    deps: [7, "random_bot", "human"] as const,
    start: startMock,
    move: moveMock,
    botMove: botMoveMock,
    onHint: onHintMock,
    onGameFinished: onGameFinishedMock,
    onGameAbandoned: onGameAbandonedMock,
    resultConfig: {
      title: "Juego Y — Human vs Bot",
      subtitle: "Subtítulo",
      emptyText: "No se pudo crear la partida.",
      abandonOkText: "Sí, abandonar",
      getResultTitle: (winner: string | null) =>
        winner === "human" ? "¡Felicidades!" : "Game Over",
      getResultText: (winner: string | null) =>
        winner === "human" ? "Has ganado." : "Has perdido.",
    },
    winnerPalette: {
      highlightedWinner: "human",
      highlightedBackground: "#28bbf532",
      otherWinnerBackground: "#ff7b0033",
    },
    turnConfig: {
      textPrefix: "Turno actual:",
      turns: {
        human: { label: "Humano", color: "#28BBF5" },
        bot: { label: "random_bot", color: "#FF7B00" },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    parseYenToCellsMock.mockReturnValue([
      { cellId: 0, value: ".", hint: false },
    ]);

    useSessionGameMock.mockReturnValue({
      yen: { size: 7, layout: "." },
      gameId: "g1",
      winner: null,
      nextTurn: "human",
      error: "",
      loading: false,
      gameOver: false,
      moveCount: 2,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });
  });

  it("llama a useSessionGame con deps/start/move/botMove", () => {
    render(<SessionGamePage {...baseProps} />);

    expect(useSessionGameMock).toHaveBeenCalledWith({
      deps: [7, "random_bot", "human"],
      start: startMock,
      move: moveMock,
      botMove: botMoveMock,
    });
  });

  it("parsea el yen y renderiza el tablero", () => {
    render(<SessionGamePage {...baseProps} />);

    expect(parseYenToCellsMock).toHaveBeenCalledWith({ size: 7, layout: "." });
    expect(screen.getByText("BOARD size=7")).toBeInTheDocument();
    expect(screen.getByText("hasBoard=true")).toBeInTheDocument();
  });

  it("muestra el indicador de turno y el botón de pista cuando procede", () => {
    render(<SessionGamePage {...baseProps} />);

    expect(screen.getByTestId("shell-turn")).toHaveTextContent("Turno actual:");
    expect(screen.getByTestId("shell-turn")).toHaveTextContent("Humano");
    expect(screen.getByRole("button", { name: "Pista" })).toBeInTheDocument();
  });

  it("pide pista y luego la bloquea", async () => {
    onHintMock.mockResolvedValueOnce(0);

    const user = userEvent.setup();
    render(<SessionGamePage {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Pista" }));

    await waitFor(() => {
      expect(onHintMock).toHaveBeenCalledWith("g1");
    });

    expect(
      await screen.findByRole("button", { name: "Pista usada" }),
    ).toBeDisabled();
  });

  it("limpia la pista al pulsar una celda", async () => {
    onHintMock.mockResolvedValueOnce(0);

    const user = userEvent.setup();
    render(<SessionGamePage {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Pista" }));

    await waitFor(() => {
      expect(onHintMock).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "board-cell-0" }));

    expect(onCellClickMock).toHaveBeenCalledWith(0);
  });

  it("dispara el turno del bot automáticamente", async () => {
    useSessionGameMock.mockReturnValueOnce({
      yen: { size: 7, layout: "." },
      gameId: "g1",
      winner: null,
      nextTurn: "bot",
      error: "",
      loading: false,
      gameOver: false,
      moveCount: 1,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });

    render(<SessionGamePage {...baseProps} />);

    await waitFor(() => {
      expect(onBotTurnMock).toHaveBeenCalledTimes(1);
    });
  });

  it("notifica onGameFinished una sola vez por gameId", async () => {
    useSessionGameMock.mockReturnValue({
      yen: { size: 7, layout: "." },
      gameId: "g1",
      winner: "human",
      nextTurn: null,
      error: "",
      loading: false,
      gameOver: true,
      moveCount: 5,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });

    const { rerender } = render(<SessionGamePage {...baseProps} />);

    await waitFor(() => {
      expect(onGameFinishedMock).toHaveBeenCalledWith({
        gameId: "g1",
        winner: "human",
        totalMoves: 5,
      });
    });

    rerender(<SessionGamePage {...baseProps} />);

    expect(onGameFinishedMock).toHaveBeenCalledTimes(1);
  });

  it("abre confirm de abandono y ejecuta callback", async () => {
    const user = userEvent.setup();
    render(<SessionGamePage {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Abandonar" }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    const args = confirmMock.mock.calls[0][0];
    expect(args.title).toBe("Abandonar");
    expect(args.content).toBe("¿Seguro que quieres abandonar la partida?");
    expect(args.okText).toBe("Sí, abandonar");

    await args.onOk();

    expect(onGameAbandonedMock).toHaveBeenCalledWith({
      gameId: "g1",
      totalMoves: 2,
    });
    expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("si no hay gameId al abandonar, vuelve a home sin callback", async () => {
    useSessionGameMock.mockReturnValueOnce({
      yen: null,
      gameId: null,
      winner: null,
      nextTurn: null,
      error: "",
      loading: false,
      gameOver: false,
      moveCount: 0,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });

    const user = userEvent.setup();
    render(<SessionGamePage {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Abandonar" }));

    const args = confirmMock.mock.calls[0][0];
    await args.onOk();

    expect(onGameAbandonedMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("muestra el resultado final cuando gameOver=true", () => {
    useSessionGameMock.mockReturnValueOnce({
      yen: { size: 7, layout: "." },
      gameId: "g1",
      winner: "human",
      nextTurn: null,
      error: "",
      loading: false,
      gameOver: true,
      moveCount: 5,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });

    render(<SessionGamePage {...baseProps} />);

    expect(screen.getByText("¡Felicidades!")).toBeInTheDocument();
    expect(screen.getByText("Has ganado.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Volver a Home" }),
    ).toBeInTheDocument();
  });

  it("muestra el botón de guardar partida para invitados y lo dispara con el payload correcto", async () => {
    useSessionGameMock.mockReturnValueOnce({
      yen: { size: 7, layout: "." },
      gameId: "g77",
      winner: "human",
      nextTurn: null,
      error: "",
      loading: false,
      gameOver: true,
      moveCount: 9,
      onCellClick: onCellClickMock,
      onBotTurn: onBotTurnMock,
    });

    const user = userEvent.setup();
    render(
      <SessionGamePage
        {...baseProps}
        canOfferGuestSave
        onGuestSaveRequested={onGuestSaveRequestedMock}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Guardar esta partida" }),
    );

    expect(onGuestSaveRequestedMock).toHaveBeenCalledWith({
      gameId: "g77",
      winner: "human",
      totalMoves: 9,
    });
  });
});
