import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../vistas/Home.tsx";

const navigateMock = vi.fn();
const getMetaMock = vi.fn();

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

vi.mock("../vistas/AppHeader.tsx", () => ({
    default: ({ title }: { title: string }) => (
        <div data-testid="app-header">{title}</div>
    ),
}));

vi.mock("antd", () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Divider: ({ children }: any) => <div>{children}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
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
            values.includes("random_bot") || values.includes("mcts_bot")
                ? "bot-select"
                : values.includes("human") || values.includes("bot")
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
}));

const LAST_CONFIG_KEY_HVB = "yovi:lastGameConfig";
const LAST_CONFIG_KEY_HVH = "yovi:lastGameConfigHvh";

function metaOk() {
    getMetaMock.mockResolvedValue({
        api_version: "v1",
        min_board_size: 2,
        max_board_size: 15,
        bots: ["random_bot", "mcts_bot"],
    });
}

describe("Home", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        getMetaMock.mockReset();
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("renderiza el AppHeader con el título YOVI", async () => {
        metaOk();

        render(<Home />);

        expect(await screen.findByTestId("app-header")).toHaveTextContent("YOVI");
    });

    it("renderiza valores por defecto", async () => {
        metaOk();

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect((sizeInputs[1] as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(hvbStarterSelect.value).toBe("human");
        expect(hvhStarterSelect.value).toBe("player0");
    });

    it("carga la configuración previa de HvB desde localStorage y la refleja en la UI", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 9, botId: "mcts_bot", hvbstarter: "bot" }),
        );

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("9");
        expect((sizeInputs[1] as HTMLInputElement).value).toBe("9");
        expect(botSelect.value).toBe("mcts_bot");
        expect(hvbStarterSelect.value).toBe("bot");
    });

    it("carga la configuración previa de HvH desde localStorage", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVH,
            JSON.stringify({ size: 8, hvhstarter: "player1" }),
        );

        render(<Home />);

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

        render(<Home />);

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

        render(<Home />);

        const botSelect = await screen.findByLabelText("bot-select");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select");

        await user.selectOptions(botSelect, "mcts_bot");
        await user.selectOptions(hvbStarterSelect, "bot");

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

        render(<Home />);

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        await user.selectOptions(hvhStarterSelect, "player1");

        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVH,
            expect.stringContaining('"hvhstarter":"player1"'),
        );
    });

    it("permite cambiar bot/hvbstarter y navega a /game-hvb con query completa", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 5, botId: "random_bot", hvbstarter: "human" }),
        );

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        render(<Home />);

        const botSelect = await screen.findByLabelText("bot-select");
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select");

        await user.selectOptions(botSelect, "mcts_bot");
        await user.selectOptions(hvbStarterSelect, "bot");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        expect(navigateMock).toHaveBeenCalledWith(
            "/game-hvb?size=5&bot=mcts_bot&hvbstarter=bot",
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

        render(<Home />);

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        await user.selectOptions(hvhStarterSelect, "player1");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[1]);

        expect(navigateMock).toHaveBeenCalledWith("/game-hvh?size=7&hvhstarter=player1");
        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY_HVH,
            expect.stringContaining('"hvhstarter":"player1"'),
        );
    });

    it("si InputNumber onChange recibe null, usa 7", async () => {
        getMetaMock.mockResolvedValue({
            api_version: "v1",
            min_board_size: 3,
            max_board_size: 15,
            bots: ["random_bot", "mcts_bot"],
        });

        const user = userEvent.setup();
        render(<Home />);

        const nonNumberButtons = await screen.findAllByLabelText("size-non-number");
        await user.click(nonNumberButtons[0]);

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

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
        render(<Home />);

        await screen.findByLabelText("bot-select");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        expect(navigateMock).toHaveBeenCalledWith(
            "/game-hvb?size=4&bot=random_bot&hvbstarter=human",
        );
    });

    it("si getMeta falla, usa valores por defecto", async () => {
        getMetaMock.mockRejectedValue(new Error("boom"));

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        expect((sizeInputs[0] as HTMLInputElement).getAttribute("min")).toBe("2");
        expect((sizeInputs[0] as HTMLInputElement).getAttribute("max")).toBe("15");
    });

    it("si localStorage tiene JSON inválido, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(LAST_CONFIG_KEY_HVB, "{NOT_JSON");
        localStorage.setItem(LAST_CONFIG_KEY_HVH, "{NOT_JSON");

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;
        const hvhStarterSelect = screen.getByLabelText("hvh-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(hvbStarterSelect.value).toBe("human");
        expect(hvhStarterSelect.value).toBe("player0");
    });

    it("si localStorage tiene campos inválidos en HvB, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: "7", botId: "mcts_bot", hvbstarter: "bot" }),
        );

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(hvbStarterSelect.value).toBe("human");
    });

    it("si localStorage tiene hvbstarter inválido, ignora y mantiene defaults", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVB,
            JSON.stringify({ size: 9, botId: "mcts_bot", hvbstarter: "alien" }),
        );

        render(<Home />);

        const sizeInputs = await screen.findAllByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const hvbStarterSelect = screen.getByLabelText("hvb-starter-select") as HTMLSelectElement;

        expect((sizeInputs[0] as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(hvbStarterSelect.value).toBe("human");
    });

    it("si localStorage tiene hvhstarter inválido, ignora y mantiene defaults de HvH", async () => {
        metaOk();

        localStorage.setItem(
            LAST_CONFIG_KEY_HVH,
            JSON.stringify({ size: 9, hvhstarter: "alien" }),
        );

        render(<Home />);

        const hvhStarterSelect = await screen.findByLabelText("hvh-starter-select");
        expect((hvhStarterSelect as HTMLSelectElement).value).toBe("player0");
    });

    it("si saveLastConfig falla, Home no revienta al pulsar Jugar", async () => {
        metaOk();

        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });

        const user = userEvent.setup();
        render(<Home />);

        await screen.findByLabelText("bot-select");

        const playButtons = screen.getAllByRole("button", { name: "Jugar" });
        await user.click(playButtons[0]);

        expect(navigateMock).toHaveBeenCalled();
    });

    it("renderiza el bloque de estadísticas", async () => {
        metaOk();

        render(<Home />);

        await waitFor(() => {
            expect(screen.getByText("Estadísticas")).toBeInTheDocument();
            expect(screen.getByText("Sin implementar todavía")).toBeInTheDocument();
        });
    });
});