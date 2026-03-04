import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../vistas/Home.tsx";

const navigateMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

const getGameConfigMock = vi.fn();

vi.mock("../api/gamey", () => ({
    getGameConfig: () => getGameConfigMock(),
}));

vi.mock("antd", () => ({
    App: {
        useApp: () => ({
            modal: { confirm: confirmMock },
        }),
    },
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
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
            <button type="button" onClick={() => onChange(null)} aria-label="size-non-number">
                non-number
            </button>
        </div>
    ),

    Select: ({ value, onChange, options }: any) => {
        const isBotSelect = Array.isArray(options) && options.some((o: any) => o?.value === "random_bot");
        const aria = isBotSelect ? "bot-select" : "starter-select";

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
    LogoutOutlined: () => null,
    PlayCircleOutlined: () => null,
    RobotOutlined: () => null,
    TeamOutlined: () => null,
    UserOutlined: () => null,
}));

const LAST_CONFIG_KEY = "yovi:lastGameConfig";

describe("Home", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
        getGameConfigMock.mockReset();

        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("carga la configuración previa desde localStorage y la muestra en la UI", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        localStorage.setItem(
            LAST_CONFIG_KEY,
            JSON.stringify({ size: 9, botId: "mcts_bot", starter: "bot" })
        );

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const starterSelect = screen.getByLabelText("starter-select") as HTMLSelectElement;

        expect((sizeInput as HTMLInputElement).value).toBe("9");
        expect(botSelect.value).toBe("mcts_bot");
        expect(starterSelect.value).toBe("bot");
    });

    it("clampa el size al rango devuelto por getGameConfig (cubre rama clamped !== prev)", async () => {
        localStorage.setItem(
            LAST_CONFIG_KEY,
            JSON.stringify({ size: 12, botId: "random_bot", starter: "human" })
        );

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 8 });

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        expect((sizeInput as HTMLInputElement).value).toBe("8");

        expect(setItemSpy).toHaveBeenCalled();
    });

    it("renderiza por defecto, permite cambiar size/bot/starter y navega a /game con query completa al pulsar Jugar (y guarda en localStorage)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

        const user = userEvent.setup();
        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input") as HTMLInputElement;
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const starterSelect = screen.getByLabelText("starter-select") as HTMLSelectElement;

        expect(sizeInput.value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(starterSelect.value).toBe("human");

        await user.clear(sizeInput);
        await user.type(sizeInput, "5");
        await user.selectOptions(botSelect, "mcts_bot");
        await user.selectOptions(starterSelect, "bot");

        await user.click(screen.getByRole("button", { name: "Jugar" }));

        expect(navigateMock).toHaveBeenCalledTimes(1);
        expect(String(navigateMock.mock.calls[0][0])).toBe("/game?size=5&bot=mcts_bot&starter=bot");

        expect(setItemSpy).toHaveBeenCalledWith(
            LAST_CONFIG_KEY,
            expect.stringContaining('"size":5')
        );
    });

    it("al pulsar 'Cerrar sesión' abre modal.confirm y al confirmar navega a '/' con replace", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];

        expect(args.title).toBe("Cerrar sesión");
        expect(args.okText).toBe("Sí, salir");
        expect(args.cancelText).toBe("Cancelar");

        args.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });

    it("si InputNumber onChange recibe null, usa min_board_size como fallback (y navega con ese size)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 3, max_board_size: 15 });

        const user = userEvent.setup();
        render(<Home />);

        await screen.findByLabelText("size-input");

        await user.click(screen.getByLabelText("size-non-number"));

        await user.click(screen.getByRole("button", { name: "Jugar" }));

        expect(String(navigateMock.mock.calls[0][0])).toContain("size=3");
    });
    
    it("si getGameConfig falla, usa valores por defecto (cubre catch)", async () => {
        getGameConfigMock.mockRejectedValue(new Error("boom"));

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        expect((sizeInput as HTMLInputElement).getAttribute("min")).toBe("2");
    });

    it("si localStorage tiene JSON inválido, ignora y mantiene defaults (cubre catch de loadLastConfig)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        localStorage.setItem("yovi:lastGameConfig", "{NOT_JSON");

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const starterSelect = screen.getByLabelText("starter-select") as HTMLSelectElement;

        expect((sizeInput as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(starterSelect.value).toBe("human");
    });

    it("si localStorage tiene campos inválidos, ignora y mantiene defaults (cubre returns null por validación)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        localStorage.setItem("yovi:lastGameConfig", JSON.stringify({ size: "7", botId: "mcts_bot", starter: "bot" }));

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const starterSelect = screen.getByLabelText("starter-select") as HTMLSelectElement;

        expect((sizeInput as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(starterSelect.value).toBe("human");
    });

    it("si localStorage tiene starter inválido, ignora y mantiene defaults (cubre rama starter !== human/bot)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        localStorage.setItem(
            "yovi:lastGameConfig",
            JSON.stringify({ size: 9, botId: "mcts_bot", starter: "alien" })
        );

        render(<Home />);

        const sizeInput = await screen.findByLabelText("size-input");
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;
        const starterSelect = screen.getByLabelText("starter-select") as HTMLSelectElement;

        expect((sizeInput as HTMLInputElement).value).toBe("7");
        expect(botSelect.value).toBe("random_bot");
        expect(starterSelect.value).toBe("human");
    });

    it("si saveLastConfig falla (localStorage.setItem lanza), Home no revienta al pulsar Jugar (cubre catch de saveLastConfig)", async () => {
        getGameConfigMock.mockResolvedValue({ min_board_size: 2, max_board_size: 15 });

        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });

        const user = userEvent.setup();
        render(<Home />);

        await screen.findByLabelText("size-input");

        await user.click(screen.getByRole("button", { name: "Jugar" }));

        expect(navigateMock).toHaveBeenCalled();
    });
});