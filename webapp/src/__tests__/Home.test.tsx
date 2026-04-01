import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../vistas/Home.tsx";
import type { Variant } from "../vistas/VariantSelect";

// ─── Mocks globales ──────────────────────────────────────────────────────────

const navigateMock = vi.fn();
const getMetaMock = vi.fn();
const getUserStatsMock = vi.fn();
const getUserSessionMock = vi.fn();
const onChangeVariantMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("../api/gamey", () => ({
    getMeta: () => getMetaMock(),
}));

vi.mock("../api/users", () => ({
    getUserStats: (...args: any[]) => getUserStatsMock(...args),
}));

vi.mock("../utils/session", () => ({
    getUserSession: (...args: any[]) => getUserSessionMock(...args),
}));

vi.mock("../vistas/AppHeader.tsx", () => ({
    default: ({ title }: { title: string }) => (
        <div data-testid="app-header">{title}</div>
    ),
}));

vi.mock("../vistas/Dificultyselect.tsx", () => ({
    default: ({ selectedBot, onSelect, onConfirm }: any) => (
        <div data-testid="difficulty-select" data-bot={selectedBot}>
            <button aria-label="select-mcts_bot" onClick={() => onSelect("mcts_bot")}>mcts_bot</button>
            <button aria-label="confirm-difficulty" onClick={onConfirm}>Confirmar</button>
        </div>
    ),
}));

vi.mock("../vistas/UserStats", () => ({
    default: ({ title, stats }: any) => (
        <div data-testid="user-stats-summary">
            <div>{title}</div>
            <div>{`W:${stats.gamesWon}`}</div>
            <div>{`L:${stats.gamesLost}`}</div>
            <div>{`A:${stats.gamesAbandoned}`}</div>
        </div>
    ),
}));

