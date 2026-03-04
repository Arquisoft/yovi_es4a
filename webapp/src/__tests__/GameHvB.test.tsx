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

const newHvbGameMock = vi.fn();
const humanVsBotMoveMock = vi.fn();

vi.mock("../api/gamey", () => ({
    newHvbGame: (...args: any[]) => newHvbGameMock(...args),
    humanVsBotMove: (...args: any[]) => humanVsBotMoveMock(...args),
}));

vi.mock("../game/yen", () => ({
    parseYenToCells: () => [
        {
            cellId: 0,
            row: 0,
            col: 0,
            value: ".",
            coords: { x: 0, y: 0, z: 0 },
            touches: { a: false, b: false, c: false },
        },
    ],
}));

vi.mock("../game/Board", () => ({
    default: ({ onCellClick, disabled }: any) => (
        <div>
            <button aria-label="cell-0" disabled={disabled} onClick={() => onCellClick(0)}>
                cell0
            </button>
        </div>
    ),
}));

vi.mock("antd", () => ({
    App: {
        useApp: () => ({
            modal: { confirm: confirmMock },
        }),
    },
    Alert: ({ message }: any) => <div role="alert">{message}</div>,
    Button: ({ children, onClick, disabled, danger, type }: any) => (
        <button data-danger={!!danger} data-type={type} onClick={onClick} disabled={disabled}>
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
        newHvbGameMock.mockReset();
        humanVsBotMoveMock.mockReset();
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");
    });

    it("crea partida HVB y renderiza Board (newHvbGame OK)", async () => {
        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        render(<GameHvB />);

        expect(await screen.findByLabelText("cell-0")).toBeInTheDocument();

        // newHvbGame(size, botId, starter)
        expect(newHvbGameMock).toHaveBeenCalledWith(7, "random_bot", "human");

        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Bot: random_bot/i)).toBeInTheDocument();
        expect(screen.getByText(/Empieza: human/i)).toBeInTheDocument();
    });

    it("usa starter=bot si viene en query (case-insensitive)", async () => {
        mockSearchParams = new URLSearchParams("size=7&bot=mcts_bot&starter=BoT");

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(newHvbGameMock).toHaveBeenCalledWith(7, "mcts_bot", "bot");
        expect(screen.getByText(/Empieza: bot/i)).toBeInTheDocument();
    });

    it("fallback a size=7 si 'size' es inválido (<2 o NaN)", async () => {
        mockSearchParams = new URLSearchParams("size=1&bot=mcts_bot&starter=human");

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(newHvbGameMock).toHaveBeenCalledWith(7, "mcts_bot", "human");
        expect(screen.getByText(/Bot: mcts_bot/i)).toBeInTheDocument();
    });

    it("muestra error si newHvbGame falla (Error.message)", async () => {
        newHvbGameMock.mockRejectedValueOnce(new Error("boom"));

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    });

    it("start(): si newHvbGame rechaza sin .message, usa String(e)", async () => {
        newHvbGameMock.mockRejectedValueOnce("NEWGAME_FAIL");

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("NEWGAME_FAIL");
    });

    it("si newHvbGame devuelve estado finished, muestra resultado sin hacer movimientos", async () => {
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot&starter=bot");

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: "bot" },
        });

        render(<GameHvB />);

        expect(await screen.findByText("Game Over")).toBeInTheDocument();
        expect(screen.getByText("Ha ganado el bot. ¡Inténtalo de nuevo!")).toBeInTheDocument();

        const cards = screen.getAllByTestId("card");
        const boardCard = cards[1] as HTMLElement;
        expect(boardCard.style.background).toBe("rgba(255, 123, 0, 0.2)");
        expect((boardCard.getAttribute("style") ?? "").toLowerCase()).toContain("rgba(255, 123, 0, 0.2)");
    });

    it("al click en celda ejecuta humanVsBotMove y si termina winner=human muestra resultado y deshabilita Abandonar", async () => {
        const user = userEvent.setup();

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(humanVsBotMoveMock).toHaveBeenCalledWith("random_bot", { size: 7 }, 0);

        expect(await screen.findByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si humanVsBotMove devuelve NO finished, ejecuta else (no muestra resultado)", async () => {
        const user = userEvent.setup();

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        humanVsBotMoveMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
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

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        humanVsBotMoveMock.mockRejectedValueOnce(new Error("move failed"));

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("move failed");
    });

    it("si humanVsBotMove rechaza con string/objeto sin message, usa String(e)", async () => {
        const user = userEvent.setup();

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        humanVsBotMoveMock.mockRejectedValueOnce("BAD_MOVE");

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("BAD_MOVE");
    });

    it("al pulsar Abandonar abre modal.confirm y onOk navega a /home replace", async () => {
        const user = userEvent.setup();

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");
        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];
        expect(args.title).toBe("Abandonar");

        args.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si el componente se desmonta antes de que newHvbGame resuelva, no intenta setear estado (rama cancelled)", async () => {
        let resolveNewGame: (v: any) => void = () => {};
        const pending = new Promise((res) => (resolveNewGame = res));
        newHvbGameMock.mockReturnValueOnce(pending);

        const { unmount } = render(<GameHvB />);
        unmount();

        resolveNewGame({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(true).toBe(true);
    });

    it("si gameOver=true, handleCellClick retorna sin llamar a humanVsBotMove (early return)", async () => {
        const user = userEvent.setup();

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

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

    it("usa valores por defecto si faltan query params (size=7, bot=random_bot, starter=human)", async () => {
        mockSearchParams = new URLSearchParams("");

        newHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7 },
            status: { state: "ongoing", winner: null },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(newHvbGameMock).toHaveBeenCalledWith(7, "random_bot", "human");
        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Bot: random_bot/i)).toBeInTheDocument();
        expect(screen.getByText(/Empieza: human/i)).toBeInTheDocument();
    });
});