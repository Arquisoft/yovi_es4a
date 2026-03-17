import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SessionGamePage from "../game/SessionGamePage";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

const useSessionGameMock = vi.fn();
const parseYenToCellsMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("antd", () => ({
  App: {
    useApp: () => ({
      modal: { confirm: confirmMock },
    }),
  },
  Button: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} data-type={type}>
      {children}
    </button>
  ),
  Card: ({ children, style, bodyStyle, size }: any) => (
    <div
      data-testid="card"
      data-style={JSON.stringify(style ?? {})}
      data-body-style={JSON.stringify(bodyStyle ?? {})}
      data-size={size ?? ""}
    >
      {children}
    </div>
  ),
  Flex: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Typography: {
    Title: ({ children }: any) => <div>{children}</div>,
    Text: ({ children }: any) => <div>{children}</div>,
  },
}));

vi.mock("../game/useSessionGame", () => ({
  useSessionGame: (...args: any[]) => useSessionGameMock(...args),
}));

vi.mock("../game/yen", () => ({
  parseYenToCells: (...args: any[]) => parseYenToCellsMock(...args),
}));

vi.mock("../game/Board", () => ({
  default: ({ size, cells, disabled, onCellClick }: any) => (
    <div>
      <div>BOARD size={size}</div>
      <div>BOARD disabled={String(disabled)}</div>
      <div>BOARD cells={JSON.stringify(cells)}</div>
      <button aria-label="board-cell-0" onClick={() => onCellClick(0)} disabled={disabled}>
        cell0
      </button>
    </div>
  ),
}));

