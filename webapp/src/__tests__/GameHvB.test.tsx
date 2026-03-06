import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const createHvbGameMock = vi.fn();
const hvbHumanMoveMock = vi.fn();

vi.mock("../api/gamey", () => ({
    createHvbGame: (...args: any[]) => createHvbGameMock(...args),
    hvbHumanMove: (...args: any[]) => hvbHumanMoveMock(...args),
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

vi.mock("antd", () => {
    const EmptyComp = ({ description }: any) => <div>{description}</div>;
    (EmptyComp as any).PRESENTED_IMAGE_DEFAULT = "default-empty";
    return {
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
        Empty: EmptyComp,
        Flex: ({ children }: any) => <div>{children}</div>,
        Space: ({ children }: any) => <div>{children}</div>,
        Typography: {
            Title: ({ children }: any) => <div>{children}</div>,
            Text: ({ children }: any) => <div>{children}</div>,
        },
    };
});

describe("GameHvB", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        createHvbGameMock.mockReset();
        hvbHumanMoveMock.mockReset();
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");
    });

    it("crea partida y renderiza Board", async () => {
        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        expect(await screen.findByLabelText("cell-0")).toBeInTheDocument();
        expect(createHvbGameMock).toHaveBeenCalledWith({
            size: 7,
            bot_id: "random_bot",
            hvb_starter: "human",
        });

        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Bot: random_bot/i)).toBeInTheDocument();
        expect(screen.getByText(/Empieza: human/i)).toBeInTheDocument();
    });

    it("usa starter=bot si viene en query (case-insensitive)", async () => {
        mockSearchParams = new URLSearchParams("size=7&bot=mcts_bot&hvbstarter=BoT");

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-2",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(createHvbGameMock).toHaveBeenCalledWith({
            size: 7,
            bot_id: "mcts_bot",
            hvb_starter: "bot",
        });
        expect(screen.getByText(/Empieza: bot/i)).toBeInTheDocument();
    });

    it("fallback a size=7 si size es inválido", async () => {
        mockSearchParams = new URLSearchParams("size=1&bot=mcts_bot&hvbstarter=human");

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-3",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        await screen.findByLabelText("cell-0");

        expect(createHvbGameMock).toHaveBeenCalledWith({
            size: 7,
            bot_id: "mcts_bot",
            hvb_starter: "human",
        });
    });

    it("muestra loading antes de crear la partida", () => {
        createHvbGameMock.mockReturnValue(new Promise(() => {}));

        render(<GameHvB />);

        expect(screen.getByText("Creando partida...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("muestra error si createHvbGame falla con Error.message", async () => {
        createHvbGameMock.mockRejectedValueOnce(new Error("boom"));

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("boom");
        expect(screen.getByText("No se pudo crear la partida.")).toBeInTheDocument();
    });

    it("si createHvbGame rechaza sin .message, usa String(e)", async () => {
        createHvbGameMock.mockRejectedValueOnce("NEWGAME_FAIL");

        render(<GameHvB />);

        expect(await screen.findByRole("alert")).toHaveTextContent("NEWGAME_FAIL");
    });

    it("si createHvbGame devuelve finished con winner=bot, muestra resultado del bot", async () => {
        mockSearchParams = new URLSearchParams("size=7&bot=random_bot&hvbstarter=bot");

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-4",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "bot" },
        });

        render(<GameHvB />);

        expect(await screen.findByText("Game Over")).toBeInTheDocument();
        expect(screen.getByText("Ha ganado el bot. ¡Inténtalo de nuevo!")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("si createHvbGame devuelve finished con winner=human, muestra resultado del humano", async () => {
        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-5",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        expect(await screen.findByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();
    });

    it("al click en celda ejecuta hvbHumanMove y si termina winner=human muestra resultado", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-6",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockResolvedValueOnce({
            game_id: "game-6",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            bot_move: null,
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(hvbHumanMoveMock).toHaveBeenCalledWith("game-6", 0);
        expect(await screen.findByText("¡Felicidades!")).toBeInTheDocument();
        expect(screen.getByText("Has ganado la partida.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si hvbHumanMove devuelve ongoing, no muestra resultado final", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-7",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockResolvedValueOnce({
            game_id: "game-7",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            bot_move: { cell_id: 1, coords: { x: 0, y: 1, z: 0 } },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(screen.queryByText("Volver a Home")).not.toBeInTheDocument();
        expect(screen.queryByText("¡Felicidades!")).not.toBeInTheDocument();
        expect(screen.queryByText("Game Over")).not.toBeInTheDocument();
    });

    it("si hvbHumanMove falla, muestra Alert con el error", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-8",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockRejectedValueOnce(new Error("move failed"));

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("move failed");
    });

    it("si hvbHumanMove rechaza con string, usa String(e)", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-9",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockRejectedValueOnce("BAD_MOVE");

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("BAD_MOVE");
    });

    it("si falta gameId, handleCellClick retorna sin llamar a hvbHumanMove", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(hvbHumanMoveMock).not.toHaveBeenCalled();
    });

    it("al pulsar Abandonar abre modal.confirm y onOk navega a /home replace", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-10",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
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

    it("si el componente se desmonta antes de que createHvbGame resuelva, no rompe", async () => {
        let resolveNewGame: (value: any) => void = () => {};
        const pending = new Promise((res) => {
            resolveNewGame = res;
        });
        createHvbGameMock.mockReturnValueOnce(pending);

        const { unmount } = render(<GameHvB />);
        unmount();

        resolveNewGame({
            game_id: "late-game",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(true).toBe(true);
    });

    it("si la partida ya terminó, no vuelve a llamar a hvbHumanMove", async () => {
        const user = userEvent.setup();

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-11",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockResolvedValueOnce({
            game_id: "game-11",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            bot_move: null,
            status: { state: "finished", winner: "human" },
        });

        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByText("Volver a Home")).toBeInTheDocument();
        expect(hvbHumanMoveMock).toHaveBeenCalledTimes(1);

        await user.click(cell0);
        expect(hvbHumanMoveMock).toHaveBeenCalledTimes(1);
    });

    it("deshabilita Abandonar mientras loading=true y lo habilita después", async () => {
        let resolveMove: (value: any) => void = () => {};
        const pendingMove = new Promise((res) => {
            resolveMove = res;
        });

        createHvbGameMock.mockResolvedValueOnce({
            game_id: "game-12",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        hvbHumanMoveMock.mockReturnValueOnce(pendingMove);

        const user = userEvent.setup();
        render(<GameHvB />);

        const cell0 = await screen.findByLabelText("cell-0");
        const abandonButton = screen.getByRole("button", { name: "Abandonar" });

        expect(abandonButton).toBeEnabled();

        await user.click(cell0);
        expect(abandonButton).toBeDisabled();

        resolveMove({
            game_id: "game-12",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            bot_move: null,
            status: { state: "ongoing", next: "human" },
        });

        await waitFor(() => {
            expect(abandonButton).toBeEnabled();
        });
    });
});