vi.mock("antd", () => ({
    Alert: ({ message, description }: any) => (
        <div>
            <div>{message}</div>
            <div>{description}</div>
        </div>
    ),
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Divider: ({ children }: any) => <div>{children}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Spin: () => <div>Cargando...</div>,
    Tag: ({ children }: any) => <span>{children}</span>,
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
        Text: ({ children }: any) => <span>{children}</span>,
    },
    InputNumber: ({ value, onChange, min, max }: any) => (
        <div>
            <input
                aria-label="size-input"
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <button
                type="button"
                aria-label="size-non-number"
                onClick={() => onChange(null)}
            >
                non-number
            </button>
        </div>
    ),
    Select: ({ value, onChange, options }: any) => {
        const values = (options ?? []).map((o: any) => o.value);

        const aria =
            values.includes("human") || values.includes("bot")
                ? "hvb-starter-select"
                : values.includes("player0") || values.includes("player1")
                    ? "hvh-starter-select"
                    : "select";

        return (
            <select aria-label={aria} value={value} onChange={(e) => onChange(e.target.value)}>
                {options?.map((o: any) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        );
    },
}));

vi.mock("@ant-design/icons", () => ({
    BuildOutlined: () => null,
    PlayCircleOutlined: () => null,
    RobotOutlined: () => null,
    TeamOutlined: () => null,
    ThunderboltOutlined: () => null,
    FireOutlined: () => null,
    ArrowLeftOutlined: () => null,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LAST_CONFIG_KEY_HVB = "yovi:lastGameConfig";
const LAST_CONFIG_KEY_HVH = "yovi:lastGameConfigHvh";

/** Variante clásica usada por defecto en todos los tests de Home */
const CLASSIC_VARIANT: Variant = {
    id: "classic",
    label: "Clásico",
    emoji: "⬡",
    tagLabel: "Estándar",
    tagColor: "blue",
    description: "El juego Y original.",
    detail: "Detalle del clásico.",
    implemented: true,
};

/** Helper: renderiza Home con props requeridas ya rellenas */
function renderHome(variantOverride?: Partial<Variant>) {
    const variant: Variant = { ...CLASSIC_VARIANT, ...variantOverride };
    return render(
        <Home variant={variant} onChangeVariant={onChangeVariantMock} />
    );
}

function metaOk() {
    getMetaMock.mockResolvedValue({
        api_version: "v1",
        min_board_size: 2,
        max_board_size: 15,
        bots: ["random_bot", "mcts_bot"],
    });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Home", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        getMetaMock.mockReset();
        getUserStatsMock.mockReset();
        getUserSessionMock.mockReset();
        onChangeVariantMock.mockReset();
        vi.restoreAllMocks();
        localStorage.clear();

        getUserSessionMock.mockReturnValue(null);
    });

    // ── Renderizado básico ───────────────────────────────────────────────────

    it("renderiza el AppHeader con el título YOVI", async () => {
        metaOk();

        renderHome();

        expect(await screen.findByTestId("app-header")).toHaveTextContent("YOVI");
    });

    it("renderiza el nombre de la variante activa", async () => {
        metaOk();

        renderHome();

        expect(await screen.findByText("Clásico")).toBeInTheDocument();
    });

    it("renderiza el tag de la variante activa", async () => {
        metaOk();

        renderHome({ tagLabel: "Estándar" });

        expect(await screen.findByText("Estándar")).toBeInTheDocument();
    });

    it("renderiza valores por defecto", async () => {
        metaOk();

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect((sizeInputs[1] as HTMLInputElement).value).toBe("7");
        expect(hvbStarterSelect.value).toBe("human");
        expect(hvhStarterSelect.value).toBe("player0");
    });

    // ── Botón cambiar variante ───────────────────────────────────────────────

    it("llama a onChangeVariant al pulsar «Cambiar variante»", async () => {
        metaOk();

        const user = userEvent.setup();
        renderHome();

        const btn = await screen.findByTestId("change-variant-btn");
        await user.click(btn);

        expect(onChangeVariantMock).toHaveBeenCalledTimes(1);
    });

    // ── localStorage ─────────────────────────────────────────────────────────

    it("carga la configuración previa de HvB desde localStorage y la refleja en la UI", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 9, botId: "mcts_bot", hvbstarter: "bot" }),
        );

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("9");
        expect(hvbStarterSelect.value).toBe("bot");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await userEvent.click(playButtons[0]);
        const diffSelect = screen.getByTestId("difficulty-select");
        expect(diffSelect).toHaveAttribute("data-bot", "mcts_bot");
    });

    it("carga la configuración previa de HvH desde localStorage", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVH,
            JSON.stringify({ size: 8, hvhstarter: "player1" }),
        );

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("8");
        expect((sizeInputs[1] as HTMLInputElement).value).toBe("8");
        expect(hvhStarterSelect.value).toBe("player1");
    });

    it("si existen HvB y HvH previos, prevalece el size de HvB y el starter de HvH", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 11, botId: "mcts_bot", hvbstarter: "bot" }),
        );
        localStorage.setItem(
            LAST_CONFIG_KEY_HVH,
            JSON.stringify({ size: 5, hvhstarter: "player1" }),
        );

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("11");
        expect((sizeInputs[1] as HTMLInputElement).value).toBe("11");
        expect(hvhStarterSelect.value).toBe("player1");
    });

    it("guarda al cambiar bot y hvbstarter", async () => {
        metaOk();

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        renderHome();

        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select");
        await user.selectOptions(hvbStarterSelect, "bot");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        const botSelectButton = screen.getByLabelText("select-mcts_bot");
        await user.click(botSelectButton);

        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVB,
            expect.stringContaining('"botId":"mcts_bot"'),
        );
        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVB,
            expect.stringContaining('"hvbstarter":"bot"'),
        );
    });

    it("guarda al cambiar hvhstarter", async () => {
        metaOk();

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        renderHome();

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        await user.selectOptions(hvhStarterSelect, "player1");

        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVH,
            expect.stringContaining('"hvhstarter":"player1"'),
        );
    });

    // ── Navegación ───────────────────────────────────────────────────────────

    it("permite cambiar bot/hvbstarter y navega a /game-hvb con query completa", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 5, botId: "random_bot", hvbstarter: "human" }),
        );

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        renderHome();

        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select");
        await user.selectOptions(hvbStarterSelect, "bot");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        const botSelectButton = screen.getByLabelText("select-mcts_bot");
        await user.click(botSelectButton);

        const confirmButton = screen.getByLabelText("confirm-difficulty");
        await user.click(confirmButton);

        expect(navigateMock).toHaveBeenCalledWith(
            "/game-hvb?size=5&bot=mcts_bot&hvbstarter=bot&variant=classic",
        );
        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVB,
            expect.stringContaining('"size":5'),
        );
    });

    it("permite cambiar hvhstarter y navega a /game-hvh con query completa", async () => {
        metaOk();

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        renderHome();

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        await user.selectOptions(hvhStarterSelect, "player1");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[1]);

        expect(navigateMock).toHaveBeenCalledWith("/game-hvh?size=7&hvhstarter=player1&variant=classic");
        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVH,
            expect.stringContaining('"hvhstarter":"player1"'),
        );
    });

    // ── Edge cases ───────────────────────────────────────────────────────────

    it("si InputNumber onChange recibe null, usa 7", async () => {
        getMetaMock.mockResolvedValue({
            api_version: "v1",
            min_board_size: 3,
            max_board_size: 15,
            bots: ["random_bot", "mcts_bot"],
        });

        const user = userEvent.setup();
        renderHome();

        const nonNumberButtons = await screen.findAllByLabelText("size-non-number");
        await user.click(nonNumberButtons[0]);

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        const confirmButton = screen.getByLabelText("confirm-difficulty");
        await user.click(confirmButton);

        expect(String(navigateMock.mock.calls[0][0])).toContain("size=7");
    });

    it("si el size queda por debajo del mínimo, al jugar hace clamp", async () => {
        getMetaMock.mockResolvedValue({
            api_version: "v1",
            min_board_size: 4,
            max_board_size: 15,
            bots: ["random_bot", "mcts_bot"],
        });

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 1, botId: "random_bot", hvbstarter: "human" }),
        );

        const user = userEvent.setup();
        renderHome();

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        const confirmButton = screen.getByLabelText("confirm-difficulty");
        await user.click(confirmButton);

        expect(navigateMock).toHaveBeenCalledWith(
            "/game-hvb?size=4&bot=random_bot&hvbstarter=human&variant=classic",
        );
    });

    it("si getMeta falla, usa valores por defecto", async () => {
        getMetaMock.mockRejectedValue(new Error("boom"));

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        expect((sizeInputs[0] as HTMLInputElement).getAttribute("min")).toBe("2");
        expect((sizeInputs[0] as HTMLInputElement).getAttribute("max")).toBe("15");
    });

    it("si localStorage tiene JSON inválido, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(LAST_CONFIG_KEY_HVB, "{NOT_JSON");
        localStorage.setItem(LAST_CONFIG_KEY_HVH, "{NOT_JSON");

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(hvbStarterSelect.value).toBe("human");
        expect(hvhStarterSelect.value).toBe("player0");
    });

    it("si localStorage tiene campos inválidos en HvB, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: "7", botId: "mcts_bot", hvbstarter: "bot" }),
        );

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(hvbStarterSelect.value).toBe("human");
    });

    it("si localStorage tiene hvbstarter inválido, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 9, botId: "mcts_bot", hvbstarter: "alien" }),
        );

        renderHome();

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(hvbStarterSelect.value).toBe("human");
    });

    it("si localStorage tiene hvhstarter inválido, ignora y mantiene defaults de HvH", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVH,
            JSON.stringify({ size: 9, hvhstarter: "alien" }),
        );

        renderHome();

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        expect((hvhStarterSelect as HTMLSelectElement).value).toBe("player0");
    });

    it("si saveLastConfig falla, Home no revienta al pulsar Jugar", async () => {
        metaOk();

        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });

        const user = userEvent.setup();
        renderHome();

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        const confirmButton = screen.getByLabelText("confirm-difficulty");
        await user.click(confirmButton);

        expect(navigateMock).toHaveBeenCalled();
    });

    // ── Estadísticas ─────────────────────────────────────────────────────────

    it("muestra el bloque de estadísticas si hay usuario registrado", async () => {
        metaOk();
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });
        getUserStatsMock.mockResolvedValue({
            username: "marcelo",
            profilePicture: "avatar.png",
            stats: {
                gamesPlayed: 6,
                gamesWon: 2,
                gamesLost: 3,
                gamesAbandoned: 1,
                totalMoves: 24,
                winRate: 33,
            },
        });

        renderHome();

        await waitFor(() => {
            expect(getUserStatsMock).toHaveBeenCalledWith("marcelo");
        });

        expect(await screen.findByTestId("user-stats-summary")).toBeInTheDocument();
        expect(screen.getByText("Tus estadísticas")).toBeInTheDocument();
        expect(screen.getByText("W:2")).toBeInTheDocument();
        expect(screen.getByText("L:3")).toBeInTheDocument();
        expect(screen.getByText("A:1")).toBeInTheDocument();
    });

    it("no muestra el bloque de estadísticas si es usuario invitado", async () => {
        metaOk();
        getUserSessionMock.mockReturnValue(null);

        renderHome();

        await screen.findByTestId("app-header");

        expect(getUserStatsMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId("user-stats-summary")).not.toBeInTheDocument();
        expect(screen.queryByText("Tus estadísticas")).not.toBeInTheDocument();
    });

    it("muestra spinner mientras carga estadísticas del usuario", async () => {
        metaOk();
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });
        getUserStatsMock.mockReturnValue(new Promise(() => {}));

        renderHome();

        expect(await screen.findByText("Cargando...")).toBeInTheDocument();
    });

    it("muestra error si falla la carga de estadísticas del usuario", async () => {
        metaOk();
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });
        getUserStatsMock.mockRejectedValue(new Error("Error stats"));

        renderHome();

        expect(
            await screen.findByText("No se pudieron cargar las estadísticas")
        ).toBeInTheDocument();
        expect(screen.getByText("Error stats")).toBeInTheDocument();
    });
});