vi.mock("../game/GameShell", () => ({
  default: ({
    title,
    subtitle,
    onAbandon,
    board,
    result,
    turnIndicator,
    abandonDisabled,
    emptyText,
    error,
    hasBoard,
  }: any) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
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

    const baseProps = {
        deps: [7, "random_bot", "human"] as const,
        start: startMock,
        move: moveMock,
        botMove: botMoveMock,
        resultConfig: {
            title: "Juego Y — Human vs Bot",
            subtitle: "Tamaño: 7 · Bot: random_bot · Empieza: Humano",
            emptyText: "No se pudo crear la partida.",
            abandonOkText: "Sí, abandonar",
            getResultTitle: (winner: string | null) =>
                winner === "human" ? "¡Felicidades!" : "Game Over",
            getResultText: (winner: string | null) =>
                winner === "human"
                    ? "Has ganado la partida."
                    : "Ha ganado random_bot. ¡Inténtalo de nuevo!",
        },
        winnerPalette: {
            highlightedWinner: "human",
            highlightedBackground: "#28bbf532",
            otherWinnerBackground: "#ff7b0033",
        },
        turnConfig: {
            textPrefix: "Turno actual:",
            turns: {
                human: {
                    label: "Humano",
                    color: "#28BBF5",
                },
                bot: {
                    label: "random_bot",
                    color: "#FF7B00",
                },
            },
        },
    };

    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        useSessionGameMock.mockReset();
        parseYenToCellsMock.mockReset();
        startMock.mockReset();
        moveMock.mockReset();
        botMoveMock.mockReset();

        parseYenToCellsMock.mockReturnValue([
            {
                cellId: 0,
                row: 0,
                col: 0,
                value: ".",
                coords: { x: 0, y: 0, z: 0 },
                touches: { a: false, b: false, c: false },
            },
        ]);

        useSessionGameMock.mockReturnValue({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "human",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn().mockResolvedValue(undefined),
        });
    });

    it("llama a useSessionGame con deps/start/move y botMove", () => {
        render(<SessionGamePage {...baseProps} />);

        expect(useSessionGameMock).toHaveBeenCalledWith({
            deps: [7, "random_bot", "human"],
            start: startMock,
            move: moveMock,
            botMove: botMoveMock,
        });
    });

    it("parsea yen a cells y monta Board con size del yen", () => {
        render(<SessionGamePage {...baseProps} />);

        expect(parseYenToCellsMock).toHaveBeenCalledWith({ size: 7, layout: "." });
        expect(screen.getByText("BOARD size=7")).toBeInTheDocument();
        expect(screen.getByText(/BOARD cells=/)).toBeInTheDocument();
    });

    it("si no hay yen no parsea y usa size fallback=7", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: null,
            gameId: null,
            winner: null,
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(parseYenToCellsMock).not.toHaveBeenCalled();
        expect(screen.getByText("BOARD size=7")).toBeInTheDocument();
        expect(screen.getByText("hasBoard=false")).toBeInTheDocument();
    });

    it("muestra el indicador de turno cuando la partida sigue en curso", () => {
        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByTestId("shell-turn")).toHaveTextContent("Turno actual:");
        expect(screen.getByTestId("shell-turn")).toHaveTextContent("Humano");
    });

    it("el indicador de turno usa la Card pequeña con borde lateral del color correcto", () => {
        render(<SessionGamePage {...baseProps} />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-size", "small");
        expect(cards[0]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                borderLeft: "6px solid #28BBF5",
            }),
        );
    });

    it("no muestra indicador de turno si gameOver=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: "human",
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByTestId("shell-turn")).toBeEmptyDOMElement();
    });

    it("no muestra indicador de turno si nextTurn no existe en turnConfig", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "spectator",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByTestId("shell-turn")).toBeEmptyDOMElement();
    });

    it("deshabilita el Board cuando loading=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "human",
            error: "",
            loading: true,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("deshabilita el Board cuando nextTurn es bot", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn().mockResolvedValue(undefined),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
    });

    it("deshabilita el Board y Abandonar cuando gameOver=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: "human",
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("pasa onCellClick al Board", async () => {
        const user = userEvent.setup();
        const onCellClick = vi.fn();

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "human",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick,
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        await user.click(screen.getByRole("button", { name: "board-cell-0" }));
        expect(onCellClick).toHaveBeenCalledWith(0);
    });

    it("aplica borde azul al tablero si el turno es human", () => {
        render(<SessionGamePage {...baseProps} />);

        const cards = screen.getAllByTestId("card");
        expect(cards[1]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                border: "2px solid #28BBF5",
                boxShadow: "0 0 0 3px #28BBF522",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                width: "100%",
                overflow: "hidden",
            }),
        );
    });

    it("pasa el bodyStyle responsivo a la Card del tablero", () => {
        render(<SessionGamePage {...baseProps} />);

        const cards = screen.getAllByTestId("card");
        expect(cards[1]).toHaveAttribute(
            "data-body-style",
            JSON.stringify({
                padding: "clamp(8px, 2vw, 16px)",
            }),
        );
    });

    it("aplica borde naranja al tablero si el turno es bot", async () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        const cards = screen.getAllByTestId("card");
        expect(cards[1]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                border: "2px solid #FF7B00",
                boxShadow: "0 0 0 3px #FF7B0022",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                width: "100%",
                overflow: "hidden",
            }),
        );

        await waitFor(() => {
        expect(onBotTurn).toHaveBeenCalledTimes(1);
        });
    });

    it("dispara onBotTurn cuando nextTurn es bot", async () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        await waitFor(() => {
        expect(onBotTurn).toHaveBeenCalledTimes(1);
        });
    });

    it("no dispara onBotTurn si nextTurn es human", () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "human",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        expect(onBotTurn).not.toHaveBeenCalled();
    });

    it("no dispara onBotTurn si loading=true", () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: true,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        expect(onBotTurn).not.toHaveBeenCalled();
    });

    it("no dispara onBotTurn si gameOver=true", () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: "bot",
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        expect(onBotTurn).not.toHaveBeenCalled();
    });

    it("no dispara onBotTurn si no hay gameId", () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: null,
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} />);

        expect(onBotTurn).not.toHaveBeenCalled();
    });

    it("no dispara onBotTurn si no existe botMove", () => {
        const onBotTurn = vi.fn().mockResolvedValue(undefined);

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: "bot",
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
            onBotTurn,
        });

        render(<SessionGamePage {...baseProps} botMove={undefined} />);

        expect(onBotTurn).not.toHaveBeenCalled();
    });

    it("muestra resultado si gameOver=true y gana el highlightedWinner", async () => {
        const user = userEvent.setup();

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: "human",
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                background: "#28bbf532",
                width: "100%",
                overflow: "hidden",
            }),
        );

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("muestra resultado si gameOver=true y gana otro winner", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: "bot",
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        expect(screen.getByText("Game Over")).toBeInTheDocument();
        expect(screen.getByText("Ha ganado random_bot. ¡Inténtalo de nuevo!")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                background: "#ff7b0033",
                width: "100%",
                overflow: "hidden",
            }),
        );
    });

    it("no aplica color si gameOver=true pero no hay winner", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            gameId: "g1",
            winner: null,
            nextTurn: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
            onBotTurn: vi.fn(),
        });

        render(<SessionGamePage {...baseProps} />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                width: "100%",
                overflow: "hidden",
            }),
        );
    });

    it("no muestra resultado si gameOver=false", () => {
        render(<SessionGamePage {...baseProps} />);

        expect(screen.queryByText("¡Felicidades!")).not.toBeInTheDocument();
        expect(screen.queryByText("Game Over")).not.toBeInTheDocument();
    });

    it("abre modal de abandono y navega al confirmar", async () => {
        const user = userEvent.setup();

        render(<SessionGamePage {...baseProps} />);

        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);

        const modalArgs = confirmMock.mock.calls[0][0];
        expect(modalArgs.title).toBe("Abandonar");
        expect(modalArgs.content).toBe("¿Seguro que quieres abandonar la partida?");
        expect(modalArgs.okText).toBe("Sí, abandonar");
        expect(modalArgs.cancelText).toBe("Cancelar");

        modalArgs.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("usa abandonOkText por defecto si no se pasa", async () => {
        const user = userEvent.setup();

        render(
        <SessionGamePage
            {...baseProps}
            resultConfig={{
            ...baseProps.resultConfig,
            abandonOkText: undefined,
            }}
        />,
        );

        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        const modalArgs = confirmMock.mock.calls[0][0];
        expect(modalArgs.okText).toBe("Abandonar");
    });

    it("usa emptyText por defecto si no se pasa", () => {
        render(
            <SessionGamePage
                {...baseProps}
                resultConfig={{
                    ...baseProps.resultConfig,
                    emptyText: undefined,
                }}
            />,
        );

        expect(screen.getByText("emptyText=No se pudo crear la partida.")).toBeInTheDocument();
    });
});