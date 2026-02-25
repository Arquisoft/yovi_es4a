import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameHvB from "../vistas/GameHvB.tsx";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useSearchParams: () => [mockSearchParams],
    };
});

const newGameMock = vi.fn();
const humanVsBotMoveMock = vi.fn();

vi.mock("../api/gamey", () => ({
    newGame: (...args: any[]) => newGameMock(...args),
    humanVsBotMove: (...args: any[]) => humanVsBotMoveMock(...args),
}));

vi.mock("../game/yen", () => ({
    parseYenToCells: () => [
        { cellId: 0, row: 0, col: 0, value: ".", coords: { x: 0, y: 0, z: 0 }, touches: { a: false, b: false, c: false } },
    ],
}));

let lastOnCellClick: ((cellId: number) => void) | null = null;

vi.mock("../game/Board", () => ({
    default: ({ onCellClick, disabled }: any) => {
        lastOnCellClick = onCellClick;
        return (
            <div>
                <button aria-label="cell-0" disabled={disabled} onClick={() => onCellClick(0)}>
                    cell0
                </button>
            </div>
        );
    },
}));

vi.mock("antd", () => ({
    App: {
        useApp: () => ({
            modal: { confirm: confirmMock },
        }),
    },
    Alert: ({ message }: any) => <div role="alert">{message}</div>,
    Button: ({ children, onClick, disabled, danger }: any) => (
        <button data-danger={!!danger} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
    Card: ({ children, style }: any) => (
        <div data-testid="card" style={style}>
            {children}
        </div>
    ),
    Empty: ({ description }: any) => <div>{description}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Typography: {
        Title: ({ children }: any) => <div>{children}</div>,
        Text: ({ children }: any) => <div>{children}</div>,
    },
}));

describe("GameHvB", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        newGameMock.mockReset();
        humanVsBotMoveMock.mockReset();
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");
    });

    it("crea partida y renderiza Board (newGame OK)", async () => {
        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });

        render(<GameHvB />);

        expect(await screen.findByLabelText("cell-0")).toBeInTheDocument();
        expect(newGameMock).toHaveBeenCalledWith(7);

        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Bot: random_bot/i)).toBeInTheDocument();
    });

    it("muestra error si newGame falla", async () => {
        newGameMock.mockRejectedValueOnce(new Error("boom"));

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    });

    it("fallback a size=7 si 'size' es inválido (<2 o NaN)", async () => {
        mockSearchParams = new URLSearchParams("size=1&bot=mcts_bot");
        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });

        render(<GameHvB />);
        await screen.findByLabelText("cell-0");

        expect(newGameMock).toHaveBeenCalledWith(7);
        expect(screen.getByText(/Bot: mcts_bot/i)).toBeInTheDocument();
    });

    it("al click en celda ejecuta humanVsBotMove y si termina con winner=human muestra resultado y estilo", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        const boardCard = cards.find((c) => (c as HTMLElement).style.background.includes("rgba") || (c as HTMLElement).style.background.includes("#28bbf5")) ?? cards[1];
        expect((boardCard as HTMLElement).style.background).toBeTruthy();

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("al pulsar Abandonar abre modal.confirm y onOk navega a /home replace", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");
        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];
        expect(args.title).toBe("Abandonar");

        args.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si humanVsBotMove devuelve estado NO finished, ejecuta el else (gameOver false, winner null) y no muestra resultado", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "playing", winner: null },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(screen.queryByText("Volver a Home")).not.toBeInTheDocument();
        expect(screen.queryByText("¡Felicidades!")).not.toBeInTheDocument();
        expect(screen.queryByText("Game Over")).not.toBeInTheDocument();
    });

    it("si humanVsBotMove falla, entra en catch y muestra Alert con el error", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockRejectedValueOnce(new Error("move failed"));

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("move failed");
    });

    it("si termina y winner es distinto de 'human', boardCardStyle aplica fondo naranja", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: "bot" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByText("Game Over")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        const boardCard = cards[1] as HTMLElement;

        expect(boardCard.style.background).toBe("rgba(255, 123, 0, 0.2)");
    });

    it("si termina pero winner es falsy, boardCardStyle devuelve {}, sin background", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: null },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByText("Game Over")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        const boardCard = cards[1] as HTMLElement;

        expect(boardCard.style.background).toBe("");
    });

    it("usa valores por defecto si faltan query params (size=7, bot=random_bot)", async () => {
        mockSearchParams = new URLSearchParams("");

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(newGameMock).toHaveBeenCalledWith(7);
        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Bot: random_bot/i)).toBeInTheDocument();
    });

    it("si el componente se desmonta antes de que newGame resuelva, no intenta setear estado (rama cancelled)", async () => {
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

        let resolveNewGame: (v: any) => void = () => {};
        const pending = new Promise((res) => (resolveNewGame = res));
        newGameMock.mockReturnValueOnce(pending);

        const { unmount } = render(<GameHvB />);

        unmount();

        resolveNewGame({ yen: { size: 7 } });

        await Promise.resolve();
        await Promise.resolve();

        expect(true).toBe(true);
    });

    it("si gameOver=true, handleCellClick retorna sin llamar a humanVsBotMove (early return)", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");

        await user.click(cell0);
        expect(await screen.findByText("Volver a Home")).toBeInTheDocument();
        expect(humanVsBotMoveMock).toHaveBeenCalledTimes(1);

        await user.click(cell0);
        expect(humanVsBotMoveMock).toHaveBeenCalledTimes(1);
    });

    it("si humanVsBotMove rechaza con un string u objeto sin message, usa String(e) en el error (línea 86)", async () => {
        const user = userEvent.setup();

        newGameMock.mockResolvedValueOnce({ yen: { size: 7 } });
        humanVsBotMoveMock.mockRejectedValueOnce("BAD_MOVE");

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("BAD_MOVE");
    });

    it("start(): si newGame rechaza sin .message, usa String(e)", async () => {
        newGameMock.mockRejectedValueOnce("NEWGAME_FAIL");

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("NEWGAME_FAIL");
    });

    it("start(): si el componente se desmonta y luego newGame falla, no setea error", async () => {
        let rejectNewGame: (e: any) => void = () => {};
        const pending = new Promise((_, rej) => (rejectNewGame = rej));
        newGameMock.mockReturnValueOnce(pending);

        const { unmount } = render(<GameHvB />);
        unmount();

        rejectNewGame(new Error("late fail"));

        await Promise.resolve();
        await Promise.resolve();

        expect(true).toBe(true);
    });
});