import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameHvH from "../vistas/GameHvH.tsx";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

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

describe("GameHvH", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        useSessionGameMock.mockReset();
        parseYenToCellsMock.mockReset();

        mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

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

    it("configura useSessionGame con size y starter por defecto", () => {
        render(<GameHvH />);

        const args = useSessionGameMock.mock.calls[0][0];
        expect(args.deps).toEqual([7, "player0"]);
        expect(screen.getByText("Juego Y — Human vs Human")).toBeInTheDocument();
        expect(screen.getByText("Tamaño: 7 · Empieza: player0")).toBeInTheDocument();
    });

    it("normaliza starter=player1", () => {
        mockSearchParams = new URLSearchParams("size=9&hvhstarter=PLAYER1");

        render(<GameHvH />);

        const args = useSessionGameMock.mock.calls[0][0];
        expect(args.deps).toEqual([9, "player1"]);
        expect(screen.getByText("Tamaño: 9 · Empieza: player1")).toBeInTheDocument();
    });

    it("hace fallback a size=7 y starter=player0", () => {
        mockSearchParams = new URLSearchParams("size=1&hvhstarter=alien");

        render(<GameHvH />);

        const args = useSessionGameMock.mock.calls[0][0];
        expect(args.deps).toEqual([7, "player0"]);
        expect(screen.getByText("Tamaño: 7 · Empieza: player0")).toBeInTheDocument();
    });

    it("parsea yen a cells y monta Board", () => {
        render(<GameHvH />);

        expect(parseYenToCellsMock).toHaveBeenCalledWith({ size: 7, layout: "." });
        expect(screen.getByText("BOARD size=7")).toBeInTheDocument();
    });

    it("si no hay yen usa el size de la query para Board", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: null,
            winner: null,
            error: "",
            loading: false,
            gameOver: false,
            onCellClick: vi.fn(),
        });

        mockSearchParams = new URLSearchParams("size=11&hvhstarter=player1");

        render(<GameHvH />);

        expect(screen.getByText("BOARD size=11")).toBeInTheDocument();
        expect(parseYenToCellsMock).not.toHaveBeenCalled();
    });

    it("deshabilita Board si loading=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: null,
            error: "",
            loading: true,
            gameOver: false,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
    });

    it("deshabilita Board si gameOver=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player0",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        expect(screen.getByText("BOARD disabled=true")).toBeInTheDocument();
    });

    it("muestra resultado si gana player0", async () => {
        const user = userEvent.setup();

        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player0",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        expect(screen.getByText("Partida finalizada")).toBeInTheDocument();
        expect(screen.getByText("Player 0 ha ganado la partida.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("muestra resultado si gana player1", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player1",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        expect(screen.getByText("Partida finalizada")).toBeInTheDocument();
        expect(screen.getByText("Player 1 ha ganado la partida.")).toBeInTheDocument();
    });

    it("no muestra resultado si gameOver=false", () => {
        render(<GameHvH />);

        expect(screen.queryByText("Partida finalizada")).not.toBeInTheDocument();
    });

    it("colorea la card azul cuando gana player0", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player0",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-style", JSON.stringify({ background: "#28bbf532" }));
    });

    it("colorea la card naranja cuando gana player1", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player1",
            error: "",
            loading: false,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

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

        render(<GameHvH />);

        const cards = screen.getAllByTestId("card");
        expect(cards[0]).toHaveAttribute("data-style", JSON.stringify({}));
    });

    it("abre modal de abandono y navega al confirmar", async () => {
        const user = userEvent.setup();

        render(<GameHvH />);

        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);

        const modalArgs = confirmMock.mock.calls[0][0];
        expect(modalArgs.title).toBe("Abandonar");
        expect(modalArgs.content).toBe("¿Seguro que quieres abandonar la partida?");
        expect(modalArgs.okText).toBe("Abandonar");
        expect(modalArgs.cancelText).toBe("Cancelar");

        modalArgs.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("deshabilita Abandonar solo si loading=true", () => {
        useSessionGameMock.mockReturnValueOnce({
            yen: { size: 7, layout: "." },
            winner: "player0",
            error: "",
            loading: true,
            gameOver: true,
            onCellClick: vi.fn(),
        });

        render(<GameHvH />);

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });
});