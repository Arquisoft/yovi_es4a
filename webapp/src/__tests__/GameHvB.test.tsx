import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameHvB from "../vistas/GameHvB.tsx";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

const useSessionGameMock = vi.fn();
const parseYenToCellsMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useSearchParams: () => [mockSearchParams],
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
    Card: ({ children, style }: any) => (
        <div data-testid="card" data-style={JSON.stringify(style ?? {})}>
            {children}
        </div>
    ),
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Typography: {
        Title: ({ children }: any) => <div>{children}</div>,
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
    default: ({ title, subtitle, onAbandon, board, result, abandonDisabled }: any) => (
        <div>
            <div>{title}</div>
            <div>{subtitle}</div>
            <button onClick={onAbandon} disabled={!!abandonDisabled}>
                Abandonar
            </button>
            <div data-testid="shell-board">{board}</div>
            <div data-testid="shell-result">{result}</div>
        </div>
    ),
}));

describe("GameHvB", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        useSessionGameMock.mockReset();
        parseYenToCellsMock.mockReset();

        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

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
            winner: null,
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
        });
    });

    it("normaliza starter=bot y respeta bot/size de la query", () => {
        mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=BoT");

        render(<GameHvB />);

        const args = useSessionGameMock.mock.calls[0][0];
        expect(args.deps).toEqual([9, "mcts_bot", "bot"]);
        expect(screen.getByText("Tamaño: 9 · Bot: mcts_bot · Empieza: bot")).toBeInTheDocument();
    });

    it("hace fallback a size=7 y starter=human si la query es inválida", () => {
        mockSearchParams = new URLSearchParams("size=1&bot=smart_bot&hvbstarter=alien");

        render(<GameHvB />);

        const args = useSessionGameMock.mock.calls[0][0];
        expect(args.deps).toEqual([7, "smart_bot", "human"]);
        expect(screen.getByText("Tamaño: 7 · Bot: smart_bot · Empieza: human")).toBeInTheDocument();
    });

    it("parsea yen a cells y monta el Board con size del yen", () => {
        render(<GameHvB />);

        expect(parseYenToCellsMock).toHaveBeenCalledWith({ size: 7, layout: "." });
        expect(screen.getByText("BOARD size=7")).toBeInTheDocument();
        expect(screen.getByText(/BOARD cells=/)).toBeInTheDocument();
    });

    it("si no hay yen usa el size de la query para el Board", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: null,
            winner: null,
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
        });

        mockSearchParams = new URLSearchParams("size=11&bot=random_bot&hvbstarter=human");

        render(<GameHvB />);

        expect(screen.getByText("BOARD size=11")).toBeInTheDocument();
        expect(parseYenToCellsMock).not.toHaveBeenCalled();
    });

    it("deshabilita el Board cuando loading=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: null,
            error: "",
            loading: true,
            gameOver: false,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
    });

    it("deshabilita el Board cuando gameOver=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "human",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
    });

    it("muestra resultado ganador del humano", async () => {
        const user = userEvent.setup();

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "human",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("muestra resultado ganador del bot", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "bot",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByText("Game Over")).toBeInTheDocument();
        expect(screen.getByText("Ha ganado el bot. ¡Inténtalo de nuevo!")).toBeInTheDocument();
    });

    it("no muestra resultado si gameOver=false", () => {
        render(<GameHvB />);

        expect(screen.queryByText("¡Felicidades!")).not.toBeInTheDocument();
        expect(screen.queryByText("Game Over")).not.toBeInTheDocument();
    });

    it("colorea la card azul cuando gana human", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "human",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-style", JSON.stringify({ background: "#28bbf532" }));
    });

    it("colorea la card naranja cuando gana bot", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "bot",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-style", JSON.stringify({ background: "#ff7b0033" }));
    });

    it("no aplica color si gameOver=true pero no hay winner", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: null,
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-style", JSON.stringify({}));
    });

    it("abre modal de abandono y navega al confirmar", async () => {
        const user = userEvent.setup();

        render(<GameHvB />);

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

    it("deshabilita Abandonar si loading=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: null,
            error: "",
            loading: true,
            gameOver: false,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("deshabilita Abandonar si gameOver=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "human",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvB />);

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });
});