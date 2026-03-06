import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameHvH from "../vistas/GameHvH.tsx";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useSearchParams: () => [mockSearchParams],
    };
});

const putConfigMock = vi.fn();
const createHvhGameMock = vi.fn();
const hvhMoveMock = vi.fn();

vi.mock("../api/gamey", () => ({
    putConfig: (...args: any[]) => putConfigMock(...args),
    createHvhGame: (...args: any[]) => createHvhGameMock(...args),
    hvhMove: (...args: any[]) => hvhMoveMock(...args),
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

describe("GameHvH", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        putConfigMock.mockReset();
        createHvhGameMock.mockReset();
        hvhMoveMock.mockReset();
        mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");
    });

    it("guarda config y crea partida al montar", async () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });

        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        render(<GameHvH />);

        expect(await screen.findByLabelText("cell-0")).toBeInTheDocument();
        expect(putConfigMock).toHaveBeenCalledWith({
            size: 7,
            hvb_starter: "human",
            bot_id: null,
            hvh_starter: "player0",
        });
        expect(createHvhGameMock).toHaveBeenCalledTimes(1);

        expect(screen.getByText(/Tamaño: 7/i)).toBeInTheDocument();
        expect(screen.getByText(/Empieza: player0/i)).toBeInTheDocument();
    });

    it("usa player1 si viene en query", async () => {
        mockSearchParams = new URLSearchParams("size=9&hvhstarter=PLAYER1");

        putConfigMock.mockResolvedValueOnce({
            size: 9,
            hvb_starter: "human",
            hvh_starter: "player1",
            bot_id: null,
        });

        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-2",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "player1" },
        });

        render(<GameHvH />);

        await screen.findByLabelText("cell-0");

        expect(putConfigMock).toHaveBeenCalledWith({
            size: 9,
            hvb_starter: "human",
            bot_id: null,
            hvh_starter: "player1",
        });
        expect(screen.getByText(/Empieza: player1/i)).toBeInTheDocument();
    });

    it("fallback a size=7 y starter=player0 si query inválida", async () => {
        mockSearchParams = new URLSearchParams("size=1&hvhstarter=alien");

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });

        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-3",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        render(<GameHvH />);

        await screen.findByLabelText("cell-0");

        expect(putConfigMock).toHaveBeenCalledWith({
            size: 7,
            hvb_starter: "human",
            bot_id: null,
            hvh_starter: "player0",
        });
    });

    it("muestra loading antes de crear la partida", () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockReturnValue(new Promise(() => {}));

        render(<GameHvH />);

        expect(screen.getByText("Creando partida...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("si putConfig falla, muestra error", async () => {
        putConfigMock.mockRejectedValueOnce(new Error("config failed"));

        render(<GameHvH />);

        expect(await screen.findByRole("alert")).toHaveTextContent("config failed");
        expect(createHvhGameMock).not.toHaveBeenCalled();
    });

    it("si createHvhGame falla, muestra error", async () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockRejectedValueOnce(new Error("create failed"));

        render(<GameHvH />);

        expect(await screen.findByRole("alert")).toHaveTextContent("create failed");
    });

    it("si el create inicial devuelve finished con winner=player0, muestra resultado", async () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-4",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "player0" },
        });

        render(<GameHvH />);

        expect(await screen.findByText("Partida finalizada")).toBeInTheDocument();
        expect(screen.getByText("Player 0 ha ganado la partida.")).toBeInTheDocument();
    });

    it("si el create inicial devuelve finished con winner=player1, muestra resultado", async () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player1",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-5",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "player1" },
        });

        render(<GameHvH />);

        expect(await screen.findByText("Partida finalizada")).toBeInTheDocument();
        expect(screen.getByText("Player 1 ha ganado la partida.")).toBeInTheDocument();
    });

    it("al click en celda ejecuta hvhMove y si termina winner=player0 muestra resultado", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-6",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockResolvedValueOnce({
            game_id: "hvh-6",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            status: { state: "finished", winner: "player0" },
        });

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(hvhMoveMock).toHaveBeenCalledWith("hvh-6", 0);
        expect(await screen.findByText("Player 0 ha ganado la partida.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si hvhMove devuelve ongoing, no muestra resultado final", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-7",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockResolvedValueOnce({
            game_id: "hvh-7",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            status: { state: "ongoing", next: "player1" },
        });

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(screen.queryByText("Volver a Home")).not.toBeInTheDocument();
        expect(screen.queryByText("Partida finalizada")).not.toBeInTheDocument();
    });

    it("si hvhMove falla, muestra Alert con el error", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-8",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockRejectedValueOnce(new Error("move failed"));

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("move failed");
    });

    it("si hvhMove rechaza con string, usa String(e)", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-9",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockRejectedValueOnce("BAD_MOVE");

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByRole("alert")).toHaveTextContent("BAD_MOVE");
    });

    it("si falta gameId, handleCellClick retorna sin llamar a hvhMove", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(hvhMoveMock).not.toHaveBeenCalled();
    });

    it("al pulsar Abandonar abre modal.confirm y onOk navega a /home replace", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-10",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        render(<GameHvH />);

        await screen.findByLabelText("cell-0");
        await user.click(screen.getByRole("button", { name: "Abandonar" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];
        expect(args.title).toBe("Abandonar");
        expect(args.okText).toBe("Abandonar");
        expect(args.cancelText).toBe("Cancelar");

        args.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });

    it("si el componente se desmonta antes de que createHvhGame resuelva, no rompe", async () => {
        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });

        let resolveCreate: (value: any) => void = () => {};
        const pending = new Promise((res) => {
            resolveCreate = res;
        });
        createHvhGameMock.mockReturnValueOnce(pending);

        const { unmount } = render(<GameHvH />);
        unmount();

        resolveCreate({
            game_id: "late-game",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(true).toBe(true);
    });

    it("si la partida ya terminó, no vuelve a llamar a hvhMove", async () => {
        const user = userEvent.setup();

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-11",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockResolvedValueOnce({
            game_id: "hvh-11",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            status: { state: "finished", winner: "player1" },
        });

        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        await user.click(cell0);

        expect(await screen.findByText("Player 1 ha ganado la partida.")).toBeInTheDocument();
        expect(hvhMoveMock).toHaveBeenCalledTimes(1);

        await user.click(cell0);
        expect(hvhMoveMock).toHaveBeenCalledTimes(1);
    });

    it("deshabilita Abandonar mientras loading=true y lo habilita después", async () => {
        let resolveMove: (value: any) => void = () => {};
        const pendingMove = new Promise((res) => {
            resolveMove = res;
        });

        putConfigMock.mockResolvedValueOnce({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: null,
        });
        createHvhGameMock.mockResolvedValueOnce({
            game_id: "hvh-12",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });
        hvhMoveMock.mockReturnValueOnce(pendingMove);

        const user = userEvent.setup();
        render(<GameHvH />);

        const cell0 = await screen.findByLabelText("cell-0");
        const abandonButton = screen.getByRole("button", { name: "Abandonar" });

        expect(abandonButton).toBeEnabled();

        await user.click(cell0);
        expect(abandonButton).toBeDisabled();

        resolveMove({
            game_id: "hvh-12",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 0, coords: { x: 0, y: 0, z: 0 } },
            status: { state: "ongoing", next: "player1" },
        });

        await waitFor(() => {
            expect(abandonButton).toBeEnabled();
        });
    });
});